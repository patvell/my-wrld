import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import {
  getFlightByFaId,
  getFlightsByIdent,
  isAeroApiConfigured,
  AeroApiError,
} from "@/lib/aeroapi";
import { mapAeroFlightToStatus, pickFlightForDate, type LiveStatus } from "@/lib/aeroMapper";
import { getCached, setCached, STATUS_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";

interface StatusResult {
  configured: boolean;
  found: boolean;
  status?: LiveStatus;
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
): Promise<void> {
  let newStatus: "completed" | "cancelled" | null = null;
  if (live.cancelled) {
    newStatus = "cancelled";
  } else if (live.actual_in || isArrivedStatus(live.status)) {
    newStatus = "completed";
  }
  if (!newStatus) return;

  await db.execute({
    sql: "UPDATE flights SET status = ? WHERE id = ? AND user_id = ?",
    args: [newStatus, flightId, userId],
  });
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
      sql: "SELECT id, flight_number, departure_time, fa_flight_id FROM flights WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });
    if (row.rows.length === 0) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const flightNumber = row.rows[0].flight_number as string | null;
    const departureTime = String(row.rows[0].departure_time);
    const faFlightId = row.rows[0].fa_flight_id as string | null;
    if (!flightNumber && !faFlightId) {
      return NextResponse.json({ configured: true, found: false } satisfies StatusResult);
    }

    const cacheKey = `status:${id}`;
    const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
    if (cached) return NextResponse.json(cached);

    let match = null;
    if (faFlightId) {
      match = await getFlightByFaId(faFlightId);
    }
    if (!match && flightNumber) {
      const aeroIdent = toAeroIdent(flightNumber);
      const flights = await getFlightsByIdent(aeroIdent);
      match = pickFlightForDate(flights, departureTime.slice(0, 10));
    }

    const result: StatusResult = match
      ? { configured: true, found: true, status: mapAeroFlightToStatus(match) }
      : { configured: true, found: false };

    if (result.status) {
      await syncFlightStatus(db, id, userId, result.status);
    }

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI status failed:", error);
    return NextResponse.json({ error: "Status fetch failed" }, { status });
  }
}
