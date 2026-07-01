import { describe, expect, it } from "vitest";

import { buildLeadershipReconciliation, buildSectorsDataQuality } from "./dataQuality";

describe("dashboard data quality derivation", () => {
  it("marks missing Layer 1 helper series without blocking sector snapshots", () => {
    const sectors = [sector("SMH", 105, 103, 85), sector("XLV", 99, 106, 68)];
    const quality = buildSectorsDataQuality({
      asOf: "2026-06-26",
      layer1Flow: {
        as_of: "2026-06-26",
        data_freshness: {
          series: [{ series_id: "SPY", latest_date: "2026-06-26" }],
        },
        warnings: ["supplemental_inputs_not_official_breadth"],
      },
      marketContext: [],
      sectors,
      sourceFreshness: [],
    });

    expect(quality.layers.layer1.status).toBe("partial");
    expect(quality.layers.layer1.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "layer1_helper_missing",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "layer1_proxy_breadth",
          severity: "info",
        }),
      ]),
    );
    expect(quality.layers.layer2.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "official_context_incomplete" })]),
    );
  });

  it("separates current RS leader from momentum leader as transition watch", () => {
    const reconciliation = buildLeadershipReconciliation([
      sector("SMH", 106, 102, 85),
      sector("XLV", 99, 107, 60),
    ]);

    expect(reconciliation).toMatchObject({
      current_leader: expect.objectContaining({ sector_code: "SMH" }),
      momentum_leader: expect.objectContaining({ sector_code: "XLV" }),
      status: "transition_watch",
      warnings: ["current_leader_momentum_leader_split"],
    });
  });
});

function sector(sectorCode: string, rsRatio: number, rsMomentum: number, strength: number) {
  return {
    as_of: "2026-06-26",
    modules: {
      breadth: { warnings: [] },
      participation: { warnings: [] },
      relative_strength: {
        evidence: {
          rs_momentum: rsMomentum,
          rs_ratio: rsRatio,
        },
        warnings: [],
      },
    },
    quadrant: rsRatio >= 100 && rsMomentum >= 100 ? "leading" : "improving",
    rulebook: {
      lead_pattern: strength >= 80 ? "Strong Leader" : "Emerging Leader",
      strength,
    },
    sector_code: sectorCode,
  };
}
