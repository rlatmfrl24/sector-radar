import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse, sourceExampleValidationResponse } from "../../../data/sampleSectors";
import { DashboardTopBar } from "./DashboardTopBar";

describe("DashboardTopBar surface mode", () => {
  it("keeps Layer 1-4 as the top tabs and exposes result/collection switching", () => {
    const html = renderTopBar("layer1", "result");

    expect(html).toContain("Layer 1");
    expect(html).toContain("Layer 2");
    expect(html).toContain("리더십");
    expect(html).toContain("Layer 4");
    expect(html).toContain("검증");
    expect(html).toContain("결과");
    expect(html).toContain("수집");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).not.toContain("쉬운 화면");
    expect(html).not.toContain("<span>Data</span>");
  });

  it("keeps the collection switch available on Layer 2, Layer 3, and Layer 4 screens", () => {
    const layerTwo = renderTopBar("layer2", "collection");
    const layerThree = renderTopBar("leadership", "collection");
    const layerFour = renderTopBar("validation", "collection");

    expect(layerTwo).toContain("수집");
    expect(layerThree).toContain("수집");
    expect(layerFour).toContain("수집");
    expect(layerTwo).toContain("aria-pressed=\"true\"");
    expect(layerThree).toContain("aria-pressed=\"true\"");
    expect(layerFour).toContain("aria-pressed=\"true\"");
  });

  it("uses the Layer 4 validation API status in the top validation pill", () => {
    const html = renderToStaticMarkup(
      <DashboardTopBar
        activeSurface="result"
        activeView="validation"
        data={sourceExampleSectorsResponse}
        isRefreshing={false}
        onRefresh={() => undefined}
        onSurfaceChange={() => undefined}
        onViewChange={() => undefined}
        validation={sourceExampleValidationResponse}
      />,
    );

    expect(html).toContain("표본 확률 표시");
    expect(html).toContain("관측치는 신뢰도와 함께 Layer 4에서 확인합니다.");
    expect(html).not.toContain("상승 확률");
    expect(html).not.toContain("승률");
    expect(html).not.toContain("기대수익률");
  });
});

function renderTopBar(activeView: "layer1" | "layer2" | "leadership" | "validation", activeSurface: "result" | "collection") {
  return renderToStaticMarkup(
    <DashboardTopBar
      activeSurface={activeSurface}
      activeView={activeView}
      data={sourceExampleSectorsResponse}
      isRefreshing={false}
      onRefresh={() => undefined}
      onSurfaceChange={() => undefined}
      onViewChange={() => undefined}
    />,
  );
}
