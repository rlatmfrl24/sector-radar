# 02. MVP Specification

## 1. MVP 이름

**Sector Radar MVP**

## 2. 사용자 관점 한 문장

> 투자 리서처로서 나는 현재 어느 섹터가 강하고, 그 강세가 건강한지, 그리고 어떤 조건에서 그 판단을 철회해야 하는지 빠르게 알고 싶다.

## 3. 핵심 사용자 스토리

### Story 1 — 시장 흐름 확인

```text
사용자는 Layer 1에서 시장 tape, breadth quality, 변동성 압력, 현재 RS 리더를 먼저 확인할 수 있다.
```

Acceptance Criteria:

- Layer 1 상단 탭과 독립 화면 표시
- 현재 흐름 판정, transition, narrative 표시
- 주도/순환 섹터 수와 경고 섹터 수 표시
- Layer 1 관련 수집원만 수집 내역에 표시
- easy mode에서는 쉬운 해설 화면으로 전환 가능

### Story 2 — 유동성/여력 확인

```text
사용자는 Layer 2에서 ETF participation, 공식 FRED market context, risk trigger를 별도 화면에서 확인할 수 있다.
```

Acceptance Criteria:

- RVOL, OBV slope, CMF 기반 Participation state 표시
- S01/S02/S03/S05 market context 카드 표시
- Trigger watchlist 표시
- Layer 2 관련 수집원만 수집 내역에 표시
- 공식 원천과 보조/후보 원천을 혼동하지 않음

### Story 3 — 리더십 상세와 회전 후보 확인

```text
사용자는 Layer 3에서 현재 RS 리더와 모멘텀 선두 후보를 분리해 보고, 선택 섹터의 RRG 위치와 rulebook 판단을 확인할 수 있다.
```

Acceptance Criteria:

- Layer 3 기본 상세 선택은 Layer 1의 현재 RS 리더를 따른다.
- 좌측 레일은 `rs_momentum` 기준 모멘텀 선두 후보를 보여준다.
- 현재 RS 리더와 모멘텀 선두가 다르면 전환 관찰 신호로 표시한다.
- RRG plot, RRG path, treemap, selected-sector inspector 표시
- selected-sector inspector는 pattern, narrative, risks, invalidation, data freshness를 포함한다.

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
| Dashboard | Layer 1 흐름 + Layer 2 여력 + Layer 3 리더십 상세 | P0 |
| Source freshness | 활성 Layer 관련 수집원만 표시 | P0 |
| Context reconciliation | 섹터 리더십과 Layer 2 환경의 정합성/불일치 표시 | P0 |
| Trigger watchlist | risk trigger를 qualitative 상태로 표시 | P0 |
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

현재 대시보드가 읽는 상위 응답은 단일 섹터 객체가 아니라 `/api/sectors`의 `SectorsResponse`입니다. 주요 top-level 필드는 다음과 같습니다.

```text
as_of
benchmark
sectors[]
validation
data_connection
data_connections
market_context
layer1_flow
concentration
source_freshness
source_expansion
watchlist
context_reconciliation
```

## 8. MVP 완료 후 첫 확장

MVP가 끝나면 바로 종목 엔진으로 가지 말고, 먼저 Replay/Validation을 붙입니다.

```text
Sector Radar → Replay Mode → Validation Report → Stock Candidate Funnel
```

검증 없이 종목 후보를 붙이면 그럴듯한 랭킹 앱이 될 위험이 큽니다.
