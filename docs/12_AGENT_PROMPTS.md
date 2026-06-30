# 12. Agent Prompts

이 문서는 Codex, Cursor, Claude Code 같은 코딩 에이전트에게 작업을 맡길 때 사용할 현재 버전용 프롬프트입니다.

부트스트랩 프롬프트는 제거했습니다. 저장소 구조는 이미 존재하므로 새 에이전트에게 초기 scaffold를 다시 만들게 하지 않습니다.

## 1. 공통 시작 프롬프트

```text
You are working on Sector Radar.

Read AGENTS.md, PROJECT_CHARTER.md, README.md, DESIGN.md, and the task-relevant docs first.

Keep the product sector-first. Do not expose investment advice, unvalidated probabilities, hit rates, expected returns, or buy/sell recommendations. Preserve module disagreement as signal. Keep thresholds in config or injected runtime settings.

Before finishing, update docs when behavior or contracts change.
```

## 2. Dashboard UI 작업 프롬프트

```text
Update the React dashboard.

Read DESIGN.md, docs/08_UI_SPEC.md, docs/09_API_CONTRACT.md, and skills/skill_dashboard_engineer.md.

Maintain the current 4-layer structure:
- Layer 1 흐름
- Layer 2 여력
- Layer 3 리더십
- Layer 4 검증

Requirements:
- Do not compute metrics inside UI.
- Keep source freshness scoped to the active Layer.
- Layer 3 default inspector follows the current RS leader.
- Momentum rail is sorted by rs_momentum desc, rs_ratio desc.
- Do not call both current RS leader and momentum leader "주도섹터".
- Layer 4 uses validation/history coverage for readiness only, not probability-like claims.
- Show narrative, risks, invalidation, data freshness, and validation status.
- Run npm run test:app and npm run build.
```

## 3. API / Contract 작업 프롬프트

```text
Update the dashboard API contract.

Read docs/09_API_CONTRACT.md, docs/03_ARCHITECTURE.md, and frontend/src/types.ts.

Maintain:
- GET /api/sectors top-level SectorsResponse
- GET /api/history timeframe=30D|90D|180D
- GET /api/validation with expose_probability=false
- GET /api/data/status
- POST /api/refresh returning refresh_unavailable_in_pages on public Pages

If response shape changes, update frontend/src/types.ts, docs/09_API_CONTRACT.md, and tests.
```

## 4. Data / Ingestion 작업 프롬프트

```text
Update data ingestion or storage.

Read docs/04_DATA_MODEL.md, docs/13_CLOUDFLARE_DEPLOYMENT.md, docs/15_DATA_SOURCE_EXPANSION.md, and skills/skill_data_engineer.md.

Requirements:
- Keep raw series and derived snapshots separate.
- Store source, fetched_at, provider, and freshness metadata.
- Keep writes idempotent.
- Preserve SQLite and D1 contract compatibility.
- Do not add network calls to unit tests.
- Keep public Pages refresh disabled; scheduled Worker owns Cloudflare refresh.
```

## 5. Metrics 작업 프롬프트

```text
Update metric functions.

Read docs/05_METRICS_AND_STATES.md and skills/skill_quant_metrics_engineer.md.

Implement pure functions for RS/RRG, breadth, or participation. Do not import UI, API, or DB code into metric functions. Thresholds must be configurable. Add synthetic tests for missing data, flat prices, zero volume, and each expected state transition.
```

## 6. Rulebook 작업 프롬프트

```text
Update Sector Rulebook.

Read docs/06_SECTOR_RULEBOOK.md and skills/skill_rulebook_engineer.md.

Every output must include direction, strength, conviction_label, lead_pattern, narrative, risks, invalidation, source_metrics, and data_freshness. Do not average module scores. Do not expose probabilities. Add pattern tests and update docs when patterns or veto rules change.
```

## 7. Validation 작업 프롬프트

```text
Implement replay or validation.

Read docs/07_VALIDATION_PLAN.md and skills/skill_validation_engineer.md.

Validation outputs may include descriptive diagnostics inside Verification/Validation surfaces only. Main dashboard copy must remain probability-free. Keep expose_probability=false until walk-forward validation and calibration are explicitly implemented.
```

## 8. Documentation 작업 프롬프트

```text
Clean up documentation.

Read README.md, AGENTS.md, DESIGN.md, docs/08_UI_SPEC.md, docs/09_API_CONTRACT.md, and skills/skill_documentation_writer.md.

Remove duplicate or obsolete bootstrap guidance. Keep README as the primary document map. Keep DESIGN.md aligned with the current dashboard, not external brand analysis. Search for obsolete terms such as Overview, Sector Detail, Data Health screen, 주도·섹터, 주도섹터, Selected Sector, and Sector Leadership before finishing.
```
