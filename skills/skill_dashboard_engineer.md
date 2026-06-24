---
name: sector-radar-dashboard-engineer
description: Use this skill to build React dashboard screens that display sector states, rulebook narratives, and data health.
---

# Skill: Dashboard Engineer

## 목적

사용자가 섹터 상태를 빠르게 이해할 수 있는 UI를 구현합니다.

## 원칙

- UI는 계산하지 않습니다.
- UI는 DB/API에서 받은 snapshot을 표시합니다.
- 확률은 표시하지 않습니다.
- narrative, risks, invalidation을 반드시 표시합니다.
- 데이터 기준일을 항상 표시합니다.

## MVP 화면

```text
Overview
RRG
Sector Detail
Data Health
```

## Overview 구성

```text
Leading 섹터
Improving 섹터
Weakening 섹터
Lagging 섹터
Warning cards
```

## Sector Detail 구성

```text
Pattern
Direction
Conviction label
Narrative
Module cards
Risks
Invalidation checklist
```

## UI 문구

허용:

```text
강세가 확인됩니다.
주의가 필요합니다.
이 조건에서 판단이 약화됩니다.
```

금지:

```text
매수하세요.
확실히 상승합니다.
수익 확률이 높습니다.
```

## 완료 기준

```text
[ ] React app builds and launches
[ ] fixture snapshot displays
[ ] no calculation in UI
[ ] data freshness visible
[ ] no probability display
```
