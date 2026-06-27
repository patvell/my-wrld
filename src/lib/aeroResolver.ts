/**
 * Server-only tiered AeroAPI lookup resolver.
 * Picks the best endpoint for a given ident + date combination.
 */

import {
  getFlightsByIdent,
  getHistoricalFlightsByIdent,
  getSchedules,
  type AeroFlight,
  type AeroSchedule,
} from "@/lib/aeroapi";
import {
  daySpan,
  mapAeroFlightToInput,
  mapAeroScheduleToInput,
  pickFlightForDate,
  pickScheduleForDate,
} from "@/lib/aeroMapper";
import { FLIGHTAWARE_CARRIER } from "@/lib/config";
import type { FlightInput } from "@/types";

export type LookupSource = "operational" | "schedule" | "history" | "template";

export interface ResolveFlightLookupResult {
  flight: FlightInput | null;
  source: LookupSource;
  exact: boolean;
  day_span: number;
  fa_flight_id?: string | null;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWithinOperationalWindow(date: string, today: string): boolean {
  const start = addDays(today, -10);
  const end = addDays(today, 2);
  return date >= start && date <= end;
}

function isWithinScheduleWindow(date: string, today: string): boolean {
  const start = addDays(today, -90);
  const end = addDays(today, 365);
  return date >= start && date <= end;
}

function flightDigits(aeroIdent: string): string {
  return aeroIdent.replace(/\D/g, "");
}

function resultFromFlight(
  match: AeroFlight,
  date: string,
  source: LookupSource,
): ResolveFlightLookupResult {
  const mapped = mapAeroFlightToInput(match);
  if (!mapped) {
    return { flight: null, source, exact: false, day_span: 0, fa_flight_id: null };
  }
  return {
    flight: mapped,
    source,
    exact: mapped.departure_time.slice(0, 10) === date,
    day_span: daySpan(mapped.departure_time, mapped.arrival_time),
    fa_flight_id: match.fa_flight_id ?? null,
  };
}

function resultFromSchedule(
  match: AeroSchedule,
  date: string,
  source: LookupSource,
): ResolveFlightLookupResult {
  const mapped = mapAeroScheduleToInput(match);
  if (!mapped) {
    return { flight: null, source, exact: false, day_span: 0, fa_flight_id: null };
  }
  return {
    flight: mapped,
    source,
    exact: mapped.departure_time.slice(0, 10) === date,
    day_span: daySpan(mapped.departure_time, mapped.arrival_time),
    fa_flight_id: match.fa_flight_id ?? null,
  };
}

async function tryOperational(aeroIdent: string, date: string): Promise<ResolveFlightLookupResult | null> {
  const flights = await getFlightsByIdent(aeroIdent, { start: date, end: addDays(date, 1) });
  const match = pickFlightForDate(flights, date);
  if (!match) return null;
  const result = resultFromFlight(match, date, "operational");
  return result.flight ? result : null;
}

async function trySchedule(aeroIdent: string, date: string): Promise<ResolveFlightLookupResult | null> {
  const digits = flightDigits(aeroIdent);
  const schedules = await getSchedules(date, addDays(date, 1), {
    airline: FLIGHTAWARE_CARRIER,
    flight_number: digits,
  });
  const match = pickScheduleForDate(schedules, date);
  if (!match) return null;
  const result = resultFromSchedule(match, date, "schedule");
  return result.flight ? result : null;
}

async function tryHistory(aeroIdent: string, date: string): Promise<ResolveFlightLookupResult | null> {
  const flights = await getHistoricalFlightsByIdent(aeroIdent, {
    start: date,
    end: addDays(date, 1),
  });
  const match = pickFlightForDate(flights, date);
  if (!match) return null;
  const result = resultFromFlight(match, date, "history");
  return result.flight ? result : null;
}

async function tryTemplate(aeroIdent: string, date: string): Promise<ResolveFlightLookupResult | null> {
  const flights = await getFlightsByIdent(aeroIdent);
  const match = pickFlightForDate(flights, date) ?? flights[0] ?? null;
  if (!match) return null;
  const result = resultFromFlight(match, date, "template");
  return result.flight ? result : null;
}

/**
 * Resolve flight lookup using a tiered AeroAPI strategy based on the requested date.
 */
export async function resolveFlightLookup(
  aeroIdent: string,
  date: string,
  opts: { preferHistory?: boolean } = {},
): Promise<ResolveFlightLookupResult> {
  const today = todayUtc();
  const isPast = date < today;

  if (opts.preferHistory && isPast) {
    const history = await tryHistory(aeroIdent, date);
    if (history) return history;
  }

  if (isWithinOperationalWindow(date, today)) {
    const operational = await tryOperational(aeroIdent, date);
    if (operational) return operational;
  } else if (isWithinScheduleWindow(date, today)) {
    const schedule = await trySchedule(aeroIdent, date);
    if (schedule) return schedule;
  } else if (isPast) {
    const history = await tryHistory(aeroIdent, date);
    if (history) return history;
  }

  const template = await tryTemplate(aeroIdent, date);
  if (template) return template;

  return { flight: null, source: "template", exact: false, day_span: 0, fa_flight_id: null };
}
