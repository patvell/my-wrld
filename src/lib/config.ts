/**
 * Centralized app configuration.
 *
 * These values are currently personal defaults for a single-traveler experience,
 * but they are isolated here so the app can be generalized (multi-airline,
 * configurable hub/home, multi-user) without hunting through components.
 */

/** IATA airline prefix shown/stored on flight numbers, e.g. "EK123". */
export const AIRLINE_CODE = "EK";

/** ICAO/carrier code used when deep-linking to FlightAware, e.g. "UAE123". */
export const FLIGHTAWARE_CARRIER = "UAE";

/** The traveler's home hub airport. Journeys are grouped around round-trips from here. */
export const HOME_HUB_CODE = "DXB";

/** Default "partner" location shown on the home screen secondary clock. */
export const PARTNER_CODE = "YUL";
export const PARTNER_CITY = "Montreal";

/**
 * Single-tenant placeholder user. All rows are scoped to this id today; when auth
 * lands, only `getUserId()` (see API routes) needs to change.
 */
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Build an AeroAPI ident (ICAO designator) from a stored flight number.
 * e.g. "EK123" or "123" -> "UAE123". A multi-airline IATA->ICAO map is future work.
 */
export function toAeroIdent(flightNumber: string): string {
  const digits = flightNumber.replace(/\D/g, "");
  return `${FLIGHTAWARE_CARRIER}${digits}`;
}
