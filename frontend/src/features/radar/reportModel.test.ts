import { describe, expect, it } from "vitest";

import {
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../../data/sampleSectors";
import { deriveDashboardSnapshotQuality } from "../../lib/dashboardSnapshot";
import { buildResearchBrief } from "./reportModel";

describe("research brief model", () => {
  it("derives report-ready layer summaries from the current dashboard snapshot", () => {
    const history = sourceExampleHistoryResponse("90D");
    const validation = sourceExampleValidationResponse;
    const quality = deriveDashboardSnapshotQuality(sourceExampleSectorsResponse, history, validation);
    const brief = buildResearchBrief({
      data: sourceExampleSectorsResponse,
      history,
      quality,
      validation,
    });

    expect(brief.executive_summary).toContain("시장 흐름은");
    expect(brief.layer1_market_context.headline).toContain("현재 RS 리더");
    expect(brief.layer2_macro_context.stack?.map((item) => item.label)).toContain("달러·FX 게이트");
    expect(brief.layer3_rotation_thesis.buckets?.map((bucket) => bucket.label)).toContain("모멘텀 후보");
    expect(brief.layer4_validation_caveats.headline).toContain("패턴 이력 진단");
    expect(brief.validation_guardrails.find((guardrail) => guardrail.pattern === "Strong Leader")).toMatchObject({
      allowedCopy: "표본 관측치와 신뢰도 병기 가능",
      observedProbabilityLabel: "67.0% 표본 관측",
      reliabilityLabel: "높음",
      status: "ready",
    });
  });

  it("keeps research brief wording inside validation-safe boundaries", () => {
    const history = sourceExampleHistoryResponse("90D");
    const validation = sourceExampleValidationResponse;
    const quality = deriveDashboardSnapshotQuality(sourceExampleSectorsResponse, history, validation);
    const brief = buildResearchBrief({
      data: sourceExampleSectorsResponse,
      history,
      quality,
      validation,
    });

    for (const banned of ["상승 확률", "승률", "기대수익률", "매수", "추천", "목표가"]) {
      expect(brief.markdown).not.toContain(banned);
      expect(brief.executive_summary).not.toContain(banned);
    }
    expect(brief.markdown).toContain("표본 관측 확률은 보정 완료 확률이 아니라 누적 표본 진단치입니다.");
  });
});
