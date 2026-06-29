import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../../../data/sampleSectors";
import { DashboardTopBar } from "./DashboardTopBar";

describe("DashboardTopBar explain mode", () => {
  it("shows a persisted explain toggle on the Layer 1+2 screen", () => {
    const html = renderToStaticMarkup(
      <DashboardTopBar
        activeView="flow"
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
    expect(html).toContain("Layer 1+2를 초보자용 쉬운 해설 화면으로 전환합니다.");
  });

  it("does not show the Layer 1+2 explain toggle on the Layer 3 screen", () => {
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

    expect(html).not.toContain("쉬운 화면");
    expect(html).not.toContain("전문 화면");
  });
});
