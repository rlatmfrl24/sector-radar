import pandas as pd

from sector_radar.metrics.relative_strength import (
    RelativeStrengthConfig,
    build_relative_strength_states,
    classify_rrg_quadrant,
    compute_relative_strength_frame,
    compute_rs_raw,
)


def test_compute_rs_raw_basic():
    sector = pd.Series([100, 110, 120], index=pd.date_range("2024-01-01", periods=3))
    benchmark = pd.Series([100, 100, 100], index=pd.date_range("2024-01-01", periods=3))
    out = compute_rs_raw(sector, benchmark)
    assert out.iloc[-1] == 1.2


def test_classify_rrg_quadrants():
    assert classify_rrg_quadrant(101, 101) == "leading"
    assert classify_rrg_quadrant(99, 101) == "improving"
    assert classify_rrg_quadrant(101, 99) == "weakening"
    assert classify_rrg_quadrant(99, 99) == "lagging"


def test_relative_strength_frame_and_states_use_config_thresholds():
    index = pd.date_range("2024-01-01", periods=40)
    sector = pd.Series([100 * (1.001 ** (i * i)) for i in range(40)], index=index)
    benchmark = pd.Series([100] * 40, index=index)
    config = RelativeStrengthConfig(
        rs_window=5,
        momentum_window=3,
        strong_threshold=100.5,
        weak_threshold=99.5,
        momentum_strengthening_threshold=100.1,
        momentum_weakening_threshold=99.9,
    )

    frame = compute_relative_strength_frame(sector, benchmark, config)
    states = build_relative_strength_states(frame, config)

    assert frame.iloc[-1]["rrg_quadrant"] == "leading"
    assert states["relative_strength"].state == "strong"
    assert states["relative_strength"].transition == "strengthening"
    assert states["momentum"].state == "improving"
    assert "rs_ratio" in states["relative_strength"].evidence


def test_relative_strength_states_are_unknown_with_insufficient_lookback():
    index = pd.date_range("2024-01-01", periods=5)
    sector = pd.Series([100, 101, 102, 103, 104], index=index)
    benchmark = pd.Series([100, 100, 100, 100, 100], index=index)
    config = RelativeStrengthConfig(
        rs_window=50,
        momentum_window=10,
        strong_threshold=102,
        weak_threshold=98,
        momentum_strengthening_threshold=101,
        momentum_weakening_threshold=99,
    )

    frame = compute_relative_strength_frame(sector, benchmark, config)
    states = build_relative_strength_states(frame, config)

    assert states["relative_strength"].state == "unknown"
    assert states["relative_strength"].transition == "unknown"
    assert states["relative_strength"].warnings == ["insufficient_lookback"]
