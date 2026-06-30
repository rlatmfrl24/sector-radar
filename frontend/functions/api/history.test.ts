import { describe, expect, it } from "vitest";

import { boundedLimit, buildHistoryCoverage } from "./history";

describe("history API coverage", () => {
  it("maps timeframe to requested days", () => {
    expect(buildHistoryCoverage("30D", 120)).toMatchObject({
      requested_days: 30,
      effective_days: 30,
      limited_by_data: false,
    });
    expect(buildHistoryCoverage("90D", 120)).toMatchObject({
      requested_days: 90,
      effective_days: 90,
      limited_by_data: false,
    });
    expect(buildHistoryCoverage("180D", 120)).toMatchObject({
      requested_days: 180,
      effective_days: 120,
      limited_by_data: true,
    });
  });

  it("marks sparse history as limited by available data", () => {
    expect(buildHistoryCoverage("90D", 7)).toEqual({
      requested_days: 90,
      available_sector_days: 7,
      effective_days: 7,
      limited_by_data: true,
    });
  });

  it("degrades empty or invalid coverage to zero available days", () => {
    expect(buildHistoryCoverage("30D", null)).toEqual({
      requested_days: 30,
      available_sector_days: 0,
      effective_days: 0,
      limited_by_data: true,
    });
  });

  it("uses the selected timeframe as default limit when limit is omitted", () => {
    expect(boundedLimit(null, "30D")).toBe(30);
    expect(boundedLimit(null, "90D")).toBe(90);
    expect(boundedLimit(null, "180D")).toBe(180);
    expect(boundedLimit("", "180D")).toBe(180);
  });

  it("keeps explicit history limit within the supported range", () => {
    expect(boundedLimit("7", "180D")).toBe(20);
    expect(boundedLimit("240", "180D")).toBe(180);
    expect(boundedLimit("45", "180D")).toBe(45);
  });
});
