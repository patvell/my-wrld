import type { AeroFlight, AeroSchedule } from "@/lib/aeroapi";
import { FlightInput } from "@/types";
import { AIRPORTS, getAirportTimezone } from "@/data/airports";
import { instantToWallClockTz } from "@/lib/time";
import { AIRLINE_CODE, formatFlightDigits } from "@/lib/config";

/**
 * Pure mapping helpers from AeroAPI flight objects to the app's model.
 * Kept free of any network/server imports so they are easy to unit test.
 */

function bestDeparture(f: AeroFlight): string | null {
  return f.scheduled_out ?? f.estimated_out ?? f.actual_out ?? f.scheduled_off ?? null;
}

function bestArrival(f: AeroFlight): string | null {
  return f.scheduled_in ?? f.estimated_in ?? f.actual_in ?? f.scheduled_on ?? null;
}

function flightNumberFrom(f: AeroFlight): string {
  const raw = f.ident_iata ?? `${AIRLINE_CODE}${(f.ident ?? "").replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  return `${AIRLINE_CODE}${formatFlightDigits(digits)}`;
}

/**
 * Number of calendar days the arrival wall-clock falls after the departure
 * wall-clock (0 = same day, 1 = lands the next day, etc). Used to preserve an
 * overnight span when the user moves the trip to a different departure date.
 */
export function daySpan(departureWallClock: string, arrivalWallClock: string): number {
  const dep = Date.parse(`${departureWallClock.slice(0, 10)}T00:00:00Z`);
  const arr = Date.parse(`${arrivalWallClock.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(dep) || Number.isNaN(arr)) return 0;
  return Math.round((arr - dep) / 86_400_000);
}

/**
 * Choose the AeroAPI flight whose scheduled departure (local date) matches the
 * requested date (YYYY-MM-DD). Falls back to the closest by departure instant.
 */
export function pickFlightForDate(flights: AeroFlight[], date: string): AeroFlight | null {
  if (flights.length === 0) return null;

  const withDep = flights.filter((f) => bestDeparture(f));
  if (withDep.length === 0) return flights[0];

  const exact = withDep.find((f) => {
    const dep = bestDeparture(f)!;
    const tz = f.origin?.timezone ?? getAirportTimezone(f.origin?.code_iata ?? "");
    return instantToWallClockTz(dep, tz).slice(0, 10) === date;
  });
  if (exact) return exact;

  const target = Date.parse(`${date}T12:00:00Z`);
  return withDep.reduce((closest, f) => {
    const diff = Math.abs(Date.parse(bestDeparture(f)!) - target);
    const best = Math.abs(Date.parse(bestDeparture(closest)!) - target);
    return diff < best ? f : closest;
  });
}

/**
 * Map an AeroAPI flight to a FlightInput (origin/destination + canonical
 * wall-clock times). Returns null if essential fields (IATA codes, times) are
 * missing. Leaves status/type to the caller.
 */
/**
 * Choose the published schedule whose local departure date matches the
 * requested date (YYYY-MM-DD). Falls back to the closest by departure instant.
 */
export function pickScheduleForDate(schedules: AeroSchedule[], date: string): AeroSchedule | null {
  if (schedules.length === 0) return null;

  const exact = schedules.find((s) => {
    const tz = s.origin_timezone ?? getAirportTimezone(s.origin_iata);
    return instantToWallClockTz(s.scheduled_out, tz).slice(0, 10) === date;
  });
  if (exact) return exact;

  const target = Date.parse(`${date}T12:00:00Z`);
  return schedules.reduce((closest, s) => {
    const tz = s.origin_timezone ?? getAirportTimezone(s.origin_iata);
    const dep = Date.parse(instantToWallClockTz(s.scheduled_out, tz));
    const best = Date.parse(instantToWallClockTz(closest.scheduled_out, closest.origin_timezone ?? getAirportTimezone(closest.origin_iata)));
    return Math.abs(dep - target) < Math.abs(best - target) ? s : closest;
  });
}

function scheduleFlightNumber(s: AeroSchedule): string {
  const raw = s.ident_iata ?? `${AIRLINE_CODE}${(s.ident ?? "").replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  return `${AIRLINE_CODE}${formatFlightDigits(digits)}`;
}

/** Map a published schedule row to FlightInput using AIRPORTS for city names. */
export function mapAeroScheduleToInput(s: AeroSchedule): FlightInput | null {
  const originTz = s.origin_timezone ?? getAirportTimezone(s.origin_iata);
  const destTz = s.destination_timezone ?? getAirportTimezone(s.destination_iata);

  return {
    origin_code: s.origin_iata,
    origin_city: AIRPORTS[s.origin_iata]?.city ?? s.origin_iata,
    destination_code: s.destination_iata,
    destination_city: AIRPORTS[s.destination_iata]?.city ?? s.destination_iata,
    departure_time: instantToWallClockTz(s.scheduled_out, originTz),
    arrival_time: instantToWallClockTz(s.scheduled_in, destTz),
    flight_number: scheduleFlightNumber(s),
  };
}

export function mapAeroFlightToInput(f: AeroFlight): FlightInput | null {
  const originCode = f.origin?.code_iata;
  const destCode = f.destination?.code_iata;
  const dep = bestDeparture(f);
  const arr = bestArrival(f);
  if (!originCode || !destCode || !dep || !arr) return null;

  const originTz = f.origin?.timezone ?? getAirportTimezone(originCode);
  const destTz = f.destination?.timezone ?? getAirportTimezone(destCode);

  return {
    origin_code: originCode,
    origin_city: f.origin?.city ?? originCode,
    destination_code: destCode,
    destination_city: f.destination?.city ?? destCode,
    departure_time: instantToWallClockTz(dep, originTz),
    arrival_time: instantToWallClockTz(arr, destTz),
    flight_number: flightNumberFrom(f),
  };
}

export interface LiveStatus {
  fa_flight_id: string;
  status: string | null;
  progress_percent: number | null;
  cancelled: boolean;
  departure_delay_min: number | null;
  arrival_delay_min: number | null;
  estimated_out: string | null;
  actual_out: string | null;
  estimated_in: string | null;
  actual_in: string | null;
  gate_origin: string | null;
  gate_destination: string | null;
  terminal_origin: string | null;
  terminal_destination: string | null;
}

/** Map an AeroAPI flight to the compact live-status payload used by boarding passes. */
export function mapAeroFlightToStatus(f: AeroFlight): LiveStatus {
  const originTz = f.origin?.timezone ?? getAirportTimezone(f.origin?.code_iata ?? "");
  const destTz = f.destination?.timezone ?? getAirportTimezone(f.destination?.code_iata ?? "");
  const toLocal = (v: string | null | undefined, tz: string) =>
    v ? instantToWallClockTz(v, tz) : null;

  return {
    fa_flight_id: f.fa_flight_id,
    status: f.status ?? null,
    progress_percent: f.progress_percent ?? null,
    cancelled: Boolean(f.cancelled),
    departure_delay_min: f.departure_delay != null ? Math.round(f.departure_delay / 60) : null,
    arrival_delay_min: f.arrival_delay != null ? Math.round(f.arrival_delay / 60) : null,
    estimated_out: toLocal(f.estimated_out, originTz),
    actual_out: toLocal(f.actual_out, originTz),
    estimated_in: toLocal(f.estimated_in, destTz),
    actual_in: toLocal(f.actual_in, destTz),
    gate_origin: f.gate_origin ?? null,
    gate_destination: f.gate_destination ?? null,
    terminal_origin: f.terminal_origin ?? null,
    terminal_destination: f.terminal_destination ?? null,
  };
}
