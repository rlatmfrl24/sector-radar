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
three dense dashboard screens: Layer 1, Layer 2, and Layer 3
deep navy analytical panels
thin 300-weight typography
tabular numerics for market values
12px card radius, pill buttons
```

주의:

```text
DESIGN.md의 display negative letter-spacing은 프로젝트 UI 규칙에 맞춰 0으로 정규화한다.
Sector MVP에 없는 Macro / Stock / Watchlist 기능은 가짜 수치로 렌더링하지 않는다.
Landing page hero, marketing CTA, product promo copy, decorative mesh-first composition은 사용하지 않는다.
```

## 2. 화면 구조

```text
Overview
  ├─ Compact Top Bar: benchmark, as_of, source, validation gate, probability gate
  ├─ Screen Switch: 흐름 / 여력 / 주도·섹터
  ├─ Screen A: Layer 1 흐름
  │   ├─ Layer 1: flow readout strip (leadership, breadth, warnings, reconciliation)
  │   └─ Layer 1: evidence panel (RRG quadrant mix, RS distribution, clusters, breadth, checkpoints)
  ├─ Screen B: Layer 2 여력
  │   ├─ Layer 2: live ETF participation snapshot
  │   └─ Layer 2: Yahoo/FRED live/proxy/hold liquidity inputs without fake source claims
  ├─ Screen C: Layer 3 주도 (섹터)
  │   ├─ Left Rail: sector leadership ranking
  │   ├─ Main Canvas: RRG + treemap
  │   └─ Right Inspector: selected sector narrative, module states, risks, invalidation
  └─ No landing hero / no marketing CTA

Sector Detail expansion
  └─ 보류: Overview inspector에서 충분히 표현한 뒤 필요성이 검증되면 별도 화면으로 확장한다.

Replay / Validation
  ├─ Date Picker
  ├─ Historical State
  ├─ Forward Outcome
  └─ Pattern Statistics
```

## 3. Overview 화면

### 3.1 Header

```text
Sector Radar
As of: YYYY-MM-DD
Benchmark: SPY
Data freshness: latest close YYYY-MM-DD
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
Overview card:
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
  - freshness panel은 선택된 상단 탭의 관련 수집원만 표시한다. Layer 1은 market tape·breadth helper 시리즈, Layer 2는 participation·market context·risk trigger 원천, Layer 3는 sector snapshot/leadership 원천을 기준으로 분리한다.
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

각 점은 섹터 ETF입니다. MVP에서는 현재 점만 표시하고, P1에서 trailing tail을 추가합니다.

## 5. Sector Detail 화면

### 5.1 Top Summary

```text
Sector: SMH Semiconductors
Pattern: Strong Leader
Direction: Strong Up
Conviction: High
```

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

## 7. Data Health Panel

표시 항목:

```text
latest price date
missing series count
unknown module count
last compute time
database path
provider
```

## 8. MVP UI 구현 방식

React + Vite 우선:

```text
frontend/src/App.tsx: three-screen Overview switch, Screen A Layer 1, Screen B Layer 2, Screen C Layer 3
frontend/functions/api/sectors.ts: D1-backed sector snapshots
frontend/wrangler.jsonc: Cloudflare Pages + D1 binding
```

Replay / Validation은 같은 JSON contract 위에 별도 view로 확장합니다.

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
desktop Screen A: Layer 1은 화면 전체를 사용하며 market tape, breadth, volatility evidence가 선택 화면 내부에서만 스크롤된다.
desktop Screen B: Layer 2는 화면 전체를 사용하며 participation, market context, risk trigger가 선택 화면 내부에서만 스크롤된다.
desktop Screen C: Layer 3는 화면 전체를 사용하며 leadership rail과 selected inspector는 내부 스크롤만 허용한다.
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
