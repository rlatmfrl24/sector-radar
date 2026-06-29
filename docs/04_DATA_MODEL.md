# 04. Data Model

## 1. 설계 원칙

- long-format 우선
- raw data와 derived data 분리
- idempotent upsert
- source와 fetched_at 기록
- data freshness 추적
- 설정값은 YAML/JSON, 시계열은 DB

## 2. 테이블 개요

| 테이블 | 목적 |
|---|---|
| `instrument_master` | ETF, 종목, 지수, benchmark 메타데이터 |
| `series_daily` | 가격·거래량·지수 등 모든 원천 시계열 |
| `sector_metrics_daily` | 섹터별 계산 지표와 상태 |
| `market_context_daily` | Layer 2 market context 카드별 상태와 freshness |
| `watchlist_events` | Rulebook 이벤트 발동 이력 |
| `manual_catalyst_ledger` | 사람이 입력한 catalyst 이력 |
| `run_log` | ingest / compute 실행 이력 |

## 3. DDL

Python에서 사용하는 canonical DDL과 컬럼 순서는 아래 파일에 둡니다.

```text
src/sector_radar/infrastructure/sqlite/schema.py
```

Cloudflare D1 배포용 mirror schema는 아래 migration에 둡니다.

```text
frontend/migrations/0001_sector_radar_base.sql
```

DDL 변경 시 두 위치와 테스트 fixture를 함께 확인해야 합니다.

```sql
CREATE TABLE IF NOT EXISTS instrument_master (
    instrument_id TEXT PRIMARY KEY,
    symbol        TEXT NOT NULL,
    name          TEXT,
    asset_type    TEXT NOT NULL,
    market        TEXT,
    sector_code   TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1
);
```

```sql
CREATE TABLE IF NOT EXISTS series_daily (
    series_id   TEXT NOT NULL,
    date        DATE NOT NULL,
    field       TEXT NOT NULL DEFAULT 'close',
    value       REAL NOT NULL,
    source      TEXT NOT NULL,
    fetched_at  TIMESTAMP NOT NULL,
    PRIMARY KEY (series_id, date, field)
);

CREATE INDEX IF NOT EXISTS idx_series_daily_lookup
ON series_daily(series_id, field, date);
```

`series_daily`는 가격뿐 아니라 volume, FRED/KRX 원자료 값도 저장할 수 있도록 `field`를 둡니다. 가격은 OHLCV long-format, 비가격 시계열은 `field = value`를 사용합니다.

예:

```text
series_id = XLK, field = close
series_id = XLK, field = volume
series_id = SPY, field = close
series_id = FRED:WALCL, field = value
series_id = KRX:FOREIGN_NET_BUY, field = value
series_id = KRX:EQUITY_TRADE_VALUE, field = value
```

```sql
CREATE TABLE IF NOT EXISTS sector_metrics_daily (
    market                 TEXT NOT NULL,
    sector_code            TEXT NOT NULL,
    date                   DATE NOT NULL,
    benchmark              TEXT NOT NULL,

    ret_1m                 REAL,
    ret_3m                 REAL,
    ret_6m                 REAL,
    ret_12m                REAL,
    excess_ret_3m          REAL,

    rs_ratio               REAL,
    rs_momentum            REAL,
    rrg_quadrant           TEXT,

    pct_above_20ma         REAL,
    pct_above_50ma         REAL,
    pct_above_200ma        REAL,
    breadth_state          TEXT,
    breadth_transition     TEXT,

    rvol_20                REAL,
    obv_slope_20           REAL,
    cmf_20                 REAL,
    participation_state    TEXT,
    participation_transition TEXT,

    catalyst_state         TEXT,
    catalyst_transition    TEXT,

    rule_pattern           TEXT,
    direction              TEXT,
    strength               INTEGER,
    conviction_label       TEXT,
    narrative              TEXT,
    risks_json             TEXT,
    invalidation_json      TEXT,
    source_metrics_json    TEXT,
    data_freshness_json    TEXT,
    validation_status      TEXT NOT NULL DEFAULT 'unvalidated',
    expose_probability     INTEGER NOT NULL DEFAULT 0,

    computed_at            TIMESTAMP NOT NULL,
    PRIMARY KEY (market, sector_code, date, benchmark)
);

CREATE INDEX IF NOT EXISTS idx_sector_metrics_trail
ON sector_metrics_daily(market, sector_code, date);
```

```sql
CREATE TABLE IF NOT EXISTS market_context_daily (
    market              TEXT NOT NULL,
    context_code        TEXT NOT NULL,
    date                DATE NOT NULL,
    state               TEXT NOT NULL,
    transition          TEXT NOT NULL,
    availability        TEXT NOT NULL,
    source_class        TEXT NOT NULL,
    title               TEXT NOT NULL,
    source              TEXT NOT NULL,
    meaning             TEXT NOT NULL,
    evidence_json       TEXT NOT NULL DEFAULT '{}',
    warnings_json       TEXT NOT NULL DEFAULT '[]',
    data_freshness_json TEXT NOT NULL DEFAULT '{}',
    computed_at         TIMESTAMP NOT NULL,
    PRIMARY KEY (market, context_code, date)
);

CREATE INDEX IF NOT EXISTS idx_market_context_daily_latest
ON market_context_daily(market, context_code, date);
```

`source_class`는 `official | proxy | manual | held` 중 하나입니다. 동일 카드에 official과 proxy가 모두 있으면 UI와 API는 official을 우선합니다.

```sql
CREATE TABLE IF NOT EXISTS watchlist_events (
    event_id     TEXT NOT NULL,
    date         DATE NOT NULL,
    sector_code  TEXT NOT NULL,
    event_type   TEXT NOT NULL,
    status       TEXT NOT NULL,
    payload_json TEXT,
    recorded_at  TIMESTAMP NOT NULL,
    PRIMARY KEY (event_id, date, sector_code)
);
```

```sql
CREATE TABLE IF NOT EXISTS manual_catalyst_ledger (
    catalyst_id          TEXT PRIMARY KEY,
    sector_code          TEXT NOT NULL,
    catalyst_type        TEXT NOT NULL,
    title                TEXT NOT NULL,
    description          TEXT,
    state                TEXT NOT NULL,
    transition           TEXT NOT NULL,
    confidence           TEXT NOT NULL,
    source_note          TEXT,
    effective_from       DATE,
    effective_to         DATE,
    recorded_at          TIMESTAMP NOT NULL
);
```

```sql
CREATE TABLE IF NOT EXISTS run_log (
    run_id       TEXT PRIMARY KEY,
    run_type     TEXT NOT NULL,
    started_at   TIMESTAMP NOT NULL,
    finished_at  TIMESTAMP,
    status       TEXT NOT NULL,
    message      TEXT
);
```

## 4. Upsert 규칙

### series_daily

중복 실행에 안전해야 합니다.

```sql
INSERT INTO series_daily(series_id, date, field, value, source, fetched_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(series_id, date, field)
DO UPDATE SET
    value = excluded.value,
    source = excluded.source,
    fetched_at = excluded.fetched_at;
```

### sector_metrics_daily

같은 날짜와 benchmark에 대해 재계산 가능해야 합니다.

```sql
ON CONFLICT(market, sector_code, date, benchmark)
DO UPDATE SET
    rs_ratio = excluded.rs_ratio,
    rs_momentum = excluded.rs_momentum,
    rrg_quadrant = excluded.rrg_quadrant,
    computed_at = excluded.computed_at;
```

구현 helper:

```text
src/sector_radar/data/store.py
  create_schema(conn)
  upsert_instrument_master(conn, rows)
  upsert_series_daily(conn, rows)
  upsert_sector_metrics_daily(conn, rows)
  read_series_daily(conn, series_ids, fields, start_date, end_date)
  read_series_lookback(conn, series_id, field, lookback, end_date)
  read_series_wide(conn, series_ids, field, start_date, end_date)
  get_series_freshness(conn, series_ids, field)
```

`sector_metrics_daily.validation_status`는 MVP에서 기본적으로 `unvalidated`이며, `expose_probability`는 검증 전 항상 `0`이어야 합니다.

## 5. Freshness Query

```sql
SELECT MAX(date)
FROM series_daily
WHERE series_id = ? AND field = 'close';
```

Dashboard는 각 섹터의 최신 데이터 기준일을 표시해야 합니다.

첫 구현 slice의 snapshot builder는 섹터와 benchmark의 최신 close 날짜를 함께 반환합니다.

## 6. Backfill 전략

초기 실행:

```text
lookback 3~5년 가격 데이터 수집
```

이후 실행:

```text
DB 최신 날짜 확인 → 누락된 기간만 fetch → upsert
```

## 7. 보존 정책

MVP에서는 삭제 정책을 두지 않습니다. 일별 데이터 수십만 행은 SQLite로 충분히 관리 가능합니다.

## 8. Git 관리

아래 파일은 git에 포함하지 않습니다.

```text
data/*.db
data/*.sqlite
data/raw/
data/cache/
```

config와 docs는 git에 포함합니다.
