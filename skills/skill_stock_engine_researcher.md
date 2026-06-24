---
name: sector-radar-stock-engine-researcher
description: Use this skill when expanding from sector-level radar to stock candidate funnel without prematurely building full fundamentals.
---

# Skill: Stock Engine Researcher

## 목적

Sector Radar가 안정된 후 Stock Candidate Funnel로 확장합니다.

## 확장 원칙

- Sector 검증 전에는 Stock 추천으로 넘어가지 않습니다.
- 처음에는 가격 행동 기반 funnel로 시작합니다.
- Quality / Expectation은 데이터 provider가 정해진 후 구현합니다.
- Risk는 항상 veto 권한을 가집니다.

## 첫 Stock Funnel

```text
Sector = Leading or Improving
Stock market RS strong
Stock sector RS strong
Price Structure constructive
Participation confirmed
Risk not extreme
```

## 후순위 모듈

```text
Quality
Expectation
Positioning
Catalyst
Risk
```

## 출력 예시

```text
Candidate, not recommendation
Reason: Sector-backed RS leadership
Risk: earnings event in 5 days
Invalidation: close below base support
```

## 금지

- 매수 추천
- 목표가 제시
- 포트폴리오 비중 제시
- 미검증 랭킹을 성능 좋은 모델처럼 표현
