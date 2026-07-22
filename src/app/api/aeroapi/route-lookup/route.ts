import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getFlightsBetweenAirports,
  getSchedules,
  isAeroApiConfigured,
  AeroApiError,
  type AeroFlight,
  type AeroSchedule,
} from "@/lib/aeroapi";
import { getCached, setCached, LOOKUP_TTL_MS } from "@/lib/aeroCache";
import {
  daySpan,
  mapAeroFlightToInput,
  mapAeroScheduleToInput,
} from "@/lib/aeroMapper";
import { FLIGHTAWARE_CARRIER, AIRLINE_CODE } from "@/lib/config";
import { AIRPORTS } from "@/data/airports";
import type { FlightInput } from "@/types";

const querySchema = z.object({
  origin: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .transform((s) => s.toUpperCase()),
  destination: z
    .string()
    .length(3)
    .regex(/^[A-Za-z]{3}$/)
    .transform((s) => s.toUpperCase()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

export interface RouteOption {
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  day_span: number;
  fa_flight_id?: string | null;
  flight: FlightInput;
}

interface RouteLookupResult {
  configured: boolean;
  found: boolean;
  flights?: RouteOption[];
}

/** Short TTL for empty results so a failed probe does not block retries for 12h. */
const EMPTY_ROUTE_TTL_MS = 2 * 60 * 1000;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isEmiratesIdent(ident: string | null | undefined, identIata?: string | null): boolean {
  const a = (ident ?? "").toUpperCase();
  const b = (identIata ?? "").toUpperCase();
  return a.startsWith("UAE") || b.startsWith(AIRLINE_CODE);
}

function optionFromSchedule(s: AeroSchedule, date: string): RouteOption | null {
  const mapped = mapAeroScheduleToInput(s);
  if (!mapped) return null;
  if (mapped.departure_time.slice(0, 10) !== date) return null;
  return {
    flight_number: mapped.flight_number ?? "",
    departure_time: mapped.departure_time,
    arrival_time: mapped.arrival_time,
    day_span: daySpan(mapped.departure_time, mapped.arrival_time),
    fa_flight_id: s.fa_flight_id ?? null,
    flight: mapped,
  };
}

function optionFromFlight(f: AeroFlight, date: string): RouteOption | null {
  const mapped = mapAeroFlightToInput(f);
  if (!mapped) return null;
  if (mapped.departure_time.slice(0, 10) !== date) return null;
  if (!isEmiratesIdent(f.ident, f.ident_iata)) return null;
  return {
    flight_number: mapped.flight_number ?? "",
    departure_time: mapped.departure_time,
    arrival_time: mapped.arrival_time,
    day_span: daySpan(mapped.departure_time, mapped.arrival_time),
    fa_flight_id: f.fa_flight_id ?? null,
    flight: mapped,
  };
}

function dedupeSort(options: RouteOption[]): RouteOption[] {
  const seen = new Set<string>();
  const out: RouteOption[] = [];
  for (const opt of options) {
    const key = `${opt.flight_number}:${opt.departure_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(opt);
  }
  out.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
  return out;
}

async function schedulesForRoute(
  origin: string,
  destination: string,
  date: string,
): Promise<AeroSchedule[]> {
  // 1) Explicit route + airline filter
  let rows = await getSchedules(date, addDays(date, 1), {
    airline: FLIGHTAWARE_CARRIER,
    origin,
    destination,
    max_pages: 3,
  });
  if (rows.length > 0) return rows;

  // 2) Airline-only for the day, filter client-side (IATA origin/dest filters
  //    are unreliable on some AeroAPI tiers / code formats).
  rows = await getSchedules(date, addDays(date, 1), {
    airline: FLIGHTAWARE_CARRIER,
    max_pages: 5,
  });
  return rows.filter(
    (s) =>
      s.origin_iata.toUpperCase() === origin &&
      s.destination_iata.toUpperCase() === destination,
  );
}

export async function GET(request: Request) {
  if (!isAeroApiConfigured()) {
    return NextResponse.json({ configured: false, found: false } satisfies RouteLookupResult);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    origin: url.searchParams.get("origin") ?? "",
    destination: url.searchParams.get("destination") ?? "",
    date: url.searchParams.get("date") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid route lookup", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { origin, destination, date } = parsed.data;
  if (!AIRPORTS[origin] || !AIRPORTS[destination]) {
    return NextResponse.json({ error: "Unknown airport code" }, { status: 400 });
  }
  if (origin === destination) {
    return NextResponse.json(
      { error: "Origin and destination must differ" },
      { status: 400 },
    );
  }

  const cacheKey = `route:v2:${origin}:${destination}:${date}`;

  try {
    const cached = await getCached<RouteLookupResult>(cacheKey, LOOKUP_TTL_MS);
    if (cached?.found) return NextResponse.json(cached);
    // Re-check empty cache with short TTL
    if (cached && !cached.found) {
      const emptyCached = await getCached<RouteLookupResult>(cacheKey, EMPTY_ROUTE_TTL_MS);
      if (emptyCached) return NextResponse.json(emptyCached);
    }

    const options: RouteOption[] = [];

    const schedules = await schedulesForRoute(origin, destination, date);
    for (const s of schedules) {
      const opt = optionFromSchedule(s, date);
      if (opt) options.push(opt);
    }

    // Fallback: airport-pair operational/scheduled flights (near-term).
    if (options.length === 0) {
      try {
        const flights = await getFlightsBetweenAirports(origin, destination, {
          start: date,
          end: addDays(date, 1),
          airline: FLIGHTAWARE_CARRIER,
          max_pages: 3,
        });
        for (const f of flights) {
          const opt = optionFromFlight(f, date);
          if (opt) options.push(opt);
        }
      } catch (err) {
        console.warn("Route lookup airport-pair fallback failed:", err);
      }
    }

    const sorted = dedupeSort(options);
    const result: RouteLookupResult =
      sorted.length > 0
        ? { configured: true, found: true, flights: sorted }
        : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI route lookup failed:", error);
    return NextResponse.json({ error: "Route lookup failed" }, { status });
  }
}
