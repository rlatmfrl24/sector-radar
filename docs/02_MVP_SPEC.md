# 02. MVP Specification

## 1. MVP 이름

**Sector Radar MVP**

## 2. 사용자 관점 한 문장

> 투자 리서처로서 나는 현재 어느 섹터가 강하고, 그 강세가 건강한지, 그리고 어떤 조건에서 그 판단을 철회해야 하는지 빠르게 알고 싶다.

## 3. 핵심 사용자 스토리

### Story 1 — 현재 리더 확인

```text
사용자는 대시보드 첫 화면에서 현재 Leading 섹터와 Improving 섹터를 볼 수 있다.
```

Acceptance Criteria:

- 섹터별 RRG quadrant 표시
- Top Leader / Top Improver 리스트 표시
- 각 섹터의 데이터 기준일 표시

### Story 2 — 강세의 건강도 확인

```text
사용자는 특정 섹터의 강세가 섹터 전체로 확산되는지 확인할 수 있다.
```

Acceptance Criteria:

- 20/50/200MA 위 종목 비율 표시
- Breadth state 표시
- RS 강세 + Breadth 약화 시 경고 표시

### Story 3 — 거래량 확인

```text
사용자는 가격 상승이 거래량과 money flow로 확인되는지 볼 수 있다.
```

Acceptance Criteria:

- RVOL, OBV slope, CMF 표시
- Participation state 표시
- RS 강세 + Participation 약화 시 False Leadership flag 표시

### Story 4 — 해석과 무효화 조건

```text
사용자는 숫자뿐 아니라 해석 문장과 리스크, 무효화 조건을 볼 수 있다.
```

Acceptance Criteria:

- Rulebook pattern 표시
- Narrative 표시
- Risks 표시
- Invalidation 표시

## 4. MVP Universe

### 기본 ETF

```text
SPY  - Benchmark
QQQ  - Growth benchmark optional
XLK  - Technology
XLF  - Financials
XLY  - Consumer Discretionary
XLI  - Industrials
XLE  - Energy
XLV  - Health Care
XLP  - Consumer Staples
XLU  - Utilities
XLB  - Materials
XLRE - Real Estate
XLC  - Communication Services
SMH  - Semiconductors satellite
```

### 대표 종목 방식

초기에는 공식 ETF 전체 구성종목 대신 섹터별 대표 종목 10~20개를 수동 universe로 시작합니다.

이 방식은 완벽하지 않지만 MVP에는 충분합니다.

## 5. MVP 기능 목록

| 기능 | 설명 | 우선순위 |
|---|---|---|
| Price ingestion | ETF와 대표 종목 가격 저장 | P0 |
| SQLite store | 원천값과 계산값 저장 | P0 |
| RS ranking | 벤치마크 대비 상대강도 | P0 |
| RRG quadrant | Leading / Improving / Weakening / Lagging | P0 |
| Breadth | MA 위 종목 비율 | P0 |
| Participation | RVOL / OBV / CMF | P0 |
| Manual catalyst | 수동 촉매 입력 | P1 |
| Rulebook | 패턴 해석 | P0 |
| Dashboard | overview + detail | P0 |
| Replay | 과거 날짜 재생 | P1 |
| Validation | 패턴별 검증 | P1 |

## 6. 제외 범위

MVP에서 하지 않을 것:

- 자동 매수/매도
- 브로커 주문 연동
- 종목 추천 알림
- 개인화 포트폴리오 조언
- 옵션 체인 기반 정밀 수급 분석
- 공매도·다크풀 실시간 분석
- 뉴스 NLP 자동 catalyst 추출
- 개별 종목 펀더멘털 Quality / Expectation 엔진
- 확률 예측 노출

## 7. 주요 산출 JSON 예시

```json
{
  "as_of": "2026-06-23",
  "sector": "SMH",
  "benchmark": "SPY",
  "quadrant": "leading",
  "state": {
    "relative_strength": "strong",
    "momentum": "strengthening",
    "breadth": "healthy",
    "participation": "confirmed",
    "catalyst": "positive"
  },
  "rulebook": {
    "lead_pattern": "Strong Leader",
    "direction": "strong_up",
    "strength": 4,
    "conviction_label": "high",
    "narrative": "반도체 섹터는 시장 대비 상대강도와 모멘텀이 모두 강하며, breadth와 participation이 상승을 확인하고 있다.",
    "risks": ["Breadth 약화", "Participation 둔화", "Catalyst 약화"],
    "invalidation": ["RS Momentum 2주 연속 하락", "50MA 위 종목 비율 50% 하회", "CMF 0 하회"]
  },
  "data_freshness": {
    "price_latest": "2026-06-22",
    "metrics_latest": "2026-06-22"
  }
}
```

## 8. MVP 완료 후 첫 확장

MVP가 끝나면 바로 종목 엔진으로 가지 말고, 먼저 Replay/Validation을 붙입니다.

```text
Sector Radar → Replay Mode → Validation Report → Stock Candidate Funnel
```

검증 없이 종목 후보를 붙이면 그럴듯한 랭킹 앱이 될 위험이 큽니다.
