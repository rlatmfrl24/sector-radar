from __future__ import annotations

import json
import threading
import urllib.request
from pathlib import Path

import pandas as pd

from sector_radar.api.local_server import LocalApiContext, create_handler
from sector_radar.data.config_loader import load_threshold_config, load_universe_config

ROOT = Path(__file__).resolve().parents[1]


class FakePriceProvider:
    name = "yahoo_finance"

    def __init__(self) -> None:
        self.call_count = 0

    def fetch_daily(self, symbols, *, start=None, end=None, period="2y") -> pd.DataFrame:
        self.call_count += 1
        dates = pd.date_range("2024-01-01", periods=80)
        rows = []
        for symbol_index, symbol in enumerate(symbols):
            for day_index, date in enumerate(dates):
                price = 100 + symbol_index + day_index / 10
                rows.append(
                    {
                        "symbol": symbol,
                        "date": date.strftime("%Y-%m-%d"),
                        "open": price,
                        "high": price + 1,
                        "low": price - 1,
                        "close": price,
                        "volume": 1000 + day_index,
                    }
                )
        return pd.DataFrame(rows)


def test_local_api_status_refresh_and_sectors_contract(tmp_path):
    from http.server import ThreadingHTTPServer

    provider = FakePriceProvider()
    context = LocalApiContext(
        db_path=tmp_path / "sector_radar.db",
        universe=load_universe_config(ROOT / "config" / "universe.us_sectors.yaml"),
        thresholds=load_threshold_config(ROOT / "config" / "thresholds.example.yaml"),
        refresh_interval_minutes=15,
        provider_factory=lambda: provider,
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(context))
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        status = _get_json(f"http://127.0.0.1:{port}/api/data/status")
        first_refresh = _post_json(f"http://127.0.0.1:{port}/api/refresh")
        second_refresh = _post_json(f"http://127.0.0.1:{port}/api/refresh")
        sectors = _get_json(f"http://127.0.0.1:{port}/api/sectors")
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert status["status"] == "never_run"
    assert first_refresh["status"] == "success"
    assert second_refresh["status"] == "skipped_rate_limited"
    assert provider.call_count == 1
    assert sectors["source"] == "local_sqlite"
    assert sectors["data_connection"]["provider"] == "yahoo_finance"
    assert sectors["data_connection"]["manual_refresh_available"] is False
    assert sectors["validation"] == {"status": "unvalidated", "expose_probability": False}
    assert sectors["sectors"]


def _get_json(url: str):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def _post_json(url: str):
    request = urllib.request.Request(url, method="POST", data=b"{}")
    request.add_header("content-type", "application/json")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
