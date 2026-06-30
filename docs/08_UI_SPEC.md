# 08. UI Specification

## 1. UI 목표

사용자가 1분 안에 다음을 이해해야 합니다.

```text
오늘의 리더 섹터
차기 리더 후보
약화 중인 리더
가짜 강세 가능 섹터
위험 경고 섹터
```

## 1.1 Design Base

프로젝트의 공식 디자인 베이스는 루트의 `DESIGN.md`입니다.

적용 원칙:

```text
canvas white / canvas-soft 배경
dense app shell, no landing hero
compact status bar and summary strip
four dense dashboard screens: Layer 1, Layer 2, Layer 3, and Layer 4
deep navy analytical panels
thin 300-weight typography
tabular numerics for market values
12px card radius, pill buttons
```

주의:

```text
Sector MVP에 없는 Macro / Stock / Watchlist 기능은 가짜 수치로 렌더링하지 않는다.
Landing page hero, marketing CTA, product promo copy, decorative background-first composition은 사용하지 않는다.
현재 RS 리더와 모멘텀 선두를 같은 `주도섹터` 문구로 합치지 않는다.
```

## 2. 화면 구조

```text
Dashboard Shell
  ├─ Compact Top Bar: benchmark, as_of, source, validation gate, probability gate
  ├─ Screen Switch: 흐름 / 여력 / 리더십 / 검증
  ├─ Layer 1: 흐름
  │   ├─ Layer 1: flow readout strip (leadership, breadth, warnings, reconciliation)
  │   └─ Layer 1: evidence panel (RRG quadrant mix, RS distribution, clusters, breadth, checkpoints)
  ├─ Layer 2: 여력
  │   ├─ Layer 2: live ETF participation snapshot
  │   └─ Layer 2: Yahoo/FRED live/proxy/hold liquidity inputs without fake source claims
  ├─ Layer 3: 리더십 상세
  │   ├─ Flow Strip: 현재 RS 리더와 모멘텀 선두를 분리 표시
  │   ├─ Left Rail: momentum leader candidates
  │   ├─ Main Canvas: RRG + treemap
  │   └─ Right Inspector: selected sector narrative, module states, risks, invalidation
  ├─ Layer 4: 검증 Lab
  │   ├─ Integrated Overview: 데이터 수집 / Replay / 패턴 진단 / 표본 관측치
  │   ├─ Replay Status: 30D / 90D / 180D 가능 범위를 Replay 상태 안에 병합
  │   ├─ Pattern Diagnostics: rulebook pattern별 가로형 historical diagnostics chart
  │   └─ Data Limits: 실제 데이터 제한이 있을 때만 표시
  └─ No landing hero / no marketing CTA

Dedicated sector page expansion
  └─ 보류: Layer 3 inspector에서 충분히 표현한 뒤 필요성이 검증되면 별도 화면으로 확장한다.

Replay / Validation
  ├─ Layer 4 검증 Lab
  ├─ History timeframe selector
  ├─ Coverage readiness
  └─ Pattern readiness
```

## 3. Dashboard Shell

### 3.1 Header

```text
Sector Radar
As of: YYYY-MM-DD
Benchmark: SPY
Data freshness: latest close YYYY-MM-DD
Active layer freshness: Layer 1 / Layer 2 / Layer 3 / Layer 4 관련 수집원만 표시
```

### 3.2 Summary Cards

```text
Leading
- XLK Technology
- SMH Semiconductors

Improving
- XLI Industrials
- XLF Financials

Weakening
- XLE Energy

Lagging
- XLU Utilities
- XLP Staples
```

### 3.2.1 Layer 1 Flow Evidence

Layer 1은 같은 숫자를 여러 카드에서 반복하지 않고, 역할을 분리합니다.

```text
Layer 1 readout:
  - 현재 흐름 판정
  - 주도/순환 섹터 수
  - breadth 정합성
  - warning count
  - reconciliation label

Evidence panel:
  - indicator guide cards with meaning, current value, current readout
  - small meter visualization for current data value or state
  - RRG quadrant mix
  - RS distribution sparkline
  - leading/rotation cluster
  - warning cluster
  - breadth profile
  - next checkpoints
```

Layer 1/2의 기본 정보 문법은 다음을 따른다.

```text
Left:
  - 전체 판단
  - 현재 결과
  - 왜 그렇게 해석하는지
  - 다음 확인 지점

Right:
  - 지표별 의미
  - 현재 수치
  - 현재 판단
  - 작은 막대/분포형 시각화
  - 데이터 출처는 카드 툴팁이나 `출처 정보` 힌트에 부착
```

전문 용어는 첫 노출에서 단독으로 쓰지 않는다. 예를 들어 `proxy`, `HHI`, `RRG` 같은 내부 용어는 `보조 지표`, `집중도`, `상대강도 경로`처럼 사용자가 먼저 이해할 수 있는 표현과 함께 둔다.

데이터 소스는 기본 본문에서 별도 카드 그룹으로 노출하지 않는다. 사용자가 먼저 읽어야 하는 것은 판단과 지표 해석이며, 출처·갱신·공식/보조 여부는 다음 위치로 낮춘다.

```text
Primary screen:
  - 지표 카드 안의 클릭형 `출처 정보` disclosure
  - disclosure 안에 `요청 정보`, `요청/수집 항목`, `받아온 결과`, `최신 기준`, `주의 메모` 표시

Diagnostics:
  - 상단 수집 내역 / freshness panel
  - freshness panel은 선택된 상단 탭의 관련 수집원만 표시한다. Layer 1은 market tape·breadth helper 시리즈, Layer 2는 participation·market context·risk trigger 원천, Layer 3는 sector snapshot/leadership 원천, Layer 4는 sector snapshot·Yahoo history·FRED/context coverage를 기준으로 분리한다.
  - 개발 문서의 data-source expansion plan
```

Layer 2는 `데이터별 상세 지표`, `마켓 컨텍스트`, `리스크 트리거`를 분리하지 않는다. 같은 수집값을 반복하지 않도록 `마켓 컨텍스트` 카드 안에 다음을 통합한다.

```text
Market context card:
  - 지표 의미
  - 현재 수치
  - 현재 판단
  - 해석
  - 관련 리스크 트리거
  - 클릭형 출처 정보
```

Layer 1/2의 좌측 패널은 사용자가 먼저 읽는 판단 영역이다. Layer 1은 판단 관련 문장을 `흐름 최종 판단`으로 병합하고, 우측은 근거와 상세 지표를 확인하는 보조 영역으로 유지한다. Layer 2의 요약 문장은 별도 카드처럼 감싸지 말고 요약 제목 아래의 리드 텍스트로 둔다. `다음 확인` 같은 모호한 표현은 피하고 `확인 체크리스트`처럼 무엇을 확인하는지 드러나는 제목을 사용한다.

Layer 3는 Layer 1의 이해 흐름을 이어야 한다. 기본 상세 선택은 Layer 1에서 쓰는 현재 RS 리더 정렬을 따른다. 단, 좌측 레일은 `rs_momentum` 기준의 모멘텀 선두 후보를 유지한다. 현재 RS 리더와 모멘텀 선두가 다르면 두 값을 같은 `주도섹터`로 부르지 않고 다음처럼 분리한다.

```text
현재 RS 리더: 높은 상대강도 또는 rulebook strength로 앞선 기존 리더
모멘텀 선두: rs_momentum 기준으로 가장 빠르게 좋아지는 회전 후보
```

이 차이는 오류가 아니라 리더십 전환 관찰 신호로 표시한다.

벤치마크 UI에서 흡수할 수 있는 방향은 "요약 문장 + 근거 카드"의 분리입니다. Layer 1은 가격 흐름, 폭, 변동성, 정합성을 빠르게 확인하는 곳이므로 다음 데이터는 후속 수집 후보로 둡니다.

```text
Benchmark tape:
  - benchmark close
  - 1D return
  - 52-week range position

Risk/volatility:
  - VIX latest state
  - realized volatility proxy

Breadth quality:
  - representative holdings coverage
  - advancing ratio
  - pct_above_20/50/200ma freshness
```

위 항목은 provider/API/freshness가 연결되기 전에는 화면에 수치처럼 노출하지 않습니다. 연결 전에는 `unknown`, `manual_check`, `proxy`로 명확히 표시합니다.

현재 Layer 1 추가 수집/표시:

```text
Yahoo chart provider:
  - SPY: benchmark tape, 1D/1W/1M/3M return, 52w range position
  - QQQ: growth leadership proxy vs SPY
  - RSP: equal-weight breadth proxy vs SPY
  - IWM: small-cap risk appetite proxy vs SPY
  - ^VIX: volatility pressure proxy

UI:
  - 좌측 readout: Tape, Breadth, Vol, 정합성
  - 우측 evidence: Market Tape, Risk/Vol, Breadth Proxy, RRG mix, RS distribution, checkpoints
```

### 3.3 Watchlist Cards

| Card | 조건 |
|---|---|
| Emerging Leaders | Improving + momentum strengthening |
| Late Leaders | Leading + momentum weakening |
| False Leadership | RS strong + participation weak |
| Mega-cap Dependence | RS strong + breadth narrow |
| Breakdown | RS weak + momentum weak + participation distribution |

## 4. RRG Chart

X축:

```text
RS Ratio
```

Y축:

```text
RS Momentum
```

사분면:

```text
Leading
Improving
Weakening
Lagging
```

각 점은 섹터 ETF입니다. 현재 위치는 최신 sector snapshot에서 그리고, 선택 섹터의 경로는 `/api/history?timeframe=30D|90D|180D`로 받은 RRG path에서 표시합니다. 히스토리가 부족하면 path 영역은 준비 상태와 coverage를 보여줍니다.

## 5. Layer 3 리더십 상세 화면

### 5.1 Top Summary

```text
현재 RS 리더: SMH
모멘텀 선두: XLV
상태: 기존 리더와 모멘텀 선두가 달라 전환 관찰 구간
선택 상세: SMH Semiconductors / Late Leader / Weakening
```

Layer 3 기본 상세 선택은 Layer 1의 현재 RS 리더를 따른다. 좌측 rail은 모멘텀 선두 후보를 보여주므로, 선택 상세와 rail 1위가 다를 수 있다. 이 불일치는 오류가 아니라 전환 신호로 표시한다.

### 5.2 Narrative

```text
반도체 섹터는 시장 대비 상대강도와 모멘텀이 강하며, breadth와 participation이 상승을 확인하고 있다. AI CAPEX cycle이 구조적 촉매로 작용하고 있다.
```

### 5.3 Risks

```text
- Breadth 약화
- Participation 둔화
- Catalyst 약화
- RS Momentum 100 하회
```

### 5.4 Invalidation Checklist

```text
[ ] RS Momentum 2주 연속 하락
[ ] pct_above_50ma 50% 하회
[ ] CMF 0 하회
[ ] Catalyst weakening 전환
```

## 6. Module Cards

각 모듈은 동일한 형식을 사용합니다.

```text
Relative Strength
State: Strong
Transition: Strengthening
Evidence: RS Ratio 104.2, RS Momentum 101.8
```

## 6.5 Layer 4 검증 Lab

Layer 4는 Layer 1~3 판단을 더 강하게 말하는 화면이 아니라, 어떤 판단이 아직 검증 전인지 분리하는 화면입니다.

```text
Top:
  - 통합 검증 요약 카드
  - 데이터 수집 / Replay / 패턴 진단 / 표본 관측치를 한 카드 안에서 표시
  - Replay 칸 안에 30D / 90D / 180D available/effective days 병합
  - history coverage / context coverage / 표본 관측 확률 / 신뢰도 표시

Bottom:
  - pattern diagnostics chart
  - 패턴명, 표본, 20D 관측, 20D 이후, 60D 이후, 20D 하락, 신뢰도를 한 행으로 가로 배치
  - 데이터 제한이 있을 때만 제한 카드
```

Layer 4 v1은 기존 `/api/sectors`, `/api/history`, `/api/validation`과 운영 점검용 `/api/validation/status`를 사용합니다. 새 DB migration은 요구하지 않습니다.
`historical_ready` 상태에서는 검증이 멈춘 것처럼 보이지 않도록 `이력 진단 완료`, `Replay 가능`, `패턴 진단 완료`, `표본 확률 표시`를 함께 보여줍니다. 표본 관측 확률은 positive forward-label 비율이며 신뢰도와 함께 표시합니다.

로컬 개발이나 API 데이터가 비어 있는 환경에서는 `sourceExampleHistoryResponse`와 `sourceExampleValidationResponse` 임시 fixture를 사용해 모든 Layer 4 항목을 렌더링할 수 있어야 합니다. 이 fixture는 `Temporary Layer 4 fixture` limitation을 표시하며, 실제 검증 결과처럼 표현하지 않습니다.

## 7. Source Freshness / Data Health

표시 항목:

```text
latest price date
provider
provider mode/status
last success
next allowed collection
active Layer source rows
source class
frequency
stale/live/manual_check status
```

이 정보는 독립 화면이 아니라 `FreshnessBar`, `SourceFreshnessPanel`, `ContextRail`에서 표시한다. 활성 탭과 무관한 수집원은 현재 화면의 primary diagnostics에 섞지 않는다.

## 8. MVP UI 구현 방식

React + Vite 우선:

```text
frontend/src/App.tsx: four-layer screen switch, Layer 1 흐름, Layer 2 여력, Layer 3 리더십, Layer 4 검증
frontend/functions/api/sectors.ts: D1-backed sector snapshots
frontend/wrangler.jsonc: Cloudflare Pages + D1 binding
```

Replay / Validation은 같은 JSON contract 위에 Layer 4 view로 확장합니다.

`DESIGN.md` 반영 원칙:

```text
light product canvas for dense app shell
deep-navy RRG and analytical panels
indigo selected/focus state
pill-shaped buttons and soft tags
tabular numerics
sector-first information hierarchy without fake macro/stock metrics
no fake macro or stock metrics
```

현재 미구현 기능은 UI에 수치처럼 노출하지 않고 구현 계획에만 둡니다.

높이와 스크롤 원칙:

```text
desktop: app shell은 100dvh 안에 고정하고 선택된 화면이 남은 높이를 모두 사용한다.
desktop Layer 1: 화면 전체를 사용하며 market tape, breadth, volatility evidence가 선택 화면 내부에서만 스크롤된다.
desktop Layer 2: 화면 전체를 사용하며 participation, market context, risk trigger가 선택 화면 내부에서만 스크롤된다.
desktop Layer 3: 화면 전체를 사용하며 momentum rail과 selected inspector는 내부 스크롤만 허용한다.
tablet/mobile: 선택된 화면 내부만 세로 스크롤되고, top bar/status는 가로 스크롤 대신 반응형 그리드로 접힌다.
screen switch는 local UI state로 동작하며 route를 늘리지 않는다.
```

## 9. UI 문구 원칙

허용:

```text
현재 리서치 관점에서 강세가 확인됩니다.
가짜 리더십 가능성이 있습니다.
이 판단은 아래 조건에서 약화됩니다.
```

금지:

```text
매수하세요.
확실히 오릅니다.
수익 가능성이 높습니다.
```
