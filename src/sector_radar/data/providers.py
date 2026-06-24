from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

import pandas as pd


class PriceProvider(Protocol):
    name: str

    def fetch_daily(
        self,
        symbols: Sequence[str],
        *,
        start: str | None = None,
        end: str | None = None,
        period: str = "2y",
    ) -> pd.DataFrame:
        """Return daily OHLCV rows with symbol, date, open, high, low, close, volume."""
