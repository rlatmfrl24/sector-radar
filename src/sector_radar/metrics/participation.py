from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ParticipationConfig:
    rvol_window: int
    rvol_accumulation: float
    cmf_window: int
    cmf_positive: float
    obv_slope_window: int

    @classmethod
    def from_mapping(cls, values: dict[str, Any]) -> ParticipationConfig:
        return cls(
            rvol_window=int(values["rvol_window"]),
            rvol_accumulation=float(values["rvol_accumulation"]),
            cmf_window=int(values["cmf_window"]),
            cmf_positive=float(values["cmf_positive"]),
            obv_slope_window=int(values["obv_slope_window"]),
        )


def compute_rvol(volume: pd.Series, window: int) -> pd.Series:
    avg = volume.rolling(window=window, min_periods=window).mean().replace(0, np.nan)
    return (volume / avg).astype("float64")


def compute_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff()).fillna(0)
    return (direction * volume.fillna(0)).cumsum().astype("float64")


def compute_obv_slope(obv: pd.Series, window: int) -> pd.Series:
    return obv.diff(window) / float(window)


def compute_cmf(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
    window: int,
) -> pd.Series:
    price_range = (high - low).replace(0, np.nan)
    multiplier = ((close - low) - (high - close)) / price_range
    mfv = multiplier.fillna(0) * volume.fillna(0)
    vol_sum = volume.rolling(window=window, min_periods=window).sum().replace(0, np.nan)
    return (mfv.rolling(window=window, min_periods=window).sum() / vol_sum).astype("float64")


def classify_participation(
    rvol: float,
    obv_slope: float,
    cmf: float,
    config: ParticipationConfig,
) -> str:
    if pd.isna(rvol) or pd.isna(obv_slope) or pd.isna(cmf):
        return "unknown"
    if rvol >= config.rvol_accumulation and obv_slope > 0 and cmf > config.cmf_positive:
        return "accumulation"
    if obv_slope > 0 and cmf >= 0:
        return "confirmed"
    if obv_slope < 0 and cmf < 0:
        return "distribution"
    if obv_slope <= 0 or cmf < 0:
        return "diverging"
    return "neutral"
