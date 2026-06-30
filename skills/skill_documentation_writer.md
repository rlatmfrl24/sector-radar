---
name: sector-radar-documentation-writer
description: Use this skill to keep project docs, API contracts, and user-facing explanations aligned with implementation.
---

# Skill: Documentation Writer

## 목적

문서와 구현이 어긋나지 않도록 관리합니다.

## 업데이트 대상

```text
README.md
AGENTS.md
DESIGN.md
PROJECT_CHARTER.md
docs/02_MVP_SPEC.md
docs/01_IMPLEMENTATION_PLAN.md
docs/03_ARCHITECTURE.md
docs/05_METRICS_AND_STATES.md
docs/06_SECTOR_RULEBOOK.md
docs/08_UI_SPEC.md
docs/09_API_CONTRACT.md
docs/13_CLOUDFLARE_DEPLOYMENT.md
docs/14_MARKET_DASHBOARD_BENCHMARK.md
docs/15_DATA_SOURCE_EXPANSION.md
skills/*.md
```

문서 역할:

```text
README.md: 현재 제품과 문서 지도
AGENTS.md: 변경 불가능한 구현 원칙과 현재 next issues
DESIGN.md: 현재 dashboard design system
docs/08_UI_SPEC.md: 화면 구조와 UX 규칙
docs/09_API_CONTRACT.md: API/JSON 계약
docs/12_AGENT_PROMPTS.md: 현재 작업용 prompt, bootstrap prompt 금지
```

삭제/통합 기준:

```text
중복 인덱스 문서는 README로 흡수
bootstrap-only 문서는 현재 구현 단계에서는 제거
미래 확장 문서는 deferred reference로 명확히 표시
```

## 유지해야 할 구현 용어

```text
Layer 1 흐름
Layer 2 여력
Layer 3 리더십
현재 RS 리더
모멘텀 선두
순환 후보
전환 관찰 구간
```

피해야 할 낡은 용어:

```text
Overview
Sector Detail
Data Health screen
주도·섹터
주도섹터
```

## 문체 원칙

- 투자 조언처럼 쓰지 않습니다.
- 확률이나 승률을 과장하지 않습니다.
- 숫자보다 의미를 설명합니다.
- 무효화 조건을 함께 씁니다.

## 문서 변경 체크리스트

```text
[ ] 새 기능의 목적이 설명되어 있는가?
[ ] 입력/출력 schema가 있는가?
[ ] threshold 위치가 명확한가?
[ ] validation status가 명확한가?
[ ] 사용자에게 오해될 표현이 없는가?
```
