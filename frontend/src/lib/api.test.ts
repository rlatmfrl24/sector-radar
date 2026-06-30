import { afterEach, describe, expect, it, vi } from "vitest";

import { sourceExampleSectorsResponse } from "../data/sampleSectors";
import { loadHistory, loadValidation, normalizeSectorsResponse } from "./api";
import { normalizeSectorName } from "./sectorNames";

describe("API fallback responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns temporary Layer 4 history coverage when the history API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    await expect(loadHistory("180D")).resolves.toMatchObject({
      timeframe: "180D",
      status: "degraded",
      coverage: {
        requested_days: 180,
        available_sector_days: 126,
        effective_days: 126,
        limited_by_data: true,
      },
    });
  });

  it("returns temporary Layer 4 validation coverage when the validation API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    await expect(loadValidation()).resolves.toMatchObject({
      status: "historical_ready",
      expose_probability: false,
      coverage: {
        sector_history_days: 126,
        sector_snapshots: 1512,
      },
      pattern_diagnostics: expect.arrayContaining([
        expect.objectContaining({ pattern: "Strong Leader", status: "ready" }),
      ]),
      limitations: expect.arrayContaining([
        "Temporary Layer 4 fixture is displayed when validation data is unavailable.",
      ]),
    });
  });

  it("normalizes sector names when an API response only contains ETF symbols", () => {
    const response = {
      ...sourceExampleSectorsResponse,
      sectors: sourceExampleSectorsResponse.sectors.map((sector) => ({
        ...sector,
        sector_name: sector.sector_code,
      })),
    };

    expect(normalizeSectorsResponse(response).sectors.find((sector) => sector.sector_code === "SMH")).toMatchObject({
      sector_name: "Semiconductors",
    });
    expect(normalizeSectorName("XLC", "XLC")).toBe("Communication Services");
    expect(normalizeSectorName("CUSTOM", "Custom Sector")).toBe("Custom Sector");
  });
});
