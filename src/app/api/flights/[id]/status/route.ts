import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import {
  getFlightByFaId,
  getFlightsByIdent,
  isAeroApiConfigured,
  AeroApiError,
} from "@/lib/aeroapi";
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

interface StatusResult {
  configured: boolean;
  found: boolean;
  status?: LiveStatus;
  /** True when this poll just marked the flight completed/cancelled in the DB. */
  landed?: boolean;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function syncFlightStatus(
  db: Awaited<ReturnType<typeof getDb>>,
  flightId: string,
  userId: string,
  live: LiveStatus,
  existingFaId: string | null,
  departureWallClock: string,
  originCode: string,
  currentStatus: string,
): Promise<{ landed: boolean }> {
  const nowMs = Date.now();
  const depMs = toInstant(departureWallClock, originCode).getTime();
  const beforeDeparture = nowMs < depMs;

  // Heal false completions: AeroAPI matched a prior landed instance.
  if (beforeDeparture && (currentStatus === "completed" || currentStatus === "cancelled")) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
      args: ["scheduled", "future", flightId, userId],
    });
  }

  let newStatus: "completed" | "cancelled" | null = null;
  if (live.cancelled && !beforeDeparture) {
    newStatus = "cancelled";
  } else if (!beforeDeparture && isConfirmedArrival(live)) {
    newStatus = "completed";
  }

  const shouldPersistFaId = Boolean(live.fa_flight_id && live.fa_flight_id !== existingFaId);

  if (newStatus && shouldPersistFaId) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, fa_flight_id = ?, type = ? WHERE id = ? AND user_id = ?",
      args: [newStatus, live.fa_flight_id, "past", flightId, userId],
    });
  } else if (newStatus) {
    await db.execute({
      sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
      args: [newStatus, "past", flightId, userId],
    });
  } else if (shouldPersistFaId) {
    await db.execute({
      sql: "UPDATE flights SET fa_flight_id = ? WHERE id = ? AND user_id = ?",
      args: [live.fa_flight_id, flightId, userId],
    });
  }

  return { landed: Boolean(newStatus) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAeroApiConfigured()) {
    return NextResponse.json({ configured: false, found: false } satisfies StatusResult);
  }

  try {
    const db = await getDb();
    const userId = getUserId(request);
    const { id } = await params;

    const row = await db.execute({
      sql: `SELECT id, flight_number, departure_time, fa_flight_id, origin_code, destination_code, status
            FROM flights WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });
    if (row.rows.length === 0) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const flightNumber = row.rows[0].flight_number as string | null;
    const departureTime = String(row.rows[0].departure_time);
    const faFlightId = row.rows[0].fa_flight_id as string | null;
    const originCode = String(row.rows[0].origin_code ?? "");
    const destinationCode = String(row.rows[0].destination_code ?? "");
    const currentStatus = String(row.rows[0].status ?? "scheduled");

    if (!flightNumber && !faFlightId) {
      return NextResponse.json({ configured: true, found: false } satisfies StatusResult);
    }

    // Skip cache when healing a premature completion so the next poll is fresh.
    const depMs = toInstant(departureTime, originCode).getTime();
    const beforeDeparture = Date.now() < depMs;
    const needsHeal =
      beforeDeparture && (currentStatus === "completed" || currentStatus === "cancelled");

    const cacheKey = `status:${id}`;
    if (!needsHeal) {
      const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
      if (cached) return NextResponse.json(cached);
    }

    const date = departureTime.slice(0, 10);
    let match = null;
    if (faFlightId && !needsHeal) {
      match = await getFlightByFaId(faFlightId);
      // Stale fa_flight_id from a previous day's instance — ignore if already arrived
      // while our flight has not departed yet.
      if (match && beforeDeparture && (match.actual_in || match.cancelled)) {
        match = null;
      }
    }
    if (!match && flightNumber) {
      const aeroIdent = toAeroIdent(flightNumber);
      const flights = await getFlightsByIdent(aeroIdent, {
        start: date,
        end: addDays(date, 1),
      });
      const routed = filterFlightsByRoute(flights, originCode, destinationCode);
      match = pickFlightForLiveTracking(routed, date, {
        preferNotArrived: beforeDeparture || Date.now() < depMs + 6 * 60 * 60 * 1000,
      });
    }

    if (!match) {
      // Still heal false completion even when AeroAPI has no match.
      if (needsHeal) {
        await db.execute({
          sql: "UPDATE flights SET status = ?, type = ? WHERE id = ? AND user_id = ?",
          args: ["scheduled", "future", id, userId],
        });
      }
      const result: StatusResult = { configured: true, found: false };
      await setCached(cacheKey, result);
      return NextResponse.json(result);
    }

    const live = mapAeroFlightToStatus(match);
    const { landed } = await syncFlightStatus(
      db,
      id,
      userId,
      live,
      faFlightId,
      departureTime,
      originCode,
      currentStatus,
    );

    const result: StatusResult = {
      configured: true,
      found: true,
      status: live,
      landed,
    };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI status failed:", error);
    return NextResponse.json({ error: "Status fetch failed" }, { status });
  }
}
