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
