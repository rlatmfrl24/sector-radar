from __future__ import annotations

import json
import sqlite3
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sector_radar.application.build_relative_strength_snapshot import (
    build_relative_strength_snapshot_from_db,
)
from sector_radar.data.config_loader import ThresholdConfig, UniverseConfig
from sector_radar.data.price_csv import price_frame_to_series_rows
from sector_radar.data.providers import PriceProvider
from sector_radar.data.store import (
    get_data_refresh_status,
    get_series_freshness,
    upsert_data_refresh_status,
    upsert_sector_metrics_daily,
    upsert_series_daily,
)
from sector_radar.domain.refresh import DataConnection

DEFAULT_PROVIDER = "yahoo_finance"


@dataclass(frozen=True)
class RefreshResult:
    status: str
    data_connection: DataConnection

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "data_connection": self.data_connection.as_dict(),
        }


def build_symbol_universe(universe: UniverseConfig) -> list[str]:
    symbols = {universe.benchmark, *universe.optional_benchmarks, *universe.sectors.keys()}
    for sector in universe.sectors.values():
        symbols.update(sector.representative_holdings)
    return sorted(symbol for symbol in symbols if symbol)


def get_data_connection(
    conn: sqlite3.Connection,
    *,
    provider: str = DEFAULT_PROVIDER,
    refresh_interval_minutes: int = 15,
    mode: str | None = None,
    now: datetime | None = None,
) -> DataConnection:
    now = now or datetime.now(UTC)
    status_row = get_data_refresh_status(conn, provider)
    if status_row is None:
        return DataConnection(
            provider=provider,
            mode="sample" if mode == "sample" else "stale",
            status="never_run",
            refresh_interval_minutes=refresh_interval_minutes,
            manual_refresh_available=True,
            message="Yahoo Finance refresh has not run yet.",
        )

    next_allowed_at = _parse_datetime(status_row.get("next_allowed_at"))
    manual_refresh_available = next_allowed_at is None or next_allowed_at <= now
    status = str(status_row.get("status") or "never_run")
    has_success_data = bool(
        status_row.get("last_success_at") and status_row.get("latest_price_date")
    )
    connection_mode = mode or ("live" if status == "success" or has_success_data else "stale")

    return DataConnection(
        provider=str(status_row.get("provider") or provider),
        mode=connection_mode,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        refresh_interval_minutes=refresh_interval_minutes,
        manual_refresh_available=manual_refresh_available,
        last_attempt_at=status_row.get("last_attempt_at"),
        last_success_at=status_row.get("last_success_at"),
        next_allowed_at=status_row.get("next_allowed_at"),
        latest_price_date=status_row.get("latest_price_date"),
        symbol_count=int(status_row.get("symbol_count") or 0),
        rows_upserted=int(status_row.get("rows_upserted") or 0),
        message=status_row.get("message"),
    )


def refresh_market_data(
    conn: sqlite3.Connection,
    *,
    provider: PriceProvider,
    universe: UniverseConfig,
    thresholds: ThresholdConfig,
    refresh_interval_minutes: int = 15,
    now: datetime | None = None,
) -> RefreshResult:
    now = now or datetime.now(UTC)
    attempted_at = _to_iso(now)
    provider_name = provider.name
    existing = get_data_refresh_status(conn, provider_name)

    next_allowed_at = _parse_datetime(existing.get("next_allowed_at")) if existing else None
    if next_allowed_at is not None and next_allowed_at > now:
        upsert_data_refresh_status(
            conn,
            {
                **(existing or {}),
                "provider": provider_name,
                "status": "skipped_rate_limited",
                "last_attempt_at": attempted_at,
                "message": "Refresh skipped because the 15 minute upstream gate is still active.",
            },
        )
        conn.commit()
        return RefreshResult(
            "skipped_rate_limited",
            get_data_connection(
                conn,
                provider=provider_name,
                refresh_interval_minutes=refresh_interval_minutes,
                now=now,
            ),
        )

    symbols = build_symbol_universe(universe)
    try:
        core_symbols = [universe.benchmark, *universe.sectors.keys()]
        latest_core_date = _latest_core_price_date(conn, core_symbols)
        frame = provider.fetch_daily(
            symbols,
            start=latest_core_date,
            period="2y",
        )
        frame = frame.copy()
        frame["symbol"] = frame["symbol"].astype(str).str.upper()
        frame["date"] = frame["date"].astype(str)
        frame["source"] = "yahoo_finance:yfinance"
        frame["fetched_at"] = attempted_at
        rows = price_frame_to_series_rows(frame)
        upsert_series_daily(conn, rows)

        metric_rows = _build_sector_metric_rows(
            conn,
            universe=universe,
            thresholds=thresholds,
            computed_at=attempted_at,
        )
        upsert_sector_metrics_daily(conn, metric_rows)

        latest_price_date = _latest_core_price_date(conn, core_symbols)
        upsert_data_refresh_status(
            conn,
            {
                "provider": provider_name,
                "status": "success",
                "last_attempt_at": attempted_at,
                "last_success_at": attempted_at,
                "next_allowed_at": _to_iso(now + timedelta(minutes=refresh_interval_minutes)),
                "latest_price_date": latest_price_date,
                "symbol_count": len(symbols),
                "rows_upserted": len(rows),
                "message": "Yahoo Finance research refresh completed.",
            },
        )
        conn.commit()
        return RefreshResult(
            "success",
            get_data_connection(
                conn,
                provider=provider_name,
                refresh_interval_minutes=refresh_interval_minutes,
                now=now,
            ),
        )
    except Exception as exc:
        conn.rollback()
        upsert_data_refresh_status(
            conn,
            {
                "provider": provider_name,
                "status": "failed",
                "last_attempt_at": attempted_at,
                "last_success_at": existing.get("last_success_at") if existing else None,
                "next_allowed_at": _to_iso(now + timedelta(minutes=refresh_interval_minutes)),
                "latest_price_date": existing.get("latest_price_date") if existing else None,
                "symbol_count": int(existing.get("symbol_count") or 0) if existing else 0,
                "rows_upserted": 0,
                "message": str(exc),
            },
        )
        conn.commit()
        return RefreshResult(
            "failed",
            get_data_connection(
                conn,
                provider=provider_name,
                refresh_interval_minutes=refresh_interval_minutes,
                now=now,
            ),
        )


def _build_sector_metric_rows(
    conn: sqlite3.Connection,
    *,
    universe: UniverseConfig,
    thresholds: ThresholdConfig,
    computed_at: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sector_code in universe.sectors:
        snapshot = build_relative_strength_snapshot_from_db(
            conn,
            universe=universe,
            thresholds=thresholds,
            sector_code=sector_code,
        )
        if not snapshot["as_of"]:
            continue
        rows.append(_snapshot_to_metric_row(snapshot, universe.market, computed_at))
    return rows


def _snapshot_to_metric_row(
    snapshot: dict[str, Any],
    market: str,
    computed_at: str,
) -> dict[str, Any]:
    rs = snapshot["modules"]["relative_strength"]
    breadth = snapshot["modules"].get("breadth", {})
    participation = snapshot["modules"].get("participation", {})
    rulebook = snapshot["rulebook"]
    evidence = rs.get("evidence", {})

    return {
        "market": market,
        "sector_code": snapshot["sector_code"],
        "date": snapshot["as_of"],
        "benchmark": snapshot["benchmark"],
        "rs_ratio": evidence.get("rs_ratio"),
        "rs_momentum": evidence.get("rs_momentum"),
        "rrg_quadrant": snapshot["quadrant"],
        "breadth_state": breadth.get("state", "unknown"),
        "breadth_transition": breadth.get("transition", "unknown"),
        "participation_state": participation.get("state", "unknown"),
        "participation_transition": participation.get("transition", "unknown"),
        "rule_pattern": rulebook["lead_pattern"],
        "direction": rulebook["direction"],
        "strength": rulebook["strength"],
        "conviction_label": rulebook["conviction_label"],
        "narrative": rulebook["narrative"],
        "risks_json": json.dumps(rulebook["risks"], ensure_ascii=False),
        "invalidation_json": json.dumps(rulebook["invalidation"], ensure_ascii=False),
        "source_metrics_json": json.dumps(rulebook["source_metrics"], ensure_ascii=False),
        "data_freshness_json": json.dumps(snapshot["data_freshness"], ensure_ascii=False),
        "validation_status": "unvalidated",
        "expose_probability": 0,
        "computed_at": computed_at,
    }


def _latest_core_price_date(conn: sqlite3.Connection, symbols: Sequence[str]) -> str | None:
    freshness = get_series_freshness(conn, symbols)
    dates = [value for value in freshness.values() if value is not None]
    return min(dates) if dates else None


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat(timespec="seconds")
