import { getDb } from "@/lib/db";

export const LOOKUP_TTL_MS = 12 * 60 * 60 * 1000; // schedules are stable: 12h
export const STATUS_TTL_MS = 30 * 1000; // live status: 30s (matches client poll)
export const EVICT_AFTER_MS = 2 * LOOKUP_TTL_MS; // safely past every TTL

/**
 * Tiny TTL cache backed by the `aeroapi_cache` table. Used to avoid repeated
 * (billed, rate-limited) AeroAPI calls for the same lookup/status within a window.
 */

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT payload, fetched_at FROM aeroapi_cache WHERE cache_key = ?",
    args: [key],
  });
  if (res.rows.length === 0) return null;

  const fetchedAt = Date.parse(String(res.rows[0].fetched_at));
  if (Number.isNaN(fetchedAt) || Date.now() - fetchedAt >= ttlMs) return null;

  try {
    return JSON.parse(String(res.rows[0].payload)) as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO aeroapi_cache (cache_key, payload, fetched_at)
          VALUES (?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    args: [key, JSON.stringify(payload), new Date().toISOString()],
  });

  // Opportunistically evict rows past the longest TTL so the table doesn't
  // grow without bound.
  const cutoff = new Date(Date.now() - EVICT_AFTER_MS).toISOString();
  await db.execute({
    sql: "DELETE FROM aeroapi_cache WHERE fetched_at < ?",
    args: [cutoff],
  });
}
