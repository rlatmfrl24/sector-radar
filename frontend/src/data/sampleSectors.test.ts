import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "./sampleSectors";

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
});
