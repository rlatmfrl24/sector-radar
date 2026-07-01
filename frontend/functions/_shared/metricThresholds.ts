export const METRIC_WINDOWS = {
  breadth: [20, 50, 200] as const,
  metricHistoryDefaultDays: 260,
  metricHistoryMaxDays: 360,
  participation: 20,
  rs: 50,
  rsMomentum: 10,
};

export const METRIC_THRESHOLDS = {
  breadth: {
    breakdownPct20: 35,
    breakdownPct50: 40,
    healthyPct20: 65,
    healthyPct50: 55,
    narrowPct20: 60,
    narrowPct50: 45,
    strengtheningAdvancingRatio: 60,
    weakeningAdvancingRatio: 40,
  },
  participation: {
    accumulationCmf: 0,
    accumulationRvol: 1.05,
    distributionCmf: 0,
    strengtheningCmf: 0.05,
    strengtheningRvol: 1.2,
    weakeningCmf: -0.05,
  },
  relativeStrength: {
    strongRatio: 102,
    weakRatio: 98,
    strengtheningMomentum: 101,
    weakeningMomentum: 99,
  },
};

export function classifyRelativeStrengthState(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (value >= METRIC_THRESHOLDS.relativeStrength.strongRatio) return "strong";
  if (value < METRIC_THRESHOLDS.relativeStrength.weakRatio) return "weak";
  return "average";
}

export function classifyRelativeStrengthTransition(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (value >= METRIC_THRESHOLDS.relativeStrength.strengtheningMomentum) return "strengthening";
  if (value < METRIC_THRESHOLDS.relativeStrength.weakeningMomentum) return "weakening";
  return "stable";
}

export function relativeStrengthClassStrength(state: string) {
  if (state === "strong") return 3;
  if (state === "average") return 2;
  if (state === "weak") return 1;
  return 0;
}

export function breadthStateStrength(state: string | null | undefined) {
  if (state === "healthy") return 3;
  if (state === "mixed" || state === "narrow") return 2;
  if (state === "breakdown") return 1;
  return 0;
}

export function participationStateStrength(state: string | null | undefined) {
  if (state === "accumulation") return 3;
  if (state === "neutral" || state === "confirmed") return 2;
  if (state === "distribution" || state === "diverging") return 1;
  return 0;
}
