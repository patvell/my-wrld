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
  /**
   * True when results come from a near-term reference day because the
   * requested date is outside what schedules/FindFlight can serve (or that
   * day returned nothing). Clients should keep the user's entered date.
   */
  date_relaxed?: boolean;
  /** Calendar day actually queried when `date_relaxed` is true. */
  reference_date?: string;
}

/** Short TTL for empty results so a failed probe does not block retries for 12h. */
const EMPTY_ROUTE_TTL_MS = 2 * 60 * 1000;

/** Prefer the user's date only when it falls in this near-term window. */
const NEAR_SCHEDULE_DAYS = 14;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isNearTermDate(date: string, today: string): boolean {
  const start = addDays(today, -1);
  const end = addDays(today, NEAR_SCHEDULE_DAYS);
  return date >= start && date <= end;
}

/** Near-term day used to discover typical EK flight numbers + times. */
function referenceScheduleDate(today: string): string {
  return addDays(today, 1);
}

function isEmiratesIdent(ident: string | null | undefined, identIata?: string | null): boolean {
  const a = (ident ?? "").toUpperCase();
  const b = (identIata ?? "").toUpperCase();
  return a.startsWith("UAE") || b.startsWith(AIRLINE_CODE);
}

function optionFromSchedule(s: AeroSchedule, searchDate: string): RouteOption | null {
  const mapped = mapAeroScheduleToInput(s);
  if (!mapped) return null;
  const depDay = mapped.departure_time.slice(0, 10);
  // Accept overnight services that land on the next local calendar day.
  if (depDay !== searchDate && depDay !== addDays(searchDate, 1)) return null;
  return {
    flight_number: mapped.flight_number ?? "",
    departure_time: mapped.departure_time,
    arrival_time: mapped.arrival_time,
    day_span: daySpan(mapped.departure_time, mapped.arrival_time),
    fa_flight_id: s.fa_flight_id ?? null,
    flight: mapped,
  };
}

function optionFromFlight(f: AeroFlight, searchDate: string): RouteOption | null {
  const mapped = mapAeroFlightToInput(f);
  if (!mapped) return null;
  const depDay = mapped.departure_time.slice(0, 10);
  if (depDay !== searchDate && depDay !== addDays(searchDate, 1)) return null;
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
  // One option per EK number — schedules + FindFlight often disagree by a few
  // minutes; keep the earliest departure for that service.
  const byNumber = new Map<string, RouteOption>();
  const sorted = [...options].sort((a, b) =>
    a.departure_time.localeCompare(b.departure_time),
  );
  for (const opt of sorted) {
    const key = opt.flight_number;
    if (!key || byNumber.has(key)) continue;
    byNumber.set(key, opt);
  }
  // Sort by local clock time so overnight early services (EK007 ~02:30) lead.
  return [...byNumber.values()].sort((a, b) =>
    a.departure_time.slice(11, 16).localeCompare(b.departure_time.slice(11, 16)),
  );
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
    max_pages: 1,
  });
  if (rows.length > 0) return rows;

  // 2) Airline-only for the day, filter client-side (IATA origin/dest filters
  //    are unreliable on some AeroAPI tiers / code formats).
  rows = await getSchedules(date, addDays(date, 1), {
    airline: FLIGHTAWARE_CARRIER,
    max_pages: 1,
  });
  return rows.filter(
    (s) =>
      s.origin_iata.toUpperCase() === origin &&
      s.destination_iata.toUpperCase() === destination,
  );
}

async function collectRouteOptions(
  origin: string,
  destination: string,
  searchDate: string,
): Promise<RouteOption[]> {
  const options: RouteOption[] = [];

  try {
    const schedules = await schedulesForRoute(origin, destination, searchDate);
    for (const s of schedules) {
      const opt = optionFromSchedule(s, searchDate);
      if (opt) options.push(opt);
    }
  } catch (err) {
    console.warn("Route lookup schedules failed:", err);
  }

  // Always merge FindFlight — catches overnight services (e.g. EK7 ~02:15)
  // that /schedules may place on the adjacent UTC day. No airline query param
  // (AeroAPI rejects it on this endpoint).
  try {
    const flights = await getFlightsBetweenAirports(origin, destination, {
      start: searchDate,
      end: addDays(searchDate, 1),
      max_pages: 1,
    });
    for (const f of flights) {
      const opt = optionFromFlight(f, searchDate);
      if (opt) options.push(opt);
    }
  } catch (err) {
    console.warn("Route lookup airport-pair fallback failed:", err);
  }

  return dedupeSort(options);
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

  const cacheKey = `route:v6:${origin}:${destination}:${date}`;

  try {
    const cached = await getCached<RouteLookupResult>(cacheKey, LOOKUP_TTL_MS);
    if (cached?.found) return NextResponse.json(cached);
    // Re-check empty cache with short TTL
    if (cached && !cached.found) {
      const emptyCached = await getCached<RouteLookupResult>(cacheKey, EMPTY_ROUTE_TTL_MS);
      if (emptyCached) return NextResponse.json(emptyCached);
    }

    const today = todayUtc();
    let sorted: RouteOption[] = [];
    let dateRelaxed = false;
    let referenceDate: string | undefined;

    // Near-term: try the user's date first.
    if (isNearTermDate(date, today)) {
      sorted = await collectRouteOptions(origin, destination, date);
    }

    // Far-future / empty: use a reference day for typical EK number + times.
    // Do not require the sample departure date to equal the user's date.
    if (sorted.length === 0) {
      const ref = referenceScheduleDate(today);
      if (ref !== date) {
        sorted = await collectRouteOptions(origin, destination, ref);
        if (sorted.length > 0) {
          dateRelaxed = true;
          referenceDate = ref;
        }
      }
    }

    const result: RouteLookupResult =
      sorted.length > 0
        ? {
            configured: true,
            found: true,
            flights: sorted,
            ...(dateRelaxed
              ? { date_relaxed: true, reference_date: referenceDate }
              : {}),
          }
        : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI route lookup failed:", error);
    return NextResponse.json({ error: "Route lookup failed" }, { status });
  }
}
