# 14. Market Dashboard Benchmark Decisions

## 1. Purpose

This document records what Sector Radar should absorb from the external benchmark project:

```text
https://market-dashboard-worker.kentafy.workers.dev/
https://github.com/lifeispf/market-dashboard
```

The goal is not to copy the full Macro -> Sector -> Stock cascade. Sector Radar remains sector-first. We absorb only the screens and data flows that improve sector leadership research, explainability, freshness, and validation discipline.

Observed benchmark endpoints:

```text
GET /api/health
GET /api/market/NASDAQ
GET /api/sectors/NASDAQ
GET /api/history/NASDAQ
GET /api/verification/NASDAQ
GET /api/stocks/NASDAQ
```

`/api/briefing/NASDAQ` was unavailable when reviewed and is not a dependency.

## 2. Decision Principles

Any borrowed feature must pass these constraints:

1. It must support Sector Radar's sector-first MVP.
2. It must preserve module disagreement instead of collapsing modules into one average score.
3. It must distinguish state from transition.
4. It must expose source, frequency, freshness, and warnings.
5. It must not expose unvalidated probabilities, return forecasts, or buy/sell advice.
6. It must degrade cleanly when FRED, KRX, Yahoo, or manual inputs are unavailable.

## 3. Adopted Already

The following benchmark concepts have already been absorbed into the current architecture:

| Benchmark concept | Sector Radar implementation |
|---|---|
| Provider freshness/status | `data_connections`, `FreshnessBar` |
| Layer 2 official/proxy separation | `market_context_daily`, `source_class`, FRED/KRX/Yahoo priority |
| Multi-window RRG | 1M/3M/6M/12M RRG evidence and UI strip |
| RRG history trail | `/api/history` and selected-sector RRG trail |
| Verification separated from main 판단 | `/api/validation`, `VerificationPanel`, `expose_probability = false` |
| Common engine envelope idea | Module state + rulebook output contracts retained |
| Source freshness table | `source_freshness`, expandable `SourceFreshnessPanel` |
| Trigger watchlist | system-generated `watchlist` rows in Layer 2 |
| Context reconciliation | qualitative `context_reconciliation` banner |
| History timeframe selector | `/api/history?timeframe=30D|90D|180D` |
| Leadership flow separation | Layer 3 separates current RS leader from momentum leader candidates |

## 4. Implemented Screens And Remaining Upgrades

### 4.1 Source Freshness Table — Implemented

Benchmark signal:

`/api/market/NASDAQ` returns a `freshness` list with label, source, frequency, last date, and stale flag.

Why it is useful:

Users need to know whether an interpretation is based on current Yahoo prices, stale FRED macro data, missing KRX flow, or manual ledger values.

Current UI:

```text
Top freshness chip -> opens SourceFreshnessPanel
ContextRail -> compact layer-specific status row
FreshnessBar -> scopes rows by active Layer 1/2/3 tab
```

Proposed fields:

```json
{
  "label": "HY OAS",
  "provider": "fred",
  "series_id": "FRED:BAMLH0A0HYM2",
  "frequency": "daily",
  "latest_date": "2026-06-22",
  "stale": false,
  "source_class": "official",
  "warning": null
}
```

Implemented contract:

1. `source_freshness` is returned by `/api/sectors`.
2. It is derived from `series_daily`, `market_context_daily`, and `data_refresh_status`.
3. Rows are grouped by active provider and scoped by selected Layer.
4. Staleness uses provider-specific cadence.

Definition of done:

```text
Every Layer 2 card can be traced to source, date, provider, and stale status.
Missing FRED data appears as unavailable, not as zero or neutral.
KRX-only candidates stay out of active US Sector Radar until a directly useful source is connected.
```

### 4.2 Trigger Watchlist — Implemented

Benchmark signal:

`/api/market/NASDAQ` returns a `watchlist` with label, trigger, meaning, and status.

Why it is useful:

Sector Radar needs invalidation and risk monitoring beyond the current snapshot. A watchlist turns Layer 2 into actionable research monitoring without becoming trading advice.

Current UI:

```text
Layer 2 -> Trigger Watchlist panel
Rows: indicator / trigger / meaning / status / source_class
```

Initial watchlist items:

| Indicator | Trigger | Meaning | Source |
|---|---|---|---|
| WALCL | weekly contraction persists | liquidity support fading | FRED |
| DXY / USDKRW | dollar uptrend accelerates | risk-asset pressure | FRED |
| HY OAS / VIX | spread + volatility expansion | credit regime pressure | FRED |
| Breadth | leaders rise while breadth narrows | late-cycle or mega-cap dependence | Yahoo holdings |
| KRX foreign flow | sustained net selling | deferred reference gate | excluded from active watchlist until a licensed or KRX investor-flow source is connected |
| Manual catalyst | reversal or invalidation | rulebook downgrade | manual ledger |

Implemented contract:

1. `/api/sectors.watchlist` exposes system-generated rows.
2. Rows are generated from latest market context, breadth, concentration, and static rule definitions.
3. Manual catalyst ledger rows remain deferred until freshness is trackable.
4. Statuses remain qualitative: `quiet`, `fired`, `unknown`, `manual_check`.

Definition of done:

```text
No watchlist row uses probability or recommendation language.
Every fired trigger explains why it matters and what would invalidate it.
```

### 4.3 Context Reconciliation — Implemented

Benchmark signal:

`/api/market/NASDAQ` exposes `reconciliation` to compare market price regime and liquidity/fuel context.

Why it is useful:

The most valuable signal is often disagreement: sector leadership is strong while credit/fx/freshness deteriorates, or leadership is weak while liquidity improves.

Current UI:

```text
ContextRail:
Layer 1/2/3 scoped status segments

Layer 1:
Flow judgement and reconciliation copy

Alignment: supportive / divergent / risk rising / data insufficient
```

Allowed language:

```text
Sector leadership is constructive, but credit context is weakening.
Leadership is narrow; breadth confirmation is missing.
Context is supportive, but sector leadership has not rotated yet.
```

Avoid:

```text
BULL probability
Expected return
Target band
```

Implemented contract:

1. `context_reconciliation` is returned by `/api/sectors`.
2. It outputs `state`, `transition`, `evidence`, `warnings`, not a score.
3. It is rendered in ContextRail and Layer 1 interpretation.

Definition of done:

```text
Module disagreement remains visible.
No composite average or market direction prediction is displayed.
```

### 4.4 Real Concentration Panel

Benchmark signal:

`/api/sectors/NASDAQ` returns `hhi`, `effective_n`, `top1_cap_pct`, `top3_cap_pct`, and YTD contribution measures.

Why it is useful:

It directly improves late-leader, mega-cap dependence, and false-leadership detection.

Current limitation:

Sector Radar currently has an RS leadership proxy concentration. It does not yet have true sector market-cap contribution.

Implementation plan:

1. Keep current `rs_leadership_estimate` clearly labeled as a supplemental estimate.
2. Add official market-cap contribution only when a reliable source is selected.
3. Store derived concentration in a separate daily table or in `sector_metrics_daily.source_metrics_json`.
4. Use concentration as a warning input, not as an average score.

Preferred output:

```json
{
  "method": "market_cap_contribution",
  "hhi": 0.18,
  "effective_sector_count": 5.5,
  "top1_contribution": 0.30,
  "top3_contribution": 0.69,
  "warnings": ["narrow_leadership"]
}
```

Definition of done:

```text
Mega-cap dependence can be identified from breadth plus concentration.
The UI says supplemental estimate when market-cap data is unavailable.
```

### 4.5 Verification Scorecard Panel

Benchmark signal:

`/api/verification/NASDAQ` exposes sample size, hit-rate-like metrics, IC, and limitations.

Why it is useful:

It gives users a place to inspect evidence quality without polluting the main dashboard with probability claims.

Constraint:

Sector Radar must not expose unvalidated probabilities or use hit-rate-like metrics in the main decision copy before its own replay/validation harness exists.

Implementation plan:

1. Keep `/api/validation` as `status: unvalidated` for now.
2. Add fields only after replay data exists locally.
3. Display any IC/hit-rate only inside the Verification panel with sample size and limitations.
4. Never feed those values into `conviction_label` until calibration is explicitly implemented.

Definition of done:

```text
Verification is clearly separated from live rulebook interpretation.
Main cards never say "승률", "확률", or "expected return".
```

### 4.6 History Explorer

Benchmark signal:

`/api/history/NASDAQ` returns sector trails, source scores, composite history, and fear-greed history.

Why it is useful:

RRG paths and context trend are more useful than a single static dot.

Implementation plan:

1. Extend current `/api/history` with Layer 2 context trend points.
2. Add a small timeframe selector for `30D`, `90D`, `180D`.
3. Use RRG trails and context state transitions.
4. Do not add fear-greed composite history until a Sector Radar-native rulebook exists.

Definition of done:

```text
User can answer: "Is this sector entering, sustaining, or exiting leadership?"
```

## 5. Deferred Features And Reasons

### 5.1 Fear & Greed Composite

Reason to defer:

It is visually useful, but it collapses different modules into a single score. That conflicts with the Sector Radar rule that module disagreement is signal, not noise.

Potential future form:

Use individual sentiment/risk modules, not one headline score.

### 5.2 BULL / HYPER Bands

Reason to defer:

Index bands can look like target ranges or forecast zones. Sector Radar is not a price-target system and should avoid implying expected return or upside probability.

Potential future form:

Show valuation or liquidity context as qualitative pressure/support, not as price bands.

### 5.3 Regime Composite / Headroom Score

Reason to defer:

The benchmark's `regime.composite` and source headroom scores are useful for a macro dashboard, but Sector Radar should not average Layer 2 inputs into one score.

Potential future form:

Represent each context card separately and add a disagreement-based reconciliation label.

### 5.4 Stock Engine

Reason to defer:

Stock ranking is explicitly after Sector Radar validation scaffolding. Pulling `/api/stocks/NASDAQ` now would blur the MVP boundary.

Potential future form:

Use it as a reference when implementing Stock Candidate Funnel after replay and validation exist.

### 5.5 Briefing Endpoint

Reason to defer:

The benchmark `/api/briefing/NASDAQ` endpoint was unavailable at review time. It is not reliable enough to become a dependency.

Potential future form:

Generate Sector Radar narrative from local rulebook outputs after data contracts stabilize.

### 5.6 Forward PER / EPS Manual Valuation

Reason to defer:

Forward PER and EPS data require a reliable licensed or manually maintained source. This belongs to valuation/macro overlay, not the first Sector Radar leadership MVP.

Potential future form:

Add a manual valuation ledger later, clearly separated from RS/RRG, breadth, and participation.

### 5.7 KRX As Core Input For US Sectors

Reason to defer:

KRX flow is useful as reference context, but US sector leadership should not depend on Korean market flow. It becomes core only in a future KOSPI mode.

Potential future form:

Keep KRX in Layer 2 as `reference` for US and promote it in a separate KOSPI universe.

### 5.8 Main-UI Hit Rate Or Return Stats

Reason to defer:

Hit rate, mean forward return, and sample-based performance can be mistaken for current probability. Until walk-forward validation and calibration are implemented, these must stay out of main sector cards.

Potential future form:

Expose them only in the Verification panel with sample size, horizon, and limitations.

## 6. Recommended Implementation Order

### Phase A — Documentation And Contract Alignment

Status: this document.

Tasks:

1. Record adopted and deferred benchmark concepts.
2. Keep API contract aligned with `market_context`, `data_connections`, `/api/history`, and `/api/validation`.
3. Ensure future work does not drift into full Macro/Stock OS before Sector Radar validation.

### Phase B — Source Freshness Table

Status: implemented as a derived `/api/sectors` field and expandable UI panel.

Implemented:

1. `source_freshness` response shape.
2. Freshness derived from `series_daily`, `market_context_daily`, and `data_refresh_status`.
3. Compact expandable `SourceFreshnessPanel` and layer-scoped `FreshnessBar`.

Remaining upgrades:

1. Move provider cadence and source labels into a source registry config.
2. Add active rows only when new adapters are connected and freshness is trackable.

Tests:

```text
Missing FRED key -> FRED rows stale/unavailable.
KRX key missing -> no active US Layer 2 impact while KRX context refresh is disabled.
Fresh Yahoo price rows -> Yahoo rows live.
```

### Phase C — Trigger Watchlist

Status: implemented as system-generated rows from latest market context, breadth, concentration, and manual placeholders.

Implemented:

1. System-generated watchlist rows from latest context, breadth, concentration, and static trigger definitions.
2. Layer 2 rendering.

Remaining upgrades:

1. Merge manual catalyst ledger rows later, but keep them out of active triggers while the ledger is not connected.
2. Persist fired trigger history in `watchlist_events`.

Tests:

```text
HY OAS rising + VIX rising -> credit trigger fired.
WALCL missing -> unknown/manual_check, not false neutral.
Breadth narrowing while RS leading -> narrow leadership warning.
```

### Phase D — Context Reconciliation

Status: implemented as qualitative state/transition/evidence/warnings and rendered in ContextRail plus Layer 1.

Implemented:

1. Qualitative reconciliation output.
2. ContextRail and Layer 1 rendering.

Remaining upgrades:

1. Expand reconciliation rulebook test coverage as new source adapters land.

Tests:

```text
Strong sector leadership + pressure context -> divergent/risk_rising.
Improving context + weak leadership -> rotation_watch.
Unknown context -> data_insufficient.
```

### Phase E — Real Concentration

Tasks:

1. Select data source for true sector market-cap contribution.
2. Keep existing RS proxy until official source exists.
3. Add HHI/effective sector count only when source is reliable.

Tests:

```text
One dominant sector -> high HHI and narrow_leadership warning.
Broad distribution -> effective sector count increases.
Unavailable cap data -> proxy label remains visible.
```

### Phase F — Verification Upgrade

Tasks:

1. Build replay dataset.
2. Compute IC/hit-rate-like diagnostics offline.
3. Display only in Verification panel.
4. Keep `expose_probability = false` until calibration is explicitly accepted.

## 7. Final Recommendation

Prioritize these next:

```text
1. Source Freshness Table
2. Trigger Watchlist
3. Context Reconciliation
4. Real Concentration Panel
5. Verification Scorecard Upgrade
```

Defer these:

```text
Fear & Greed composite
BULL / HYPER price bands
Regime composite / headroom score
Stock Engine
Briefing endpoint
Forward PER / EPS valuation
KRX as a core US-sector input
Main-UI hit-rate or return stats
```

This keeps the benchmark's strongest operational ideas while preserving Sector Radar's rulebook-first, sector-first, validation-aware product boundary.
