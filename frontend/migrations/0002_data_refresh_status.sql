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
);
