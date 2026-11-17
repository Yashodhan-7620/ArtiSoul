# Deploying ArtiSoul on Cloudflare

The whole app runs as **one Cloudflare Worker**:

| Part | Runs on |
| --- | --- |
| React frontend (`frontend/dist`) | Workers static assets (SPA fallback for deep links) |
| Express API (`/api/*`) | The Worker, via `backend/src/worker.mjs` + `nodejs_compat` |
| Uploaded photos / videos / `.glb` (`/uploads/*`) | R2 bucket `artisoul-uploads` |
| MySQL | Your hosted MySQL, reached through **Hyperdrive** |

Everything is on one HTTPS origin, so the camera, AR and Razorpay all work, and
no CORS settings are needed. `npm run dev` on your own machine still works
exactly as before (disk uploads, local MySQL).

## 1. Get a MySQL database on the internet

Cloudflare can't reach the MySQL on your laptop, so you need a hosted one
(free tiers: Aiven for MySQL, TiDB Cloud Serverless, Railway, etc.).
Then load the schema **and every migration, in order**, into it:

```powershell
# either copy your local data across …
mysqldump -u root -p artisoul > artisoul_dump.sql
mysql -h <host> -P <port> -u <user> -p <db> < artisoul_dump.sql

# … or start empty: run backend\artisoul_phase1_schema.sql, then phase4 … phase10
```

## 2. One-time setup + first deploy (PowerShell, repo root)

```powershell
npm run cf:setup
```

This script:
1. installs dependencies,
2. runs `wrangler login` (opens the browser),
3. creates the R2 bucket `artisoul-uploads`,
4. asks for your hosted MySQL connection string
   (`mysql://user:password@host:3306/artisoul`), creates a Hyperdrive config and
   writes its id into `wrangler.jsonc`,
5. builds the frontend and deploys,
6. uploads `JWT_SECRET`, `TEST_KEY_ID`, `TEST_KEY_SECRET` from `backend\.env` as
   Worker secrets.

The site is then live at `https://artisoul.<your-subdomain>.workers.dev`.

Products created before the move keep their files if you copy them to R2:

```powershell
npm run cf:upload-existing
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run cf:deploy` | Rebuild the frontend and deploy |
| `npm run cf:logs` | Live logs from the deployed Worker |
| `npm run cf:dev` | Run the Worker locally (see below) |
| `npx wrangler secret put JWT_SECRET` | Change a secret |

### Running the Worker locally (`npm run cf:dev`)

Uses a local R2 simulation and your local MySQL. Before the first run:

```powershell
# secrets for local runs (this file is git-ignored)
Get-Content backend\.env | Select-String '^(JWT_SECRET|TEST_KEY_ID|TEST_KEY_SECRET)=' | % Line | Set-Content .dev.vars
# point Hyperdrive at your local MySQL for this terminal session
$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = "mysql://root:<password>@127.0.0.1:3306/artisoul"
npm run cf:dev
```

## What changed in the code

- `backend/src/worker.mjs`: Worker entry, which hands requests to the existing Express app.
- `backend/src/config/runtime.js`: detects Node vs. Workers and exposes the bindings.
- `backend/src/config/db.js`: on Workers, `pool.query` opens a per-query
  connection through Hyperdrive, which does the real pooling. The local pool is unchanged.
- `backend/src/utils/storage.js` + `routes/uploadRoutes.js`: uploads are
  buffered in memory, then saved to disk (local) or R2 (Workers). `/uploads/*` is
  served from R2 with Range support for video seeking.
- `backend/package.json`: `overrides.iconv-lite = ^0.7.3`. Express 4 ships
  iconv-lite 0.4, which can't be bundled for Workers; 0.7 has the same API.
- `wrangler.jsonc` and `scripts/cloudflare/*.ps1`: deployment config and helpers.

## Limits to know

- Request bodies are capped at 100 MB on the free plan (the app's own caps are 5 MB / 30 MB).
- Worker bundle is ~0.85 MB gzipped (free-plan limit is 3 MB).
- The free plan allows 100k requests/day; R2 gives 10 GB free.
