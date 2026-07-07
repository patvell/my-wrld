import type { Client } from "@libsql/client";
import { getFlightByFaId, getFlightsByIdent } from "@/lib/aeroapi";
import { mapAeroFlightToStatus, pickFlightForDate, type LiveStatus } from "@/lib/aeroMapper";
import { getCached, setCached, STATUS_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";

/**
 * Shared live-status sync used by both the per-flight status route (client
 * polling while the app is open) and the cron sweep (server-side, so flights
 * land in History even when nobody has the app open).
 */

export interface StatusResult {
  configured: boolean;
  found: boolean;
  status?: LiveStatus;
}

export interface SyncableFlightRow {
  id: string;
  user_id: string | null;
  flight_number: string | null;
  /** Wall-clock "YYYY-MM-DDTHH:mm" at the origin airport. */
  departure_time: string;
  fa_flight_id: string | null;
}

export function isArrivedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("arrived") || s.includes("landed") || s.includes("completed");
}

/** Persist a definitive outcome (landed/cancelled) onto the flight row. */
export async function applyStatusToFlight(
  db: Client,
  flight: Pick<SyncableFlightRow, "id" | "user_id">,
  live: LiveStatus,
): Promise<"completed" | "cancelled" | null> {
  let newStatus: "completed" | "cancelled" | null = null;
  if (live.cancelled) {
    newStatus = "cancelled";
  } else if (live.actual_in || isArrivedStatus(live.status)) {
    newStatus = "completed";
  }
  if (!newStatus) return null;

  await db.execute({
    sql: "UPDATE flights SET status = ? WHERE id = ? AND user_id = ?",
    args: [newStatus, flight.id, flight.user_id],
  });
  return newStatus;
}

/**
 * Resolve a flight's live status from AeroAPI (fa_flight_id first, ident
 * fallback), TTL-cached per flight so client polling and the cron sweep share
 * one billed lookup. Applies landed/cancelled outcomes to the DB row.
 */
export async function getOrFetchStatus(db: Client, flight: SyncableFlightRow): Promise<StatusResult> {
  if (!flight.flight_number && !flight.fa_flight_id) {
    return { configured: true, found: false };
  }

  const cacheKey = `status:${flight.id}`;
  const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
  if (cached) return cached;

  let match = null;
  if (flight.fa_flight_id) {
    match = await getFlightByFaId(flight.fa_flight_id);
  }
  if (!match && flight.flight_number) {
    const flights = await getFlightsByIdent(toAeroIdent(flight.flight_number));
    match = pickFlightForDate(flights, flight.departure_time.slice(0, 10));
  }

  const result: StatusResult = match
    ? { configured: true, found: true, status: mapAeroFlightToStatus(match) }
    : { configured: true, found: false };

  if (result.status) {
    await applyStatusToFlight(db, flight, result.status);
  }

  await setCached(cacheKey, result);
  return result;
}
