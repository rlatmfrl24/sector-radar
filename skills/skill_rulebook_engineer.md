---
name: sector-radar-rulebook-engineer
description: Use this skill to implement Sector Rulebook patterns, veto rules, narratives, risks, and invalidation conditions.
---

# Skill: Rulebook Engineer

## 목적

지표 상태를 투자적 의미로 해석하는 Rulebook 계층을 구현합니다.

## 입력

```text
ModuleState(relative_strength)
ModuleState(momentum)
ModuleState(breadth)
ModuleState(participation)
ModuleState(rotation)
ModuleState(catalyst)
```

## 출력

```text
RulebookOutput
  direction
  strength
  conviction_label
  lead_pattern
  narrative
  risks
  invalidation
```

## 구현 순서

1. ModuleState dataclass 정의
2. RulebookOutput dataclass 정의
3. Primary pattern matcher 구현
4. Veto rule 적용
5. Narrative template 구현
6. Risks / invalidation 생성
7. 테스트 케이스 작성

## 필수 패턴

```text
Strong Leader
Emerging Leader
Healthy Expansion
Late Leader
Mega-cap Dependence
False Leadership
Early Rotation
Structural Winner
Weak Expansion
Breakdown
```

## Veto

```text
Momentum Collapse -> Strong Up 금지
Participation Breakdown -> high conviction 금지
Catalyst Reversal -> strength 감소
Broad Breadth Collapse -> risk 추가
Data Insufficient -> high conviction 금지
```

## 금지

- 모듈 점수 평균
- 확률 표현
- narrative 없이 pattern만 출력
- invalidation 없는 판단

## 테스트 기준

각 패턴마다 하나 이상의 fixture를 만듭니다.

```text
Given states
When rulebook evaluates
Then expected lead_pattern, direction, risks are returned
```
