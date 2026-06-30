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
Worker generated type drift check
App and Pages Functions tests
Worker typecheck
Worker unit tests
Vite build
```

`deploy-cloudflare.yml` runs on pushes to `main` and manual dispatch:

```text
npm run cf:ingest:types:check
npm run test:app
npm run test:worker
npm run build
wrangler deploy --config wrangler.ingest.jsonc --dry-run
wrangler d1 migrations apply sector-radar --remote --config wrangler.jsonc
wrangler pages deploy dist --project-name=sector-radar --branch=production
wrangler deploy --config wrangler.ingest.jsonc
```

The workflow is triggered by pushes to `main`, but the current Cloudflare Pages project uses
`production` as its production branch label. Keep `--branch=production` unless the Pages project
production branch is changed in Cloudflare.

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
GET /api/history
GET /api/validation
GET /api/validation/status
POST /api/refresh
```

`GET /api/sectors` reads the latest `sector_metrics_daily` rows and returns the existing Sector Snapshot contract plus `data_connection`, provider-specific `data_connections`, top-level `market_context`, and proxy leadership `concentration`.

`GET /api/history` returns bounded RRG and market-context trails for UI path rendering. `GET /api/validation` returns Layer 4 historical diagnostics from D1 while keeping `expose_probability = false`. `GET /api/validation/status` is the compact monitor endpoint for Layer 4 data health and scheduled audit status.

`POST /api/refresh` is intentionally disabled on public Cloudflare Pages. It returns `refresh_unavailable_in_pages` because the Scheduled Worker owns Cloudflare refresh and enforces the upstream refresh gate.

Production UI smoke-check expectations:

```text
Top tabs:
  흐름 / Layer 1
  여력 / Layer 2
  리더십 / Layer 3
  검증 / Layer 4

Layer 1:
  Shows market tape, breadth quality, risk/vol, flow judgement.
  Freshness panel is scoped to Layer 1 helper series such as SPY, QQQ, RSP, IWM, ^VIX.

Layer 2:
  Shows ETF participation, official FRED market context, and risk trigger watchlist.
  Freshness panel is scoped to Yahoo sector prices and FRED/context rows, not Layer 1 tape rows.

Layer 3:
  Shows current RS leader and momentum leader as separate concepts.
  Default selected inspector follows the Layer 1 current RS leader.
  Momentum rail remains sorted by RS Momentum so the rail leader can differ from the selected inspector.

Layer 4:
  Shows validation gate, replay availability, pattern diagnostics, scheduled audit status, and data limits only when they are real blockers.
  Keeps probability hidden even when historical diagnostics are ready.
```

## 6. Scheduled Research Ingestion

The deployable ingestion path is a separate Worker:

```text
frontend/workers/ingest/index.ts
frontend/wrangler.ingest.jsonc
```

Configuration:

```jsonc
{
  "triggers": {
    "crons": ["*/15 23 * * SUN-FRI", "*/15 0 * * MON-FRI", "*/15 20-22 * * MON-FRI"]
  }
}
```

Cloudflare cron executes on UTC time. The configured windows cover the US post-close period across daylight saving time. The Worker still makes the final decision using `America/New_York` market time and skips external calls outside the optimized windows. The UI converts timestamps to the user's local timezone and currently surfaces KST when the browser timezone is `Asia/Seoul`.

The Worker:

- fetches Yahoo chart daily data through a Worker-compatible adapter
- fetches FRED observations through REST when `FRED_API_KEY` is configured
- leaves KRX context refresh disabled by default until a directly useful KRX investor-flow or leverage source is selected
- treats Layer 1 and Layer 3 as daily-close sector snapshots, not 15 minute intraday signals
- runs a post-close core phase for benchmark and sector ETFs
- runs later post-close holding phases for representative holdings only, so breadth coverage fills quickly without refetching core ETFs every time
- skips Yahoo calls when core and representative holdings already have the latest daily close
- fetches existing symbols incrementally and only missing symbols with full history, so one new holding does not force a full-year rewrite for every symbol
- writes raw long-format rows to `series_daily`
- computes RS/RRG, multi-window RRG evidence, breadth, participation, and Layer 2 context
- upserts validation-length sector snapshot history into `sector_metrics_daily`
- upserts Layer 2 context cards into `market_context_daily`
- runs Layer 4 validation audit after each scheduled refresh and records `run_type = layer4_validation_audit`
- updates `data_refresh_status` independently for active providers
- records each cron lifecycle in `run_log`, including stale `refreshing` recovery and final success/failure messages
- keeps `validation_status = unvalidated` and `expose_probability = 0`

Default ingestion vars:

```jsonc
{
  "REFRESH_INTERVAL_MINUTES": "15",
  "ENABLE_INTRADAY_CORE_REFRESH": "false",
  "YAHOO_CORE_FETCH_BUDGET": "32",
  "YAHOO_FETCH_BUDGET": "38",
  "YAHOO_HOLDINGS_FETCH_BUDGET": "38",
  "YAHOO_FETCH_CONCURRENCY": "2",
  "VALIDATION_HISTORY_DAYS": "260",
  "FRED_REFRESH_INTERVAL_MINUTES": "720",
  "ENABLE_KRX_CONTEXT_REFRESH": "false",
  "KRX_REFRESH_INTERVAL_MINUTES": "1440",
  "KRX_CONTEXT_ENDPOINT": "http://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd,http://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"
}
```

`YAHOO_FETCH_BUDGET` remains as a backward-compatible fallback. New deployments should tune
`YAHOO_CORE_FETCH_BUDGET` and `YAHOO_HOLDINGS_FETCH_BUDGET` separately. Keeping intraday core
refresh disabled is the default because the current metrics are daily OHLCV based:

```text
RS/RRG: 50D RS Ratio and 10D RS Momentum
Breadth: 20/50/200D moving-average participation
ETF participation: 20D RVOL, OBV slope, and CMF
```

Recommended operating model:

| Provider | Window | Interval | Purpose |
|---|---:|---:|---|
| Yahoo core | 16:20-16:45 ET | 15 min gate inside cron | Daily Layer 1/3 snapshot base |
| Yahoo holdings | 16:45-20:00 ET | 15 min gate inside cron | Breadth shard fill and snapshot recompute |
| FRED | 16:45-18:00 ET | 720 min default | Official Layer 2 macro observations |
| KRX | disabled by default | opt-in only | Deferred until a directly useful investor-flow or leverage source is selected |
| off_window | all other times | none | Preserve last successful snapshot and write run log skip entries |

If an intraday preview is enabled later, keep it core-only and label it provisional in the UI.

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

Secrets:

```bash
cd frontend
npx wrangler secret put FRED_API_KEY --config wrangler.ingest.jsonc
npx wrangler secret put KRX_API_KEY --config wrangler.ingest.jsonc
```

FRED is optional at runtime. If its secret is missing or an endpoint shape changes, only FRED market context becomes failed/stale; Yahoo sector snapshots remain available. KRX remains an opt-in research adapter and is not part of active US Sector Radar Layer 2 by default.

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

Layer 2 is split by `source_class`:

| Input | Preferred source | Fallback | Notes |
|---|---|---|
| ETF Participation | Yahoo OHLCV | none | Uses sector ETF RVOL, OBV slope, and CMF. |
| Fed Policy / WALCL | FRED `WALCL`, `DFF/SOFR`, `DGS2`, `DFII5` | none in active Layer 2 | `DFII5` is the nearest official TIPS real-yield series used here; `DFII2` is not a valid FRED series. |
| Dollar / FX Gate | FRED `DEXKOUS`, `DTWEXBGS` | none in active Layer 2 | Yahoo DXY/USDKRW proxy is not shown as an official substitute. |
| VIX / Credit | FRED `BAMLH0A0HYM2`, `VIXCLS` | none in active Layer 2 | HY OAS should not be represented as ETF data. |
| KRX foreign flow | separate KRX investor-flow source needed | excluded from active Layer 2 | Current KRX OpenAPI stock endpoints expose daily trading value, volume, and market cap. Foreign-flow is deferred for US Sector Radar. |
| Bank reserve balances | FRED `WRESBAL` | none in active Layer 2 | WRESBAL is bank reserve balances and must not be labelled as official MMF total assets. |
| Credit / leverage proxy | FINRA monthly margin statistics or FRED broker/dealer margin-loan proxy | excluded from active Layer 2 | Leveraged ETF proxies are not shown as margin debt substitutes. |

Proxy signals must be displayed as proxy signals in `source_metrics`, `market_context.source_class`, and UI copy. They must not be presented as official source data.

## 9. Safety Policy

- `validation.status` starts as `unvalidated`.
- `validation.expose_probability` must remain `false` before calibration.
- UI must show patterns, states, transitions, narrative, risks, invalidation, and freshness.
- UI must not show personalized buy/sell advice.
- Yahoo/yfinance/Yahoo chart data is for research use; do not redistribute raw OHLCV data through the UI.
- Public or commercial deployment should confirm data rights or swap the provider interface to a licensed market data source.
