import { describe, expect, it } from "vitest";

import {
  buildLayerFourValidationReportFromRows,
  type ValidationCloseRow,
  type ValidationMetricRow,
} from "./validationReport";

describe("Layer 4 validation report", () => {
  it("builds pattern diagnostics from sector history and close series", () => {
    const dates = makeDates(100);
    const metrics: ValidationMetricRow[] = dates.flatMap((date, index) => [
      metric("SMH", date, "Emerging Leader", index >= 20 ? "leading" : "improving"),
      metric("XLK", date, "Late Leader", index >= 30 ? "weakening" : "leading"),
    ]);
    const closes: ValidationCloseRow[] = [
      ...closeSeries("SPY", dates, 100, 0.45),
      ...closeSeries("SMH", dates, 100, 0.7),
      ...closeSeries("XLK", dates, 100, 0.25),
    ];

    const report = buildLayerFourValidationReportFromRows(metrics, closes, {
      market_context_days: 80,
      market_context_points: 320,
    });

    expect(report.status).toBe("historical_ready");
    expect(report.expose_probability).toBe(false);
    expect(report.coverage).toMatchObject({
      market_context_days: 80,
      market_context_points: 320,
      sector_history_days: 100,
      sector_snapshots: 200,
    });
    expect(report.replay_windows.find((window) => window.timeframe === "90D")).toMatchObject({
      effective_days: 90,
      status: "ready",
    });
    expect(report.replay_windows.find((window) => window.timeframe === "180D")).toMatchObject({
      effective_days: 100,
      limited_by_data: true,
      status: "limited",
    });
    expect(report.pattern_diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluated_20d: 80,
          evaluated_60d: 40,
          pattern: "Emerging Leader",
          sample_size: 100,
          status: "ready",
        }),
        expect.objectContaining({
          evaluated_20d: 80,
          evaluated_60d: 40,
          pattern: "Late Leader",
          sample_size: 100,
          status: "ready",
        }),
      ]),
    );
    expect(report.scorecard.pattern_hit_rate).toBeNull();
    expect(report.limitations).toEqual([]);
  });

  it("keeps sparse history in collecting status", () => {
    const dates = makeDates(35);
    const metrics = dates.map((date) => metric("SMH", date, "Emerging Leader", "improving"));
    const closes = [
      ...closeSeries("SPY", dates, 100, 0.4),
      ...closeSeries("SMH", dates, 100, 0.6),
    ];

    const report = buildLayerFourValidationReportFromRows(metrics, closes);

    expect(report.status).toBe("insufficient_history");
    expect(report.pattern_diagnostics[0]).toMatchObject({
      evaluated_20d: 15,
      status: "collecting",
    });
    expect(report.replay_windows[0]).toMatchObject({
      timeframe: "30D",
      status: "ready",
    });
    expect(report.replay_windows[1]).toMatchObject({
      timeframe: "90D",
      status: "collecting",
    });
    expect(report.limitations).toEqual(
      expect.arrayContaining(["At least 60 sector history days are required before Layer 4 can show diagnostics."]),
    );
  });
});

function metric(
  sectorCode: string,
  date: string,
  pattern: string,
  quadrant: string,
): ValidationMetricRow {
  return {
    benchmark: "SPY",
    date,
    market: "US",
    rrg_quadrant: quadrant,
    rule_pattern: pattern,
    sector_code: sectorCode,
    strength: 2,
  };
}

function closeSeries(seriesId: string, dates: string[], start: number, dailyChange: number): ValidationCloseRow[] {
  return dates.map((date, index) => ({
    date,
    series_id: seriesId,
    value: Math.round((start + index * dailyChange) * 100) / 100,
  }));
}

function makeDates(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date("2026-01-01T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
