import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../../../data/sampleSectors";
import { groupByQuadrant, hasHealthyBreadth, isWarningSector, isWeakBreadth, sortSectors } from "../model";
import { FlowLiquidityView } from "./FlowLiquidityView";

function renderFlowLiquidityView(explainMode: boolean) {
  const sectors = sortSectors(sourceExampleSectorsResponse.sectors);
  const selected = sectors[0];
  return renderToStaticMarkup(
    <FlowLiquidityView
      contextHistory={[]}
      contextReconciliation={sourceExampleSectorsResponse.context_reconciliation}
      explainMode={explainMode}
      grouped={groupByQuadrant(sectors)}
      healthyBreadthCount={sectors.filter(hasHealthyBreadth).length}
      layerOneFlow={sourceExampleSectorsResponse.layer1_flow}
      marketContext={sourceExampleSectorsResponse.market_context ?? []}
      sectors={sectors}
      selected={selected}
      watchlist={sourceExampleSectorsResponse.watchlist ?? []}
      warnings={sectors.filter(isWarningSector)}
      weakBreadthCount={sectors.filter(isWeakBreadth).length}
    />,
  );
}

describe("FlowLiquidityView explain mode", () => {
  it("keeps the dense dashboard as the professional Layer 1+2 view when easy mode is off", () => {
    const html = renderFlowLiquidityView(false);

    expect(html).toContain("근거와 확인 지점");
    expect(html).toContain("리스크 트리거");
    expect(html).not.toContain("쉬운 흐름 해설");
    expect(html).not.toContain("오늘의 쉬운 결론");
    expect(html).not.toContain("연준 유동성, 정책금리");
  });

  it("replaces the dense dashboard with a separate beginner-friendly screen", () => {
    const html = renderFlowLiquidityView(true);

    expect(html).toContain("쉬운 흐름 해설");
    expect(html).toContain("오늘의 쉬운 결론");
    expect(html).toContain("지표 뜻");
    expect(html).toContain("현재 해석");
    expect(html).toContain("읽는 순서");
    expect(html).toContain("지표 뜻과 현재 결과");
    expect(html).toContain("숫자를 그림으로 보기");
    expect(html).toContain("섹터 확산");
    expect(html).toContain("유동성 컨텍스트");
    expect(html).toContain("좋은 점");
    expect(html).toContain("확인할 점");
    expect(html).toContain("시장 바람");
    expect(html).toContain("마켓 컨텍스트");
    expect(html).toContain("리스크 경고등");
    expect(html).toContain("연준 유동성, 정책금리");
    expect(html).toContain("현재 결과");
    expect(html).toContain("현재 경고등은 꺼져 있습니다.");
    expect(html).not.toContain("근거와 확인 지점");
  });
});
