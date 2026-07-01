import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../../../data/sampleSectors";
import { buildResearchBrief } from "../reportModel";
import { LayerFourValidationLab } from "./LayerFourValidationLab";

describe("LayerFourValidationLab", () => {
  it("shows completed validation coverage, fixture limits, and sample-observed probability", () => {
    const html = renderLayerFour();

    expect(html).toContain("Layer 4");
    expect(html).toContain("검증 Lab");
    expect(html).toContain("현재 진행");
    expect(html).toContain("이력, Replay, 패턴, 관측치를 한 줄 흐름으로 압축해 확인합니다.");
    expect(html).toContain("현재 판단 검증 연결");
    expect(html).toContain("표본 관측치와 신뢰도 병기 가능");
    expect(html).toContain("수집 충분");
    expect(html).toContain("패턴 진단 완료");
    expect(html).toContain("표본 확률 표시");
    expect(html).toContain("1512 sector samples");
    expect(html).toContain("이력 진단 완료");
    expect(html).toContain("126일 / 1512 samples");
    expect(html).toContain("504 rows / 126 days");
    expect(html).toContain("Replay 가능");
    expect(html).toContain("제한 표시");
    expect(html).toContain("30D");
    expect(html).toContain("90D");
    expect(html).toContain("180D");
    expect(html).toContain("Temporary Layer 4 fixture is displayed when validation data is unavailable.");
    expect(html).toContain("Fixture diagnostics are synthetic and must not be read as live historical diagnostics.");
    expect(html).toContain("패턴별 이력 진단 결과");
    expect(html).toContain("pattern diagnostics matrix");
    expect(html).toContain("표본 관측");
    expect(html).toContain("Strong Leader");
    expect(html).toContain("67.0%");
    expect(html).toContain("높음 88/100");
    expect(html).toContain("+1.4%");
    expect(html).toContain("20D 하락");
    expect(html).toContain("라벨 106/126");
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

  it("does not expose sample-observed probability for thin pattern diagnostics", () => {
    const validation = {
      ...sourceExampleValidationResponse,
      coverage: {
        ...sourceExampleValidationResponse.coverage,
        pattern_ready_count: 1,
        thin_pattern_count: 1,
      },
      pattern_diagnostics: [
        sourceExampleValidationResponse.pattern_diagnostics![0],
        {
          ...sourceExampleValidationResponse.pattern_diagnostics![1],
          evaluated_20d: 8,
          evaluated_ratio_20d: 12.5,
          observed_probability_20d: null,
          pattern: "Thin Pattern",
          quality_warnings: ["thin_20d_sample"],
          status: "thin_sample" as const,
        },
      ],
    };
    const html = renderLayerFour(validation);

    expect(html).toContain("Thin Pattern");
    expect(html).toContain("표본 부족");
    expect(html).toContain("20D 표본 부족");
    expect(html).not.toContain("58.5%");
  });
});

function renderLayerFour(validation = sourceExampleValidationResponse) {
  const history = sourceExampleHistoryResponse("90D");
  const brief = buildResearchBrief({
    data: sourceExampleSectorsResponse,
    history,
    quality: null,
    validation,
  });

  return renderToStaticMarkup(
    <LayerFourValidationLab
      data={sourceExampleSectorsResponse}
      history={history}
      historyTimeframe="90D"
      onHistoryTimeframeChange={() => undefined}
      validation={validation}
      validationGuardrails={brief.validation_guardrails}
    />,
  );
}
