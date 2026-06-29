import { afterEach, describe, expect, it, vi } from "vitest";

import { loadHistory } from "./api";

describe("API fallback responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns explicit history coverage when the history API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    await expect(loadHistory("180D")).resolves.toMatchObject({
      timeframe: "180D",
      status: "degraded",
      coverage: {
        requested_days: 180,
        available_sector_days: 0,
        effective_days: 0,
        limited_by_data: true,
      },
    });
  });
});
