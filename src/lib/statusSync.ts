import type { Client } from "@libsql/client";
import { getFlightByFaId, getFlightsByIdent } from "@/lib/aeroapi";
import {
  filterFlightsByRoute,
  isConfirmedArrival,
  mapAeroFlightToStatus,
  pickFlightForLiveTracking,
  type LiveStatus,
} from "@/lib/aeroMapper";
import { getCached, setCached, STATUS_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";
import { toInstant } from "@/lib/time";

/**
 * Shared live-status sync used by both the per-flight status route (client
 * polling while the app is open) and the cron sweep (server-side, so flights
 * land in History even when nobody has the app open).
 */

export interface StatusResult {
  configured: boolean;
  found: boolean;
  status?: LiveStatus;
  /** True when this poll just marked the flight completed/cancelled in the DB. */
  landed?: boolean;
}

export interface SyncableFlightRow {
  id: string;
  user_id: string | null;
  flight_number: string | null;
  /** Wall-clock "YYYY-MM-DDTHH:mm" at the origin airport. */
  departure_time: string;
  fa_flight_id: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
  status?: string | null;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Persist a definitive outcome (landed/cancelled) onto the flight row. */
export async function applyStatusToFlight(
  db: Client,
  flight: SyncableFlightRow,
  live: LiveStatus,
): Promise<"completed" | "cancelled" | null> {
  const origin = flight.origin_code ?? "";
  const depMs = toInstant(flight.departure_time, origin).getTime();
  const beforeDeparture = Date.now() < depMs;
  const currentStatus = flight.status ?? "scheduled";

  // Heal false completions: AeroAPI matched a prior landed instance.
  if (beforeDeparture && (currentStatus === "completed" || currentStatus === "cancelled")) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
      args: ["scheduled", "future", flight.id, flight.user_id],
    });
  }

  let newStatus: "completed" | "cancelled" | null = null;
  if (live.cancelled && !beforeDeparture) {
    newStatus = "cancelled";
  } else if (!beforeDeparture && isConfirmedArrival(live)) {
    newStatus = "completed";
  }

  const shouldPersistFaId = Boolean(live.fa_flight_id && live.fa_flight_id !== flight.fa_flight_id);

  if (newStatus && shouldPersistFaId) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, fa_flight_id = ?, type = ? WHERE id = ? AND user_id = ?",
      args: [newStatus, live.fa_flight_id, "past", flight.id, flight.user_id],
    });
  } else if (newStatus) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
      args: [newStatus, "past", flight.id, flight.user_id],
    });
  } else if (shouldPersistFaId) {
    await db.execute({
      sql: "UPDATE flights SET fa_flight_id = ? WHERE id = ? AND user_id = ?",
      args: [live.fa_flight_id, flight.id, flight.user_id],
    });
  }

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

  const origin = flight.origin_code ?? "";
  const destination = flight.destination_code ?? "";
  const currentStatus = flight.status ?? "scheduled";
  const depMs = toInstant(flight.departure_time, origin).getTime();
  const beforeDeparture = Date.now() < depMs;
  const needsHeal =
    beforeDeparture && (currentStatus === "completed" || currentStatus === "cancelled");

  const cacheKey = `status:${flight.id}`;
  if (!needsHeal) {
    const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
    if (cached) return cached;
  }

  const date = flight.departure_time.slice(0, 10);
  let match = null;
  if (flight.fa_flight_id && !needsHeal) {
    match = await getFlightByFaId(flight.fa_flight_id);
    // Stale fa_flight_id from a previous day's instance — ignore if already
    // arrived while our flight has not departed yet.
    if (match && beforeDeparture && (match.actual_in || match.cancelled)) {
      match = null;
    }
  }
  if (!match && flight.flight_number) {
    const flights = await getFlightsByIdent(toAeroIdent(flight.flight_number), {
      start: date,
      end: addDays(date, 1),
    });
    const routed =
      origin && destination ? filterFlightsByRoute(flights, origin, destination) : flights;
    match = pickFlightForLiveTracking(routed, date, {
      preferNotArrived: beforeDeparture || Date.now() < depMs + 6 * 60 * 60 * 1000,
    });
  }

  if (!match) {
    if (needsHeal) {
      await db.execute({
        sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
        args: ["scheduled", "future", flight.id, flight.user_id],
      });
    }
    const result: StatusResult = { configured: true, found: false };
    await setCached(cacheKey, result);
    return result;
  }

  const live = mapAeroFlightToStatus(match);
  const outcome = await applyStatusToFlight(db, flight, live);
  const result: StatusResult = {
    configured: true,
    found: true,
    status: live,
    landed: Boolean(outcome),
  };

  await setCached(cacheKey, result);
  return result;
}
