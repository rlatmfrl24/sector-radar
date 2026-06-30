import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "./sampleSectors";

describe("source example sectors response", () => {
  it("includes active FRED example rows and excludes inactive KRX context rows", () => {
    const providers = new Set(sourceExampleSectorsResponse.source_freshness?.map((item) => item.provider));
    const fredRows = sourceExampleSectorsResponse.source_freshness?.filter((item) => item.provider === "fred") ?? [];
    const krxRows = sourceExampleSectorsResponse.source_freshness?.filter((item) => item.provider === "krx_openapi") ?? [];

    expect(providers.has("fred")).toBe(true);
    expect(fredRows.length).toBeGreaterThan(1);
    expect(krxRows).toEqual([]);
    expect(fredRows.every((item) => item.status === "live")).toBe(true);
    expect((sourceExampleSectorsResponse.market_context ?? []).map((item) => item.code)).toEqual(["S01", "S02", "S03", "S05"]);
  });

  it("exposes source expansion without reactivating deferred KRX as market context", () => {
    const expansion = sourceExampleSectorsResponse.source_expansion ?? [];

    expect(expansion.find((item) => item.id === "l1_holdings_breadth")).toMatchObject({
      layer: "layer1",
      status: "candidate",
    });
    expect(expansion.find((item) => item.id === "l2_treasury_dts")).toMatchObject({
      layer: "layer2",
      status: "candidate",
    });
    expect(expansion.find((item) => item.id === "l2_krx_flow")).toMatchObject({
      layer: "layer2",
      status: "deferred",
    });
  });

  it("keeps the validation contract unvalidated in source-example mode", () => {
    expect(sourceExampleSectorsResponse.validation).toEqual({
      status: "unvalidated",
      expose_probability: false,
    });
  });

  it("provides temporary Layer 4 validation and replay fixture data", () => {
    const history = sourceExampleHistoryResponse("180D");

    expect(sourceExampleValidationResponse).toMatchObject({
      status: "historical_ready",
      expose_probability: true,
      probability_mode: "sample_observed",
      coverage: {
        sector_history_days: 126,
        sector_snapshots: sourceExampleSectorsResponse.sectors.length * 126,
      },
      pattern_diagnostics: expect.arrayContaining([
        expect.objectContaining({
          observed_probability_20d: 67,
          pattern: "Strong Leader",
          reliability_label: "high",
          status: "ready",
        }),
      ]),
      schedule: {
        api: "/api/validation/status",
        cron: "Runs after each sector-radar-ingest scheduled refresh.",
        last_run_at: "2026-06-26T21:10:00+00:00",
        last_run_status: "success",
        run_type: "layer4_validation_audit",
      },
    });
    expect(history.coverage).toEqual({
      requested_days: 180,
      available_sector_days: 126,
      effective_days: 126,
      limited_by_data: true,
    });
    expect(history.sectors).toHaveLength(sourceExampleSectorsResponse.sectors.length);
    expect(history.sectors[0].trail).toHaveLength(126);
  });
});
