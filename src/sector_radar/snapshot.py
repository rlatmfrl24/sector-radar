from __future__ import annotations

from typing import Any

from sector_radar.domain.models import ModuleState, RulebookOutput


def build_sector_snapshot(
    *,
    as_of: str,
    benchmark: str,
    sector_code: str,
    sector_name: str,
    quadrant: str,
    modules: dict[str, ModuleState],
    rulebook: RulebookOutput,
    data_freshness: dict[str, Any],
    rank: dict[str, int | None] | None = None,
) -> dict[str, Any]:
    return {
        "as_of": as_of,
        "benchmark": benchmark,
        "sector_code": sector_code,
        "sector_name": sector_name,
        "quadrant": quadrant,
        "rank": rank or {"rs_rank": None, "momentum_rank": None, "breadth_rank": None},
        "modules": {name: state.as_dict() for name, state in modules.items()},
        "rulebook": rulebook.as_dict(),
        "validation": {
            "status": "unvalidated",
            "expose_probability": False,
        },
        "data_freshness": dict(data_freshness),
    }
