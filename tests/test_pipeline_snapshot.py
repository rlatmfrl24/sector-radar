import sqlite3
from pathlib import Path

import pandas as pd

from sector_radar.data.config_loader import (
    load_threshold_config,
    load_universe_config,
)
from sector_radar.data.store import create_schema, upsert_series_daily
from sector_radar.pipeline import build_relative_strength_snapshot_from_db

ROOT = Path(__file__).resolve().parents[1]


def test_build_relative_strength_snapshot_from_sqlite_contract_shape():
    conn = sqlite3.connect(":memory:")
    create_schema(conn)
    dates = pd.date_range("2024-01-01", periods=80)
    rows = []
    for i, date in enumerate(dates):
        day = date.strftime("%Y-%m-%d")
        rows.append(("SPY", day, "close", 100.0, "fixture", "fixed"))
        rows.append(("XLK", day, "close", float(100 * (1.001 ** (i * i))), "fixture", "fixed"))
    upsert_series_daily(conn, rows)

    snapshot = build_relative_strength_snapshot_from_db(
        conn,
        universe=load_universe_config(ROOT / "config" / "universe.us_sectors.yaml"),
        thresholds=load_threshold_config(ROOT / "config" / "thresholds.example.yaml"),
        sector_code="XLK",
    )

    assert snapshot["sector_code"] == "XLK"
    assert snapshot["benchmark"] == "SPY"
    assert snapshot["quadrant"] == "leading"
    assert snapshot["modules"]["relative_strength"]["state"] == "strong"
    assert snapshot["modules"]["breadth"]["state"] == "unknown"
    assert snapshot["validation"] == {"status": "unvalidated", "expose_probability": False}
    assert snapshot["data_freshness"]["latest_price_date"] == "2024-03-20"
    assert "source_metrics" in snapshot["rulebook"]
