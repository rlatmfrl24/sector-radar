from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class BreadthConfig:
    ma_windows: tuple[int, ...]
    broad_strength_pct_50ma: float
    healthy_pct_50ma: float
    narrow_pct_50ma: float
    breakdown_pct_200ma: float
    transition_window: int

    @classmethod
    def from_mapping(cls, values: dict[str, Any]) -> BreadthConfig:
        return cls(
            ma_windows=tuple(int(value) for value in values["ma_windows"]),
            broad_strength_pct_50ma=float(values["broad_strength_pct_50ma"]),
            healthy_pct_50ma=float(values["healthy_pct_50ma"]),
            narrow_pct_50ma=float(values["narrow_pct_50ma"]),
            breakdown_pct_200ma=float(values["breakdown_pct_200ma"]),
            transition_window=int(values["transition_window"]),
        )


def pct_above_moving_average(price_panel: pd.DataFrame, window: int) -> pd.Series:
    """Return percentage of symbols above their moving average for each date.

    price_panel index: date, columns: symbols, values: close prices.
    """
    ma = price_panel.rolling(window=window, min_periods=window).mean()
    above = price_panel > ma
    valid = ma.notna()
    counts = above.where(valid).sum(axis=1)
    totals = valid.sum(axis=1).replace(0, np.nan)
    return (counts / totals).astype("float64")


def classify_breadth(
    pct_above_50ma: float,
    pct_above_200ma: float | None,
    config: BreadthConfig,
) -> str:
    if pd.isna(pct_above_50ma):
        return "unknown"
    if (
        pct_above_200ma is not None
        and not pd.isna(pct_above_200ma)
        and pct_above_200ma < config.breakdown_pct_200ma
    ):
        return "breakdown"
    if pct_above_50ma >= config.broad_strength_pct_50ma:
        return "broad_strength"
    if pct_above_50ma >= config.healthy_pct_50ma:
        return "healthy"
    if pct_above_50ma >= config.narrow_pct_50ma:
        return "mixed"
    return "narrow"


def classify_breadth_transition(pct_above_50ma: pd.Series, config: BreadthConfig) -> str:
    cleaned = pct_above_50ma.dropna()
    if len(cleaned) <= config.transition_window:
        return "unknown"
    delta = cleaned.iloc[-1] - cleaned.iloc[-1 - config.transition_window]
    if delta > 0:
        return "strengthening"
    if delta < 0:
        return "weakening"
    return "stable"
