import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { Flight } from "@/types";
import { getAirportTimezone } from "@/data/airports";
import { HOME_HUB_CODE } from "@/lib/config";

/**
 * Time model
 * ----------
 * A flight's `departure_time` / `arrival_time` are stored as the LOCAL WALL-CLOCK
 * at the respective airport, in the format "YYYY-MM-DDTHH:mm" (no offset, no Z).
 *
 * To compare flights against "now" (an absolute instant), we convert each
 * wall-clock + IATA code into a true UTC instant using the airport's IANA
 * timezone. All comparisons happen on instants; all display formatting happens
 * on the raw wall-clock so the user always sees exactly what they entered.
 */

export const LIVE_BEFORE_MS = 3 * 60 * 60 * 1000; // active 3h before departure
export const LIVE_AFTER_MS = 2 * 60 * 60 * 1000; // active until 2h after arrival
export const PAST_AFTER_MS = 2 * 60 * 60 * 1000; // moves to history 2h after arrival
export const IMMINENT_HOURS = 24;
export const LAYOVER_THRESHOLD_HOURS = 12;

/**
 * Coerce any stored value (canonical wall-clock, or a legacy ISO string that
 * carries a Z/offset) into a normalized "YYYY-MM-DDTHH:mm" wall-clock string.
 */
export function normalizeWallClock(value: string): string {
  if (!value) return value;
  // Drop a trailing Z or +hh:mm / -hh:mm offset, and anything after minutes.
  const stripped = value.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
  const match = stripped.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{1,2})/);
  if (!match) return stripped;
  const [, y, mo, d, h, mi] = match;
  return `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi.padStart(2, "0")}`;
}

/** Pad a user-entered HH:mm (or H:mm) to two-digit hours and minutes. */
export function padTimeInput(time: string): string {
  const [h = "", m = ""] = time.split(":");
  if (!h || !m) return time;
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** Build canonical wall-clock "YYYY-MM-DDTHH:mm" from date + local time inputs. */
export function buildWallClock(date: string, time: string): string {
  return `${date}T${padTimeInput(time)}`;
}

/** Convert a local wall-clock at the given airport into an absolute UTC instant. */
export function toInstant(wallClock: string, code: string): Date {
  return fromZonedTime(normalizeWallClock(wallClock), getAirportTimezone(code));
}

/** Convert an absolute instant (UTC ISO) into canonical wall-clock in an IANA zone. */
export function instantToWallClockTz(utcIso: string, ianaTz: string): string {
  return formatInTimeZone(new Date(utcIso), ianaTz, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Convert an absolute instant (UTC ISO string, e.g. from AeroAPI) into the
 * canonical local wall-clock ("YYYY-MM-DDTHH:mm") at the given airport. Inverse
 * of {@link toInstant}.
 */
export function instantToWallClock(utcIso: string, code: string): string {
  return instantToWallClockTz(utcIso, getAirportTimezone(code));
}

export function departureInstant(flight: Flight): Date {
  return toInstant(flight.departure_time, flight.origin_code);
}

export function arrivalInstant(flight: Flight): Date {
  return toInstant(flight.arrival_time, flight.destination_code);
}

/**
 * A flight is "past" (History) when:
 * - cancelled, or
 * - marked completed AND departure has already happened (guards false AeroAPI matches), or
 * - scheduled arrival was more than 2h ago (fallback for never-tracked flights).
 */
export function isPast(flight: Flight, now: Date = new Date()): boolean {
  // Guard: Array.filter/map pass an index as the 2nd arg — ignore non-Dates.
  const t = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  if (flight.status === "cancelled") return true;
  if (flight.status === "completed") {
    // Do not trust a premature "completed" while still before departure.
    return t.getTime() >= departureInstant(flight).getTime();
  }
  return t.getTime() >= arrivalInstant(flight).getTime() + PAST_AFTER_MS;
}

/** Live-tracking window: from 3h before departure until 2h after arrival. */
export function isActive(flight: Flight, now: Date = new Date()): boolean {
  const t = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  if (isPast(flight, t)) return false;
  const ms = t.getTime();
  return (
    ms >= departureInstant(flight).getTime() - LIVE_BEFORE_MS &&
    ms <= arrivalInstant(flight).getTime() + LIVE_AFTER_MS
  );
}

/**
 * Among upcoming flights, the soonest departure currently inside the live
 * window — only this flight should poll/highlight as active.
 */
export function getNextLiveFlightId(
  flights: Flight[],
  now: Date = new Date(),
): string | null {
  const candidates = flights
    .filter((f) => !isPast(f, now) && isActive(f, now))
    .sort(
      (a, b) => departureInstant(a).getTime() - departureInstant(b).getTime(),
    );
  return candidates[0]?.id ?? null;
}

/** True when departure is within the next 24h (and hasn't happened yet). */
export function isImminent(flight: Flight, now: Date = new Date()): boolean {
  const hoursUntil =
    (departureInstant(flight).getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntil > 0 && hoursUntil < IMMINENT_HOURS;
}

/** Whether the gap between two consecutive legs is a layover (>12h) vs a return. */
export function isLayoverBetween(a: Flight, b: Flight): boolean {
  const aDep = departureInstant(a).getTime();
  const bDep = departureInstant(b).getTime();
  const first = aDep < bDep ? a : b;
  const second = aDep < bDep ? b : a;
  const gapHours =
    (departureInstant(second).getTime() - arrivalInstant(first).getTime()) /
    (1000 * 60 * 60);
  return gapHours > LAYOVER_THRESHOLD_HOURS;
}

export interface CurrentLocation {
  code: string;
  city: string;
}

/**
 * Best-effort "where is the traveler now":
 *  - mid-flight  -> origin of the active flight
 *  - otherwise   -> destination of the most recently completed flight
 *  - no history  -> origin of the earliest flight
 */
export function getCurrentLocation(
  flights: Flight[],
  now: Date = new Date(),
): CurrentLocation {
  if (flights.length === 0) {
    return { code: HOME_HUB_CODE, city: "Dubai" };
  }

  const sorted = [...flights].sort(
    (a, b) => departureInstant(a).getTime() - departureInstant(b).getTime(),
  );

  const active = sorted.find((f) => {
    const t = now.getTime();
    return (
      t >= departureInstant(f).getTime() && t < arrivalInstant(f).getTime()
    );
  });
  if (active) {
    return { code: active.origin_code, city: active.origin_city };
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    const f = sorted[i];
    if (now.getTime() >= arrivalInstant(f).getTime()) {
      return { code: f.destination_code, city: f.destination_city };
    }
  }

  const first = sorted[0];
  return { code: first.origin_code, city: first.origin_city };
}

/** Parse a wall-clock string into a Date pinned to UTC (for display formatting only). */
function wallClockAsUtcDate(value: string): Date {
  return new Date(`${normalizeWallClock(value)}:00Z`);
}

/** Format a wall-clock as "HH:mm" exactly as entered (no timezone shifting). */
export function formatLocalTime(value: string): string {
  const d = wallClockAsUtcDate(value);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

/** Format a wall-clock as "MMM DD YYYY" exactly as entered (no timezone shifting). */
export function formatLocalDate(value: string): string {
  const d = wallClockAsUtcDate(value);
  if (isNaN(d.getTime())) return "---";
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase()
    .replace(",", "");
}
