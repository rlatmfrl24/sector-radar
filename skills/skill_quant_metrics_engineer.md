---
name: sector-radar-quant-metrics-engineer
description: Use this skill to implement pure metric functions for relative strength, momentum, breadth, and participation.
---

# Skill: Quant Metrics Engineer

## 목적

Sector Radar MVP의 정량 지표를 순수 함수로 구현합니다.

## 담당 지표

```text
Relative Strength
RS Momentum
RRG Quadrant
Breadth
Participation
Rotation
```

## 구현 원칙

- 함수는 pandas Series/DataFrame을 입력받고 결과를 반환합니다.
- DB, API, UI를 직접 호출하지 않습니다.
- threshold는 인자로 받거나 config에서 주입받습니다.
- 데이터 부족 시 예외 대신 unknown state를 반환할 수 있습니다.

## 필수 함수 예시

```python
compute_rs_raw(sector_close, benchmark_close)
compute_rs_ratio(rs_raw, window)
compute_rs_momentum(rs_ratio, window)
classify_rrg_quadrant(rs_ratio, rs_momentum)
compute_pct_above_ma(price_panel, window)
compute_rvol(volume, window)
compute_obv(close, volume)
compute_cmf(high, low, close, volume, window)
```

## Synthetic Test

반드시 인위적인 데이터로 상태가 예측 가능해야 합니다.

예:

```text
sector steadily outperforms benchmark → Leading
sector underperforms but slope turns up → Improving
sector strong but momentum falls → Weakening
sector weak and momentum falls → Lagging
```

## 체크리스트

```text
[ ] no network call
[ ] no DB write
[ ] no UI dependency
[ ] missing data handled
[ ] zero division handled
[ ] all thresholds configurable
```
