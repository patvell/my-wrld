import type { Flight } from "@/types";

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
