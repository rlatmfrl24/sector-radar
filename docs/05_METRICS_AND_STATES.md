# 05. Metrics and States

## 1. 공통 상태 모델

각 모듈은 아래 네 가지를 반드시 출력합니다.

```text
state
transition
strength
evidence
```

예:

```json
{
  "state": "strong",
  "transition": "strengthening",
  "strength": 3,
  "evidence": {"rs_ratio": 103.5, "rs_momentum": 101.2}
}
```

## 2. Relative Strength

### 목적

어느 섹터가 시장보다 강한지 확인합니다.

### 계산식

```text
rs_raw_t = close_sector_t / close_benchmark_t
rs_ratio_t = 100 * rs_raw_t / SMA(rs_raw, rs_window)_t
rs_momentum_t = 100 * rs_ratio_t / SMA(rs_ratio, momentum_window)_t
```

기본값:

```text
rs_window = 50
momentum_window = 10
```

### RRG Quadrant

| 조건 | Quadrant | 해석 |
|---|---|---|
| RS Ratio >= 100, RS Momentum >= 100 | Leading | 이미 강하고 더 강함 |
| RS Ratio < 100, RS Momentum >= 100 | Improving | 아직 약하지만 개선 중 |
| RS Ratio >= 100, RS Momentum < 100 | Weakening | 강하지만 둔화 중 |
| RS Ratio < 100, RS Momentum < 100 | Lagging | 약하고 개선도 없음 |

### State

| State | 조건 예시 |
|---|---|
| `strong` | rs_ratio >= 102 |
| `average` | 98 <= rs_ratio < 102 |
| `weak` | rs_ratio < 98 |

### Transition

| Transition | 조건 예시 |
|---|---|
| `strengthening` | rs_momentum >= 101 |
| `stable` | 99 <= rs_momentum < 101 |
| `weakening` | rs_momentum < 99 |

## 3. Momentum

### 목적

강한지보다 **강해지고 있는지**를 확인합니다.

### MVP 지표

```text
rs_momentum
slope_20d(rs_raw)
rate_of_change_20d(rs_ratio)
```

### State

| State | 해석 |
|---|---|
| `accelerating` | 상대강도 상승 속도가 빠름 |
| `improving` | 개선 중 |
| `flat` | 변화 미미 |
| `decelerating` | 둔화 중 |
| `collapsing` | 급격한 약화 |

## 4. Breadth

### 목적

강세가 섹터 전체로 확산되는지 확인합니다.

### 지표

```text
pct_above_20ma  = 20일선 위 대표 종목 비율
pct_above_50ma  = 50일선 위 대표 종목 비율
pct_above_200ma = 200일선 위 대표 종목 비율
advancing_ratio = 전일 대비 상승 종목 비율
```

### State

| State | 조건 예시 | 해석 |
|---|---|---|
| `broad_strength` | pct_above_50ma >= 70% | 건강한 확산 |
| `healthy` | pct_above_50ma >= 55% | 양호 |
| `mixed` | 40% <= pct_above_50ma < 55% | 혼조 |
| `narrow` | pct_above_50ma < 40% | 소수 종목 의존 |
| `breakdown` | pct_above_200ma < 35% | 내부 붕괴 |

### Transition

```text
strengthening = pct_above_50ma가 최근 10영업일 동안 상승
weakening     = pct_above_50ma가 최근 10영업일 동안 하락
```

## 5. Participation

### 목적

가격 상승에 실제 거래량과 money flow가 동반되는지 확인합니다.

### RVOL

```text
rvol_20 = volume_t / SMA(volume, 20)_t
```

### OBV

```text
if close_t > close_{t-1}: obv_t = obv_{t-1} + volume_t
if close_t < close_{t-1}: obv_t = obv_{t-1} - volume_t
else: obv_t = obv_{t-1}
```

`obv_slope_20`은 최근 20일 OBV 기울기입니다.

### CMF

```text
money_flow_multiplier = ((close - low) - (high - close)) / (high - low)
money_flow_volume = money_flow_multiplier * volume
cmf_20 = sum(money_flow_volume, 20) / sum(volume, 20)
```

### State

| State | 조건 예시 | 해석 |
|---|---|---|
| `accumulation` | rvol>1.2, obv_slope>0, cmf>0.05 | 매집 가능성 |
| `confirmed` | obv_slope>0, cmf>=0 | 거래량 확인 |
| `neutral` | 방향성 불명확 | 중립 |
| `diverging` | 가격 상승, OBV/CMF 약화 | 약한 상승 |
| `distribution` | obv_slope<0, cmf<0 | 분산 가능성 |

## 6. Rotation

### 목적

공격형 섹터와 방어형 섹터 중 어느 쪽으로 돈이 이동하는지 봅니다.

### MVP 그룹

```yaml
risk_on:
  - XLK
  - XLY
  - XLC
  - XLI
  - XLF
  - SMH

risk_off:
  - XLP
  - XLU
  - XLV
```

### 지표

```text
risk_on_rs = equal_weight_return(risk_on) / SPY_return
risk_off_rs = equal_weight_return(risk_off) / SPY_return
rotation_spread = risk_on_rs - risk_off_rs
```

## 7. Catalyst

### 목적

왜 움직이는지 설명합니다.

### MVP 방식

뉴스 NLP를 하지 않고 사람이 YAML로 입력합니다.

```yaml
- sector_code: SMH
  catalyst_type: structural
  title: AI CAPEX cycle
  state: positive
  transition: strengthening
  confidence: high
```

### Catalyst Type

| Type | 설명 |
|---|---|
| structural | 장기 구조 변화 |
| cyclical | 경기 순환 |
| policy | 정책·금리·규제 |
| event | 실적·제품·M&A 등 이벤트 |

## 8. 상태 판정 주의사항

- Threshold는 모두 config로 분리합니다.
- 데이터 부족 시 `unknown`을 반환합니다.
- `unknown`이 2개 이상이면 Rulebook conviction은 high가 될 수 없습니다.
- 모든 지표는 날짜 기준을 명시해야 합니다.
