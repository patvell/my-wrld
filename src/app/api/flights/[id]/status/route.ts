import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { getFlightsByIdent, isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";
import { mapAeroFlightToStatus, pickFlightForDate, type LiveStatus } from "@/lib/aeroMapper";
import { getCached, setCached, STATUS_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";

interface StatusResult {
  configured: boolean;
  found: boolean;
  status?: LiveStatus;
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
      sql: "SELECT id, flight_number, departure_time FROM flights WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });
    if (row.rows.length === 0) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const flightNumber = row.rows[0].flight_number as string | null;
    const departureTime = String(row.rows[0].departure_time);
    if (!flightNumber) {
      return NextResponse.json({ configured: true, found: false } satisfies StatusResult);
    }

    const cacheKey = `status:${id}`;
    const cached = await getCached<StatusResult>(cacheKey, STATUS_TTL_MS);
    if (cached) return NextResponse.json(cached);

    const aeroIdent = toAeroIdent(flightNumber);
    const flights = await getFlightsByIdent(aeroIdent);
    const match = pickFlightForDate(flights, departureTime.slice(0, 10));

    const result: StatusResult = match
      ? { configured: true, found: true, status: mapAeroFlightToStatus(match) }
      : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI status failed:", error);
    return NextResponse.json({ error: "Status fetch failed" }, { status });
  }
}
