from __future__ import annotations

import argparse
import sqlite3
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from sector_radar.infrastructure.sqlite.schema import (
    DATA_REFRESH_STATUS_COLUMNS,
    DDL_STATEMENTS,
    INSTRUMENT_MASTER_COLUMNS,
    SECTOR_METRICS_COLUMNS,
    SERIES_DAILY_FIELDS,
)

__all__ = [
    "DATA_REFRESH_STATUS_COLUMNS",
    "DDL_STATEMENTS",
    "INSTRUMENT_MASTER_COLUMNS",
    "SECTOR_METRICS_COLUMNS",
    "SERIES_DAILY_FIELDS",
    "connect",
    "create_schema",
    "get_data_refresh_status",
    "get_latest_date",
    "get_series_freshness",
    "init_db",
    "read_series_daily",
    "read_series_lookback",
    "read_series_wide",
    "upsert_instrument_master",
    "upsert_data_refresh_status",
    "upsert_sector_metrics_daily",
    "upsert_series_daily",
    "utc_now_iso",
]


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path)
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    for statement in DDL_STATEMENTS:
        conn.execute(statement)
    conn.commit()


def init_db(db_path: str | Path) -> None:
    with connect(db_path) as conn:
        create_schema(conn)


def upsert_series_daily(
    conn: sqlite3.Connection,
    rows: Iterable[tuple[str, str, str, float, str, str]],
) -> None:
    rows = list(rows)
    if not rows:
        return
    conn.executemany(
        """
        INSERT INTO series_daily(series_id, date, field, value, source, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(series_id, date, field)
        DO UPDATE SET
            value = excluded.value,
            source = excluded.source,
            fetched_at = excluded.fetched_at
        """,
        rows,
    )


def upsert_instrument_master(
    conn: sqlite3.Connection,
    rows: Iterable[Mapping[str, Any]],
) -> None:
    normalized_rows = [_row_values(row, INSTRUMENT_MASTER_COLUMNS) for row in rows]
    if not normalized_rows:
        return

    conn.executemany(
        """
        INSERT INTO instrument_master(
            instrument_id, symbol, name, asset_type, market, sector_code, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instrument_id)
        DO UPDATE SET
            symbol = excluded.symbol,
            name = excluded.name,
            asset_type = excluded.asset_type,
            market = excluded.market,
            sector_code = excluded.sector_code,
            is_active = excluded.is_active
        """,
        normalized_rows,
    )


def upsert_sector_metrics_daily(
    conn: sqlite3.Connection,
    rows: Iterable[Mapping[str, Any]],
) -> None:
    normalized_rows = []
    for row in rows:
        prepared = dict(row)
        prepared.setdefault("validation_status", "unvalidated")
        prepared.setdefault("expose_probability", 0)
        prepared.setdefault("computed_at", utc_now_iso())
        normalized_rows.append(_row_values(prepared, SECTOR_METRICS_COLUMNS))
    if not normalized_rows:
        return

    columns_sql = ", ".join(SECTOR_METRICS_COLUMNS)
    placeholders = ", ".join("?" for _ in SECTOR_METRICS_COLUMNS)
    update_columns = [
        column
        for column in SECTOR_METRICS_COLUMNS
        if column not in {"market", "sector_code", "date", "benchmark"}
    ]
    updates_sql = ", ".join(f"{column} = excluded.{column}" for column in update_columns)
    conn.executemany(
        f"""
        INSERT INTO sector_metrics_daily({columns_sql})
        VALUES ({placeholders})
        ON CONFLICT(market, sector_code, date, benchmark)
        DO UPDATE SET {updates_sql}
        """,
        normalized_rows,
    )


def upsert_data_refresh_status(
    conn: sqlite3.Connection,
    row: Mapping[str, Any],
) -> None:
    prepared = dict(row)
    prepared.setdefault("symbol_count", 0)
    prepared.setdefault("rows_upserted", 0)
    values = _row_values(prepared, DATA_REFRESH_STATUS_COLUMNS)
    update_columns = [column for column in DATA_REFRESH_STATUS_COLUMNS if column != "provider"]
    updates_sql = ", ".join(f"{column} = excluded.{column}" for column in update_columns)
    conn.execute(
        f"""
        INSERT INTO data_refresh_status({", ".join(DATA_REFRESH_STATUS_COLUMNS)})
        VALUES ({", ".join("?" for _ in DATA_REFRESH_STATUS_COLUMNS)})
        ON CONFLICT(provider)
        DO UPDATE SET {updates_sql}
        """,
        values,
    )


def get_data_refresh_status(
    conn: sqlite3.Connection,
    provider: str = "yahoo_finance",
) -> dict[str, Any] | None:
    cur = conn.execute(
        f"""
        SELECT {", ".join(DATA_REFRESH_STATUS_COLUMNS)}
        FROM data_refresh_status
        WHERE provider = ?
        """,
        (provider,),
    )
    row = cur.fetchone()
    if row is None:
        return None
    return dict(zip(DATA_REFRESH_STATUS_COLUMNS, row, strict=False))


def get_latest_date(conn: sqlite3.Connection, series_id: str, field: str = "close") -> str | None:
    cur = conn.execute(
        """
        SELECT MAX(date)
        FROM series_daily
        WHERE series_id = ? AND field = ?
        """,
        (series_id, field),
    )
    value = cur.fetchone()[0]
    return value if value is not None else None


def get_series_freshness(
    conn: sqlite3.Connection,
    series_ids: Sequence[str],
    field: str = "close",
) -> dict[str, str | None]:
    return {series_id: get_latest_date(conn, series_id, field) for series_id in series_ids}


def read_series_daily(
    conn: sqlite3.Connection,
    series_ids: Sequence[str],
    fields: Sequence[str] = ("close",),
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    if not series_ids or not fields:
        return _empty_series_frame()

    clauses = [
        f"series_id IN ({_placeholders(series_ids)})",
        f"field IN ({_placeholders(fields)})",
    ]
    params: list[Any] = [*series_ids, *fields]
    if start_date is not None:
        clauses.append("date >= ?")
        params.append(start_date)
    if end_date is not None:
        clauses.append("date <= ?")
        params.append(end_date)

    query = f"""
        SELECT series_id, date, field, value, source, fetched_at
        FROM series_daily
        WHERE {" AND ".join(clauses)}
        ORDER BY series_id, field, date
    """
    frame = pd.read_sql_query(query, conn, params=params)
    if frame.empty:
        return _empty_series_frame()
    frame["date"] = pd.to_datetime(frame["date"])
    return frame


def read_series_lookback(
    conn: sqlite3.Connection,
    series_id: str,
    field: str = "close",
    lookback: int = 252,
    end_date: str | None = None,
) -> pd.DataFrame:
    params: list[Any] = [series_id, field]
    end_clause = ""
    if end_date is not None:
        end_clause = "AND date <= ?"
        params.append(end_date)

    query = f"""
        SELECT series_id, date, field, value, source, fetched_at
        FROM series_daily
        WHERE series_id = ? AND field = ? {end_clause}
        ORDER BY date DESC
        LIMIT ?
    """
    params.append(lookback)
    frame = pd.read_sql_query(query, conn, params=params)
    if frame.empty:
        return _empty_series_frame()
    frame = frame.sort_values(["series_id", "field", "date"]).reset_index(drop=True)
    frame["date"] = pd.to_datetime(frame["date"])
    return frame


def read_series_wide(
    conn: sqlite3.Connection,
    series_ids: Sequence[str],
    field: str = "close",
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    long_frame = read_series_daily(conn, series_ids, (field,), start_date, end_date)
    if long_frame.empty:
        return pd.DataFrame()
    return long_frame.pivot(index="date", columns="series_id", values="value").sort_index()


def _row_values(row: Mapping[str, Any], columns: Sequence[str]) -> tuple[Any, ...]:
    return tuple(row.get(column) for column in columns)


def _placeholders(values: Sequence[Any]) -> str:
    return ", ".join("?" for _ in values)


def _empty_series_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=["series_id", "date", "field", "value", "source", "fetched_at"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--init-db", type=str, required=True)
    args = parser.parse_args()
    init_db(args.init_db)
    print(f"initialized {args.init_db}")


if __name__ == "__main__":
    main()
