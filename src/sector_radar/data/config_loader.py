from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class SectorConfig:
    symbol: str
    name: str
    group: str
    representative_holdings: tuple[str, ...]


@dataclass(frozen=True)
class UniverseConfig:
    market: str
    benchmark: str
    optional_benchmarks: tuple[str, ...]
    sectors: dict[str, SectorConfig]

    @property
    def sector_symbols(self) -> tuple[str, ...]:
        return tuple(self.sectors)

    @property
    def all_price_symbols(self) -> tuple[str, ...]:
        symbols = [self.benchmark, *self.optional_benchmarks, *self.sector_symbols]
        seen: set[str] = set()
        unique_symbols: list[str] = []
        for symbol in symbols:
            if symbol in seen:
                continue
            seen.add(symbol)
            unique_symbols.append(symbol)
        return tuple(unique_symbols)


@dataclass(frozen=True)
class ThresholdConfig:
    raw: dict[str, Any]

    def section(self, name: str) -> dict[str, Any]:
        value = self.raw.get(name, {})
        if not isinstance(value, dict):
            raise ValueError(f"threshold section '{name}' must be a mapping")
        return value


def load_yaml(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a YAML mapping")
    return data


def load_universe_config(path: str | Path) -> UniverseConfig:
    data = load_yaml(path)
    sectors_data = data.get("sectors")
    if not isinstance(sectors_data, dict) or not sectors_data:
        raise ValueError("universe config requires a non-empty 'sectors' mapping")

    sectors: dict[str, SectorConfig] = {}
    for symbol, values in sectors_data.items():
        if not isinstance(values, dict):
            raise ValueError(f"sector '{symbol}' must be a mapping")
        holdings = values.get("representative_holdings", [])
        if not isinstance(holdings, list) or not all(isinstance(item, str) for item in holdings):
            raise ValueError(f"sector '{symbol}' representative_holdings must be a list of strings")
        sectors[symbol] = SectorConfig(
            symbol=symbol,
            name=_required_str(values, "name", f"sector '{symbol}'"),
            group=_required_str(values, "group", f"sector '{symbol}'"),
            representative_holdings=tuple(holdings),
        )

    optional_benchmarks = data.get("optional_benchmarks", [])
    if optional_benchmarks is None:
        optional_benchmarks = []
    if not isinstance(optional_benchmarks, list) or not all(
        isinstance(item, str) for item in optional_benchmarks
    ):
        raise ValueError("optional_benchmarks must be a list of strings")

    return UniverseConfig(
        market=_required_str(data, "market", "universe"),
        benchmark=_required_str(data, "benchmark", "universe"),
        optional_benchmarks=tuple(optional_benchmarks),
        sectors=sectors,
    )


def load_threshold_config(path: str | Path) -> ThresholdConfig:
    data = load_yaml(path)
    for section in ("relative_strength", "breadth", "participation", "rulebook"):
        if section not in data:
            raise ValueError(f"threshold config requires '{section}'")
    return ThresholdConfig(raw=data)


def _required_str(data: dict[str, Any], key: str, context: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{context} requires string field '{key}'")
    return value
