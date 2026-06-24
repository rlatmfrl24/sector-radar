import type { SectorSnapshot, SectorsResponse } from "../types";

const sectorRows: SectorSnapshot[] = [
  sector({
    code: "SMH",
    name: "Semiconductors",
    quadrant: "leading",
    pattern: "Strong Leader",
    direction: "strong_up",
    conviction: "high",
    rsRatio: 106.8,
    rsMomentum: 102.7,
    breadthState: "healthy",
    participationState: "accumulation",
    narrative:
      "반도체는 시장 대비 상대강도와 RS Momentum이 동시에 개선되고 있으며, breadth와 participation도 상승을 확인하고 있다.",
    risks: ["Breadth 약화", "AI CAPEX 민감도", "RS Momentum 100 하회"],
    invalidation: ["RS Momentum 2주 연속 100 하회", "50MA 위 종목 비율 50% 하회"],
  }),
  sector({
    code: "XLK",
    name: "Technology",
    quadrant: "weakening",
    pattern: "Late Leader",
    direction: "mild_up",
    conviction: "medium",
    rsRatio: 104.1,
    rsMomentum: 98.8,
    breadthState: "mixed",
    participationState: "confirmed",
    narrative:
      "기술주는 여전히 강한 상대강도를 유지하지만 모멘텀이 둔화되어 리더십 후반부 가능성을 점검해야 한다.",
    risks: ["모멘텀 둔화", "고점 추격 위험", "대형주 의존 심화"],
    invalidation: ["RS Ratio 102 하회", "Participation diverging 전환"],
  }),
  sector({
    code: "XLI",
    name: "Industrials",
    quadrant: "improving",
    pattern: "Emerging Leader",
    direction: "mild_up",
    conviction: "medium",
    rsRatio: 99.4,
    rsMomentum: 101.9,
    breadthState: "healthy",
    participationState: "confirmed",
    narrative:
      "산업재는 아직 절대 리더는 아니지만 RS Momentum이 개선되고 내부 확산이 동반되어 차기 리더 후보로 관찰된다.",
    risks: ["RS 개선 실패", "거래량 둔화", "Breadth 확산 실패"],
    invalidation: ["RS Momentum 99 하회", "Breadth mixed 이하 전환"],
  }),
  sector({
    code: "XLY",
    name: "Consumer Discretionary",
    quadrant: "leading",
    pattern: "False Leadership",
    direction: "neutral",
    conviction: "medium",
    rsRatio: 103.6,
    rsMomentum: 100.9,
    breadthState: "narrow",
    participationState: "diverging",
    narrative:
      "임의소비재는 ETF 가격은 강하지만 breadth와 participation이 충분히 확인되지 않아 가짜 리더십 가능성이 있다.",
    risks: ["거래량 미확인", "소수 종목 의존", "False breakout 가능성"],
    invalidation: ["CMF 0 하회 지속", "50MA 위 종목 비율 추가 하락"],
  }),
  sector({
    code: "XLU",
    name: "Utilities",
    quadrant: "lagging",
    pattern: "Breakdown",
    direction: "strong_down",
    conviction: "high",
    rsRatio: 94.3,
    rsMomentum: 96.7,
    breadthState: "breakdown",
    participationState: "distribution",
    narrative:
      "유틸리티는 상대강도와 모멘텀이 모두 약하고 participation도 분산을 시사해 리스크 관리 구간으로 분류된다.",
    risks: ["상대강도 붕괴", "Breadth 붕괴", "자금 흐름 약화"],
    invalidation: ["RS Ratio 98 회복", "Participation confirmed 전환"],
  }),
  sector({
    code: "XLF",
    name: "Financials",
    quadrant: "lagging",
    pattern: "Breakdown",
    direction: "strong_down",
    conviction: "medium",
    rsRatio: 96.2,
    rsMomentum: 98.1,
    breadthState: "narrow",
    participationState: "distribution",
    narrative:
      "금융주는 상대강도와 모멘텀이 약하고 participation도 약화되어 소외 구간으로 분류된다.",
    risks: ["신용 민감도", "상대강도 회복 실패", "분산 가능성"],
    invalidation: ["RS Ratio 98 회복", "Breadth mixed 이상 회복"],
  }),
  sector({
    code: "XLE",
    name: "Energy",
    quadrant: "lagging",
    pattern: "Breakdown",
    direction: "strong_down",
    conviction: "medium",
    rsRatio: 95.4,
    rsMomentum: 97.8,
    breadthState: "breakdown",
    participationState: "distribution",
    narrative:
      "에너지는 상대강도와 모멘텀이 모두 시장 열위이며 내부 breadth도 붕괴 신호를 보인다.",
    risks: ["상대강도 붕괴", "Breadth 붕괴", "원자재 변동성"],
    invalidation: ["RS Momentum 100 회복", "Participation confirmed 전환"],
  }),
  sector({
    code: "XLV",
    name: "Health Care",
    quadrant: "lagging",
    pattern: "Weak Expansion",
    direction: "neutral",
    conviction: "low",
    rsRatio: 97.1,
    rsMomentum: 99.0,
    breadthState: "mixed",
    participationState: "neutral",
    narrative:
      "헬스케어는 일부 내부 확산은 있으나 상대강도와 participation 정렬이 부족해 낮은 확신으로 관찰된다.",
    risks: ["RS 개선 실패", "Participation 미확인", "방어주 수급 둔화"],
    invalidation: ["Breadth narrow 전환", "RS Ratio 96 하회"],
  }),
  sector({
    code: "XLC",
    name: "Communication",
    quadrant: "lagging",
    pattern: "Breakdown",
    direction: "strong_down",
    conviction: "medium",
    rsRatio: 96.6,
    rsMomentum: 98.3,
    breadthState: "narrow",
    participationState: "diverging",
    narrative:
      "커뮤니케이션은 상대강도 개선이 확인되지 않고 breadth가 좁아 소수 종목 의존 위험이 남아 있다.",
    risks: ["Breadth 협소", "RS Momentum 둔화", "대형주 편중"],
    invalidation: ["RS Momentum 101 회복", "Breadth healthy 전환"],
  }),
  sector({
    code: "XLP",
    name: "Cons. Staples",
    quadrant: "weakening",
    pattern: "Late Leader",
    direction: "neutral",
    conviction: "medium",
    rsRatio: 101.8,
    rsMomentum: 98.7,
    breadthState: "mixed",
    participationState: "neutral",
    narrative:
      "필수소비재는 방어적 상대강도는 유지하지만 모멘텀은 둔화되어 후반부 리더십으로 감시된다.",
    risks: ["모멘텀 둔화", "수급 확인 부족", "방어주 선호 약화"],
    invalidation: ["RS Ratio 100 하회", "Participation distribution 전환"],
  }),
  sector({
    code: "XLRE",
    name: "Real Estate",
    quadrant: "lagging",
    pattern: "Breakdown",
    direction: "strong_down",
    conviction: "medium",
    rsRatio: 95.9,
    rsMomentum: 97.4,
    breadthState: "breakdown",
    participationState: "distribution",
    narrative:
      "부동산은 상대강도와 내부 건강도가 모두 약해 리더십 후보에서 제외되는 상태다.",
    risks: ["금리 민감도", "Breadth 붕괴", "자금 흐름 약화"],
    invalidation: ["RS Ratio 98 회복", "CMF 0 회복"],
  }),
  sector({
    code: "XLB",
    name: "Materials",
    quadrant: "lagging",
    pattern: "Weak Expansion",
    direction: "neutral",
    conviction: "low",
    rsRatio: 98.2,
    rsMomentum: 99.2,
    breadthState: "mixed",
    participationState: "diverging",
    narrative:
      "소재는 내부 확산이 완전히 무너지진 않았지만 participation이 약해 추세 확인이 부족하다.",
    risks: ["거래량 미확인", "경기민감 수요 둔화", "RS 개선 실패"],
    invalidation: ["Breadth narrow 전환", "RS Momentum 98 하회"],
  }),
];

export const sampleSectorsResponse: SectorsResponse = {
  as_of: "2026-06-22",
  benchmark: "SPY",
  sectors: sectorRows,
  validation: {
    status: "unvalidated",
    expose_probability: false,
  },
  source: "sample",
  data_connection: {
    provider: "none",
    mode: "sample",
    status: "never_run",
    refresh_interval_minutes: 15,
    latest_price_date: "2026-06-22",
    manual_refresh_available: false,
    message: "API unavailable; deterministic sample data is displayed.",
  },
};

function sector(input: {
  code: string;
  name: string;
  quadrant: SectorSnapshot["quadrant"];
  pattern: string;
  direction: string;
  conviction: "low" | "medium" | "high";
  rsRatio: number;
  rsMomentum: number;
  breadthState: string;
  participationState: string;
  narrative: string;
  risks: string[];
  invalidation: string[];
}): SectorSnapshot {
  return {
    as_of: "2026-06-22",
    benchmark: "SPY",
    sector_code: input.code,
    sector_name: input.name,
    quadrant: input.quadrant,
    modules: {
      relative_strength: {
        state: input.rsRatio >= 102 ? "strong" : input.rsRatio < 98 ? "weak" : "average",
        transition:
          input.rsMomentum >= 101 ? "strengthening" : input.rsMomentum < 99 ? "weakening" : "stable",
        strength: input.rsRatio >= 102 ? 3 : input.rsRatio < 98 ? 1 : 2,
        evidence: {
          rs_ratio: input.rsRatio,
          rs_momentum: input.rsMomentum,
        },
        warnings: [],
      },
      breadth: {
        state: input.breadthState,
        transition: input.breadthState === "breakdown" ? "weakening" : "stable",
        strength: input.breadthState === "healthy" ? 3 : 1,
        evidence: {},
        warnings: [],
      },
      participation: {
        state: input.participationState,
        transition: input.participationState === "distribution" ? "weakening" : "stable",
        strength: input.participationState === "accumulation" ? 3 : 2,
        evidence: {},
        warnings: [],
      },
    },
    rulebook: {
      lead_pattern: input.pattern,
      direction: input.direction,
      strength: input.direction === "strong_down" ? 0 : input.direction === "strong_up" ? 4 : 2,
      conviction_label: input.conviction,
      narrative: input.narrative,
      risks: input.risks,
      invalidation: input.invalidation,
      source_metrics: {},
      data_freshness: {
        latest_price_date: "2026-06-22",
        computed_at: "2026-06-23T09:00:00+09:00",
      },
    },
    validation: {
      status: "unvalidated",
      expose_probability: false,
    },
    data_freshness: {
      latest_price_date: "2026-06-22",
      computed_at: "2026-06-23T09:00:00+09:00",
    },
  };
}
