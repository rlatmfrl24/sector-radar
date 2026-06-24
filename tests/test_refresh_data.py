from __future__ import annotations

import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd

from sector_radar.application.refresh_data import build_symbol_universe, refresh_market_data
from sector_radar.data.config_loader import load_threshold_config, load_universe_config
from sector_radar.data.store import create_schema, get_data_refresh_status

ROOT = Path(__file__).resolve().parents[1]


class FakePriceProvider:
    name = "yahoo_finance"

    def __init__(self, *, fail: bool = False) -> None:
        self.call_count = 0
        self.fail = fail

    def fetch_daily(
        self,
        symbols,
        *,
        start=None,
        end=None,
        period="2y",
    ) -> pd.DataFrame:
        self.call_count += 1
        if self.fail:
            raise RuntimeError("provider unavailable")

        dates = pd.date_range("2024-01-01", periods=80)
        rows = []
        for symbol_index, symbol in enumerate(symbols):
            for day_index, date in enumerate(dates):
                base = 100 + symbol_index
                trend = 1 + (day_index / 1000)
                rows.append(
                    {
                        "symbol": symbol,
                        "date": date.strftime("%Y-%m-%d"),
                        "open": base * trend,
                        "high": base * trend * 1.01,
                        "low": base * trend * 0.99,
                        "close": base * trend,
                        "volume": 1_000_000 + day_index,
                    }
                )
        return pd.DataFrame(rows)


def _config():
    return (
        load_universe_config(ROOT / "config" / "universe.us_sectors.yaml"),
        load_threshold_config(ROOT / "config" / "thresholds.example.yaml"),
    )


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    return conn


def test_refresh_inserts_ohlcv_and_rate_limits_repeated_calls():
    universe, thresholds = _config()
    provider = FakePriceProvider()
    conn = _conn()
    now = datetime(2026, 6, 23, 0, 0, tzinfo=UTC)

    first = refresh_market_data(
        conn,
        provider=provider,
        universe=universe,
        thresholds=thresholds,
        now=now,
    )
    first_count = conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0]

    second = refresh_market_data(
        conn,
        provider=provider,
        universe=universe,
        thresholds=thresholds,
        now=now + timedelta(minutes=1),
    )
    second_count = conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0]

    assert first.status == "success"
    assert second.status == "skipped_rate_limited"
    assert provider.call_count == 1
    assert first_count == second_count
    assert first_count == len(build_symbol_universe(universe)) * 80 * 5
    assert first.data_connection.latest_price_date == "2024-03-20"


def test_refresh_after_interval_calls_provider_and_updates_status():
    universe, thresholds = _config()
    provider = FakePriceProvider()
    conn = _conn()
    now = datetime(2026, 6, 23, 0, 0, tzinfo=UTC)

    refresh_market_data(conn, provider=provider, universe=universe, thresholds=thresholds, now=now)
    result = refresh_market_data(
        conn,
        provider=provider,
        universe=universe,
        thresholds=thresholds,
        now=now + timedelta(minutes=16),
    )

    status = get_data_refresh_status(conn)
    assert result.status == "success"
    assert provider.call_count == 2
    assert status is not None
    assert status["status"] == "success"
    assert status["rows_upserted"] > 0


def test_refresh_failure_preserves_existing_rows_and_marks_failed():
    universe, thresholds = _config()
    conn = _conn()
    now = datetime(2026, 6, 23, 0, 0, tzinfo=UTC)

    refresh_market_data(
        conn,
        provider=FakePriceProvider(),
        universe=universe,
        thresholds=thresholds,
        now=now,
    )
    existing_count = conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0]

    result = refresh_market_data(
        conn,
        provider=FakePriceProvider(fail=True),
        universe=universe,
        thresholds=thresholds,
        now=now + timedelta(minutes=16),
    )
    failed_count = conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0]

    assert result.status == "failed"
    assert failed_count == existing_count
    assert result.data_connection.status == "failed"
    assert result.data_connection.last_success_at is not None
    assert result.data_connection.message == "provider unavailable"
