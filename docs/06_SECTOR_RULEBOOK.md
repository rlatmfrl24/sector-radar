# 06. Sector Rulebook

## 1. 목적

Sector Rulebook은 개별 지표를 합산하는 계산기가 아니라 **해석 계층**입니다.

입력:

```text
Relative Strength
Momentum
Breadth
Participation
Rotation
Catalyst
```

출력:

```text
Direction
Strength
Conviction Label
Lead Pattern
Narrative
Risks
Invalidation
```

## 2. 설계 철학

### 금지

```text
RS 80
Breadth 60
Participation 70
평균 70점
```

### 허용

```text
RS 강함
Momentum 둔화
Breadth 약화
Participation 강함
→ 대형주 중심 후반부 리더십
```

불일치는 제거해야 하는 노이즈가 아니라 가장 중요한 정보입니다.

## 3. 출력 구조

```json
{
  "direction": "strong_up",
  "strength": 4,
  "conviction_label": "high",
  "lead_pattern": "Strong Leader",
  "narrative": "강한 상대강도와 모멘텀이 지속되고 있으며, Breadth와 Participation이 이를 지지하고 있다.",
  "risks": ["Momentum 둔화", "Breadth 악화", "Catalyst 약화"],
  "invalidation": ["RS Momentum 2주 연속 하락", "50MA 위 종목 비율 50% 하회"]
}
```

## 4. 우선순위

기본 우선순위:

```text
1. Relative Strength
2. Momentum
3. Breadth
4. Participation
5. Catalyst
6. Rotation
```

단, 시장 국면과 데이터 품질에 따라 우선순위는 바뀔 수 있습니다.

## 5. Primary Patterns

### Pattern A — Strong Leader

조건:

```text
RS strong
Momentum strengthening
Breadth healthy or broad_strength
Participation confirmed or accumulation
Catalyst positive
```

출력:

```text
Direction: strong_up
Strength: 4
Conviction: high
```

Narrative template:

```text
{sector}는 시장 대비 강한 상대강도와 개선되는 모멘텀을 보이고 있으며, breadth와 participation이 상승을 확인하고 있다. {catalyst}가 추가 지지 요인으로 작용한다.
```

Invalidation:

```text
RS Momentum 2주 연속 100 하회
pct_above_50ma 50% 하회
CMF 0 하회
Catalyst weakening 전환
```

---

### Pattern B — Emerging Leader

조건:

```text
RS weak or average
Momentum strengthening
Catalyst positive or Rotation improving
```

해석:

```text
아직 시장 대비 절대 강자는 아니지만, 개선 속도가 빠른 차기 리더 후보.
```

출력:

```text
Direction: mild_up
Strength: 2 or 3
Conviction: medium
Watchlist: true
```

---

### Pattern C — Healthy Expansion

조건:

```text
Breadth strengthening
Participation confirmed or accumulation
```

해석:

```text
상승이 일부 종목이 아니라 섹터 내부로 확산되고 있음.
```

---

### Pattern D — Late Leader

조건:

```text
RS strong
Momentum weakening
```

해석:

```text
여전히 강하지만 리더십 후반부일 수 있음.
```

Risks:

```text
Momentum 둔화
고점 추격 위험
Breadth 약화 시 대형주 의존 심화
```

---

### Pattern E — Mega-cap Dependence

조건:

```text
RS strong
Breadth narrow or weakening
```

해석:

```text
섹터 ETF는 강하지만 내부 종목 다수는 따라오지 못하는 상태.
```

Invalidation / Watch:

```text
pct_above_50ma 추가 하락
동일가중 proxy의 상대성과 악화
상위 1~3개 종목 제외 시 섹터 성과 약화
```

---

### Pattern F — False Leadership

조건:

```text
RS strong
Participation diverging or distribution
```

해석:

```text
가격은 강하지만 거래량과 money flow가 상승을 확인하지 않음.
```

출력:

```text
Direction: mild_up or neutral
Strength cap: 2
Conviction cap: medium
```

---

### Pattern G — Early Rotation

조건:

```text
Rotation risk_on improving
Momentum strengthening
RS not yet strong
```

해석:

```text
순환매 초기 가능성.
```

---

### Pattern H — Structural Winner

조건:

```text
Catalyst structural positive
RS strong or improving
```

해석:

```text
구조적 촉매가 가격 행동과 일치하는 장기 주도 후보.
```

---

### Pattern I — Weak Expansion

조건:

```text
Breadth strengthening
Participation weak or diverging
```

해석:

```text
상승 종목 수는 늘고 있지만 거래량 확신이 부족함.
```

---

### Pattern J — Breakdown

조건:

```text
RS weak
Momentum weakening or collapsing
Participation distribution
```

해석:

```text
회피 구간 또는 리더십 붕괴.
```

출력:

```text
Direction: strong_down
Strength: 0 or 1
Conviction: medium/high depending on alignment
```

## 6. Veto Rules

| Veto | 조건 | 효과 |
|---|---|---|
| V1 Momentum Collapse | momentum = collapsing | Strong Up 금지 |
| V2 Participation Breakdown | participation = distribution | conviction high 금지 |
| V3 Catalyst Reversal | catalyst = negative or weakening | strength 1단계 하향 |
| V4 Broad Breadth Collapse | breadth = breakdown | risk flag 추가 |
| V5 Data Insufficient | unknown module >= 2 | conviction high 금지 |

## 7. Conviction Label

검증 전에는 conviction을 확률로 해석하지 않습니다. 아래 label만 사용합니다.

| Label | 의미 |
|---|---|
| high | 여러 독립 모듈이 같은 방향으로 정렬 |
| medium | 주요 모듈은 정렬되지만 일부 충돌 존재 |
| low | 충돌이 크거나 데이터 부족 |

## 8. Narrative 생성 규칙

Narrative는 아래 순서를 따릅니다.

```text
1. 현재 상태 요약
2. 가장 강한 근거 1~2개
3. 충돌 또는 약점
4. 촉매
5. 무효화 조건
```

예:

```text
반도체 섹터는 시장 대비 상대강도가 강하고 RS Momentum도 개선되고 있어 현재 주도 섹터로 분류된다. Breadth와 Participation도 상승을 확인하고 있어 강세의 질은 양호하다. 다만 50일선 위 종목 비율이 하락하기 시작하면 대형주 의존으로 전환될 수 있으며, RS Momentum이 2주 연속 둔화될 경우 현재 판단은 약화된다.
```

## 9. Rulebook 테스트 케이스

필수 테스트:

1. Strong Leader
2. Emerging Leader
3. Late Leader
4. Mega-cap Dependence
5. False Leadership
6. Breakdown
7. Momentum Collapse veto
8. Data Insufficient veto

## 10. 향후 확장

- Macro regime을 Rulebook context로 추가
- Stock Candidate Funnel과 연결
- 패턴별 forward performance를 validation으로 조정
- 자연어 narrative template 개선
