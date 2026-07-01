import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../../../data/sampleSectors";
import { deriveDashboardSnapshotQuality } from "../../../lib/dashboardSnapshot";
import type { RadarLayerView } from "../model";
import { LayerDataContextSection, layerQualityForView } from "./LayerDataContextSection";

describe("LayerDataContextSection", () => {
  it.each([
    ["layer1", "Layer 1 수집 내역", "Layer 1 SPY", "S01 중앙은행 정책"],
    ["layer2", "Layer 2 수집 내역", "S01 중앙은행 정책", "Layer 1 SPY"],
    ["leadership", "Layer 3 수집 내역", "Sector snapshots", "Layer 1 SPY"],
    ["validation", "Layer 4 수집 내역", "FRED macro series", "Layer 1 SPY"],
  ] as Array<[RadarLayerView, string, string, string]>)("keeps %s source context inside one section", (activeView, sourceLabel, included, excluded) => {
    const quality = testData();
    const html = renderToStaticMarkup(
      <LayerDataContextSection
        activeView={activeView}
        data={sourceExampleSectorsResponse}
        dataQuality={layerQualityForView(activeView, quality, sourceExampleSectorsResponse)}
        validation={sourceExampleValidationResponse}
      />,
    );

    expect(html).toContain("레이어 수집 데이터");
    expect(html).toContain("수집원 요약 / 상세");
    expect(html).toContain(sourceLabel);
    expect(html).toContain(included);
    expect(html).toContain("레이어 상태");
    expect(html).toContain("데이터 정합성");
    expect(html).not.toContain(excluded);
  });
});

function testData() {
  const history = sourceExampleHistoryResponse("90D");
  const validation = sourceExampleValidationResponse;
  return deriveDashboardSnapshotQuality(sourceExampleSectorsResponse, history, validation);
}
