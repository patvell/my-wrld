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

interface FlightsResponse {
  flights?: AeroFlight[];
}

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

/**
 * Fetch recent/scheduled flights for an ICAO ident (e.g. "UAE123").
 * Optionally bound by ISO date(s) to narrow to the flight of interest.
 */
export async function getFlightsByIdent(
  ident: string,
  opts: { start?: string; end?: string } = {},
): Promise<AeroFlight[]> {
  const params: Record<string, string> = {};
  if (opts.start) params.start = opts.start;
  if (opts.end) params.end = opts.end;
  const data = await aeroFetch<FlightsResponse>(`/flights/${encodeURIComponent(ident)}`, params);
  return data.flights ?? [];
}
