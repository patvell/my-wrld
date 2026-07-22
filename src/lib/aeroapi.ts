/**
 * Server-only client for FlightAware AeroAPI.
 *
 * IMPORTANT: only import this from server code (route handlers). It reads the
 * `FLIGHTAWARE_API_KEY` secret and must never be bundled into the browser.
 * Calls default to `max_pages=1` to stay within the Personal tier and control
 * per-result-set billing; callers add caching on top (see `aeroCache.ts`).
 */

const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";

export interface AeroAirport {
  code_iata?: string | null;
  code_icao?: string | null;
  timezone?: string | null;
  name?: string | null;
  city?: string | null;
}

export interface AeroFlight {
  ident: string;
  ident_iata?: string | null;
  fa_flight_id: string;
  operator?: string | null;
  aircraft_type?: string | null;
  registration?: string | null;
  origin: AeroAirport | null;
  destination: AeroAirport | null;
  scheduled_out?: string | null;
  estimated_out?: string | null;
  actual_out?: string | null;
  scheduled_off?: string | null;
  estimated_off?: string | null;
  actual_off?: string | null;
  scheduled_on?: string | null;
  estimated_on?: string | null;
  actual_on?: string | null;
  scheduled_in?: string | null;
  estimated_in?: string | null;
  actual_in?: string | null;
  status?: string | null;
  progress_percent?: number | null;
  departure_delay?: number | null;
  arrival_delay?: number | null;
  gate_origin?: string | null;
  gate_destination?: string | null;
  terminal_origin?: string | null;
  terminal_destination?: string | null;
  cancelled?: boolean | null;
}

/** Published airline schedule row (normalized from /schedules). */
export interface AeroSchedule {
  ident: string;
  ident_iata?: string | null;
  fa_flight_id?: string | null;
  origin_iata: string;
  destination_iata: string;
  origin_timezone?: string | null;
  destination_timezone?: string | null;
  scheduled_out: string;
  scheduled_in: string;
}

interface FlightsResponse {
  flights?: AeroFlight[];
}

interface SchedulesResponse {
  scheduled?: Array<{
    ident: string;
    ident_iata?: string | null;
    fa_flight_id?: string | null;
    origin?: AeroAirport | null;
    destination?: AeroAirport | null;
    scheduled_out?: string | null;
    scheduled_in?: string | null;
  }>;
}

export type AeroIdentType = "designator" | "registration" | "fa_flight_id";

export class AeroApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AeroApiError";
    this.status = status;
  }
}

/** Whether an AeroAPI key is present in the environment. */
export function isAeroApiConfigured(): boolean {
  return Boolean(process.env.FLIGHTAWARE_API_KEY);
}

async function aeroFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) {
    throw new AeroApiError("AeroAPI is not configured");
  }

  const url = new URL(`${BASE_URL}${path}`);
  // Default to a single result set to cap billing/rate usage.
  if (!("max_pages" in params)) url.searchParams.set("max_pages", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { "x-apikey": apiKey, Accept: "application/json" },
    // Never let Next cache an authenticated upstream response implicitly.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AeroApiError(`AeroAPI request failed (${res.status}): ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

function normalizeSchedule(row: NonNullable<SchedulesResponse["scheduled"]>[number]): AeroSchedule | null {
  const origin_iata = row.origin?.code_iata;
  const destination_iata = row.destination?.code_iata;
  const scheduled_out = row.scheduled_out;
  const scheduled_in = row.scheduled_in;
  if (!origin_iata || !destination_iata || !scheduled_out || !scheduled_in) return null;
  return {
    ident: row.ident,
    ident_iata: row.ident_iata,
    fa_flight_id: row.fa_flight_id,
    origin_iata,
    destination_iata,
    origin_timezone: row.origin?.timezone,
    destination_timezone: row.destination?.timezone,
    scheduled_out,
    scheduled_in,
  };
}

/**
 * Fetch recent/scheduled flights for an ICAO ident (e.g. "UAE123").
 * Optionally bound by ISO date(s) to narrow to the flight of interest.
 */
export async function getFlightsByIdent(
  ident: string,
  opts: { start?: string; end?: string; ident_type?: AeroIdentType } = {},
): Promise<AeroFlight[]> {
  const params: Record<string, string> = {};
  if (opts.start) params.start = opts.start;
  if (opts.end) params.end = opts.end;
  if (opts.ident_type) params.ident_type = opts.ident_type;
  const data = await aeroFetch<FlightsResponse>(`/flights/${encodeURIComponent(ident)}`, params);
  return data.flights ?? [];
}

/** Fetch a single flight by its FlightAware flight id. */
export async function getFlightByFaId(faFlightId: string): Promise<AeroFlight | null> {
  const flights = await getFlightsByIdent(faFlightId, { ident_type: "fa_flight_id" });
  return flights[0] ?? null;
}

/** Fetch historical flights for an ident within a date range (max 7-day span). */
export async function getHistoricalFlightsByIdent(
  ident: string,
  opts: { start: string; end: string },
): Promise<AeroFlight[]> {
  const params: Record<string, string> = {
    start: opts.start,
    end: opts.end,
  };
  const data = await aeroFetch<FlightsResponse>(
    `/history/flights/${encodeURIComponent(ident)}`,
    params,
  );
  return data.flights ?? [];
}

/** Fetch published airline schedules for a date range, optionally filtered by carrier/route. */
export async function getSchedules(
  dateStart: string,
  dateEnd: string,
  opts: {
    airline?: string;
    flight_number?: string;
    origin?: string;
    destination?: string;
    max_pages?: number;
  } = {},
): Promise<AeroSchedule[]> {
  const params: Record<string, string> = {};
  if (opts.airline) params.airline = opts.airline;
  if (opts.flight_number) params.flight_number = opts.flight_number;
  if (opts.origin) params.origin = opts.origin;
  if (opts.destination) params.destination = opts.destination;
  if (opts.max_pages != null) params.max_pages = String(opts.max_pages);
  const data = await aeroFetch<SchedulesResponse>(
    `/schedules/${dateStart}/${dateEnd}`,
    params,
  );
  return (data.scheduled ?? []).map(normalizeSchedule).filter((s): s is AeroSchedule => s !== null);
}

/**
 * Flights between two airports (FindFlight). Accepts IATA or ICAO airport ids.
 * Useful as a route-lookup fallback when /schedules returns nothing for IATA filters.
 */
export async function getFlightsBetweenAirports(
  origin: string,
  destination: string,
  opts: { start?: string; end?: string; max_pages?: number; airline?: string } = {},
): Promise<AeroFlight[]> {
  const params: Record<string, string> = {};
  if (opts.start) params.start = opts.start;
  if (opts.end) params.end = opts.end;
  if (opts.max_pages != null) params.max_pages = String(opts.max_pages);
  if (opts.airline) params.airline = opts.airline;
  const data = await aeroFetch<FlightsResponse>(
    `/airports/${encodeURIComponent(origin)}/flights/to/${encodeURIComponent(destination)}`,
    params,
  );
  return data.flights ?? [];
}
