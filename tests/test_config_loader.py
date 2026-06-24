from pathlib import Path

from sector_radar.data.config_loader import (
    load_threshold_config,
    load_universe_config,
)

ROOT = Path(__file__).resolve().parents[1]


def test_load_universe_config_reads_benchmark_sectors_and_holdings():
    universe = load_universe_config(ROOT / "config" / "universe.us_sectors.yaml")

    assert universe.market == "US"
    assert universe.benchmark == "SPY"
    assert "QQQ" in universe.optional_benchmarks
    assert universe.sectors["SMH"].name == "Semiconductors"
    assert "NVDA" in universe.sectors["SMH"].representative_holdings
    assert "SPY" in universe.all_price_symbols
    assert "XLK" in universe.all_price_symbols


def test_load_threshold_config_exposes_metric_sections():
    thresholds = load_threshold_config(ROOT / "config" / "thresholds.example.yaml")

    rs = thresholds.section("relative_strength")
    breadth = thresholds.section("breadth")
    participation = thresholds.section("participation")

    assert rs["rs_window"] == 50
    assert breadth["ma_windows"] == [20, 50, 200]
    assert participation["rvol_window"] == 20
