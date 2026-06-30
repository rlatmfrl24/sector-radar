---
name: sector-radar-validation-engineer
description: Use this skill to implement replay, historical labeling, pattern statistics, and validation gates without exposing unvalidated probabilities.
---

# Skill: Validation Engineer

## 목적

Rulebook 패턴의 실효성을 과거 데이터로 검증합니다.

## 담당 범위

- Replay mode
- Forward return labels
- Pattern statistics
- Transition matrix
- Validation gate

## 기본 라벨

```text
fwd_rel_ret_20d
fwd_rel_ret_60d
success_20d
success_top_quartile_20d
emerging_to_leading_20d
false_leadership_confirmed
```

## 검증 출력

```text
sample_size
median_forward_relative_return
diagnostic_hit_rate_optional
max_drawdown_distribution
coverage
```

검증 출력은 Verification/Validation 전용 패널에만 표시합니다. Main Layer 1/2/3 판단 문구, sector card, ContextRail에는 확률·승률처럼 읽힐 수 있는 값을 넣지 않습니다.

## 금지

- 검증 없이 probability 노출
- in-sample 결과를 성능으로 과장
- 표본 수가 작은 패턴을 확정적으로 표현

## 완료 기준

```text
[ ] 과거 as_of 날짜로 snapshot 재생 가능
[ ] forward returns 계산 가능
[ ] pattern별 통계 출력 가능
[ ] validation_status 필드 제공
[ ] probability display gate 동작
[ ] main dashboard copy remains probability-free
```
