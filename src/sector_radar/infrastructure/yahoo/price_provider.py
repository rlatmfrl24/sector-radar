from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import pandas as pd


class YahooFinancePriceProvider:
    name = "yahoo_finance"
    source = "yahoo_finance:yfinance"

    def fetch_daily(
        self,
        symbols: Sequence[str],
        *,
        start: str | None = None,
        end: str | None = None,
        period: str = "2y",
    ) -> pd.DataFrame:
        try:
            import yfinance as yf
        except ImportError as exc:  # pragma: no cover - depends on local environment
            raise RuntimeError(
                "yfinance is required for Yahoo Finance refresh. "
                "Install project dependencies with `pip install -e .`."
            ) from exc

        tickers = sorted({symbol.upper() for symbol in symbols if symbol})
        if not tickers:
            return _empty_price_frame()

        download_kwargs: dict[str, Any] = {
            "tickers": tickers,
            "interval": "1d",
            "auto_adjust": False,
            "group_by": "ticker",
            "progress": False,
            "threads": False,
        }
        if start or end:
            if start:
                download_kwargs["start"] = start
            if end:
                download_kwargs["end"] = end
        else:
            download_kwargs["period"] = period

        data = yf.download(**download_kwargs)
        if data.empty:
            return _empty_price_frame()

        frames: list[pd.DataFrame] = []
        for symbol in tickers:
            symbol_frame = _slice_symbol_frame(data, symbol, len(tickers))
            if symbol_frame.empty:
                continue
            symbol_frame = symbol_frame.reset_index()
            date_column = "Date" if "Date" in symbol_frame.columns else symbol_frame.columns[0]
            normalized = pd.DataFrame(
                {
                    "symbol": symbol,
                    "date": pd.to_datetime(symbol_frame[date_column]).dt.strftime("%Y-%m-%d"),
                    "open": pd.to_numeric(symbol_frame.get("Open"), errors="coerce"),
                    "high": pd.to_numeric(symbol_frame.get("High"), errors="coerce"),
                    "low": pd.to_numeric(symbol_frame.get("Low"), errors="coerce"),
                    "close": pd.to_numeric(symbol_frame.get("Close"), errors="coerce"),
                    "volume": pd.to_numeric(symbol_frame.get("Volume"), errors="coerce"),
                }
            )
            normalized = normalized.dropna(subset=["close"])
            if not normalized.empty:
                frames.append(normalized)

        if not frames:
            return _empty_price_frame()
        return pd.concat(frames, ignore_index=True)


def _slice_symbol_frame(data: pd.DataFrame, symbol: str, ticker_count: int) -> pd.DataFrame:
    if ticker_count == 1 and not isinstance(data.columns, pd.MultiIndex):
        return data
    if isinstance(data.columns, pd.MultiIndex) and symbol in data.columns.get_level_values(0):
        return data[symbol]
    return pd.DataFrame()


def _empty_price_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=["symbol", "date", "open", "high", "low", "close", "volume"])
