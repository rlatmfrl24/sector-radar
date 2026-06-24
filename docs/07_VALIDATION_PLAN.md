# 07. Validation Plan

## 1. 검증 철학

이 프로젝트는 “그럴듯한 대시보드”가 되기 쉽습니다. 따라서 검증 전에는 확률, 승률, 예측값을 노출하지 않습니다.

검증의 목적은 다음입니다.

```text
Rulebook 패턴이 실제로 forward relative return과 관련이 있는가?
False Leadership 경고는 실제로 이후 약화와 관련이 있는가?
Emerging Leader 후보는 향후 Leading으로 이동하는가?
```

## 2. 검증 전 UI 정책

허용:

```text
Leading
Improving
Late Leader
False Leadership
qualitative conviction: high / medium / low
```

금지:

```text
상승 확률 72%
향후 20일 수익률 +5% 예상
승률 80%
```

## 3. 데이터셋

MVP 검증 데이터:

```text
미국 섹터 ETF 일별 가격
SPY benchmark
섹터별 대표 종목 일별 가격
최소 3년, 가능하면 10년 이상
```

## 4. 라벨 정의

### Forward Relative Return

```text
fwd_rel_ret_20d = sector_return_20d - benchmark_return_20d
fwd_rel_ret_60d = sector_return_60d - benchmark_return_60d
```

### Leader Success Label

```text
success_20d = fwd_rel_ret_20d > 0
success_top_quartile_20d = fwd_rel_ret_20d가 전체 섹터 중 상위 25%
```

### False Leadership Label

```text
false_leadership_confirmed =
  pattern == False Leadership and
  fwd_rel_ret_20d < 0 and
  max_drawdown_20d < threshold
```

### Emerging Leader Transition Label

```text
emerging_success =
  quadrant_today == Improving and
  quadrant_within_20d includes Leading
```

## 5. Walk-forward 검증

```text
train: 과거 N년
validate: 다음 1년
roll forward yearly
```

하지만 MVP 초기에는 rule-based system이므로 모델 학습보다 아래를 우선합니다.

- 패턴별 빈도
- 패턴별 forward relative return 평균/중앙값
- 패턴별 hit-rate
- drawdown 분포
- transition matrix

## 6. 지표

| 지표 | 목적 |
|---|---|
| Hit-rate | 패턴 이후 benchmark 초과 확률 |
| Median fwd relative return | 이상치 영향 완화 |
| Mean fwd relative return | 평균 효과 |
| Max drawdown | 리스크 확인 |
| Transition probability | Improving → Leading 전환 비율 |
| Precision | 경고 패턴의 실제 약화 적중률 |
| Coverage | 패턴이 너무 드물지 않은지 확인 |

## 7. Calibration은 후순위

확률 모델을 붙이기 전까지 calibration은 하지 않습니다.

향후 확률 산출을 추가할 경우:

- Brier score
- reliability curve
- probability cap
- base-rate comparison
- out-of-sample split

을 반드시 구현합니다.

## 8. Replay Mode

Replay Mode는 사용자가 과거 날짜를 선택하면 그 날짜 기준으로 대시보드를 재생합니다.

필수 기능:

```text
as_of date 선택
그 날짜의 sector states 표시
그 후 20D / 60D relative return 표시
Rulebook 판단과 실제 결과 비교
```

## 9. 검증 리포트 예시

```text
Pattern: Emerging Leader
Samples: 148
Forward 20D median relative return: +1.3%
Forward 60D median relative return: +2.6%
Improving → Leading within 20D: 42%
Max drawdown median: -3.8%
Status: useful but not sufficient alone
```

## 10. Validation Gate

각 산출물에는 gate status를 둡니다.

```json
{
  "signal": "Emerging Leader",
  "validation_status": "unvalidated",
  "expose_probability": false,
  "allowed_display": ["state", "pattern", "narrative"]
}
```

검증 완료 후:

```json
{
  "signal": "Emerging Leader",
  "validation_status": "validated_v1",
  "sample_size": 148,
  "expose_probability": false,
  "allowed_display": ["state", "pattern", "narrative", "historical_forward_stats"]
}
```

확률 노출은 별도 모델 검증 이후에만 허용합니다.
