# 13. Cloudflare Deployment

## 1. Direction

Sector Radar UI is deployed as a Cloudflare Pages app.

```text
React + Vite
  -> Cloudflare Pages static assets
  -> Pages Function API
  -> Cloudflare D1
```

The Python package remains the local-first research engine for ingestion, metrics, rulebook output, replay, and validation.

## 2. Database Boundary

Local research:

```text
CSV/provider -> Python metric engine -> SQLite
```

Cloudflare deployment:

```text
Yahoo chart adapter -> Scheduled Worker -> D1 -> Pages Function API -> React UI
```

D1 uses SQLite semantics, so the MVP base schema is mirrored in:

```text
frontend/migrations/0001_sector_radar_base.sql
```

## 3. Frontend Project

```text
frontend/
  src/
  functions/api/sectors.ts
  workers/ingest/
  migrations/
  wrangler.jsonc
  wrangler.ingest.jsonc
```

Commands:

```bash
cd frontend
npm install
npm run dev
npm run build
```

## 3.1 Cloudflare Pages Git Integration

The frontend deployment target is Cloudflare Pages Git integration, not GitHub Actions.

```text
GitHub main branch
  -> Cloudflare Pages Git integration
  -> Cloudflare Pages build
  -> Pages Functions + static assets
```

Current build settings for Cloudflare Pages:

```text
Production branch: main
Root directory: frontend
Build command: npm run build
Build output directory: dist
```

The existing `sector-radar` Pages project was originally created as a Direct Upload project
(`Git Provider = No` in `wrangler pages project list`). To make Cloudflare build the repository
directly on every `main` push, connect the GitHub repository in the Cloudflare dashboard:

```text
Workers & Pages
  -> sector-radar
  -> Settings
  -> Builds
  -> Git Repository / Connect Git
  -> rlatmfrl24/sector-radar
  -> Production branch: main
  -> Root directory: frontend
  -> Build command: npm run build
  -> Build output directory: dist
```

If Cloudflare does not offer "Connect Git" on the existing Direct Upload project, create a new
Pages project through "Create application -> Pages -> Connect to Git" with the same settings, then
move the production/custom domain to that Git-integrated project. The Scheduled Worker and D1
database can stay unchanged.

Cloudflare Pages Git integration automatically builds and deploys when `main` receives a commit.
GitHub Actions secrets are not required for Pages deployment.

Local validation remains:

```bash
cd frontend
npm run typecheck:worker
npm run test:worker
npm run build
```

Scheduled Worker deployment is still separate from Pages Git integration. Cloudflare Pages Git
integration builds the dashboard only; it does not deploy the cron Worker.

To also deploy the cron Worker without GitHub Actions, connect the existing
`sector-radar-ingest` Worker to the same GitHub repository through Cloudflare Workers Builds:

```text
Workers & Pages
  -> sector-radar-ingest
  -> Settings
  -> Builds
  -> Connect
  -> Repository: rlatmfrl24/sector-radar
  -> Git branch: main
  -> Root directory: frontend
  -> Build command: npm run typecheck:worker && npm run test:worker
  -> Deploy command: npm run cf:ingest:deploy
```

The Worker name in Cloudflare must match `name` in `frontend/wrangler.ingest.jsonc`:

```text
sector-radar-ingest
```

If Workers Builds is not connected, deploy the Worker with Wrangler when
`frontend/workers/ingest/` or `frontend/wrangler.ingest.jsonc` changes:

```bash
cd frontend
npm run cf:ingest:deploy
```

## 4. D1 Setup

```bash
cd frontend
npx wrangler d1 create sector-radar
```

Copy the returned `database_id` into `frontend/wrangler.jsonc`.
Copy the same `database_id` into `frontend/wrangler.ingest.jsonc`.

Apply migrations:

```bash
npx wrangler d1 migrations apply sector-radar --local
npx wrangler d1 migrations apply sector-radar --remote
```

## 5. Pages Function API

Current endpoint:

```text
GET /api/sectors
GET /api/data/status
POST /api/refresh
```

`GET /api/sectors` reads the latest `sector_metrics_daily` rows and returns the existing Sector Snapshot contract plus `data_connection`.

`POST /api/refresh` is intentionally disabled on public Cloudflare Pages. It returns `refresh_unavailable_in_pages` because the Scheduled Worker owns Cloudflare refresh and enforces the upstream 15 minute gate.

## 6. Scheduled Yahoo Research Ingestion

The deployable ingestion path is a separate Worker:

```text
frontend/workers/ingest/index.ts
frontend/wrangler.ingest.jsonc
```

Configuration:

```jsonc
{
  "triggers": {
    "crons": ["*/15 * * * *"]
  }
}
```

Cloudflare cron executes on UTC time. The UI converts timestamps to the user's local timezone and currently surfaces KST when the browser timezone is `Asia/Seoul`.

The Worker:

- fetches Yahoo chart daily data through a Worker-compatible adapter
- keeps each cron run under the external fetch budget by fetching core ETFs first, Layer 2 proxies second, and a deterministic shard of representative holdings last
- fetches existing symbols incrementally and only missing symbols with full history, so one new holding does not force a full-year rewrite for every symbol
- writes raw long-format rows to `series_daily`
- computes RS/RRG, breadth, participation, and Layer 2 proxy context
- upserts latest sector snapshots into `sector_metrics_daily`
- updates `data_refresh_status` with last attempt, last success, next allowed refresh, latest price date, symbol count, and rows upserted
- records each cron lifecycle in `run_log`, including stale `refreshing` recovery and final success/failure messages
- keeps `validation_status = unvalidated` and `expose_probability = 0`

Default ingestion vars:

```jsonc
{
  "REFRESH_INTERVAL_MINUTES": "15",
  "YAHOO_FETCH_BUDGET": "38",
  "YAHOO_FETCH_CONCURRENCY": "2"
}
```

Yahoo host fallback uses `query2.finance.yahoo.com` first and `query1.finance.yahoo.com` second. Provider failure messages include host/status/body preview details so blocked Worker-origin requests can be diagnosed from `data_refresh_status.message`.

Deploy:

```bash
cd frontend
npm run cf:ingest:deploy
```

Local scheduled testing:

```bash
cd frontend
npm run cf:ingest:dev
```

## 7. Local Yahoo Research Refresh

Local development can run a Python API next to Vite:

```bash
python -m sector_radar.api.local_server
```

The local API provides:

```text
GET  /api/sectors
GET  /api/data/status
POST /api/refresh
```

Yahoo Finance refresh uses `yfinance` as a research adapter and enforces a 15 minute minimum upstream call interval. Manual refresh uses the same gate. The UI shows provider, freshness, last success, next allowed refresh, and sample/read-only mode.

## 8. Layer 2 Data Availability

Layer 2 is split into three availability classes:

| Input | Cloudflare Yahoo status | Notes |
|---|---|---|
| ETF Participation | Live | Uses sector ETF OHLCV for RVOL, OBV slope, and CMF. |
| Dollar / FX Gate | Live/proxy | Uses Yahoo DXY and USD/KRW proxy symbols. Validate symbol availability before relying on it. |
| VIX / Credit | Proxy | VIX is directly available; HY OAS is represented only through credit ETF proxies. |
| Fed Policy / WALCL | Proxy/hold | Yahoo can provide rate/ETF proxies but not official balance sheet data. |
| KRX foreign flow | Hold | Requires KRX or manual ledger, not Yahoo. |
| MMF total assets | Proxy/hold | Cash ETF proxies are available; official MMF totals require FRED/ICI data. |
| Margin debt / leverage | Proxy/hold | Leveraged ETF proxies are available; official margin debt requires external data. |

Proxy signals must be displayed as proxy signals in `source_metrics` and UI copy. They must not be presented as official source data.

## 9. Safety Policy

- `validation.status` starts as `unvalidated`.
- `validation.expose_probability` must remain `false` before calibration.
- UI must show patterns, states, transitions, narrative, risks, invalidation, and freshness.
- UI must not show personalized buy/sell advice.
- Yahoo/yfinance/Yahoo chart data is for research use; do not redistribute raw OHLCV data through the UI.
- Public or commercial deployment should confirm data rights or swap the provider interface to a licensed market data source.
