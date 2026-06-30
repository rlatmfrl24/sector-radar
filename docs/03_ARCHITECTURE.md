# 03. Architecture

## 1. 아키텍처 목표

- 로컬에서 쉽게 실행 가능
- 데이터 수집과 계산을 분리
- 원천 데이터와 파생 지표를 분리
- Rulebook이 지표 계산에 의존하지 않도록 분리
- UI는 API/JSON 계약에만 의존
- 검증 전 확률을 노출하지 않는 구조

## 2. 전체 흐름

```text
External Data Provider
        ↓
Provider Adapter
        ↓
SQLite Raw Store: series_daily
        ↓
Metric Engine
        ↓
SQLite Derived Store: sector_metrics_daily
        ↓
Sector Rulebook
        ↓
Dashboard / API
```

## 3. Clean Architecture 계층 구조

```text
src/sector_radar/
  domain/
    models.py            # ModuleState, RulebookOutput 같은 출력 계약 모델

  application/
    build_relative_strength_snapshot.py
                         # DB에서 데이터를 읽어 섹터 스냅샷을 만드는 유스케이스

  infrastructure/
    sqlite/
      schema.py          # SQLite canonical DDL, column constants

  data/
    store.py             # SQLite adapter facade: connect, upsert, query
    price_csv.py         # CSV fixture ingestion adapter
    config_loader.py     # yaml config loader

  metrics/
    relative_strength.py # RS ratio, RS momentum, RRG state
    breadth.py           # pct above MA
    participation.py     # RVOL, OBV, CMF

  rules/
    sector_rulebook.py   # pattern matching, veto, narrative

  validation/
    replay.py            # historical replay
    labels.py            # forward relative return labels
    report.py            # validation metrics

  pipeline.py            # backward-compatible import wrapper

frontend/
  src/features/radar/
    model.ts             # dashboard selectors and view helpers
    components/          # top bar, Layer 1/2, Layer 3 presentation components
  functions/api/         # Cloudflare Pages Function API
  workers/ingest/        # scheduled Yahoo/FRED ingestion worker
  migrations/            # Cloudflare D1 migrations
```

Dependency rule:

```text
Interface/UI → Application → Domain
Infrastructure → Application/Domain
Domain → no infrastructure, no UI, no database imports
```

기존 `sector_radar.pipeline.build_relative_strength_snapshot_from_db` 경로는 테스트와 사용 편의를 위해 유지하지만, 실제 구현은 `sector_radar.application`에 둡니다.

## 4. 데이터 수집 전략

MVP에서는 provider를 추상화합니다.

```python
class PriceProvider:
    def fetch_daily(self, symbol: str, start: date, end: date) -> DataFrame:
        ...
```

구현체는 바뀔 수 있습니다.

```text
YFinanceProvider
OpenBBProvider
CSVFixtureProvider
```

Unit test는 항상 `CSVFixtureProvider` 또는 synthetic DataFrame을 사용해야 합니다.

## 5. 저장 전략

### Raw data

```text
series_daily
```

가격, 거래량, 지수, FRED 등 모든 원천 시계열은 long-format으로 저장합니다.

### Derived data

```text
sector_metrics_daily
```

섹터별 RS, Momentum, Breadth, Participation, Rulebook 결과를 저장합니다.

### Event history

```text
watchlist_events
```

Emerging Leader, False Leadership, Breakdown 같은 이벤트 발동 이력을 저장합니다.

### Manual input

```text
manual_catalyst_ledger
```

초기 Catalyst는 사람이 입력합니다.

## 6. 모듈 의존성

```text
Relative Strength  ┐
Momentum           ├─→ Sector Rulebook
Breadth            │
Participation      │
Rotation           │
Catalyst           ┘
```

Rulebook은 각 모듈의 원자료를 다시 계산하지 않습니다. 모듈별 표준 상태 객체만 받습니다.

`ModuleState`와 `RulebookOutput`의 canonical 정의는 `sector_radar.domain.models`입니다. Rulebook과 metrics는 이 도메인 모델을 공유하되, DB adapter나 React 타입에 직접 의존하지 않습니다.

## 7. 표준 상태 객체

각 모듈은 아래 구조를 출력합니다.

```json
{
  "module": "relative_strength",
  "state": "strong",
  "transition": "strengthening",
  "direction": "up",
  "strength": 3,
  "evidence": {
    "rs_ratio": 104.2,
    "rs_momentum": 101.8
  },
  "warnings": []
}
```

## 8. Dashboard 전략

MVP UI는 React + Vite로 시작합니다.

방향:

- UI는 API/JSON contract에만 의존
- Cloudflare Pages에 정적 자산과 Functions를 배포
- Cloudflare D1을 배포용 관계형 저장소로 사용
- Python은 로컬 연구, ingestion, metric 계산 엔진으로 유지

구조:

```text
Local research:
CSV/provider → Python metric engine → SQLite

Deployable UI:
React → Pages Function → Cloudflare D1
```

프론트엔드 파일 배치:

```text
frontend/src/App.tsx
  앱 상태, 스냅샷 데이터 로딩, 현재 화면 선택, 선택 섹터 기준만 담당

frontend/src/lib/dashboardSnapshot.ts
  /api/sectors, /api/history, /api/validation을 병렬로 읽어 DashboardSnapshot을 구성
  refresh 중에는 더 빠른 poll interval을 사용

frontend/src/features/radar/model.ts
  정렬, 그룹핑, 패턴 클래스, 숫자 포맷 등 순수 helper

frontend/src/features/radar/components/
  대시보드 top bar, Layer 1, Layer 2, Layer 3, Layer 4 화면 컴포넌트와 공통 패널 부품

frontend/src/types.ts
  docs/09_API_CONTRACT.md와 맞춰야 하는 JSON 타입
```

현재 화면 선택 규칙:

```text
Layer 1:
  sortSectors = rulebook.strength desc, rs_ratio desc
  현재 RS 리더와 warning/constructive 분포를 읽는다.

Layer 2:
  Layer 1과 별도 화면에서 participation, official market context, trigger watchlist를 읽는다.

Layer 3:
  기본 상세 선택은 Layer 1의 현재 RS 리더를 따른다.
  좌측 레일은 sortSectorsByMomentum = rs_momentum desc, rs_ratio desc를 사용한다.
  현재 RS 리더와 모멘텀 선두가 다르면 전환 관찰 신호로 표시한다.

Layer 4:
  /api/validation diagnostics와 /api/history coverage로 검증 게이트, replay 준비도, pattern diagnostics를 읽는다.
  /api/validation/status와 run_log의 layer4_validation_audit으로 정기 점검 상태를 읽는다.
  calibration 전 예측 확률, 승률, 기대수익률 문구는 표시하지 않는다.
  Layer 4 안에서는 sample-observed probability와 reliability를 historical diagnostics로만 표시한다.
```

수집원 표시 규칙:

```text
FreshnessBar:
  activeView에 따라 source_freshness를 Layer 1/2/3/4로 scope한다.

ContextRail:
  Layer 1은 market tape/breadth/risk/validation,
  Layer 2는 market context/participation/risk trigger/validation,
  Layer 3는 RS 리더/순환 후보/reconciliation/validation,
  Layer 4는 검증/Replay/패턴 진단/표본 확률을 표시한다.
```

## 9. 환경 설정

```text
.env
  SECTOR_RADAR_DB_PATH=data/sector_radar.db
  PRICE_PROVIDER=yfinance
  APP_ENV=local
```

환경 변수는 선택 사항입니다. 기본값은 로컬 실행에 맞춥니다.

Cloudflare 배포 설정은 `frontend/wrangler.jsonc`와 `frontend/migrations/`에 둡니다.

## 10. 장애 대응 원칙

데이터가 부족하면 계산을 실패시키기보다 상태를 `unknown`으로 둡니다.

```json
{
  "state": "unknown",
  "reason": "insufficient_lookback",
  "required_days": 200,
  "available_days": 72
}
```

단, Rulebook은 `unknown`이 많은 상태에서 높은 conviction을 출력하면 안 됩니다.
