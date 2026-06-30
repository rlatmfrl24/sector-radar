# Sector Radar

Sector Radar는 미국 주요 섹터 ETF를 기준으로 섹터 리더십, 리더십 전환, 후반부 리더, 가짜 강세, 섹터 레벨 리스크를 설명하는 리서치 대시보드입니다.

이 프로젝트는 자동 매매나 종목 추천기가 아닙니다. 모든 판단은 상태, 전환, narrative, risks, invalidation, data freshness를 함께 보여주는 의사결정 보조 도구입니다.

## Current Product

현재 앱은 React + Vite + Cloudflare Pages/D1 경계로 동작합니다.

```text
Layer 1 흐름
  시장 tape, breadth quality, volatility pressure, 현재 RS 리더

Layer 2 여력
  ETF participation, FRED market context, risk trigger watchlist

Layer 3 리더십
  현재 RS 리더 상세, 모멘텀 선두 후보, RRG, path, treemap, selected-sector inspector

Layer 4 검증
  검증 진행 단계, 이력 진단 상태, replay 가능 범위, pattern diagnostics, 확률 게이트, scheduled audit
```

Layer 3에서는 **현재 RS 리더**와 **모멘텀 선두**를 같은 “주도섹터”로 부르지 않습니다. 둘이 다르면 오류가 아니라 리더십 전환 관찰 신호로 표시합니다.

Layer 4는 Layer 1~3 판단을 예측처럼 확장하지 않고, D1 이력에서 20D/60D forward relative diagnostics를 계산해 pattern별 historical diagnostics로 분리해 보여줍니다. 화면은 데이터 수집, replay, 패턴 진단, 확률 보정 단계를 분리해 보여주며, 이력 진단이 완료되면 `historical_ready`로 표시합니다. Calibration 전에는 확률성 판단 문구를 노출하지 않습니다.

## Architecture

```text
Local research:
CSV/provider -> Python metric engine -> SQLite

Cloudflare deployment:
Yahoo/FRED Scheduled Worker -> D1 -> Pages Function API -> React UI
```

주요 API:

```text
GET  /api/sectors
GET  /api/history
GET  /api/validation
GET  /api/validation/status
GET  /api/data/status
POST /api/refresh
```

Public Pages의 `POST /api/refresh`는 직접 Yahoo를 호출하지 않고 `refresh_unavailable_in_pages`를 반환합니다. 운영 데이터 갱신은 Scheduled Worker가 담당합니다.

## Quick Start

Python 로컬 연구 엔진:

```bash
python -m venv .venv
pip install -e ".[dev]"
python -m pytest
python -m sector_radar.api.local_server
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run test:app
npm run build
```

Cloudflare Worker checks:

```bash
cd frontend
npm run typecheck:worker
npm run test:worker
```

## Main Code Paths

| Path | Purpose |
|---|---|
| `src/sector_radar/domain/models.py` | ModuleState, RulebookOutput contracts |
| `src/sector_radar/data/store.py` | SQLite adapter facade, upsert, lookback, freshness query |
| `src/sector_radar/metrics/` | RS/RRG, breadth, participation metrics |
| `src/sector_radar/rules/sector_rulebook.py` | pattern matching, veto, narrative, risks, invalidation |
| `src/sector_radar/api/local_server.py` | local SQLite API for frontend development |
| `frontend/src/features/radar/` | 4-layer dashboard view model and components |
| `frontend/functions/api/` | Cloudflare Pages Function API |
| `frontend/workers/ingest/` | Scheduled Yahoo/FRED ingestion worker |
| `frontend/migrations/` | D1 schema migrations |

## Document Map

Read in this order:

1. `PROJECT_CHARTER.md` — product boundary and success criteria
2. `AGENTS.md` — implementation rules for agents and developers
3. `DESIGN.md` — current dashboard design system
4. `docs/02_MVP_SPEC.md` — current MVP user stories
5. `docs/03_ARCHITECTURE.md` — data and UI architecture
6. `docs/08_UI_SPEC.md` — 4-layer UI specification
7. `docs/09_API_CONTRACT.md` — API/JSON contract
8. `docs/13_CLOUDFLARE_DEPLOYMENT.md` — deployment and operations

Reference docs:

| File | Use |
|---|---|
| `docs/01_IMPLEMENTATION_PLAN.md` | roadmap and current implemented slice |
| `docs/04_DATA_MODEL.md` | SQLite/D1 table model |
| `docs/05_METRICS_AND_STATES.md` | metric formulas and state definitions |
| `docs/06_SECTOR_RULEBOOK.md` | rulebook patterns and veto rules |
| `docs/07_VALIDATION_PLAN.md` | replay and validation plan |
| `docs/10_STOCK_ENGINE_EXPANSION.md` | deferred stock funnel reference |
| `docs/11_DEVELOPMENT_WORKFLOW.md` | commands, tests, Definition of Done |
| `docs/12_AGENT_PROMPTS.md` | current agent task prompts |
| `docs/14_MARKET_DASHBOARD_BENCHMARK.md` | benchmark decision log |
| `docs/15_DATA_SOURCE_EXPANSION.md` | source expansion roadmap |
| `skills/` | role-specific agent checklists |

## Product Rules

- Do not collapse modules into one average score.
- Keep state and transition separate.
- Do not expose unvalidated probabilities, hit rates, or expected returns in the main UI.
- Keep thresholds in config or injected runtime settings.
- Surface data freshness for every dashboard output.
- Preserve module disagreement as signal.
- No automated trading, broker order placement, personalized buy/sell advice, or profit promises.
