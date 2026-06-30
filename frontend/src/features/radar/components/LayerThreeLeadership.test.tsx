import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SectorSnapshot } from "../../../types";
import { LayerThreeLeadership } from "./LayerThreeLeadership";

function sector({
  code,
  momentum,
  pattern,
  quadrant,
  ratio,
  strength,
}: {
  code: string;
  momentum: number;
  pattern: string;
  quadrant: SectorSnapshot["quadrant"];
  ratio: number;
  strength: number;
}): SectorSnapshot {
  return {
    as_of: "2026-06-29",
    benchmark: "SPY",
    sector_code: code,
    sector_name: code,
    quadrant,
    modules: {
      relative_strength: {
        state: ratio >= 102 ? "strong" : "average",
        transition: momentum >= 100 ? "strengthening" : "weakening",
        strength: ratio >= 102 ? 3 : 2,
        evidence: {
          rs_momentum: momentum,
          rs_ratio: ratio,
        },
        warnings: [],
      },
      breadth: { state: "healthy", transition: "stable", strength: 3, evidence: {}, warnings: [] },
      participation: { state: "neutral", transition: "stable", strength: 2, evidence: {}, warnings: [] },
    },
    rulebook: {
      lead_pattern: pattern,
      direction: "neutral",
      strength,
      conviction_label: "medium",
      narrative: `${code} narrative`,
      risks: [`${code} risk`],
      invalidation: [`${code} invalidation`],
      source_metrics: {},
      data_freshness: {},
    },
    validation: {
      status: "unvalidated",
      expose_probability: false,
    },
    data_freshness: {
      latest_price_date: "2026-06-29",
    },
  };
}

describe("LayerThreeLeadership", () => {
  it("keeps the Layer 1 RS leader as the default detail while separating the momentum leader", () => {
    const currentLeader = sector({
      code: "SMH",
      momentum: 97.2,
      pattern: "Late Leader",
      quadrant: "weakening",
      ratio: 110.1,
      strength: 52,
    });
    const momentumLeader = sector({
      code: "XLV",
      momentum: 104.6,
      pattern: "Neutral",
      quadrant: "leading",
      ratio: 107.1,
      strength: 35,
    });
    const html = renderToStaticMarkup(
      <LayerThreeLeadership
        currentLeader={currentLeader}
        history={null}
        historyTimeframe="90D"
        momentumLeader={momentumLeader}
        onHistoryTimeframeChange={() => undefined}
        onSelect={() => undefined}
        sectors={[momentumLeader, currentLeader]}
        selected={currentLeader}
        selectedCode={currentLeader.sector_code}
        validation={null}
        warnings={[currentLeader]}
      />,
    );

    expect(html).toContain("리더십 상세");
    expect(html).toContain("현재 RS 리더");
    expect(html).toContain("SMH");
    expect(html).toContain("모멘텀 선두");
    expect(html).toContain("XLV");
    expect(html).toContain("기존 리더와 모멘텀 선두가 달라 전환 관찰 구간입니다.");
    expect(html).toContain("SMH 기준으로 현재 리더 상태와 약화 여부를 보여줍니다.");
    expect(html).toContain("Layer 1의 현재 RS 리더입니다. 모멘텀 선두는 XLV로 분리됩니다.");
    expect(html).toContain("모멘텀 선두 후보");
    expect(html).not.toContain("Selected Sector");
  });
});
