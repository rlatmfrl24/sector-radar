# 01. Implementation Plan

## 1. 전체 전략

전체 Macro / Sector / Stock Intelligence를 한 번에 만들지 않습니다. 첫 4~6주는 **Sector Radar MVP**에 집중합니다.

```text
1차 목표: 섹터 리더십 탐지
2차 목표: 가짜 리더십 / 후반부 리더십 탐지
3차 목표: Replay와 검증
4차 목표: Stock Candidate Funnel 확장
```

## 2. 단계별 구현 로드맵

### Current implemented slice

현재 구현된 범위:

- SQLite schema 생성과 idempotent upsert: `series_daily`, `instrument_master`, `sector_metrics_daily`
- long-format series lookback query와 freshness helper
- `universe.us_sectors.yaml`, `thresholds.example.yaml` loader
- 로컬 CSV/fixture 가격 ingestion adapter
- config 기반 RS Ratio, RS Momentum, RRG quadrant, module state
- SQLite에서 가격을 읽어 Relative Strength sector snapshot을 만드는 end-to-end 함수
- deterministic unit tests for store, config, CSV ingestion, RS/RRG, breadth/participation edge cases, rulebook patterns, snapshot contract

아직 남은 범위:

- 실제 Breadth/Participation 계산 pipeline 연결
- manual catalyst ledger loader
- React 화면과 Cloudflare Pages/D1 경계 연결
- `DESIGN.md` 기반 밝은 앱 셸, compact status bar, Layer 1 흐름 / Layer 2 여력 / Layer 3 주도, deep-navy RRG, 섹터 rail/RRG/treemap/inspector
- Replay/Validation harness
- Macro Liquidity Layer, Stock Candidate Funnel, Integrated Watchlist 확장

### Phase 0 — 프로젝트 부트스트랩

목표: 개발자가 바로 작업할 수 있는 저장소 구조를 만든다.

작업:

- Python 패키지 구조 생성
- `pyproject.toml` 작성
- `config/` 디렉터리 생성
- `data/` 로컬 DB 경로 `.gitignore` 처리
- `pytest`, `ruff`, `mypy` 기본 설정
- 샘플 universe와 threshold config 작성

완료 기준:

```text
pytest가 실행된다.
패키지를 editable install 할 수 있다.
AGENTS.md와 docs가 저장소 루트에 존재한다.
```

---

### Phase 1 — 데이터 저장층

목표: 가격과 계산값을 반복 사용 가능한 형태로 저장한다.

작업:

- SQLite 연결 함수
- 테이블 생성 DDL
- `series_daily` upsert
- `sector_metrics_daily` upsert
- 최신 날짜 조회
- lookback query
- data freshness 조회

핵심 파일:

```text
src/sector_radar/data/store.py
src/sector_radar/data/config_loader.py
config/universe.us_sectors.yaml
```

완료 기준:

```text
동일 데이터를 두 번 upsert해도 중복되지 않는다.
특정 series_id의 최신 날짜를 조회할 수 있다.
특정 lookback 기간의 데이터를 DataFrame으로 읽을 수 있다.
```

---

### Phase 2 — Relative Strength & RRG

목표: 어느 섹터가 시장보다 강한지 계산하고 4사분면으로 분류한다.

작업:

- 섹터 ETF 수익률 계산
- 벤치마크 대비 초과수익 계산
- RS raw 계산
- normalized RS Ratio 계산
- RS Momentum 계산
- Leading / Improving / Weakening / Lagging 분류
- RRG용 trailing tail 저장

핵심 파일:

```text
src/sector_radar/metrics/relative_strength.py
src/sector_radar/metrics/momentum.py
```

완료 기준:

```text
각 섹터가 RRG quadrant 중 하나로 분류된다.
Improving 섹터 후보가 별도 리스트로 출력된다.
synthetic 데이터에서 예상 quadrant가 정확히 나온다.
```

---

### Phase 3 — Breadth

목표: 섹터 강세가 일부 대형주만의 움직임인지, 섹터 전체로 확산되는지 판단한다.

작업:

- 섹터별 대표 종목 리스트 구성
- 종목별 20/50/200일선 위 여부 계산
- 섹터별 `% above MA` 계산
- breadth transition 계산
- RS 강세 + breadth 약화 패턴 감지

핵심 파일:

```text
src/sector_radar/metrics/breadth.py
config/universe.us_sectors.yaml
```

완료 기준:

```text
각 섹터의 pct_above_20ma, pct_above_50ma, pct_above_200ma가 출력된다.
RS는 강하지만 breadth가 약한 섹터에 Mega-cap Dependence flag가 붙는다.
```

---

### Phase 4 — Participation

목표: 가격 상승 뒤에 실제 거래량과 자금 유입이 있는지 판단한다.

작업:

- RVOL 계산
- OBV 계산 및 slope 계산
- CMF 계산
- breakout volume confirmation flag
- RS 강세 + participation 약화 패턴 감지

핵심 파일:

```text
src/sector_radar/metrics/participation.py
```

완료 기준:

```text
각 섹터 ETF에 대해 participation state가 나온다.
RS 강세이나 volume/money flow가 약한 섹터에 False Leadership flag가 붙는다.
```

---

### Phase 5 — Manual Catalyst Ledger

목표: 뉴스 NLP 없이도 촉매 정보를 구조화해서 Rulebook에 반영한다.

작업:

- 수동 catalyst YAML 스키마 정의
- catalyst type 분류: structural / cyclical / policy / event
- catalyst state: positive / neutral / negative
- catalyst transition: strengthening / stable / weakening
- confidence: low / medium / high

핵심 파일:

```text
config/catalysts.manual.example.yaml
src/sector_radar/data/catalyst_loader.py
```

완료 기준:

```text
수동 입력된 catalyst가 sector output에 포함된다.
Catalyst Reversal이 veto rule에 반영된다.
```

---

### Phase 6 — Sector Rulebook

목표: 숫자 지표를 투자적으로 해석하는 계층을 구현한다.

작업:

- module states를 표준 schema로 통일
- pattern matching
- veto rules
- narrative generation
- risk generation
- invalidation generation

핵심 파일:

```text
src/sector_radar/rules/sector_rulebook.py
```

완료 기준:

```text
Strong Leader, Emerging Leader, Late Leader, False Leadership, Breakdown이 테스트로 검증된다.
모든 sector output에 narrative, risks, invalidation이 포함된다.
```

---

### Phase 7 — React Dashboard MVP

목표: 사용자가 1분 안에 현재 섹터 상태를 이해할 수 있는 UI를 만든다.

화면:

1. Overview
2. RRG Quadrant
3. Sector Leaderboard
4. Watchlist
5. Sector Detail
6. Data Health

핵심 파일:

```text
frontend/src/App.tsx
frontend/functions/api/sectors.ts
frontend/wrangler.jsonc
```

완료 기준:

```text
Leading / Improving / Weakening / Lagging 섹터가 화면에 표시된다.
각 섹터 클릭 시 rulebook narrative와 invalidation이 표시된다.
```

---

### Phase 8 — Replay & Validation

목표: Rulebook 패턴이 실제로 유용했는지 검증한다.

작업:

- 특정 과거 날짜 기준 sector state 재생
- forward 20D / 60D relative return 계산
- 패턴별 성과 통계
- false leadership 경고의 forward underperformance 검증
- validation gate 상태 표시

완료 기준:

```text
패턴별 forward relative return 분포를 확인할 수 있다.
검증 전 probability가 UI에 노출되지 않는다.
```

## 3. 4주 압축 플랜

| 주차 | 목표 | 산출물 |
|---|---|---|
| 1주차 | DB + 가격 저장 + RS | SQLite, universe config, RS ranking |
| 2주차 | Momentum + RRG | quadrant 분류, RRG scatter |
| 3주차 | Breadth + Participation | 내부 건강도, 거래량 확인 |
| 4주차 | Rulebook + Dashboard | narrative, risks, invalidation, MVP UI |

## 4. P0 / P1 / P2 우선순위

### P0 — 반드시 필요

- SQLite schema
- Universe config
- RS Ratio / Momentum
- Breadth 기초
- Participation 기초
- Rulebook 패턴
- React overview
- `DESIGN.md` 기반 UI token/component system
- Unit tests

### P1 — MVP 직후

- Replay mode
- Validation report
- Manual catalyst editor
- Watchlist event history
- Data quality panel
- RRG trailing tail
- Macro/credit/fx placeholder를 실제 데이터 어댑터와 연결하기 전까지 UI 기능으로 노출 금지
- 섹터 treemap 크기를 실제 market cap 또는 liquidity proxy와 연결

### P2 — 확장

- Macro Liquidity Layer: Fed balance sheet, FX gate, credit/leverage, MMF/DXY inputs
- Stock Candidate Funnel
- Integrated Watchlist: sector trigger + stock candidate + validation state
- Macro overlay
- 뉴스 catalyst 자동화
- KOSPI 확장

## 5. 보류된 참고 UI 기능

첨부 레퍼런스에서 확인했지만 현재 Sector Radar MVP 범위 밖인 기능:

| 기능 | 보류 이유 | 편입 단계 |
|---|---|---|
| 유동성/천장 대시보드 | Fed/FRED, FX, credit, MMF 데이터 어댑터 미구현 | P2 Macro Liquidity Layer |
| Stock Engine 판정 카드 | 개별 종목 가격 구조, stock RS, 후보 funnel 미구현 | Sector validation 이후 |
| 통합 워치리스트 | 이벤트 이력과 stock funnel 출력이 필요 | P1/P2 bridge |
| Fear & Greed / 심리 게이지 | 외부 심리 데이터와 검증 정책 필요 | P2 Macro overlay |
| 시나리오별 천장 밴드 | macro model과 manual override schema 필요 | P2/P3 |

## 6. 가장 먼저 만들 이슈 10개

1. `pyproject.toml`과 패키지 구조 생성
2. SQLite DDL과 `init_db()` 구현
3. `series_daily` upsert 테스트
4. `universe.us_sectors.yaml` 로더 구현
5. synthetic price fixture 생성
6. RS Ratio / RS Momentum 계산 구현
7. RRG quadrant 분류 테스트
8. Sector Rulebook dataclass 정의
9. Strong Leader / False Leadership 테스트
10. React overview scaffold 구현
