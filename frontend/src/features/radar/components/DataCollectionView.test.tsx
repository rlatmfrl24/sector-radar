import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../../../data/sampleSectors";
import { deriveDashboardSnapshotQuality } from "../../../lib/dashboardSnapshot";
import { DataCollectionView } from "./DataCollectionView";

describe("DataCollectionView", () => {
  it("renders the current Layer 1 collection screen without a global collection layer switch", () => {
    const html = renderCollection("layer1");

    expect(html).toContain("Layer 1 흐름 수집");
    expect(html).toContain("Layer 1 수집 내역");
    expect(html).toContain("Layer 1 SPY");
    expect(html).toContain("수집 상황 분석");
    expect(html).not.toContain("Layer 2 여력 수집");
    expect(html).not.toContain("role=\"tab\"");
  });

  it("renders Layer 4 collection data when the active layer is validation", () => {
    const html = renderCollection("validation");

    expect(html).toContain("Layer 4 검증 수집");
    expect(html).toContain("Layer 4 수집 내역");
    expect(html).toContain("FRED macro series");
    expect(html).toContain("데이터 정합성");
    expect(html).not.toContain("Layer 1 SPY");
  });
});

function renderCollection(activeView: "layer1" | "layer2" | "leadership" | "validation") {
  const history = sourceExampleHistoryResponse("90D");
  const validation = sourceExampleValidationResponse;
  const quality = deriveDashboardSnapshotQuality(sourceExampleSectorsResponse, history, validation);
  return renderToStaticMarkup(
    <DataCollectionView
      activeView={activeView}
      data={sourceExampleSectorsResponse}
      quality={quality}
      validation={validation}
    />,
  );
}
