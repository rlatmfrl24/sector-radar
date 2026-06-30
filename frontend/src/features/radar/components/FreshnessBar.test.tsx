import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../../../data/sampleSectors";
import { ContextRail, FreshnessBar } from "./FreshnessBar";

describe("FreshnessBar scoped source display", () => {
  it("shows Layer 1 collection sources without Layer 2 context rows", () => {
    const html = renderToStaticMarkup(
      <FreshnessBar activeView="layer1" data={sourceExampleSectorsResponse} initialExpanded />,
    );

    expect(html).toContain("Layer 1 수집 내역");
    expect(html).toContain("Layer 1 SPY");
    expect(html).toContain("Layer 1 QQQ");
    expect(html).toContain("Layer 1 RSP");
    expect(html).toContain("Layer 1 ^VIX");
    expect(html).toContain("Yahoo");
    expect(html).not.toContain("FRED macro series");
    expect(html).not.toContain("S01 중앙은행 정책");
  });

  it("shows Layer 2 collection sources without Layer 1 tape rows", () => {
    const html = renderToStaticMarkup(
      <FreshnessBar activeView="layer2" data={sourceExampleSectorsResponse} initialExpanded />,
    );

    expect(html).toContain("Layer 2 수집 내역");
    expect(html).toContain("FRED macro series");
    expect(html).toContain("S01 중앙은행 정책");
    expect(html).toContain("S02 달러·FX 게이트");
    expect(html).toContain("Yahoo sector prices");
    expect(html).not.toContain("Layer 1 SPY");
    expect(html).not.toContain("Layer 1 ^VIX");
  });

  it("labels Layer 3 context as RS leader and rotation candidates", () => {
    const html = renderToStaticMarkup(
      <ContextRail activeView="leadership" data={sourceExampleSectorsResponse} />,
    );

    expect(html).toContain("RS 리더");
    expect(html).toContain("순환 후보");
    expect(html).not.toContain("Sector Leadership");
  });
});
