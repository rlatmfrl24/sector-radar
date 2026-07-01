import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HistoryResponse, SectorSnapshot } from "../../../types";
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
    const history: HistoryResponse = {
      market: "SPY",
      timeframe: "90D",
      coverage: {
        available_sector_days: 90,
        effective_days: 90,
        limited_by_data: false,
        requested_days: 90,
      },
      market_context: [],
      sectors: [
        {
          sector_code: "SMH",
          trail: [
            { date: "2026-06-26", quadrant: "leading", rs_momentum: 99.8, rs_ratio: 108.2, strength: 50 },
            { date: "2026-06-29", quadrant: "weakening", rs_momentum: 97.2, rs_ratio: 110.1, strength: 52 },
          ],
        },
        {
          sector_code: "XLV",
          trail: [
            { date: "2026-06-26", quadrant: "improving", rs_momentum: 102.1, rs_ratio: 104.2, strength: 32 },
            { date: "2026-06-29", quadrant: "leading", rs_momentum: 104.6, rs_ratio: 107.1, strength: 35 },
          ],
        },
      ],
      status: "ok",
    };
    const html = renderToStaticMarkup(
      <LayerThreeLeadership
        currentLeader={currentLeader}
        history={history}
        historyTimeframe="90D"
        leadershipReconciliation={{
          as_of: "2026-06-29",
          current_leader: {
            lead_pattern: "Late Leader",
            quadrant: "weakening",
            rs_ratio: 110.1,
            sector_code: "SMH",
          },
          momentum_leader: {
            lead_pattern: "Neutral",
            quadrant: "leading",
            rs_momentum: 104.6,
            sector_code: "XLV",
          },
          narrative: "API 정합성: 현재 RS 리더와 모멘텀 선두가 분리된 전환 관찰 구간입니다.",
          selected_basis: "current_rs_leader_default",
          status: "transition_watch",
          warnings: ["current_leader_momentum_leader_split"],
        }}
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
    expect(html).toContain("leadership-top-strip");
    expect(html).toContain("RRG 경로");
    expect(html).toContain("현재 RS 리더");
    expect(html).toContain("SMH");
    expect(html).toContain("모멘텀 선두");
    expect(html).toContain("XLV");
    expect(html).toContain("API 정합성: 현재 RS 리더와 모멘텀 선두가 분리된 전환 관찰 구간입니다.");
    expect(html).toContain("SMH 기준으로 현재 리더 상태와 약화 여부를 보여줍니다.");
    expect(html).toContain("Layer 1의 현재 RS 리더입니다. 모멘텀 선두는 XLV로 분리됩니다.");
    expect(html).toContain("모멘텀 선두 후보");
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(html).toContain('cx="97"');
    expect(html).not.toContain('cx="100"');
    expect(html).not.toContain('preserveAspectRatio="none"');
    expect(html).not.toContain("Selected Sector");
  });
});
