import pandas as pd

from sector_radar.metrics.breadth import (
    BreadthConfig,
    classify_breadth,
    classify_breadth_transition,
    pct_above_moving_average,
)
from sector_radar.metrics.participation import (
    ParticipationConfig,
    classify_participation,
    compute_cmf,
    compute_obv,
    compute_obv_slope,
    compute_rvol,
)


def test_breadth_pct_above_ma_state_and_transition():
    index = pd.date_range("2024-01-01", periods=6)
    panel = pd.DataFrame(
        {
            "A": [10, 10, 10, 11, 12, 13],
            "B": [10, 10, 10, 11, 12, 13],
            "C": [10, 10, 10, 9, 8, 7],
            "D": [10, 10, 10, 9, 8, 7],
        },
        index=index,
    )
    config = BreadthConfig(
        ma_windows=(3,),
        broad_strength_pct_50ma=0.70,
        healthy_pct_50ma=0.55,
        narrow_pct_50ma=0.40,
        breakdown_pct_200ma=0.35,
        transition_window=2,
    )

    pct = pct_above_moving_average(panel, window=3)

    assert pct.iloc[-1] == 0.5
    assert classify_breadth(pct.iloc[-1], None, config) == "mixed"
    assert classify_breadth(0.8, 0.2, config) == "breakdown"
    assert classify_breadth_transition(pd.Series([0.25, 0.5, 0.75]), config) == "strengthening"


def test_participation_zero_volume_and_flat_prices_do_not_crash():
    index = pd.date_range("2024-01-01", periods=5)
    close = pd.Series([100, 100, 100, 100, 100], index=index)
    high = pd.Series([100, 100, 100, 100, 100], index=index)
    low = pd.Series([100, 100, 100, 100, 100], index=index)
    volume = pd.Series([0, 0, 0, 0, 0], index=index)
    config = ParticipationConfig(
        rvol_window=3,
        rvol_accumulation=1.2,
        cmf_window=3,
        cmf_positive=0.05,
        obv_slope_window=3,
    )

    rvol = compute_rvol(volume, window=config.rvol_window)
    obv = compute_obv(close, volume)
    slope = compute_obv_slope(obv, window=config.obv_slope_window)
    cmf = compute_cmf(high, low, close, volume, window=config.cmf_window)

    assert classify_participation(rvol.iloc[-1], slope.iloc[-1], cmf.iloc[-1], config) == "unknown"


def test_participation_classification_uses_config_thresholds():
    config = ParticipationConfig(
        rvol_window=20,
        rvol_accumulation=1.2,
        cmf_window=20,
        cmf_positive=0.05,
        obv_slope_window=20,
    )

    assert classify_participation(1.3, 10.0, 0.06, config) == "accumulation"
    assert classify_participation(1.0, 10.0, 0.0, config) == "confirmed"
    assert classify_participation(1.0, -10.0, -0.01, config) == "distribution"
