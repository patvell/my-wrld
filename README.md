# my-wrld

A personal flight diary that visualizes your journeys on an interactive 3D globe and as animated digital boarding passes.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack), React 19
- **Database:** libSQL / Turso via `@libsql/client` (works against a local SQLite file or a remote Turso DB)
- **Styling:** Tailwind CSS v4
- **3D / animation:** `react-globe.gl` (three.js) and `framer-motion`

## Setup
1. **Install dependencies:** `npm install`
2. **Configure the database:** copy `.env.example` to `.env.local` and set the two variables. For fully local development you can point at a SQLite file:
   ```
   TURSO_DATABASE_URL=file:my-wrld.db
   TURSO_AUTH_TOKEN=local-dev-token
   ```
3. **Run the dev server:** `npm run dev` then open http://localhost:3000

The `flights` table is created and seeded automatically on the first API request.

## Scripts
- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run test` - unit tests (Vitest)
- `npm run format` - format with Prettier

## Notes
- Flight times are stored as **local wall-clock at each airport** (`YYYY-MM-DDTHH:mm`); the airport's IANA timezone (from `src/data/airports.ts`) is used to derive absolute instants for "is it past / live now" logic. See `src/lib/time.ts`.
- The app is single-tenant today but the data model and API are scoped by `user_id` so authentication can be added without a schema change (see `getUserId` in `src/lib/auth.ts`).
