import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../../../data/sampleSectors";
import { DashboardTopBar } from "./DashboardTopBar";

describe("DashboardTopBar explain mode", () => {
  it("shows a persisted explain toggle on the Layer 1 screen", () => {
    const html = renderToStaticMarkup(
      <DashboardTopBar
        activeView="layer1"
        data={sourceExampleSectorsResponse}
        explainMode={false}
        isRefreshing={false}
        onExplainModeChange={() => undefined}
        onRefresh={() => undefined}
        onViewChange={() => undefined}
      />,
    );

    expect(html).toContain("쉬운 화면");
    expect(html).toContain("aria-pressed=\"false\"");
    expect(html).toContain("Layer 1 흐름을 초보자용 쉬운 해설 화면으로 전환합니다.");
    expect(html).toContain("Layer 1");
    expect(html).toContain("Layer 2");
    expect(html).toContain("리더십");
  });

  it("does not show the Layer 1 explain toggle on Layer 2 or Layer 3 screens", () => {
    const layerTwo = renderToStaticMarkup(
      <DashboardTopBar
        activeView="layer2"
        data={sourceExampleSectorsResponse}
        explainMode
        isRefreshing={false}
        onExplainModeChange={() => undefined}
        onRefresh={() => undefined}
        onViewChange={() => undefined}
      />,
    );
    const html = renderToStaticMarkup(
      <DashboardTopBar
        activeView="leadership"
        data={sourceExampleSectorsResponse}
        explainMode
        isRefreshing={false}
        onExplainModeChange={() => undefined}
        onRefresh={() => undefined}
        onViewChange={() => undefined}
      />,
    );

    expect(layerTwo).not.toContain("쉬운 화면");
    expect(layerTwo).not.toContain("전문 화면");
    expect(html).not.toContain("쉬운 화면");
    expect(html).not.toContain("전문 화면");
  });
});
