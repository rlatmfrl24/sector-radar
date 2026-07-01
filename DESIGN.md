# Sector Radar Design System

Sector Radar는 섹터 리더십을 빠르게 읽는 리서치 대시보드입니다. 디자인 목표는 화려한 마케팅 페이지가 아니라, 반복적으로 보는 데이터 화면에서 **흐름, 여력, 리더십 전환, 이력 진단 상태**를 안정적으로 구분하게 하는 것입니다.

## 1. Product Shape

```text
App type: dense research dashboard
Primary surface: React/Vite app shell
Navigation: 4 compact top tabs
Screens:
  Layer 1 흐름
  Layer 2 여력
  Layer 3 리더십
  Layer 4 검증
```

첫 화면은 랜딩 페이지가 아닙니다. 앱은 즉시 분석 화면으로 시작합니다.

## 2. Visual Principles

- 판단과 근거가 먼저 보이고, 출처/수집 정보는 보조 진단으로 낮춘다.
- Layer 1/2/3/4는 한 화면에 억지로 합치지 않는다.
- 현재 RS 리더와 모멘텀 선두는 같은 말로 부르지 않는다.
- module disagreement는 노이즈가 아니라 신호로 시각화한다.
- 카드 안에 카드를 중첩하지 않는다.
- 거대한 hero, decorative gradient mesh, orb, bokeh, marketing CTA를 쓰지 않는다.
- 검증 전 확률이나 수익 가능성을 암시하는 시각적 게이지를 만들지 않는다.

## 3. Color Tokens

Current CSS variables in `frontend/src/styles.css` are the source of truth.

| Token | Value | Use |
|---|---:|---|
| `--primary` | `#533afd` | selected tab, active chip, focus accent |
| `--primary-deep` | `#4434d4` | labels, secondary accent |
| `--primary-soft` | `#665efd` | subtle selected emphasis |
| `--brand-dark` | `#1c1e54` | RRG and analytical dark panels |
| `--brand-dark-2` | `#24265f` | dark panel support surface |
| `--ink` | `#0d253d` | primary text |
| `--ink-secondary` | `#273951` | secondary text |
| `--ink-mute` | `#64748d` | labels, helper copy |
| `--canvas` | `#ffffff` | cards and controls |
| `--canvas-soft` | `#f6f9fc` | app background |
| `--hairline` | `#e3e8ee` | borders |
| `--good` | `#18a878` | constructive/healthy state |
| `--warning` | `#b8791f` | caution state |
| `--danger` | `#d83a66` | risk/negative state |

Palette guidance:

- The app should read as light, quiet, and analytical.
- Deep navy is reserved for dense analytical panels such as RRG.
- Indigo indicates selection and interaction, not generic decoration.
- Status colors must map to meaning, not visual variety.

## 4. Typography

Current implementation uses:

```css
Inter, Pretendard, "Apple SD Gothic Neo", "Segoe UI", system-ui, sans-serif
```

Rules:

- Use compact dashboard type, not hero-scale type inside panels.
- Font weight is generally 300-600; avoid heavy display styling.
- Letter spacing is `0` except tiny all-caps labels where existing CSS already defines it.
- Use tabular numerics for prices, ratios, dates, ranks, and metric values.
- Text must fit its container on desktop and mobile. Prefer wrapping over clipping for Korean explanatory text.

## 5. Layout

Top-level layout:

```text
dashboard-shell
  dashboard-topbar
    Layer tabs: 흐름 / 여력 / 리더십 / 검증
    Surface switch: 결과 / 수집
  view-workspace
    result mode: active Layer analysis screen
    collection mode: active Layer collection screen
```

Desktop:

- Shell uses `100dvh`.
- Topbar stays compact.
- `결과` mode keeps the active Layer analysis screen focused on judgment and evidence.
- `수집` mode replaces the active Layer body with source freshness, source details, status rail, and data quality.
- Only the active screen scrolls.
- Layer 3 uses a three-zone workspace: momentum rail, RRG/treemap analysis, selected inspector.

Mobile/tablet:

- Topbar collapses into responsive grid.
- Layer 3 flow strip stacks vertically under narrow widths.
- Sector rail becomes a compact grid/list before the selected inspector.

## 6. Core Components

### Top Tabs

```text
흐름 / Layer 1
여력 / Layer 2
리더십 / Layer 3
검증 / Layer 4
```

Tabs are compact segmented controls. Do not return to `주도·섹터`; that label conflates current RS leadership and momentum leadership.

### Result / Collection Switch

Each top Layer tab has two surfaces:

```text
결과: 판단, 차트, 테이블, 검증 결과
수집: 수집원 요약, 수집원 상세, 레이어 상태, 데이터 정합성
```

This is not a separate global collection tab. `Layer 3 + 수집` shows Layer 3 collection data; `Layer 3 + 결과` returns to the leadership analysis screen.

### LayerDataContextSection

Collection screens place source freshness, source details, layer status, and data quality inside one section:

```text
레이어 수집 데이터
  수집원 요약 / 상세
  레이어 상태
  데이터 정합성
```

Each layer only shows its own source scope. This section is the collection-mode body, not a card attached above the result screen.

### FreshnessBar

Shows provider state and expandable source rows scoped to the active Layer.

```text
Layer 1: SPY, QQQ, RSP, IWM, ^VIX helper series
Layer 2: Yahoo sector prices, FRED/context rows, trigger-related sources
Layer 3: sector snapshots and leadership sources
Layer 4: sector snapshots, Yahoo sector history, FRED/context coverage
```

### ContextRail

Compact status rail embedded inside the collection screen:

```text
Layer 1: Market Tape / Breadth / Risk-Vol / 검증
Layer 2: Market Context / Participation / Risk Trigger / 검증
Layer 3: RS 리더 / 순환 후보 / Reconciliation / 검증
Layer 4: 검증 / Replay / Coverage / 표본 관측 확률
```

If a layer has non-info `data_quality` issues, the rail narrative appends a short data-consistency note. It does not replace the layer-specific freshness rows.

### Data Quality Strip

Each active layer shows `데이터 정합성` inside its collection screen, not as a repeated card inside the result layer body. This strip is not a scorecard and must not average investment signals. It only summarizes data readiness:

```text
complete: required inputs and dates are aligned
partial: usable but some official/context/helper inputs are incomplete
stale: source freshness or endpoint as_of dates need review
blocked: required inputs are missing
```

### Layer 3 Leadership Flow

Use a compact top strip that places the RRG path selector and leadership bridge on the same row on desktop:

```text
RRG 경로 selector | 현재 RS 리더 -> 모멘텀 선두 -> alignment note
```

The leadership bridge itself remains:

```text
현재 RS 리더 -> 모멘텀 선두 -> alignment note
```

If both are the same, say they match. If they differ, say this is a leadership transition watch signal.

### Selected Inspector

Selected sector panel must include:

```text
role label: 현재 RS 리더 / 모멘텀 선두 / 비교 섹터
quadrant
lead_pattern
direction
conviction_label
module states
narrative
risks
invalidation
freshness
validation status
```

### Layer 4 Validation Lab

Layer 4 is a historical diagnostics and sample-observed probability screen, not a forecasting or recommendation screen.

```text
컴팩트 검증 요약
  데이터 수집 / Replay / 패턴 진단 / 표본 관측치
  Replay 30D / 90D / 180D coverage
  history coverage / context coverage
pattern diagnostics matrix
데이터 제한이 있을 때만 data limits
```

Show the four steps inside one compact overview strip: 데이터 수집, Replay, 패턴 진단, 표본 관측치. Replay availability belongs inside the Replay status cell, not as a separate card. Use `이력 진단 완료`, `Replay 가능`, `패턴 진단 완료`, `표본 확률 표시`, `표본 확률 대기` as status language. Use `데이터 제한` only for real blockers such as missing history or unavailable validation data. Do not visualize the value as a forecast gauge; show diagnostics as a matrix with heat cells, signed center-axis markers, and reliability.

Pattern diagnostics must gate probability-like values per pattern. If the global validation status is ready but a pattern is `thin_sample`, show `표본 부족` and the quality warning instead of a numeric observed probability.

Layer 4 also shows a compact `현재 판단 검증 연결` strip. It maps the current RS leader, momentum leader, and warning patterns to the available pattern diagnostics so the report caveat is visible before reading the full matrix.

## 7. Interaction Rules

- Clickable sector rows, RRG dots, and treemap tiles all update the selected sector.
- Layer 3 default selected sector follows Layer 1 current RS leader.
- Momentum rail sorting follows `rs_momentum desc, rs_ratio desc`.
- `결과 / 수집` switch appears on Layer 1~4 and swaps the current Layer body.
- Manual refresh respects provider gate; do not imply public Pages can force refresh.

## 8. Copy Rules

Use:

```text
현재 RS 리더
모멘텀 선두
순환 후보
전환 관찰 구간
검증 전
규칙 정합성
표본 관측 확률
신뢰도
리서치 관점
리포트 문장
현재 판단 검증 연결
```

Avoid:

```text
주도섹터
상승 확률
승률
매수/매도
확실히 상승
목표가
```

If numeric conviction is shown, label it as rule alignment, not probability. If Layer 4 shows a probability-like number, label it as sample-observed probability with reliability.

## 9. Validation Checklist

Before shipping UI changes:

```text
[ ] npm run test:app
[ ] npm run build
[ ] Layer 1/2/3/4 tabs render
[ ] `결과 / 수집` switch works on Layer 1/2/3/4
[ ] Collection screens scope source rows by active Layer
[ ] Layer 3 separates current RS leader and momentum leader
[ ] Layer 4 shows validation coverage, sample-observed probability, and reliability without recommendation wording
[ ] No console errors in browser smoke test
[ ] No clipped topbar or tab text on desktop/mobile
[ ] No calibrated-looking probability, recommendation, or profit promise wording
```
