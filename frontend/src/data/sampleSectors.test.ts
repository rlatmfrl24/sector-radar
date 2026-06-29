import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "./sampleSectors";

describe("source example sectors response", () => {
  it("includes active FRED and KRX example rows for local source-panel QA", () => {
    const providers = new Set(sourceExampleSectorsResponse.source_freshness?.map((item) => item.provider));
    const fredRows = sourceExampleSectorsResponse.source_freshness?.filter((item) => item.provider === "fred") ?? [];
    const krxRows = sourceExampleSectorsResponse.source_freshness?.filter((item) => item.provider === "krx_openapi") ?? [];

    expect(providers.has("fred")).toBe(true);
    expect(providers.has("krx_openapi")).toBe(true);
    expect(fredRows.length).toBeGreaterThan(1);
    expect(krxRows.length).toBeGreaterThan(1);
    expect(fredRows.every((item) => item.status === "live")).toBe(true);
    expect(krxRows.every((item) => item.source_class === "official")).toBe(true);
  });

  it("keeps the validation contract unvalidated in source-example mode", () => {
    expect(sourceExampleSectorsResponse.validation).toEqual({
      status: "unvalidated",
      expose_probability: false,
    });
  });
});
