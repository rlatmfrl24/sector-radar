import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../../../data/sampleSectors";
import { groupByQuadrant, hasHealthyBreadth, isWarningSector, isWeakBreadth, sortSectors } from "../model";
import { LayerOneFlowView, LayerTwoLiquidityView } from "./FlowLiquidityView";

function renderLayerOneView(explainMode: boolean) {
  const sectors = sortSectors(sourceExampleSectorsResponse.sectors);
  return renderToStaticMarkup(
    <LayerOneFlowView
      explainMode={explainMode}
      grouped={groupByQuadrant(sectors)}
      healthyBreadthCount={sectors.filter(hasHealthyBreadth).length}
      layerOneFlow={sourceExampleSectorsResponse.layer1_flow}
      reconciliation={sourceExampleSectorsResponse.context_reconciliation}
      sectors={sectors}
      warnings={sectors.filter(isWarningSector)}
      weakBreadthCount={sectors.filter(isWeakBreadth).length}
    />,
  );
}

function renderLayerTwoView() {
  const sectors = sortSectors(sourceExampleSectorsResponse.sectors);
  const selected = sectors[0];
  return renderToStaticMarkup(
    <LayerTwoLiquidityView
      contextHistory={[]}
      marketContext={sourceExampleSectorsResponse.market_context ?? []}
      sectors={sectors}
      selected={selected}
      watchlist={sourceExampleSectorsResponse.watchlist ?? []}
    />,
  );
}

describe("Layer 1 and Layer 2 split views", () => {
  it("keeps the dense dashboard as the professional Layer 1 view when easy mode is off", () => {
    const html = renderLayerOneView(false);

    expect(html).toContain("근거와 확인 지점");
    expect(html).toContain("전체 판단");
    expect(html).toContain("흐름 최종 판단");
    expect(html).toContain("확인 체크리스트");
    expect(html).toContain("지표별 해석");
    expect(html).toContain("의미");
    expect(html).toContain("해석");
    expect(html).toContain("출처 정보");
    expect(html).toContain("요청 정보");
    expect(html).toContain("받아온 결과");
    expect(html).not.toContain("Layer 1 데이터");
    expect(html).not.toContain("Layer 2 원천");
    expect(html).not.toContain("TGA·Daily Treasury Statement");
    expect(html).not.toContain("쉬운 흐름 해설");
    expect(html).not.toContain("Layer 1 쉬운 결론");
    expect(html).not.toContain("분석 리스크별 판단");
  });

  it("renders Layer 2 without the Layer 1 evidence stack", () => {
    const html = renderLayerTwoView();

    expect(html).toContain("유동성 판단");
    expect(html).toContain("Selected ETF volume");
    expect(html).toContain("마켓 컨텍스트");
    expect(html).toContain("분석 리스크별 판단");
    expect(html).toContain("분석 리스크");
    expect(html).toContain("관련 리스크");
    expect(html).toContain("출처 정보");
    expect(html).not.toContain("근거와 확인 지점");
    expect(html).not.toContain("흐름 최종 판단");
    expect(html).not.toContain("확인 체크리스트");
  });

  it("replaces the Layer 1 dense dashboard with a separate beginner-friendly screen", () => {
    const html = renderLayerOneView(true);

    expect(html).toContain("쉬운 흐름 해설");
    expect(html).toContain("Layer 1 쉬운 결론");
    expect(html).toContain("지표 뜻");
    expect(html).toContain("현재 해석");
    expect(html).toContain("읽는 순서");
    expect(html).toContain("지표 뜻과 현재 결과");
    expect(html).toContain("Layer 1 분포");
    expect(html).toContain("섹터 회전");
    expect(html).toContain("내부 확산");
    expect(html).toContain("좋은 점");
    expect(html).toContain("확인할 점");
    expect(html).toContain("시장 바람");
    expect(html).toContain("변동성 압력");
    expect(html).toContain("현재 결과");
    expect(html).not.toContain("데이터 수집 지도");
    expect(html).not.toContain("근거와 확인 지점");
    expect(html).not.toContain("마켓 컨텍스트");
  });
});
