# AGENTS.md

## Cursor Cloud specific instructions

`my-wrld` is a single Next.js 16 (App Router, Turbopack) + React 19 app: a flight/travel tracker that renders flights on a 3D globe. Package manager is **npm** (`package-lock.json`). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`).

### Database (important / non-obvious)
- Despite the `README.md` mentioning `better-sqlite3`, the runtime data layer is **`@libsql/client` (Turso/libSQL)** in `src/lib/db.ts`, which requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- For local dev, point it at a local SQLite file: `TURSO_DATABASE_URL=file:my-wrld.db` with any non-empty `TURSO_AUTH_TOKEN`. These go in `.env.local` (git-ignored). The update script creates `.env.local` automatically if it is missing.
- If both env vars are missing, `getDb()` returns `null` and all `/api/flights` routes fail with HTTP 500 — so the env file is required for any data feature to work.
- The `flights` table is auto-created and seeded on the first API request; no manual migration step is needed. The local DB file `my-wrld.db` is git-ignored. To reset data, delete `my-wrld.db` and hit an API route again.
- The `supabase/` directory and `supabase_export.json` are legacy/unused by the runtime; do not run Supabase.

### Run / test / build
- Dev server: `npm run dev` → http://localhost:3000 (UI + API routes under `/api/flights`).
- Lint: `npm run lint`. Note the repo currently has pre-existing lint errors (mostly `no-explicit-any` in `src/components/WorldGlobe.tsx`); these are not environment issues.
- Build: `npm run build` (production build; succeeds). Running `build` overwrites `.next`, which is also used by `npm run dev` — if you build while the dev server is running, restart `npm run dev` afterward (optionally `rm -rf .next` first) to avoid a stale/confused dev state.
- Quick API check: `curl http://localhost:3000/api/flights` (GET list), POST to the same path to create a flight.
