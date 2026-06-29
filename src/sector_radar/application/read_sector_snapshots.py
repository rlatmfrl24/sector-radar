from __future__ import annotations

import json
import sqlite3
from typing import Any

from sector_radar.application.refresh_data import DEFAULT_PROVIDER, get_data_connection

SECTOR_NAMES = {
    "SMH": "Semiconductors",
    "XLB": "Materials",
    "XLC": "Communication Services",
    "XLE": "Energy",
    "XLF": "Financials",
    "XLI": "Industrials",
    "XLK": "Technology",
    "XLP": "Consumer Staples",
    "XLRE": "Real Estate",
    "XLU": "Utilities",
    "XLV": "Health Care",
    "XLY": "Consumer Discretionary",
}


def read_latest_sector_response(
    conn: sqlite3.Connection,
    *,
    source: str = "local_sqlite",
    refresh_interval_minutes: int = 15,
) -> dict[str, Any]:
    latest = conn.execute("SELECT MAX(date) AS as_of FROM sector_metrics_daily").fetchone()[0]
    data_connection = get_data_connection(
        conn,
        provider=DEFAULT_PROVIDER,
        refresh_interval_minutes=refresh_interval_minutes,
        mode="read_only" if source == "d1" else None,
    ).as_dict()

    if latest is None:
        return {
            "as_of": None,
            "benchmark": "SPY",
            "sectors": [],
            "validation": {"status": "unvalidated", "expose_probability": False},
            "source": source,
            "data_connection": data_connection,
        }

    rows = conn.execute(
        """
        SELECT *
        FROM sector_metrics_daily
        WHERE date = ?
        ORDER BY
          CASE rrg_quadrant
            WHEN 'leading' THEN 1
            WHEN 'improving' THEN 2
            WHEN 'weakening' THEN 3
            WHEN 'lagging' THEN 4
            ELSE 5
          END,
          rs_ratio DESC
        """,
        (latest,),
    ).fetchall()
    columns = [
        description[0]
        for description in conn.execute("SELECT * FROM sector_metrics_daily LIMIT 0").description
    ]
    sector_names = _read_sector_names(conn)
    sectors = [_to_sector_snapshot(dict(zip(columns, row, strict=False)), sector_names) for row in rows]

    return {
        "as_of": latest,
        "benchmark": sectors[0]["benchmark"] if sectors else "SPY",
        "sectors": sectors,
        "validation": {"status": "unvalidated", "expose_probability": False},
        "source": source,
        "data_connection": data_connection,
    }


def _to_sector_snapshot(row: dict[str, Any], sector_names: dict[str, str] | None = None) -> dict[str, Any]:
    source_metrics = _parse_json(row.get("source_metrics_json"), {})
    data_freshness = _parse_json(
        row.get("data_freshness_json"),
        {"latest_price_date": row["date"], "computed_at": row["computed_at"]},
    )

    return {
        "as_of": row["date"],
        "benchmark": row["benchmark"],
        "sector_code": row["sector_code"],
        "sector_name": _sector_name(str(row["sector_code"]), sector_names or {}),
        "quadrant": row.get("rrg_quadrant") or "unknown",
        "modules": {
            "relative_strength": {
                "state": _classify_rs(row.get("rs_ratio")),
                "transition": _classify_momentum(row.get("rs_momentum")),
                "strength": 0
                if row.get("rs_ratio") is None
                else min(4, max(1, round(float(row["rs_ratio"]) / 34))),
                "evidence": {
                    "rs_ratio": row.get("rs_ratio"),
                    "rs_momentum": row.get("rs_momentum"),
                },
                "warnings": [],
            },
            "breadth": {
                "state": row.get("breadth_state") or "unknown",
                "transition": row.get("breadth_transition") or "unknown",
                "strength": 2 if row.get("breadth_state") else 0,
                "evidence": _object_value(source_metrics.get("breadth")),
                "warnings": [] if row.get("breadth_state") else ["not_available"],
            },
            "participation": {
                "state": row.get("participation_state") or "unknown",
                "transition": row.get("participation_transition") or "unknown",
                "strength": 2 if row.get("participation_state") else 0,
                "evidence": _object_value(source_metrics.get("participation")),
                "warnings": [] if row.get("participation_state") else ["not_available"],
            },
        },
        "rulebook": {
            "lead_pattern": row.get("rule_pattern") or "Neutral",
            "direction": row.get("direction") or "neutral",
            "strength": row.get("strength") or 0,
            "conviction_label": row.get("conviction_label") or "low",
            "narrative": row.get("narrative") or "아직 계산된 Rulebook narrative가 없습니다.",
            "risks": _parse_json(row.get("risks_json"), []),
            "invalidation": _parse_json(row.get("invalidation_json"), []),
            "source_metrics": source_metrics,
            "data_freshness": data_freshness,
        },
        "validation": {
            "status": row.get("validation_status") or "unvalidated",
            "expose_probability": row.get("expose_probability") == 1,
        },
        "data_freshness": data_freshness,
    }


def _read_sector_names(conn: sqlite3.Connection) -> dict[str, str]:
    try:
        rows = conn.execute(
            """
            SELECT symbol, name
            FROM instrument_master
            WHERE is_active = 1
              AND sector_code = symbol
            """
        ).fetchall()
    except sqlite3.OperationalError:
        return {}
    return {
        str(symbol).upper(): str(name)
        for symbol, name in rows
        if symbol and name and str(name).upper() != str(symbol).upper()
    }


def _sector_name(sector_code: str, sector_names: dict[str, str]) -> str:
    normalized = sector_code.upper()
    return sector_names.get(normalized) or SECTOR_NAMES.get(normalized) or sector_code


def _classify_rs(value: Any) -> str:
    if value is None:
        return "unknown"
    numeric = float(value)
    if numeric >= 102:
        return "strong"
    if numeric < 98:
        return "weak"
    return "average"


def _classify_momentum(value: Any) -> str:
    if value is None:
        return "unknown"
    numeric = float(value)
    if numeric >= 101:
        return "strengthening"
    if numeric < 99:
        return "weakening"
    return "stable"


def _parse_json(value: Any, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(str(value))
    except json.JSONDecodeError:
        return fallback


def _object_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}
