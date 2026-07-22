import { NextResponse } from "next/server";
import { z } from "zod";
import { getSchedules, isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";
import { getCached, setCached, LOOKUP_TTL_MS } from "@/lib/aeroCache";
import { daySpan, mapAeroScheduleToInput } from "@/lib/aeroMapper";
import { FLIGHTAWARE_CARRIER } from "@/lib/config";
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

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
    return NextResponse.json(
      { error: "Unknown airport code" },
      { status: 400 },
    );
  }
  if (origin === destination) {
    return NextResponse.json(
      { error: "Origin and destination must differ" },
      { status: 400 },
    );
  }

  const cacheKey = `route:${origin}:${destination}:${date}`;

  try {
    const cached = await getCached<RouteLookupResult>(cacheKey, LOOKUP_TTL_MS);
    if (cached) return NextResponse.json(cached);

    const schedules = await getSchedules(date, addDays(date, 1), {
      airline: FLIGHTAWARE_CARRIER,
      origin,
      destination,
      max_pages: 3,
    });

    const filtered = schedules.filter(
      (s) =>
        s.origin_iata.toUpperCase() === origin &&
        s.destination_iata.toUpperCase() === destination,
    );

    const options: RouteOption[] = [];
    const seen = new Set<string>();

    for (const s of filtered) {
      const mapped = mapAeroScheduleToInput(s);
      if (!mapped) continue;
      // Keep options whose local departure date matches the requested day.
      if (mapped.departure_time.slice(0, 10) !== date) continue;
      const key = `${mapped.flight_number}:${mapped.departure_time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        flight_number: mapped.flight_number ?? "",
        departure_time: mapped.departure_time,
        arrival_time: mapped.arrival_time,
        day_span: daySpan(mapped.departure_time, mapped.arrival_time),
        fa_flight_id: s.fa_flight_id ?? null,
        flight: mapped,
      });
    }

    options.sort((a, b) => a.departure_time.localeCompare(b.departure_time));

    const result: RouteLookupResult =
      options.length > 0
        ? { configured: true, found: true, flights: options }
        : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI route lookup failed:", error);
    return NextResponse.json({ error: "Route lookup failed" }, { status });
  }
}
