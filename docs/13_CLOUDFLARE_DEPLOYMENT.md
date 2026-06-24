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

## 3.1 GitHub Actions Deployment

The repository uses GitHub Actions for reproducible validation and Cloudflare deployment:

```text
.github/workflows/ci.yml
.github/workflows/deploy-cloudflare.yml
```

`ci.yml` runs on pull requests, pushes to `main`, and manual dispatch:

```text
Python 3.11 tests
Frontend dependency install
Worker typecheck
Worker unit tests
Vite build
```

`deploy-cloudflare.yml` runs on pushes to `main` and manual dispatch:

```text
npm run test:worker
npm run build
wrangler pages deploy dist --project-name=sector-radar --branch=production
wrangler deploy --config wrangler.ingest.jsonc
```

Required GitHub repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

`CLOUDFLARE_API_TOKEN` must never be committed. Create it in the Cloudflare dashboard and store it
only as a GitHub Actions secret.

Recommended token setup for this project:

```text
Dashboard
  -> My Profile
  -> API Tokens
  -> Create Token
  -> Start from "Edit Cloudflare Workers" template or create a custom token

Permissions:
  Account / Account Settings / Read
  Account / Cloudflare Pages / Edit
  Account / Workers Scripts / Edit
  Account / D1 / Edit

Account resources:
  Include / 397love@gmail.com's Account

Zone resources:
  Include / All zones
```

The `Edit Cloudflare Workers` template is the closest preset for Wrangler-based Worker deployment.
Add `Cloudflare Pages / Edit` so `wrangler pages deploy` can publish the dashboard, and add `D1 / Edit`
so the Worker deployment can keep the existing D1 binding stable.

After the token is created, add or update GitHub repository secrets:

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo rlatmfrl24/sector-radar --body "46e1801b290196fbec7cfae87710ffcf"
gh secret set CLOUDFLARE_API_TOKEN --repo rlatmfrl24/sector-radar --body "<PASTE_TOKEN_HERE>"
```

This project intentionally keeps the existing Cloudflare Pages Direct Upload boundary. Direct upload
via GitHub Actions keeps Pages and the Scheduled Worker in one reviewed pipeline.

Worker checks:

```bash
cd frontend
npm run cf:ingest:types
npm run typecheck:worker
npm run test:worker
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
