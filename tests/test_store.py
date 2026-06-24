import sqlite3

from sector_radar.data.store import (
    create_schema,
    get_latest_date,
    get_series_freshness,
    read_series_lookback,
    upsert_instrument_master,
    upsert_sector_metrics_daily,
    upsert_series_daily,
)


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    return conn


def test_series_daily_upsert_is_idempotent_and_updates_values():
    conn = _conn()
    upsert_series_daily(
        conn,
        [("XLK", "2024-01-02", "close", 100.0, "fixture", "2024-01-03T00:00:00Z")],
    )
    upsert_series_daily(
        conn,
        [("XLK", "2024-01-02", "close", 101.5, "fixture_v2", "2024-01-04T00:00:00Z")],
    )

    count = conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0]
    value, source = conn.execute(
        "SELECT value, source FROM series_daily WHERE series_id = 'XLK'"
    ).fetchone()
    assert count == 1
    assert value == 101.5
    assert source == "fixture_v2"


def test_latest_date_freshness_and_lookback_query():
    conn = _conn()
    upsert_series_daily(
        conn,
        [
            ("XLK", "2024-01-02", "close", 100.0, "fixture", "t1"),
            ("XLK", "2024-01-03", "close", 101.0, "fixture", "t1"),
            ("XLK", "2024-01-04", "close", 102.0, "fixture", "t1"),
            ("SPY", "2024-01-03", "close", 99.0, "fixture", "t1"),
        ],
    )

    assert get_latest_date(conn, "XLK") == "2024-01-04"
    assert get_series_freshness(conn, ["XLK", "SPY"]) == {
        "XLK": "2024-01-04",
        "SPY": "2024-01-03",
    }

    lookback = read_series_lookback(conn, "XLK", lookback=2)
    assert lookback["date"].dt.strftime("%Y-%m-%d").tolist() == ["2024-01-03", "2024-01-04"]
    assert lookback["value"].tolist() == [101.0, 102.0]


def test_instrument_master_and_sector_metrics_upserts_are_idempotent():
    conn = _conn()
    upsert_instrument_master(
        conn,
        [
            {
                "instrument_id": "XLK",
                "symbol": "XLK",
                "name": "Technology Select Sector SPDR",
                "asset_type": "ETF",
                "market": "US",
                "sector_code": "XLK",
                "is_active": 1,
            }
        ],
    )
    upsert_instrument_master(
        conn,
        [
            {
                "instrument_id": "XLK",
                "symbol": "XLK",
                "name": "Technology",
                "asset_type": "ETF",
                "market": "US",
                "sector_code": "XLK",
                "is_active": 1,
            }
        ],
    )
    assert conn.execute("SELECT COUNT(*) FROM instrument_master").fetchone()[0] == 1
    assert conn.execute("SELECT name FROM instrument_master").fetchone()[0] == "Technology"

    metric = {
        "market": "US",
        "sector_code": "XLK",
        "date": "2024-01-31",
        "benchmark": "SPY",
        "rs_ratio": 101.0,
        "rs_momentum": 100.5,
        "rrg_quadrant": "leading",
    }
    upsert_sector_metrics_daily(conn, [metric])
    upsert_sector_metrics_daily(conn, [{**metric, "rs_ratio": 102.0}])
    count, ratio = conn.execute(
        "SELECT COUNT(*), MAX(rs_ratio) FROM sector_metrics_daily"
    ).fetchone()
    assert count == 1
    assert ratio == 102.0
