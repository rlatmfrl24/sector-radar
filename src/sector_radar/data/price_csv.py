from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from sector_radar.data.store import SERIES_DAILY_FIELDS, upsert_series_daily, utc_now_iso

REQUIRED_PRICE_COLUMNS = {"symbol", "date", "close"}
OPTIONAL_PRICE_COLUMNS = {"open", "high", "low", "volume", "source", "fetched_at"}


def load_price_csv(
    path: str | Path,
    *,
    default_source: str = "csv",
    default_fetched_at: str | None = None,
) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = REQUIRED_PRICE_COLUMNS - set(frame.columns)
    if missing:
        missing_text = ", ".join(sorted(missing))
        raise ValueError(f"price CSV missing required columns: {missing_text}")

    frame = frame.copy()
    frame["symbol"] = frame["symbol"].astype(str).str.upper()
    frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
    frame["close"] = pd.to_numeric(frame["close"], errors="raise")

    for field in ("open", "high", "low", "volume"):
        if field in frame.columns:
            frame[field] = pd.to_numeric(frame[field], errors="coerce")

    if "source" not in frame.columns:
        frame["source"] = default_source
    else:
        frame["source"] = frame["source"].fillna(default_source).astype(str)

    fetched_at = default_fetched_at or utc_now_iso()
    if "fetched_at" not in frame.columns:
        frame["fetched_at"] = fetched_at
    else:
        frame["fetched_at"] = frame["fetched_at"].fillna(fetched_at).astype(str)

    return frame


def price_frame_to_series_rows(
    frame: pd.DataFrame,
) -> list[tuple[str, str, str, float, str, str]]:
    rows: list[tuple[str, str, str, float, str, str]] = []
    supported_fields = [field for field in SERIES_DAILY_FIELDS if field in frame.columns]

    for record in frame.to_dict(orient="records"):
        for field in supported_fields:
            value = record.get(field)
            if pd.isna(value):
                continue
            rows.append(
                (
                    str(record["symbol"]),
                    str(record["date"]),
                    field,
                    float(value),
                    str(record["source"]),
                    str(record["fetched_at"]),
                )
            )
    return rows


def ingest_price_csv(
    conn: sqlite3.Connection,
    path: str | Path,
    *,
    default_source: str = "csv",
    default_fetched_at: str | None = None,
) -> int:
    frame = load_price_csv(
        path,
        default_source=default_source,
        default_fetched_at=default_fetched_at,
    )
    rows = price_frame_to_series_rows(frame)
    upsert_series_daily(conn, rows)
    return len(rows)
