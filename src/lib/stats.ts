import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { geoDistanceKm } from "@/lib/globeUtils";
import { arrivalInstant, departureInstant, isPast } from "@/lib/time";
import { HOME_HUB_CODE } from "@/lib/config";

/**
 * Pure travel-stat helpers over completed flights. Callers pass the flight
 * set they care about (usually past flights); everything here is derived —
 * nothing is stored.
 */

export interface TravelStats {
  flights: number;
  airports: number;
  cities: number;
  countries: number;
  hoursInAir: number;
  distanceKm: number;
  longestFlightKm: number;
  /** e.g. "DXB → YYZ", null when there are no measurable flights. */
  longestFlightRoute: string | null;
  mostVisitedCity: string | null;
  mostVisitedCode: string | null;
}

function flightYear(f: Flight): number {
  return Number(f.departure_time.slice(0, 4));
}

/** Distinct departure years, newest first. */
export function availableYears(flights: Flight[]): number[] {
  return [...new Set(flights.map(flightYear))].filter(Number.isFinite).sort((a, b) => b - a);
}

function flightDistanceKm(f: Flight): number {
  const o = AIRPORTS[f.origin_code];
  const d = AIRPORTS[f.destination_code];
  if (!o || !d || o.lat === undefined || o.lng === undefined || d.lat === undefined || d.lng === undefined) {
    return 0;
  }
  return geoDistanceKm(o.lat, o.lng, d.lat, d.lng);
}

export function computeTravelStats(flights: Flight[], year?: number): TravelStats {
  const set = year != null ? flights.filter((f) => flightYear(f) === year) : flights;

  // "Visited" places are everywhere the traveler touched other than home base.
  const visitedCodes = new Set<string>();
  const arrivalCounts: Record<string, number> = {};
  let hoursMs = 0;
  let distanceKm = 0;
  let longestFlightKm = 0;
  let longestFlightRoute: string | null = null;

  for (const f of set) {
    for (const code of [f.origin_code, f.destination_code]) {
      if (code !== HOME_HUB_CODE && AIRPORTS[code]) visitedCodes.add(code);
    }
    if (f.destination_code !== HOME_HUB_CODE) {
      arrivalCounts[f.destination_code] = (arrivalCounts[f.destination_code] || 0) + 1;
    }

    const ms = arrivalInstant(f).getTime() - departureInstant(f).getTime();
    if (ms > 0) hoursMs += ms;

    const km = flightDistanceKm(f);
    distanceKm += km;
    if (km > longestFlightKm) {
      longestFlightKm = km;
      longestFlightRoute = `${f.origin_code} → ${f.destination_code}`;
    }
  }

  const cities = new Set<string>();
  const countries = new Set<string>();
  for (const code of visitedCodes) {
    const ap = AIRPORTS[code];
    if (ap) {
      cities.add(ap.city);
      countries.add(ap.countryIso);
    }
  }

  let mostVisitedCode: string | null = null;
  let best = 0;
  for (const [code, count] of Object.entries(arrivalCounts)) {
    if (count > best) {
      best = count;
      mostVisitedCode = code;
    }
  }

  return {
    flights: set.length,
    airports: visitedCodes.size,
    cities: cities.size,
    countries: countries.size,
    hoursInAir: Math.round(hoursMs / 3_600_000),
    distanceKm: Math.round(distanceKm),
    longestFlightKm: Math.round(longestFlightKm),
    longestFlightRoute,
    mostVisitedCity: mostVisitedCode ? (AIRPORTS[mostVisitedCode]?.city ?? mostVisitedCode) : null,
    mostVisitedCode,
  };
}

export interface MonthGroup {
  /** "2026-05" — from the first flight of the group's first journey. */
  key: string;
  /** "MAY 2026" */
  label: string;
  journeys: Flight[][];
}

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Group journeys by the month of each journey's first flight, preserving order. */
export function groupJourneysByMonth(journeys: Flight[][]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const journey of journeys) {
    const first = journey[0];
    if (!first) continue;
    const key = first.departure_time.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.journeys.push(journey);
    } else {
      const [y, m] = key.split("-").map(Number);
      const label = `${MONTH_NAMES[(m ?? 1) - 1] ?? "???"} ${y}`;
      groups.push({ key, label, journeys: [journey] });
    }
  }
  return groups;
}

export interface Countdown {
  kind: "landing-home" | "next-journey";
  /** Absolute instant counted down to. */
  target: Date;
  /** Airport code the moment refers to (arrival home / next departure). */
  code: string;
}

/**
 * The next moment worth counting down to:
 *  - an upcoming/active flight arriving at the home hub → "lands home"
 *  - otherwise the next future departure → "next journey"
 */
export function nextCountdown(flights: Flight[], now: Date = new Date()): Countdown | null {
  const upcoming = flights.filter((f) => !isPast(f, now));

  const homeArrival = upcoming
    .filter((f) => f.destination_code === HOME_HUB_CODE && arrivalInstant(f).getTime() > now.getTime())
    .sort((a, b) => arrivalInstant(a).getTime() - arrivalInstant(b).getTime())[0];
  if (homeArrival) {
    return { kind: "landing-home", target: arrivalInstant(homeArrival), code: homeArrival.destination_code };
  }

  const nextDeparture = upcoming
    .filter((f) => departureInstant(f).getTime() > now.getTime())
    .sort((a, b) => departureInstant(a).getTime() - departureInstant(b).getTime())[0];
  if (nextDeparture) {
    return { kind: "next-journey", target: departureInstant(nextDeparture), code: nextDeparture.destination_code };
  }

  return null;
}

/** "2D 14H" / "14H 05M" / "23M" for a positive millisecond span. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${String(minutes).padStart(2, "0")}M`;
  return `${minutes}M`;
}

/** Compact distance for stat chips: 1,234 KM under 10k, "12.4K KM" above. */
export function formatDistanceKm(km: number): string {
  if (km >= 10_000) return `${(km / 1000).toFixed(1).replace(/\.0$/, "")}K KM`;
  return `${Math.round(km).toLocaleString("en-US")} KM`;
}
