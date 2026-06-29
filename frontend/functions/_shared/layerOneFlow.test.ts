import { describe, expect, it } from "vitest";

import { buildLayerOneFlowSnapshot, type LayerOneSectorLike, type LayerOneSeriesRow } from "./layerOneFlow";

describe("Layer 1 flow snapshot", () => {
  it("combines benchmark tape, volatility, and breadth proxies without probability claims", () => {
    const rows = [
      ...closeRows("SPY", 100, 1.0),
      ...closeRows("QQQ", 100, 1.2),
      ...closeRows("RSP", 100, 0.9),
      ...closeRows("IWM", 100, 0.6),
      ...closeRows("^VIX", 18, -0.01),
    ];

    const snapshot = buildLayerOneFlowSnapshot({
      asOf: "2026-06-24",
      rows,
      sectors: [
        sector("SMH", "leading", "healthy"),
        sector("XLK", "leading", "healthy"),
        sector("XLI", "improving", "healthy"),
        sector("XLE", "lagging", "breakdown"),
      ],
    });

    expect(snapshot.state).toBe("constructive");
    expect(JSON.stringify(snapshot)).not.toContain("probability");
    expect(JSON.stringify(snapshot)).not.toContain("expose_probability");
    expect(snapshot.tape.ret_1m).toBeGreaterThan(0);
    expect(snapshot.risk.state).toBe("calm");
    expect(snapshot.breadth_quality.qqq_vs_spy_1m).toBeGreaterThan(0);
    expect(snapshot.data_freshness.series.map((item) => item.series_id)).toContain("RSP");
  });

  it("degrades to data insufficient when benchmark tape is missing", () => {
    const snapshot = buildLayerOneFlowSnapshot({
      asOf: "2026-06-24",
      rows: closeRows("^VIX", 25, 0),
      sectors: [],
    });

    expect(snapshot.state).toBe("data_insufficient");
    expect(snapshot.transition).toBe("unknown");
    expect(snapshot.warnings).toContain("benchmark_tape_unavailable");
  });

  it("uses external Layer 1 threshold config instead of embedded metric constants", () => {
    const snapshot = buildLayerOneFlowSnapshot({
      asOf: "2026-06-24",
      rows: [
        ...closeRows("SPY", 100, 0.5),
        ...closeRows("^VIX", 18, 0),
      ],
      sectors: [
        sector("SMH", "leading", "healthy"),
        sector("XLE", "lagging", "breakdown"),
      ],
      thresholds: {
        elevatedVix: 10,
        healthyBreadthRatio: 0.9,
      },
    });

    expect(snapshot.risk.state).toBe("elevated");
    expect(snapshot.state).toBe("caution");
  });
});

function closeRows(symbol: string, start: number, drift: number): LayerOneSeriesRow[] {
  const rows: LayerOneSeriesRow[] = [];
  const base = Date.UTC(2025, 8, 30);
  for (let index = 0; index < 260; index += 1) {
    rows.push({
      date: new Date(base + index * 86_400_000).toISOString().slice(0, 10),
      fetched_at: "2026-06-24T22:00:00+00:00",
      field: "close",
      series_id: symbol,
      source: "fixture",
      value: start + drift * index,
    });
  }
  return rows;
}

function sector(code: string, quadrant: string, breadthState: string): LayerOneSectorLike {
  return {
    data_freshness: {
      holding_coverage: {
        fresh: 30,
        total: 40,
      },
    },
    modules: {
      breadth: {
        state: breadthState,
        transition: "stable",
        warnings: [],
      },
      relative_strength: {
        evidence: {
          rs_ratio: quadrant === "leading" ? 104 : 98,
        },
      },
    },
    quadrant,
    sector_code: code,
  };
}
