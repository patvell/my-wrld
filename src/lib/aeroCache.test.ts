import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake of the libSQL client, shared with the mocked getDb.
const store = vi.hoisted(() => new Map<string, { payload: string; fetched_at: string }>());

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    execute: async (q: { sql: string; args: unknown[] }) => {
      if (q.sql.startsWith("SELECT")) {
        const row = store.get(String(q.args[0]));
        return { rows: row ? [row] : [] };
      }
      // INSERT ... ON CONFLICT upsert
      const [key, payload, fetched_at] = q.args as string[];
      store.set(key, { payload, fetched_at });
      return { rows: [] };
    },
  }),
}));

import { getCached, setCached } from "@/lib/aeroCache";

describe("aeroCache", () => {
  beforeEach(() => store.clear());

  it("returns a cached value within the TTL", async () => {
    await setCached("k", { a: 1 });
    expect(await getCached<{ a: number }>("k", 60_000)).toEqual({ a: 1 });
  });

  it("returns null when the entry is older than the TTL", async () => {
    await setCached("k", { a: 1 });
    expect(await getCached("k", 0)).toBeNull();
  });

  it("returns null for a missing key", async () => {
    expect(await getCached("missing", 60_000)).toBeNull();
  });
});
