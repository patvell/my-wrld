import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAeroApiConfigured } from "@/lib/aeroapi";
import { isActive } from "@/lib/time";
import { getOrFetchStatus } from "@/lib/statusSync";
import type { Flight } from "@/types";

/** Safety cap per sweep; one traveler has at most a leg or two live at once. */
const MAX_SYNC_PER_RUN = 10;

/**
 * Server-side status sweep (Vercel Cron, see vercel.json). Syncs flights that
 * are inside their live window so completed landings move trips to History
 * even when nobody has the app open. Runs across all users.
 */
export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when configured.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAeroApiConfigured()) {
    return NextResponse.json({ configured: false, synced: 0 });
  }

  try {
    const db = await getDb();
    const rows = await db.execute(
      `SELECT id, user_id, flight_number, departure_time, arrival_time,
              origin_code, destination_code, fa_flight_id, status
       FROM flights
       WHERE status = 'scheduled' OR status IS NULL`,
    );

    const now = new Date();
    const live = rows.rows
      .filter((r) => isActive(r as unknown as Flight, now))
      .slice(0, MAX_SYNC_PER_RUN);

    let landedOrCancelled = 0;
    for (const r of live) {
      const result = await getOrFetchStatus(db, {
        id: String(r.id),
        user_id: r.user_id as string | null,
        flight_number: r.flight_number as string | null,
        departure_time: String(r.departure_time),
        fa_flight_id: r.fa_flight_id as string | null,
        origin_code: r.origin_code != null ? String(r.origin_code) : null,
        destination_code: r.destination_code != null ? String(r.destination_code) : null,
        status: r.status != null ? String(r.status) : null,
      });
      if (result.landed) {
        landedOrCancelled += 1;
      }
    }

    return NextResponse.json({ configured: true, candidates: live.length, synced: live.length, landedOrCancelled });
  } catch (error) {
    console.error("Cron status sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
