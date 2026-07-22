import type { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";

export interface GeoPoint {
  lat: number;
  lng: number;
  code: string;
}

/** Count past arrivals per destination airport (includes home base). */
export function computeArrivalVisitCounts(
  flights: Flight[],
  isPastFn: (f: Flight) => boolean,
): Record<string, number> {
  const counts: Record<string, number> = {};
  flights.forEach((f) => {
    if (!isPastFn(f)) return;
    counts[f.destination_code] = (counts[f.destination_code] || 0) + 1;
  });
  return counts;
}

/**
 * Normalize airport city labels so multi-airport metros count once
 * (e.g. "London Heathrow" / "London Gatwick" → "London").
 */
export function normalizeCityName(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return trimmed;
  if (/^London(\s|$)/i.test(trimmed)) return "London";
  if (/^Paris(\s|$)/i.test(trimmed)) return "Paris";
  if (/^New York(\s|$)/i.test(trimmed)) return "New York";
  return trimmed;
}

/** Unique normalized cities for a set of airport IATA codes. */
export function uniqueCityCount(airportCodes: Iterable<string>): number {
  const cities = new Set<string>();
  for (const code of airportCodes) {
    const city = AIRPORTS[code]?.city;
    if (city) cities.add(normalizeCityName(city));
  }
  return cities.size;
}

/**
 * Sum great-circle distance (km) over past flights. Caller should already
 * exclude return-to-home legs if desired.
 */
export function computeTotalKmFlown(
  flights: Flight[],
  isPastFn: (f: Flight) => boolean,
): number {
  let total = 0;
  for (const f of flights) {
    if (!isPastFn(f)) continue;
    const o = AIRPORTS[f.origin_code];
    const d = AIRPORTS[f.destination_code];
    if (o?.lat == null || o?.lng == null || d?.lat == null || d?.lng == null) continue;
    total += geoDistanceKm(o.lat, o.lng, d.lat, d.lng);
  }
  return total;
}

/** Format km for the World stats pill: "232.4K" / "850" (unit lives in the label). */
export function formatKmFlown(km: number): string {
  if (km >= 1000) {
    const k = km / 1000;
    return `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(Math.round(km));
}

export interface WorldTravelStats {
  cities: number;
  kmFlown: number;
  kmFlownLabel: string;
  hoursFlown: number;
  hoursFlownLabel: string;
  longestFlight: { km: number; label: string; kmLabel: string } | null;
  mostVisited: { code: string; city: string; visits: number } | null;
  pastCount: number;
  upcomingCount: number;
}

/** Aggregate travel stats for the Your World sheet. */
export function computeWorldTravelStats(
  flights: Flight[],
  isPastFn: (f: Flight) => boolean,
  opts: { excludeReturnHome?: (f: Flight) => boolean } = {},
): WorldTravelStats {
  const countable = opts.excludeReturnHome
    ? flights.filter((f) => !opts.excludeReturnHome!(f))
    : flights;
  const past = countable.filter(isPastFn);
  const upcomingCount = countable.length - past.length;

  const airportCodes = new Set<string>();
  for (const f of countable) {
    airportCodes.add(f.origin_code);
    airportCodes.add(f.destination_code);
  }

  let hours = 0;
  let longest: { km: number; label: string } | null = null;
  let kmTotal = 0;

  for (const f of past) {
    const o = AIRPORTS[f.origin_code];
    const d = AIRPORTS[f.destination_code];
    if (o?.lat != null && o?.lng != null && d?.lat != null && d?.lng != null) {
      const km = geoDistanceKm(o.lat, o.lng, d.lat, d.lng);
      kmTotal += km;
      if (!longest || km > longest.km) {
        longest = { km, label: `${f.origin_code} → ${f.destination_code}` };
      }
    }
    const dep = Date.parse(f.departure_time);
    const arr = Date.parse(f.arrival_time);
    if (!Number.isNaN(dep) && !Number.isNaN(arr) && arr > dep) {
      // Wall-clock span; overnight already encoded in dates.
      hours += (arr - dep) / (1000 * 60 * 60);
    }
  }

  const visits = computeArrivalVisitCounts(past, () => true);
  let mostVisited: WorldTravelStats["mostVisited"] = null;
  for (const [code, count] of Object.entries(visits)) {
    if (!mostVisited || count > mostVisited.visits) {
      mostVisited = {
        code,
        city: normalizeCityName(AIRPORTS[code]?.city ?? code),
        visits: count,
      };
    }
  }

  const hoursRounded = Math.round(hours * 10) / 10;

  return {
    cities: uniqueCityCount(airportCodes),
    kmFlown: kmTotal,
    kmFlownLabel: formatKmFlown(kmTotal),
    hoursFlown: hoursRounded,
    hoursFlownLabel:
      hoursRounded >= 100
        ? `${Math.round(hoursRounded)}`
        : hoursRounded.toFixed(1).replace(/\.0$/, ""),
    longestFlight: longest
      ? {
          km: longest.km,
          label: longest.label,
          kmLabel: formatKmFlown(longest.km),
        }
      : null,
    mostVisited,
    pastCount: past.length,
    upcomingCount,
  };
}

/** Unit vector on the sphere for a lat/lng pair (degrees). */
function latLngToUnit(lat: number, lng: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  return {
    x: sinPhi * Math.cos(theta),
    y: Math.cos(phi),
    z: sinPhi * Math.sin(theta),
  };
}

/** True when a surface point faces the camera hemisphere. */
export function isOnVisibleHemisphere(
  pointLat: number,
  pointLng: number,
  cameraLat: number,
  cameraLng: number,
): boolean {
  const p = latLngToUnit(pointLat, pointLng);
  const c = latLngToUnit(cameraLat, cameraLng);
  return p.x * c.x + p.y * c.y + p.z * c.z > 0;
}

/** Haversine distance in km between two lat/lng pairs. */
export function geoDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Airports within threshold km of a tap, sorted nearest first. */
export function findNearbyAirports<T extends GeoPoint>(
  lat: number,
  lng: number,
  points: T[],
  thresholdKm = 350,
): T[] {
  return points
    .map((p) => ({ point: p, dist: geoDistanceKm(lat, lng, p.lat, p.lng) }))
    .filter(({ dist }) => dist < thresholdKm)
    .sort((a, b) => a.dist - b.dist)
    .map(({ point }) => point);
}
