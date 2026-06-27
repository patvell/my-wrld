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
