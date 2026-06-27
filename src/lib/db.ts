import { createClient, type Client } from '@libsql/client';
import path from 'path';
import { SEED_FLIGHTS } from '@/lib/seed';
import { DEFAULT_USER_ID } from '@/lib/config';
import { normalizeWallClock } from '@/lib/time';

let client: Client | null = null;
let initPromise: Promise<Client> | null = null;

function resolveConfig(): { url: string; authToken?: string } {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return { url, authToken };
  }

  const localDbPath = path.join(process.cwd(), 'my-wrld.db');
  console.warn(
    `Turso environment variables not found. Using local SQLite database at ${localDbPath}`,
  );
  return { url: `file:${localDbPath}` };
}

async function migrate(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS flights (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      origin_code TEXT NOT NULL,
      origin_city TEXT NOT NULL,
      destination_code TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      flight_number TEXT,
      status TEXT,
      type TEXT,
      confirmed_at TEXT,
      user_id TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS aeroapi_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    )
  `);

  const count = await db.execute('SELECT COUNT(*) as c FROM flights');
  if (Number(count.rows[0].c) === 0) {
    for (const f of SEED_FLIGHTS) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO flights (id, created_at, origin_code, origin_city, destination_code, destination_city, departure_time, arrival_time, status, type, flight_number, confirmed_at, user_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [f.id, f.created_at, f.origin_code, f.origin_city, f.destination_code, f.destination_city, f.departure_time, f.arrival_time, f.status, f.type, f.flight_number, f.confirmed_at, f.user_id],
      });
    }
  }

  await db.execute({
    sql: 'UPDATE flights SET user_id = ? WHERE user_id IS NULL',
    args: [DEFAULT_USER_ID],
  });

  const legacy = await db.execute(
    'SELECT id, departure_time, arrival_time FROM flights WHERE length(departure_time) > 16 OR length(arrival_time) > 16',
  );
  for (const row of legacy.rows) {
    await db.execute({
      sql: 'UPDATE flights SET departure_time = ?, arrival_time = ? WHERE id = ?',
      args: [
        normalizeWallClock(String(row.departure_time)),
        normalizeWallClock(String(row.arrival_time)),
        String(row.id),
      ],
    });
  }
}

export async function getDb(): Promise<Client> {
  if (client) return client;
  if (!initPromise) {
    initPromise = (async () => {
      const { url, authToken } = resolveConfig();
      const db = authToken
        ? createClient({ url, authToken })
        : createClient({ url });
      await migrate(db);
      client = db;
      return db;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
