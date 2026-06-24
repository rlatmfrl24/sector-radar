# Sector Radar Frontend

React + Vite dashboard for Sector Radar, structured for Cloudflare Pages deployment.

## Local React Dev

```bash
npm install
npm run dev
```

The Vite dev server fetches `/api/sectors`. If that endpoint is unavailable locally, the UI falls back to deterministic sample sector snapshots.

Run the local Python API in a second terminal when you want live SQLite/Yahoo refresh data:

```bash
python -m sector_radar.api.local_server
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8787`.

## Cloudflare Pages + D1

1. Create the D1 database:

```bash
npx wrangler d1 create sector-radar
```

2. Copy the returned `database_id` into `wrangler.jsonc`.

3. Apply migrations:

```bash
npx wrangler d1 migrations apply sector-radar --local
npx wrangler d1 migrations apply sector-radar --remote
```

4. Build and preview Pages:

```bash
npm run build
npm run cf:dev
```

5. Deploy manually when needed:

```bash
npm run cf:deploy
```

Production deployment normally runs from GitHub Actions on every `main` push:

```text
.github/workflows/deploy-cloudflare.yml
```

The workflow builds the Vite dashboard, deploys `dist` to Cloudflare Pages, then deploys the
scheduled ingest Worker from `wrangler.ingest.jsonc`.

## Cloudflare Scheduled Ingestion

The deployed UI stays on Cloudflare Pages. Yahoo Finance research ingestion runs in a separate
Scheduled Worker that writes snapshots into the same D1 database.

The Worker treats Layer 1 and Layer 3 as daily-close snapshots. It keeps Yahoo requests below the
Cloudflare Free plan subrequest limit by separating the post-close core snapshot from later
representative-holding breadth shards.
Defaults live in `wrangler.ingest.jsonc`:

```jsonc
{
  "REFRESH_INTERVAL_MINUTES": "15",
  "ENABLE_INTRADAY_CORE_REFRESH": "false",
  "YAHOO_CORE_FETCH_BUDGET": "32",
  "YAHOO_FETCH_BUDGET": "38",
  "YAHOO_HOLDINGS_FETCH_BUDGET": "38",
  "YAHOO_FETCH_CONCURRENCY": "2"
}
```

1. Copy the same D1 `database_id` into both files:

```text
wrangler.jsonc
wrangler.ingest.jsonc
```

2. Generate Worker binding types after changing `wrangler.ingest.jsonc`:

```bash
npm run cf:ingest:types
```

3. Test the ingest Worker locally:

```bash
npm run cf:ingest:dev
```

4. Deploy the ingest Worker and its optimized post-close cron:

```bash
npm run cf:ingest:deploy
```

Cron runs are configured for the US post-close UTC window:

```jsonc
["*/15 20-23 * * 1-5", "*/15 0-2 * * 2-6"]
```

The Worker still checks `America/New_York` time internally. Outside the post-close core/holdings
windows it records a skip run log and does not call Yahoo.

## Data Boundary

- Python remains the local research engine.
- Cloudflare Scheduled Worker is the deployable Yahoo research ingestion path.
- Cloudflare D1 is the deployable relational store for the frontend/API surface.
- Pages Function endpoint: `GET /api/sectors`.
- Pages public `POST /api/refresh` stays disabled; cron owns Cloudflare refresh.
- UI must not expose probabilities while `validation.status` is `unvalidated`.
- Raw Yahoo OHLCV is not exposed through the UI API.
