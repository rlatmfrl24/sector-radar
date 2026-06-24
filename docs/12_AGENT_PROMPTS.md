# 12. Agent Prompts

이 문서는 Codex, Cursor, Claude Code 등 코딩 에이전트에게 작업을 맡길 때 사용할 수 있는 프롬프트 모음입니다.

## 1. 프로젝트 부트스트랩 프롬프트

```text
You are implementing the Sector Radar MVP. Read AGENTS.md, PROJECT_CHARTER.md, and docs/01_IMPLEMENTATION_PLAN.md first.

Create the initial Python package structure with pyproject.toml, src/sector_radar, tests, config, and frontend directories. Add pytest, ruff, mypy settings. Do not implement network ingestion yet. Add placeholder modules for data, metrics, rules, validation, and React UI. Ensure `pytest` runs.

Follow these constraints:
- Do not expose investment advice.
- Do not expose unvalidated probabilities.
- Keep thresholds in config.
- Add or update docs if structure changes.
```

## 2. SQLite 저장층 구현 프롬프트

```text
Implement the SQLite storage layer for Sector Radar MVP.

Read AGENTS.md and docs/04_DATA_MODEL.md. Implement:
- init_db(db_path)
- upsert_series_daily(...)
- get_latest_date(series_id, field='close')
- query_series(series_id, field, start, end)
- upsert_sector_metrics(...)

Requirements:
- Use sqlite3 from stdlib.
- All writes must be idempotent.
- Enable WAL mode.
- Add unit tests with a temporary database.
- Do not add network calls.
```

## 3. Relative Strength 구현 프롬프트

```text
Implement Relative Strength and RRG quadrant classification.

Read docs/05_METRICS_AND_STATES.md. Implement pure pandas functions:
- compute_rs_raw(sector_close, benchmark_close)
- compute_rs_ratio(rs_raw, window)
- compute_rs_momentum(rs_ratio, window)
- classify_rrg_quadrant(rs_ratio, rs_momentum)

Add synthetic tests for all four quadrants. Do not hard-code thresholds; accept them as parameters or config.
```

## 4. Breadth 구현 프롬프트

```text
Implement sector breadth metrics using representative holdings.

Inputs: DataFrame with columns date, symbol, close.
Outputs by sector/date:
- pct_above_20ma
- pct_above_50ma
- pct_above_200ma
- breadth_state
- breadth_transition

Read docs/05_METRICS_AND_STATES.md. Add tests for broad_strength, narrow, breakdown, and insufficient lookback.
```

## 5. Participation 구현 프롬프트

```text
Implement participation metrics.

Functions:
- compute_rvol(volume, window=20)
- compute_obv(close, volume)
- compute_obv_slope(obv, window=20)
- compute_cmf(high, low, close, volume, window=20)
- classify_participation(...)

Handle zero high-low range safely. Add tests for accumulation, divergence, distribution, and zero-volume edge cases.
```

## 6. Rulebook 구현 프롬프트

```text
Implement Sector Rulebook pattern matching.

Read docs/06_SECTOR_RULEBOOK.md. Create dataclasses or pydantic models for ModuleState and RulebookOutput. Implement patterns:
- Strong Leader
- Emerging Leader
- Healthy Expansion
- Late Leader
- Mega-cap Dependence
- False Leadership
- Early Rotation
- Structural Winner
- Weak Expansion
- Breakdown

Implement veto rules:
- Momentum Collapse
- Participation Breakdown
- Catalyst Reversal
- Broad Breadth Collapse
- Data Insufficient

Each output must include narrative, risks, and invalidation. Add tests for each pattern.
```

## 7. React Dashboard MVP 프롬프트

```text
Build the React dashboard MVP.

Read docs/08_UI_SPEC.md and docs/09_API_CONTRACT.md. Build:
- Overview
- RRG
- Sector Detail
- Data Health

Use fixture or API-loaded sector snapshots. Do not compute metrics inside the UI. The UI should display states, patterns, narrative, risks, invalidation, and data freshness. Do not display probabilities. Prepare the app for Cloudflare Pages with D1-backed Pages Functions.
```

## 8. Validation 프롬프트

```text
Implement Replay and Validation skeleton.

Read docs/07_VALIDATION_PLAN.md. Implement functions to:
- load sector snapshots as of a historical date
- compute forward relative returns for 20D and 60D
- summarize outcomes by rulebook pattern

Do not expose probabilities. Output historical descriptive statistics only.
```
