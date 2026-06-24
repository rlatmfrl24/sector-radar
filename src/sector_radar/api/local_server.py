from __future__ import annotations

import argparse
import json
import os
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sector_radar.application.read_sector_snapshots import read_latest_sector_response
from sector_radar.application.refresh_data import (
    DEFAULT_PROVIDER,
    get_data_connection,
    refresh_market_data,
)
from sector_radar.data.config_loader import (
    ThresholdConfig,
    UniverseConfig,
    load_threshold_config,
    load_universe_config,
)
from sector_radar.data.providers import PriceProvider
from sector_radar.data.store import connect, create_schema
from sector_radar.infrastructure.yahoo import YahooFinancePriceProvider

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class LocalApiContext:
    db_path: Path
    universe: UniverseConfig
    thresholds: ThresholdConfig
    refresh_interval_minutes: int
    provider_factory: Callable[[], PriceProvider]

    def open_connection(self) -> sqlite3.Connection:
        conn = connect(self.db_path)
        create_schema(conn)
        return conn


def build_context_from_env() -> LocalApiContext:
    db_path = Path(os.environ.get("SECTOR_RADAR_DB_PATH", ROOT / "data" / "sector_radar.db"))
    universe_path = Path(
        os.environ.get("SECTOR_RADAR_UNIVERSE_PATH", ROOT / "config" / "universe.us_sectors.yaml")
    )
    thresholds_path = Path(
        os.environ.get("SECTOR_RADAR_THRESHOLDS_PATH", ROOT / "config" / "thresholds.example.yaml")
    )
    refresh_interval_minutes = int(os.environ.get("SECTOR_RADAR_REFRESH_INTERVAL_MINUTES", "15"))
    return LocalApiContext(
        db_path=db_path,
        universe=load_universe_config(universe_path),
        thresholds=load_threshold_config(thresholds_path),
        refresh_interval_minutes=refresh_interval_minutes,
        provider_factory=YahooFinancePriceProvider,
    )


def create_handler(context: LocalApiContext) -> type[BaseHTTPRequestHandler]:
    class SectorRadarRequestHandler(BaseHTTPRequestHandler):
        def do_OPTIONS(self) -> None:
            self._send_json({}, status_code=204)

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path == "/api/sectors":
                self._handle_get_sectors()
                return
            if path == "/api/data/status":
                self._handle_get_status()
                return
            self._send_json({"error": {"code": "not_found", "message": path}}, status_code=404)

        def do_POST(self) -> None:
            path = urlparse(self.path).path
            if path == "/api/refresh":
                self._handle_post_refresh()
                return
            self._send_json({"error": {"code": "not_found", "message": path}}, status_code=404)

        def log_message(self, format: str, *args: Any) -> None:
            return

        def _handle_get_sectors(self) -> None:
            with context.open_connection() as conn:
                body = read_latest_sector_response(
                    conn,
                    source="local_sqlite",
                    refresh_interval_minutes=context.refresh_interval_minutes,
                )
            self._send_json(body)

        def _handle_get_status(self) -> None:
            with context.open_connection() as conn:
                body = get_data_connection(
                    conn,
                    provider=DEFAULT_PROVIDER,
                    refresh_interval_minutes=context.refresh_interval_minutes,
                ).as_dict()
            self._send_json(body)

        def _handle_post_refresh(self) -> None:
            content_length = int(self.headers.get("content-length", "0") or "0")
            if content_length:
                self.rfile.read(content_length)
            with context.open_connection() as conn:
                result = refresh_market_data(
                    conn,
                    provider=context.provider_factory(),
                    universe=context.universe,
                    thresholds=context.thresholds,
                    refresh_interval_minutes=context.refresh_interval_minutes,
                )
            status_code = 500 if result.status == "failed" else 200
            self._send_json(result.as_dict(), status_code=status_code)

        def _send_json(self, body: Any, status_code: int = 200) -> None:
            encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status_code)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("cache-control", "no-store")
            self.send_header("access-control-allow-origin", "*")
            self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
            self.send_header("access-control-allow-headers", "content-type, accept")
            self.send_header("content-length", str(len(encoded)))
            self.end_headers()
            if status_code != 204:
                self.wfile.write(encoded)

    return SectorRadarRequestHandler


def run_server(context: LocalApiContext, *, host: str, port: int) -> None:
    server = ThreadingHTTPServer((host, port), create_handler(context))
    print(f"Sector Radar local API listening on http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("SECTOR_RADAR_API_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("SECTOR_RADAR_API_PORT", "8787")),
    )
    args = parser.parse_args()
    run_server(build_context_from_env(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
