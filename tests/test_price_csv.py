import sqlite3

import pytest

from sector_radar.data.price_csv import ingest_price_csv, load_price_csv, price_frame_to_series_rows
from sector_radar.data.store import create_schema


def test_price_csv_loads_supported_columns_and_converts_to_long_rows(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text(
        "\n".join(
            [
                "symbol,date,open,high,low,close,volume",
                "xlk,2024-01-02,99,102,98,101,1000",
                "spy,2024-01-02,98,100,97,99,2000",
            ]
        ),
        encoding="utf-8",
    )

    frame = load_price_csv(
        path,
        default_source="fixture",
        default_fetched_at="2024-01-03T00:00:00Z",
    )
    rows = price_frame_to_series_rows(frame)

    assert frame["symbol"].tolist() == ["XLK", "SPY"]
    assert len(rows) == 10
    assert ("XLK", "2024-01-02", "close", 101.0, "fixture", "2024-01-03T00:00:00Z") in rows


def test_price_csv_missing_optional_fields_only_stores_present_fields(tmp_path):
    path = tmp_path / "close_only.csv"
    path.write_text("symbol,date,close\nXLK,2024-01-02,101\n", encoding="utf-8")

    frame = load_price_csv(path, default_fetched_at="fixed")
    rows = price_frame_to_series_rows(frame)

    assert rows == [("XLK", "2024-01-02", "close", 101.0, "csv", "fixed")]


def test_price_csv_requires_symbol_date_and_close(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("symbol,date\nXLK,2024-01-02\n", encoding="utf-8")

    with pytest.raises(ValueError, match="close"):
        load_price_csv(path)


def test_ingest_price_csv_upserts_rows(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text("symbol,date,close,volume\nXLK,2024-01-02,101,1000\n", encoding="utf-8")
    conn = sqlite3.connect(":memory:")
    create_schema(conn)

    assert ingest_price_csv(conn, path, default_fetched_at="fixed") == 2
    assert ingest_price_csv(conn, path, default_fetched_at="fixed") == 2
    assert conn.execute("SELECT COUNT(*) FROM series_daily").fetchone()[0] == 2
