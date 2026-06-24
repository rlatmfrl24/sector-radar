from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from sector_radar.domain.models import ModuleState


@dataclass(frozen=True)
class RelativeStrengthConfig:
    rs_window: int
    momentum_window: int
    strong_threshold: float
    weak_threshold: float
    momentum_strengthening_threshold: float
    momentum_weakening_threshold: float

    @classmethod
    def from_mapping(cls, values: dict[str, Any]) -> RelativeStrengthConfig:
        return cls(
            rs_window=int(values["rs_window"]),
            momentum_window=int(values["momentum_window"]),
            strong_threshold=float(values["strong_threshold"]),
            weak_threshold=float(values["weak_threshold"]),
            momentum_strengthening_threshold=float(values["momentum_strengthening_threshold"]),
            momentum_weakening_threshold=float(values["momentum_weakening_threshold"]),
        )


def compute_rs_raw(sector_close: pd.Series, benchmark_close: pd.Series) -> pd.Series:
    """Compute raw relative strength as sector close divided by benchmark close."""
    aligned = pd.concat([sector_close, benchmark_close], axis=1).dropna()
    if aligned.empty:
        return pd.Series(dtype="float64")
    sector = aligned.iloc[:, 0]
    benchmark = aligned.iloc[:, 1].replace(0, np.nan)
    return (sector / benchmark).astype("float64")


def compute_rs_ratio(rs_raw: pd.Series, window: int) -> pd.Series:
    """Normalize raw RS around 100 using a moving average."""
    ma = rs_raw.rolling(window=window, min_periods=window).mean().replace(0, np.nan)
    return (100.0 * rs_raw / ma).astype("float64")


def compute_rs_momentum(rs_ratio: pd.Series, window: int) -> pd.Series:
    """Compute RS momentum around 100 using a moving average of RS ratio."""
    ma = rs_ratio.rolling(window=window, min_periods=window).mean().replace(0, np.nan)
    return (100.0 * rs_ratio / ma).astype("float64")


def classify_rrg_quadrant(rs_ratio: float, rs_momentum: float) -> str:
    if pd.isna(rs_ratio) or pd.isna(rs_momentum):
        return "unknown"
    if rs_ratio >= 100 and rs_momentum >= 100:
        return "leading"
    if rs_ratio < 100 and rs_momentum >= 100:
        return "improving"
    if rs_ratio >= 100 and rs_momentum < 100:
        return "weakening"
    return "lagging"


def compute_relative_strength_frame(
    sector_close: pd.Series,
    benchmark_close: pd.Series,
    config: RelativeStrengthConfig,
) -> pd.DataFrame:
    rs_raw = compute_rs_raw(sector_close, benchmark_close)
    rs_ratio = compute_rs_ratio(rs_raw, window=config.rs_window)
    rs_momentum = compute_rs_momentum(rs_ratio, window=config.momentum_window)
    frame = pd.DataFrame(
        {
            "rs_raw": rs_raw,
            "rs_ratio": rs_ratio,
            "rs_momentum": rs_momentum,
        }
    )
    frame["rrg_quadrant"] = [
        classify_rrg_quadrant(ratio, momentum)
        for ratio, momentum in zip(frame["rs_ratio"], frame["rs_momentum"], strict=False)
    ]
    return frame


def classify_relative_strength_state(
    rs_ratio: float,
    config: RelativeStrengthConfig,
) -> str:
    if pd.isna(rs_ratio):
        return "unknown"
    if rs_ratio >= config.strong_threshold:
        return "strong"
    if rs_ratio < config.weak_threshold:
        return "weak"
    return "average"


def classify_relative_strength_transition(
    rs_momentum: float,
    config: RelativeStrengthConfig,
) -> str:
    if pd.isna(rs_momentum):
        return "unknown"
    if rs_momentum >= config.momentum_strengthening_threshold:
        return "strengthening"
    if rs_momentum < config.momentum_weakening_threshold:
        return "weakening"
    return "stable"


def build_relative_strength_states(
    frame: pd.DataFrame,
    config: RelativeStrengthConfig,
) -> dict[str, ModuleState]:
    if frame.empty:
        return {
            "relative_strength": ModuleState(
                "relative_strength",
                "unknown",
                "unknown",
                warnings=["insufficient_lookback"],
            ),
            "momentum": ModuleState(
                "momentum",
                "unknown",
                "unknown",
                warnings=["insufficient_lookback"],
            ),
        }

    latest = frame.dropna(subset=["rs_ratio", "rs_momentum"]).tail(1)
    if latest.empty:
        warnings = ["insufficient_lookback"]
        return {
            "relative_strength": ModuleState(
                "relative_strength",
                "unknown",
                "unknown",
                evidence={},
                warnings=warnings,
            ),
            "momentum": ModuleState(
                "momentum",
                "unknown",
                "unknown",
                evidence={},
                warnings=warnings,
            ),
        }

    row = latest.iloc[0]
    rs_ratio = float(row["rs_ratio"])
    rs_momentum = float(row["rs_momentum"])
    quadrant = str(row["rrg_quadrant"])
    rs_state = classify_relative_strength_state(rs_ratio, config)
    transition = classify_relative_strength_transition(rs_momentum, config)
    evidence: dict[str, float | str] = {
        "rs_ratio": rs_ratio,
        "rs_momentum": rs_momentum,
        "rrg_quadrant": quadrant,
    }

    return {
        "relative_strength": ModuleState(
            "relative_strength",
            rs_state,
            transition,
            strength=_rs_strength(rs_state),
            evidence=evidence,
        ),
        "momentum": ModuleState(
            "momentum",
            _momentum_state(transition),
            transition,
            strength=_momentum_strength(transition),
            evidence=evidence,
        ),
    }


def _rs_strength(state: str) -> int:
    return {"strong": 3, "average": 2, "weak": 1}.get(state, 0)


def _momentum_state(transition: str) -> str:
    return {
        "strengthening": "improving",
        "stable": "flat",
        "weakening": "decelerating",
    }.get(transition, "unknown")


def _momentum_strength(transition: str) -> int:
    return {"strengthening": 3, "stable": 2, "weakening": 1}.get(transition, 0)
