# AGENTS.md — Sector Radar MVP

이 파일은 이 저장소에서 작업하는 코딩 에이전트와 사람 개발자가 반드시 따라야 할 최상위 구현 지침입니다.

## 1. Mission

Build a local-first, testable, explainable **Sector Radar MVP** that detects sector leadership, leadership transitions, false leadership, and sector-level risk signals.

The product is a research dashboard, not an automated trading system.

## 2. Non-negotiable Principles

### 2.1 Do not collapse modules into one average score

금지:

```text
RS 80
Breadth 60
Participation 70
Average = 70
```

허용:

```text
RS strong
Momentum weakening
Breadth narrowing
Participation strong
→ Late leader / mega-cap dependent leadership
```

Module disagreement is signal, not noise.

### 2.2 Every output must be explainable

Every sector-level output must include:

```text
direction
strength
conviction
lead_pattern
narrative
risks
invalidation
source_metrics
data_freshness
```

### 2.3 Do not expose unvalidated probabilities

Until walk-forward validation and calibration are implemented, do not expose claims such as:

```text
상승 확률 72%
20일 내 초과수익 가능성 65%
승률 80%
```

Allowed before validation:

```text
state
transition
pattern
confidence as rule-alignment score
qualitative conviction: low / medium / high
```

If a numeric `conviction` is used, label it as **rule alignment**, not calibrated probability.

### 2.4 State and transition are separate

Always model both:

```python
state = "leader"
transition = "weakening"
```

Do not overwrite transition information with state information.

### 2.5 Thresholds belong in config

Do not hard-code thresholds inside metric logic. Use:

```text
config/thresholds.example.yaml
```

or a runtime config loader.

### 2.6 MVP is sector-first

Do not start with Stock Engine, fundamentals, options, darkpool, or news NLP. Implement sector-level MVP first.

## 3. Repository Map

```text
config/
  universe.us_sectors.yaml        # ETF universe and representative holdings
  thresholds.example.yaml         # state thresholds and windows
  catalysts.manual.example.yaml   # manual catalyst ledger sample

docs/
  01_IMPLEMENTATION_PLAN.md
  02_MVP_SPEC.md
  03_ARCHITECTURE.md
  04_DATA_MODEL.md
  05_METRICS_AND_STATES.md
  06_SECTOR_RULEBOOK.md
  07_VALIDATION_PLAN.md
  08_UI_SPEC.md
  09_API_CONTRACT.md
  10_STOCK_ENGINE_EXPANSION.md
  11_DEVELOPMENT_WORKFLOW.md
  12_AGENT_PROMPTS.md
  13_CLOUDFLARE_DEPLOYMENT.md

skills/
  role-specific implementation skills

src/sector_radar/
  domain/
    models.py                       # ModuleState, RulebookOutput contracts
  application/
    build_relative_strength_snapshot.py
  infrastructure/
    sqlite/
      schema.py                     # canonical SQLite DDL and columns
  data/
    store.py                        # SQLite adapter facade
    price_csv.py                    # CSV/fixture ingestion
    config_loader.py                # YAML config loaders
  metrics/
  rules/

frontend/
  React + Vite dashboard and Cloudflare Pages configuration
  src/features/radar/               # dashboard view model and components

tests/
  unit and synthetic tests
```

## 4. Implementation Order

Follow this order unless the user explicitly changes scope.

1. Project bootstrap
2. SQLite schema and store helpers
3. Universe config loader
4. Price ingestion adapter interface
5. Relative strength and RRG classification
6. Momentum metrics
7. Breadth metrics using representative holdings
8. Participation metrics
9. Manual catalyst ledger
10. Sector Rulebook
11. React MVP dashboard
12. Replay and validation harness
13. Stock Engine expansion

## 5. Data Layer Rules

### 5.1 Use long-format tables

Prefer:

```text
series_id | date | value | source | fetched_at
```

Avoid one table per ticker or one column per ticker.

### 5.2 Use upsert

Repeated ingestion must be idempotent. Running the same ingest twice must not duplicate rows.

### 5.3 Store raw and derived data separately

Raw price series and calculated sector metrics must not be mixed.

### 5.4 Track freshness

Every dashboard output must surface data freshness using the maximum available date for the relevant series.

## 6. Metric Rules

### 6.1 Relative Strength

Baseline definition:

```text
rs_raw = sector_close / benchmark_close
rs_ratio = 100 * rs_raw / SMA(rs_raw, rs_window)
rs_momentum = 100 * rs_ratio / SMA(rs_ratio, momentum_window)
```

RRG quadrant:

```text
Leading    = rs_ratio >= 100 and rs_momentum >= 100
Improving  = rs_ratio <  100 and rs_momentum >= 100
Weakening  = rs_ratio >= 100 and rs_momentum <  100
Lagging    = rs_ratio <  100 and rs_momentum <  100
```

### 6.2 Breadth

Minimum MVP breadth:

```text
pct_above_20ma
pct_above_50ma
pct_above_200ma
advancing_ratio
new_high_low_ratio optional
```

### 6.3 Participation

Minimum MVP participation:

```text
rvol_20
obv_slope_20
cmf_20
volume_confirmed_breakout flag
```

### 6.4 Catalyst

MVP catalyst is manual, not NLP.

Use a structured ledger:

```text
sector
catalyst_type: structural | cyclical | policy | event
state: positive | neutral | negative
transition: strengthening | stable | weakening
confidence: low | medium | high
```

## 7. Rulebook Rules

Implement pattern matching before machine learning.

Minimum patterns:

| Pattern | Conditions | Output |
|---|---|---|
| Strong Leader | RS↑ + Momentum↑ + Breadth↑ + Participation↑ + Catalyst↑ | Strong Up |
| Emerging Leader | RS weak/average + Momentum↑ + Catalyst↑ | Watchlist |
| Healthy Expansion | Breadth↑ + Participation↑ | Confirmed Expansion |
| Late Leader | RS↑ + Momentum↓ | Risk Rising |
| Mega-cap Dependence | RS↑ + Breadth↓ | Narrow Leadership |
| False Leadership | RS↑ + Participation↓ | Caution |
| Early Rotation | Rotation↑ + Momentum↑ | Early Upturn |
| Structural Winner | Catalyst↑ + RS↑ | Long-term Watch |
| Weak Expansion | Breadth↑ + Participation↓ | Low Conviction |
| Breakdown | RS↓ + Momentum↓ + Participation↓ | Avoid / Risk-Off |

Veto rules:

```text
Momentum Collapse       -> Strong Up 금지
Participation Breakdown -> Conviction cap
Catalyst Reversal       -> Strength 감소
Broad Breadth Collapse  -> Risk 증가
```

## 8. Testing Rules

Every metric must have synthetic tests.

Test categories:

1. deterministic synthetic data
2. edge cases: missing values, flat prices, zero volume
3. integration tests with small fixture CSVs
4. rulebook pattern tests
5. snapshot test for API JSON contracts

No network call is allowed in unit tests.

## 9. Definition of Done

A task is done only when:

1. code is typed and formatted
2. thresholds are configurable
3. unit tests exist
4. docs are updated
5. dashboard output includes data freshness
6. rulebook output includes risks and invalidation
7. no unvalidated probability is exposed

## 10. Safety and Product Boundaries

Do not implement:

```text
automated trading
broker order placement
personalized buy/sell recommendations
promises of profit
unvalidated probability claims
```

Use wording such as:

```text
리서치 관점에서 강세가 확인됩니다.
이 판단은 다음 조건에서 무효화됩니다.
개인화된 투자 조언이 아닙니다.
```

Avoid wording such as:

```text
매수하세요.
확실히 오릅니다.
승률이 보장됩니다.
```

## 11. Agent Collaboration Protocol

When working as an implementation agent:

1. Read `PROJECT_CHARTER.md` and this file first.
2. Identify the smallest useful change.
3. Prefer adding tests before or alongside implementation.
4. Do not expand scope without updating docs.
5. Summarize assumptions in the PR or final response.
6. If data availability blocks a feature, implement the interface and fixture-based tests first.

## 12. Preferred First Issue

Implement SQLite store helpers and create all base tables:

```text
series_daily
sector_metrics_daily
watchlist_events
manual_catalyst_ledger
instrument_master
```

Then add deterministic tests for upsert behavior.
