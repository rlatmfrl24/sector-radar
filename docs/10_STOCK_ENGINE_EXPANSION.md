# 10. Stock Engine Expansion Roadmap

## 1. 왜 Sector 다음에 Stock인가

원본 아이디어의 Stock Engine은 다음 질문에 답합니다.

```text
어떤 종목을 선택해야 하는가?
좋은 회사인가?
기대는 개선 중인가?
가격 구조는 좋은가?
실제로 돈이 들어오는가?
무엇이 틀릴 수 있는가?
```

하지만 Stock Engine은 데이터 난이도가 높습니다. Quality, Expectation, Positioning은 무료 데이터만으로는 제한적이며, 실적 컨센서스와 기관 포지셔닝 데이터는 공급자 의존도가 큽니다.

따라서 순서는 다음이 좋습니다.

```text
Sector Radar MVP
  ↓
Sector Validation
  ↓
Stock Candidate Funnel
  ↓
Stock Quality / Expectation 확장
```

## 2. 첫 Stock 확장: Candidate Funnel

처음에는 정밀한 펀더멘털보다 가격 행동 중심 후보 압축이 좋습니다.

```text
1. Sector가 Leading 또는 Improving
2. 해당 섹터 대표 종목 중 Market RS 상위
3. Sector RS 상위
4. Price Structure 양호
5. Participation 확인
6. Risk veto 없음
```

## 3. Stock MVP 모듈

### Relative Strength

```text
stock / SPY
stock / sector ETF
stock / peer group
```

### Price Structure

```text
trend state
base state
breakout state
distance from support
ATR risk
```

### Participation

```text
rvol
obv slope
cmf
accumulation/distribution
```

### Risk

```text
volatility risk
drawdown risk
earnings event risk
liquidity risk
```

## 4. 후순위 모듈

### Quality

- EPS CAGR
- Operating margin
- FCF margin
- ROIC
- Balance sheet strength

### Expectation

- EPS revision
- Revenue revision
- Guidance raise/cut
- Surprise history

### Positioning

- Institutional ownership
- Short interest
- Crowding
- Under-owned opportunity

## 5. Stock Rulebook 초안

패턴 예시:

| Pattern | 조건 | 해석 |
|---|---|---|
| Sector-backed Leader | Sector leading + Stock RS strong | 섹터와 종목이 정렬 |
| Emerging Stock | Sector improving + Stock momentum improving | 차기 후보 |
| False Breakout | Price breakout + Participation weak | 거래량 미확인 돌파 |
| Quality Divergence | Quality strong + Expectation weak | 기대 회복 후보 |
| Crowded Leader | RS strong + Positioning crowded | 추격 위험 |
| Risk Veto | Extreme risk | 후보 제외 |

## 6. 확장 시 주의사항

- Sector Engine 검증 전 Stock 추천으로 넘어가지 않습니다.
- 펀더멘털 데이터는 provider별 차이가 크므로 source와 timestamp를 반드시 저장합니다.
- Stock Engine도 단일 평균 점수로 만들지 않습니다.
- Risk 모듈은 항상 veto 권한을 가집니다.
