from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

RefreshStatus = Literal[
    "never_run",
    "success",
    "refreshing",
    "skipped_rate_limited",
    "failed",
]
ConnectionMode = Literal["live", "stale", "sample", "read_only"]


@dataclass(frozen=True)
class DataConnection:
    provider: str
    mode: ConnectionMode
    status: RefreshStatus
    refresh_interval_minutes: int
    manual_refresh_available: bool
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    next_allowed_at: str | None = None
    latest_price_date: str | None = None
    symbol_count: int = 0
    rows_upserted: int = 0
    message: str | None = None

    def as_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "provider": self.provider,
            "mode": self.mode,
            "status": self.status,
            "refresh_interval_minutes": self.refresh_interval_minutes,
            "manual_refresh_available": self.manual_refresh_available,
            "symbol_count": self.symbol_count,
            "rows_upserted": self.rows_upserted,
        }
        for key in (
            "last_attempt_at",
            "last_success_at",
            "next_allowed_at",
            "latest_price_date",
            "message",
        ):
            value = getattr(self, key)
            if value is not None:
                data[key] = value
        return data
