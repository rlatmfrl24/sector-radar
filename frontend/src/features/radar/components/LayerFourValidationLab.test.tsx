import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../../../data/sampleSectors";
import { LayerFourValidationLab } from "./LayerFourValidationLab";

describe("LayerFourValidationLab", () => {
  it("shows completed validation coverage, fixture limits, and sample-observed probability", () => {
    const html = renderLayerFour();

    expect(html).toContain("Layer 4");
    expect(html).toContain("검증 Lab");
    expect(html).toContain("현재 진행 상황");
    expect(html).toContain("이력 검증, Replay 범위, 패턴 진단, 표본 관측치를 한 흐름으로 확인합니다.");
    expect(html).toContain("수집 충분");
    expect(html).toContain("패턴 진단 완료");
    expect(html).toContain("표본 확률 표시");
    expect(html).toContain("1512 sector samples");
    expect(html).toContain("이력 진단 완료");
    expect(html).toContain("126일 / 1512 samples");
    expect(html).toContain("126 history days");
    expect(html).toContain("504 rows / 126 days");
    expect(html).toContain("Replay 가능");
    expect(html).toContain("제한 표시");
    expect(html).toContain("30D");
    expect(html).toContain("90D");
    expect(html).toContain("180D");
    expect(html).toContain("Temporary Layer 4 fixture is displayed when validation data is unavailable.");
    expect(html).toContain("Fixture diagnostics are synthetic and must not be read as live historical diagnostics.");
    expect(html).toContain("패턴별 이력 진단 결과");
    expect(html).toContain("pattern diagnostics chart");
    expect(html).toContain("Strong Leader");
    expect(html).toContain("67.0%");
    expect(html).toContain("높음 88/100");
    expect(html).toContain("+1.4%");
    expect(html).toContain("20D 하락");
    expect(html).toContain("양수 라벨");
    expect(html).not.toContain("Layer 5 Handoff");
    expect(html).not.toContain("후보 퍼널 진입 준비");
    expect(html).not.toContain("정기 진단 갱신");
    expect(html).not.toContain("정기 확인");
    expect(html).not.toContain("layer4_validation_audit");
    expect(html).not.toContain("이력 진단 준비");
    expect(html).not.toContain("진단 준비");
  });

  it("keeps recommendation and unvalidated probability wording out of the layer body", () => {
    const html = renderLayerFour();

    for (const banned of ["상승 확률", "승률", "기대수익률", "매수", "추천"]) {
      expect(html).not.toContain(banned);
    }
  });
});

function renderLayerFour() {
  return renderToStaticMarkup(
    <LayerFourValidationLab
      data={sourceExampleSectorsResponse}
      history={sourceExampleHistoryResponse("90D")}
      historyTimeframe="90D"
      onHistoryTimeframeChange={() => undefined}
      validation={sourceExampleValidationResponse}
    />,
  );
}
