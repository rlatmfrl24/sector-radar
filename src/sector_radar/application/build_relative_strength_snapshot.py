from __future__ import annotations

import sqlite3
from typing import Any

from sector_radar.data.config_loader import ThresholdConfig, UniverseConfig
from sector_radar.data.store import get_series_freshness, read_series_wide
from sector_radar.domain.models import ModuleState
from sector_radar.metrics.relative_strength import (
    RelativeStrengthConfig,
    build_relative_strength_states,
    compute_relative_strength_frame,
)
from sector_radar.rules.sector_rulebook import evaluate_sector
from sector_radar.snapshot import build_sector_snapshot


def build_relative_strength_snapshot_from_db(
    conn: sqlite3.Connection,
    *,
    universe: UniverseConfig,
    thresholds: ThresholdConfig,
    sector_code: str,
    as_of: str | None = None,
) -> dict[str, Any]:
    if sector_code not in universe.sectors:
        raise ValueError(f"unknown sector_code: {sector_code}")

    benchmark = universe.benchmark
    series = read_series_wide(conn, [sector_code, benchmark], field="close", end_date=as_of)
    if sector_code not in series.columns or benchmark not in series.columns:
        raise ValueError(f"missing close series for {sector_code} or {benchmark}")

    rs_config = RelativeStrengthConfig.from_mapping(thresholds.section("relative_strength"))
    rs_frame = compute_relative_strength_frame(series[sector_code], series[benchmark], rs_config)
    modules = build_relative_strength_states(rs_frame, rs_config)
    modules.setdefault(
        "breadth",
        ModuleState("breadth", "unknown", "unknown", warnings=["not_computed_in_rs_slice"]),
    )
    modules.setdefault(
        "participation",
        ModuleState(
            "participation",
            "unknown",
            "unknown",
            warnings=["not_computed_in_rs_slice"],
        ),
    )

    latest = rs_frame.dropna(subset=["rs_ratio", "rs_momentum"]).tail(1)
    if latest.empty:
        as_of_value = as_of or ""
        quadrant = "unknown"
    else:
        as_of_value = latest.index[-1].strftime("%Y-%m-%d")
        quadrant = str(latest.iloc[-1]["rrg_quadrant"])

    freshness_by_series = get_series_freshness(conn, [sector_code, benchmark])
    latest_price_dates = [date for date in freshness_by_series.values() if date is not None]
    freshness = {
        "latest_price_date": min(latest_price_dates) if latest_price_dates else None,
        "price_dates": freshness_by_series,
    }
    rulebook = evaluate_sector(
        modules,
        sector_name=universe.sectors[sector_code].name,
        data_freshness=freshness,
    )

    return build_sector_snapshot(
        as_of=as_of_value,
        benchmark=benchmark,
        sector_code=sector_code,
        sector_name=universe.sectors[sector_code].name,
        quadrant=quadrant,
        modules=modules,
        rulebook=rulebook,
        data_freshness=freshness,
    )
