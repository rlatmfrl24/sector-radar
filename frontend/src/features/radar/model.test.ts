import { describe, expect, it } from "vitest";

import type { SectorSnapshot } from "../../types";
import { sortSectorsByMomentum } from "./model";

function sector({
  code,
  momentum,
  ratio = 100,
  strength = 50,
}: {
  code: string;
  momentum: number;
  ratio?: number;
  strength?: number;
}): SectorSnapshot {
  return {
    as_of: "2026-06-26",
    benchmark: "SPY",
    sector_code: code,
    sector_name: code,
    quadrant: momentum >= 100 && ratio >= 100 ? "leading" : "lagging",
    modules: {
      relative_strength: {
        state: "test",
        transition: "test",
        strength: 0,
        evidence: {
          rs_momentum: momentum,
          rs_ratio: ratio,
        },
        warnings: [],
      },
      breadth: { state: "test", transition: "test", strength: 0, evidence: {}, warnings: [] },
      participation: { state: "test", transition: "test", strength: 0, evidence: {}, warnings: [] },
    },
    rulebook: {
      lead_pattern: "Neutral",
      direction: "neutral",
      strength,
      conviction_label: "low",
      narrative: "",
      risks: [],
      invalidation: [],
      source_metrics: {},
      data_freshness: {},
    },
    validation: {
      status: "unvalidated",
      expose_probability: false,
    },
    data_freshness: {},
  };
}

describe("sector ranking helpers", () => {
  it("sorts momentum view by RS Momentum before rulebook strength", () => {
    const sorted = sortSectorsByMomentum([
      sector({ code: "HIGH_RULEBOOK", momentum: 98, strength: 90 }),
      sector({ code: "BEST_MOMENTUM", momentum: 106, strength: 40 }),
      sector({ code: "MID_MOMENTUM", momentum: 102, strength: 60 }),
    ]);

    expect(sorted.map((item) => item.sector_code)).toEqual([
      "BEST_MOMENTUM",
      "MID_MOMENTUM",
      "HIGH_RULEBOOK",
    ]);
  });

  it("uses RS Ratio as a tiebreaker for equal momentum", () => {
    const sorted = sortSectorsByMomentum([
      sector({ code: "LOWER_RS", momentum: 103, ratio: 101 }),
      sector({ code: "HIGHER_RS", momentum: 103, ratio: 105 }),
    ]);

    expect(sorted.map((item) => item.sector_code)).toEqual(["HIGHER_RS", "LOWER_RS"]);
  });
});
