import type { MarketContextAvailability, SectorSnapshot } from "../../types";

export type RadarView = "flow" | "leadership";

export const quadrantLabels: Record<SectorSnapshot["quadrant"], string> = {
  leading: "Leading",
  improving: "Improving",
  weakening: "Weakening",
  lagging: "Lagging",
  unknown: "Unknown",
};

export type LiquidityAvailability = MarketContextAvailability;

export const liquidityInputs: Array<{
  availability: LiquidityAvailability;
  code: string;
  meaning: string;
  source: string;
  title: string;
  warning?: string;
}> = [
  {
    availability: "live",
    code: "S01",
    title: "중앙은행 정책",
    source: "FRED official",
    meaning: "금리·대차대조표 기반 유동성 여력",
  },
  {
    availability: "live",
    code: "S02",
    title: "달러·FX 게이트",
    source: "FRED official",
    meaning: "글로벌 위험자산 압박 또는 완화",
  },
  {
    availability: "live",
    code: "S03",
    title: "글로벌 신용환경",
    source: "FRED official",
    meaning: "HY OAS와 VIX로 신용·변동성 압력 확인",
  },
  {
    availability: "live",
    code: "S05",
    title: "은행 지급준비금",
    source: "FRED official",
    meaning: "연준 지급준비금으로 현금성 여력을 확인",
    warning: "WRESBAL은 공식 MMF 총자산이 아니라 은행 지급준비금입니다.",
  },
];

export function groupByQuadrant(sectors: SectorSnapshot[]) {
  return {
    leading: sectors.filter((sector) => sector.quadrant === "leading"),
    improving: sectors.filter((sector) => sector.quadrant === "improving"),
    weakening: sectors.filter((sector) => sector.quadrant === "weakening"),
    lagging: sectors.filter((sector) => sector.quadrant === "lagging"),
  };
}

export function sortSectors(sectors: SectorSnapshot[]) {
  return [...sectors].sort((a, b) => {
    const strengthDiff = b.rulebook.strength - a.rulebook.strength;
    if (strengthDiff !== 0) return strengthDiff;
    return (
      numberMetric(b.modules.relative_strength.evidence.rs_ratio, 0) -
      numberMetric(a.modules.relative_strength.evidence.rs_ratio, 0)
    );
  });
}

export function sortSectorsByMomentum(sectors: SectorSnapshot[]) {
  return [...sectors].sort((a, b) => {
    const momentumDiff =
      numberMetric(b.modules.relative_strength.evidence.rs_momentum, 0) -
      numberMetric(a.modules.relative_strength.evidence.rs_momentum, 0);
    if (momentumDiff !== 0) return momentumDiff;
    return (
      numberMetric(b.modules.relative_strength.evidence.rs_ratio, 0) -
      numberMetric(a.modules.relative_strength.evidence.rs_ratio, 0)
    );
  });
}

export function isWarningSector(sector: SectorSnapshot) {
  return ["False Leadership", "Mega-cap Dependence", "Late Leader", "Breakdown"].includes(
    sector.rulebook.lead_pattern,
  );
}

export function hasHealthyBreadth(sector: SectorSnapshot) {
  return ["healthy", "broad_strength"].includes(sector.modules.breadth.state);
}

export function isWeakBreadth(sector: SectorSnapshot) {
  return ["narrow", "breakdown"].includes(sector.modules.breadth.state);
}

export function patternClass(sector: SectorSnapshot) {
  const pattern = sector.rulebook.lead_pattern;
  if (["Strong Leader", "Emerging Leader", "Healthy Expansion"].includes(pattern)) return "positive";
  if (["Late Leader", "False Leadership", "Mega-cap Dependence"].includes(pattern)) return "caution";
  if (pattern === "Breakdown") return "negative";
  return "neutral";
}

export function directionLabel(sector: SectorSnapshot) {
  if (sector.rulebook.direction.includes("down")) return "Risk-off";
  if (sector.rulebook.direction.includes("up")) return "Constructive";
  return "Neutral";
}

export function codes(sectors: SectorSnapshot[]) {
  return sectors.map((sector) => sector.sector_code).join(", ");
}

export function numberMetric(value: number | string | null | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function toSparklinePoints(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  if (values.length === 1) return `${width / 2},${height / 2}`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
