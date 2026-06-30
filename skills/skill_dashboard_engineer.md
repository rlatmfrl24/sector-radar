---
name: sector-radar-dashboard-engineer
description: Use this skill to build or revise the React 3-layer dashboard, source freshness UI, and leadership flow.
---

# Skill: Dashboard Engineer

## 목적

사용자가 섹터 흐름, 여력, 리더십 전환을 빠르게 이해할 수 있는 React UI를 구현합니다.

## 현재 화면

```text
Layer 1 흐름
  market tape, breadth quality, volatility pressure, current RS leader

Layer 2 여력
  ETF participation, FRED market context, risk trigger watchlist

Layer 3 리더십
  current RS leader detail, momentum leader candidates, RRG, path, treemap, selected inspector
```

## 원칙

- UI는 계산하지 않고 API/fixture snapshot을 표시합니다.
- 확률, 승률, 기대수익률은 표시하지 않습니다.
- 상태와 전환을 분리해서 보여줍니다.
- narrative, risks, invalidation, data freshness를 반드시 표시합니다.
- 수집 내역은 active Layer에 관련된 원천만 보여줍니다.
- Layer 3는 현재 RS 리더와 모멘텀 선두를 같은 `주도섹터`로 부르지 않습니다.

## Layer 3 선택 규칙

```text
default selected inspector:
  Layer 1 current RS leader

momentum rail:
  sorted by rs_momentum desc, rs_ratio desc

if current RS leader != momentum leader:
  show as leadership transition watch signal
```

## UI 문구

허용:

```text
현재 RS 리더
모멘텀 선두
순환 후보
전환 관찰 구간
이 조건에서 판단이 약화됩니다.
```

금지:

```text
주도섹터
매수하세요.
확실히 상승합니다.
수익 확률이 높습니다.
```

## 완료 기준

```text
[ ] npm run test:app
[ ] npm run build
[ ] Layer 1/2/3 tabs render
[ ] FreshnessBar scopes source rows by active Layer
[ ] Layer 3 separates current RS leader and momentum leader candidates
[ ] selected sector click updates inspector, RRG, and treemap state
[ ] no probability display
```
