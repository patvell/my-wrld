import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";
import { getOrFetchStatus, type StatusResult, type SyncableFlightRow } from "@/lib/statusSync";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAeroApiConfigured()) {
    return NextResponse.json({ configured: false, found: false } satisfies StatusResult);
  }

  try {
    const db = await getDb();
    const userId = getUserId(request);
    const { id } = await params;

    const row = await db.execute({
      sql: `SELECT id, user_id, flight_number, departure_time, fa_flight_id,
                   origin_code, destination_code, status
            FROM flights WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });
    if (row.rows.length === 0) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const flight = row.rows[0] as unknown as SyncableFlightRow;
    const result = await getOrFetchStatus(db, {
      id: String(flight.id),
      user_id: flight.user_id,
      flight_number: flight.flight_number,
      departure_time: String(flight.departure_time),
      fa_flight_id: flight.fa_flight_id,
      origin_code: flight.origin_code != null ? String(flight.origin_code) : null,
      destination_code: flight.destination_code != null ? String(flight.destination_code) : null,
      status: flight.status != null ? String(flight.status) : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI status failed:", error);
    return NextResponse.json({ error: "Status fetch failed" }, { status });
  }
}
