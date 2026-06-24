from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModuleState:
    module: str
    state: str
    transition: str = "stable"
    strength: int = 0
    evidence: dict[str, float | str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "transition": self.transition,
            "strength": self.strength,
            "evidence": dict(self.evidence),
            "warnings": list(self.warnings),
        }


@dataclass(frozen=True)
class RulebookOutput:
    lead_pattern: str
    direction: str
    strength: int
    conviction_label: str
    narrative: str
    risks: list[str]
    invalidation: list[str]
    source_metrics: dict[str, Any] = field(default_factory=dict)
    data_freshness: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "lead_pattern": self.lead_pattern,
            "direction": self.direction,
            "strength": self.strength,
            "conviction_label": self.conviction_label,
            "narrative": self.narrative,
            "risks": list(self.risks),
            "invalidation": list(self.invalidation),
            "source_metrics": dict(self.source_metrics),
            "data_freshness": dict(self.data_freshness),
        }
