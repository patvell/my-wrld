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
  mapAeroFlightToStatus,
  pickFlightForDate,
  type LiveStatus,
} from "@/lib/aeroMapper";
import { getCached, setCached, STATUS_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";

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

function isArrivedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes("arrived") || s.includes("landed") || s.includes("completed");
}

async function syncFlightStatus(
  db: Awaited<ReturnType<typeof getDb>>,
  flightId: string,
  userId: string,
  live: LiveStatus,
  existingFaId: string | null,
): Promise<{ landed: boolean; faFlightId: string | null }> {
  let newStatus: "completed" | "cancelled" | null = null;
  if (live.cancelled) {
    newStatus = "cancelled";
  } else if (live.actual_in || isArrivedStatus(live.status)) {
    newStatus = "completed";
  }

  const faFlightId = live.fa_flight_id || existingFaId;
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

  return { landed: Boolean(newStatus), faFlightId };
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

    const cacheKey = `status:${id}`;
    const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
    if (cached) return NextResponse.json(cached);

    const date = departureTime.slice(0, 10);
    let match = null;
    if (faFlightId) {
      match = await getFlightByFaId(faFlightId);
    }
    if (!match && flightNumber) {
      const aeroIdent = toAeroIdent(flightNumber);
      const flights = await getFlightsByIdent(aeroIdent, {
        start: date,
        end: addDays(date, 1),
      });
      const routed = filterFlightsByRoute(flights, originCode, destinationCode);
      match = pickFlightForDate(routed, date);
    }

    if (!match) {
      const result: StatusResult = { configured: true, found: false };
      await setCached(cacheKey, result);
      return NextResponse.json(result);
    }

    const live = mapAeroFlightToStatus(match);
    const { landed } = await syncFlightStatus(db, id, userId, live, faFlightId);

    // Already completed in DB still counts as landed for the client refresh path.
    const alreadyDone = currentStatus === "completed" || currentStatus === "cancelled";
    const result: StatusResult = {
      configured: true,
      found: true,
      status: live,
      landed: landed || (alreadyDone && (Boolean(live.actual_in) || isArrivedStatus(live.status) || live.cancelled)),
    };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI status failed:", error);
    return NextResponse.json({ error: "Status fetch failed" }, { status });
  }
}
