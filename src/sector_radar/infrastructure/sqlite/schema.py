from __future__ import annotations

SERIES_DAILY_FIELDS = ("open", "high", "low", "close", "volume")

INSTRUMENT_MASTER_COLUMNS = (
    "instrument_id",
    "symbol",
    "name",
    "asset_type",
    "market",
    "sector_code",
    "is_active",
)

SECTOR_METRICS_COLUMNS = (
    "market",
    "sector_code",
    "date",
    "benchmark",
    "ret_1m",
    "ret_3m",
    "ret_6m",
    "ret_12m",
    "excess_ret_3m",
    "rs_ratio",
    "rs_momentum",
    "rrg_quadrant",
    "pct_above_20ma",
    "pct_above_50ma",
    "pct_above_200ma",
    "breadth_state",
    "breadth_transition",
    "rvol_20",
    "obv_slope_20",
    "cmf_20",
    "participation_state",
    "participation_transition",
    "catalyst_state",
    "catalyst_transition",
    "rule_pattern",
    "direction",
    "strength",
    "conviction_label",
    "narrative",
    "risks_json",
    "invalidation_json",
    "source_metrics_json",
    "data_freshness_json",
    "validation_status",
    "expose_probability",
    "computed_at",
)

DATA_REFRESH_STATUS_COLUMNS = (
    "provider",
    "status",
    "last_attempt_at",
    "last_success_at",
    "next_allowed_at",
    "latest_price_date",
    "symbol_count",
    "rows_upserted",
    "message",
)

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS instrument_master (
        instrument_id TEXT PRIMARY KEY,
        symbol        TEXT NOT NULL,
        name          TEXT,
        asset_type    TEXT NOT NULL,
        market        TEXT,
        sector_code   TEXT,
        is_active     INTEGER NOT NULL DEFAULT 1
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS series_daily (
        series_id   TEXT NOT NULL,
        date        DATE NOT NULL,
        field       TEXT NOT NULL DEFAULT 'close',
        value       REAL NOT NULL,
        source      TEXT NOT NULL,
        fetched_at  TIMESTAMP NOT NULL,
        PRIMARY KEY (series_id, date, field)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_series_daily_lookup
    ON series_daily(series_id, field, date)
    """,
    """
    CREATE TABLE IF NOT EXISTS sector_metrics_daily (
        market                   TEXT NOT NULL,
        sector_code              TEXT NOT NULL,
        date                     DATE NOT NULL,
        benchmark                TEXT NOT NULL,
        ret_1m                   REAL,
        ret_3m                   REAL,
        ret_6m                   REAL,
        ret_12m                  REAL,
        excess_ret_3m            REAL,
        rs_ratio                 REAL,
        rs_momentum              REAL,
        rrg_quadrant             TEXT,
        pct_above_20ma           REAL,
        pct_above_50ma           REAL,
        pct_above_200ma          REAL,
        breadth_state            TEXT,
        breadth_transition       TEXT,
        rvol_20                  REAL,
        obv_slope_20             REAL,
        cmf_20                   REAL,
        participation_state      TEXT,
        participation_transition TEXT,
        catalyst_state           TEXT,
        catalyst_transition      TEXT,
        rule_pattern             TEXT,
        direction                TEXT,
        strength                 INTEGER,
        conviction_label         TEXT,
        narrative                TEXT,
        risks_json               TEXT,
        invalidation_json        TEXT,
        source_metrics_json      TEXT,
        data_freshness_json      TEXT,
        validation_status        TEXT NOT NULL DEFAULT 'unvalidated',
        expose_probability       INTEGER NOT NULL DEFAULT 0,
        computed_at              TIMESTAMP NOT NULL,
        PRIMARY KEY (market, sector_code, date, benchmark)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_sector_metrics_trail
    ON sector_metrics_daily(market, sector_code, date)
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlist_events (
        event_id     TEXT NOT NULL,
        date         DATE NOT NULL,
        sector_code  TEXT NOT NULL,
        event_type   TEXT NOT NULL,
        status       TEXT NOT NULL,
        payload_json TEXT,
        recorded_at  TIMESTAMP NOT NULL,
        PRIMARY KEY (event_id, date, sector_code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS manual_catalyst_ledger (
        catalyst_id    TEXT PRIMARY KEY,
        sector_code    TEXT NOT NULL,
        catalyst_type  TEXT NOT NULL,
        title          TEXT NOT NULL,
        description    TEXT,
        state          TEXT NOT NULL,
        transition     TEXT NOT NULL,
        confidence     TEXT NOT NULL,
        source_note    TEXT,
        effective_from DATE,
        effective_to   DATE,
        recorded_at    TIMESTAMP NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS run_log (
        run_id      TEXT PRIMARY KEY,
        run_type    TEXT NOT NULL,
        started_at  TIMESTAMP NOT NULL,
        finished_at TIMESTAMP,
        status      TEXT NOT NULL,
        message     TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS data_refresh_status (
        provider          TEXT PRIMARY KEY,
        status            TEXT NOT NULL,
        last_attempt_at   TIMESTAMP,
        last_success_at   TIMESTAMP,
        next_allowed_at   TIMESTAMP,
        latest_price_date DATE,
        symbol_count      INTEGER NOT NULL DEFAULT 0,
        rows_upserted     INTEGER NOT NULL DEFAULT 0,
        message           TEXT
    )
    """,
]
