interface QualityIssue {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  source?: string;
}

interface QualityLayer {
  as_of: string | null;
  completeness: number | null;
  issues: QualityIssue[];
  status: "complete" | "partial" | "stale" | "blocked";
}

interface QualitySourceFreshnessItem {
  id: string;
  label: string;
  latest_date?: string;
  provider: string;
  source_class: string;
  stale: boolean;
  status: string;
  warning?: string;
}

interface QualityMarketContextCard {
  code: string;
  data_freshness?: Record<string, number | string | null>;
  source_class: string;
}

interface QualityLayerOneFlow {
  as_of?: string;
  warnings?: string[];
  data_freshness?: {
    series?: Array<{ series_id: string; latest_date?: string }>;
  };
}

interface QualitySector {
  as_of: string;
  sector_code: string;
  quadrant: string;
  modules: {
    relative_strength: { evidence: Record<string, unknown>; warnings: string[] };
    breadth: { warnings: string[] };
    participation: { warnings: string[] };
  };
  rulebook: {
    lead_pattern: string;
    strength: number;
  };
}

const REQUIRED_LAYER_ONE_SERIES = ["SPY", "QQQ", "RSP", "IWM", "^VIX"];
const REQUIRED_CONTEXT_COUNT = 4;
const MIN_SECTOR_PANEL = 10;

export function buildSectorsDataQuality({
  asOf,
  layer1Flow,
  marketContext,
  sectors,
  sourceFreshness,
}: {
  asOf: string | null;
  layer1Flow?: QualityLayerOneFlow;
  marketContext: QualityMarketContextCard[];
  sectors: QualitySector[];
  sourceFreshness: QualitySourceFreshnessItem[];
}) {
  return {
    generated_at: new Date().toISOString(),
    layers: {
      layer1: buildLayerOneQuality(asOf, layer1Flow, sectors, sourceFreshness),
      layer2: buildLayerTwoQuality(asOf, marketContext, sourceFreshness),
      layer3: buildLayerThreeQuality(asOf, sectors, sourceFreshness),
    },
    snapshot_as_of: asOf,
  };
}

export function buildLeadershipReconciliation(sectors: QualitySector[]) {
  const ranked = [...sectors].sort((a, b) => {
    const strengthDiff = b.rulebook.strength - a.rulebook.strength;
    if (strengthDiff !== 0) return strengthDiff;
    return numberMetric(b.modules.relative_strength.evidence.rs_ratio) - numberMetric(a.modules.relative_strength.evidence.rs_ratio);
  });
  const momentumRanked = [...sectors].sort((a, b) => {
    const momentumDiff =
      numberMetric(b.modules.relative_strength.evidence.rs_momentum) -
      numberMetric(a.modules.relative_strength.evidence.rs_momentum);
    if (momentumDiff !== 0) return momentumDiff;
    return numberMetric(b.modules.relative_strength.evidence.rs_ratio) - numberMetric(a.modules.relative_strength.evidence.rs_ratio);
  });
  const currentLeader = ranked[0];
  const momentumLeader = momentumRanked[0];

  if (!currentLeader || !momentumLeader) {
    return {
      as_of: null,
      current_leader: null,
      momentum_leader: null,
      narrative: "리더십 정합성을 계산할 sector snapshot이 부족합니다.",
      selected_basis: "current_rs_leader_default" as const,
      status: "data_insufficient" as const,
      warnings: ["sector_snapshot_missing"],
    };
  }

  const aligned = currentLeader.sector_code === momentumLeader.sector_code;
  return {
    as_of: currentLeader.as_of,
    current_leader: {
      lead_pattern: currentLeader.rulebook.lead_pattern,
      quadrant: currentLeader.quadrant,
      rs_ratio: nullableNumber(currentLeader.modules.relative_strength.evidence.rs_ratio),
      sector_code: currentLeader.sector_code,
    },
    momentum_leader: {
      lead_pattern: momentumLeader.rulebook.lead_pattern,
      quadrant: momentumLeader.quadrant,
      rs_momentum: nullableNumber(momentumLeader.modules.relative_strength.evidence.rs_momentum),
      sector_code: momentumLeader.sector_code,
    },
    narrative: aligned
      ? "현재 RS 리더와 모멘텀 선두가 같은 섹터라 리더십 흐름이 일치합니다."
      : "현재 RS 리더와 모멘텀 선두가 달라 리더십 전환 관찰 구간으로 분리해 봅니다.",
    selected_basis: "current_rs_leader_default" as const,
    status: aligned ? ("aligned" as const) : ("transition_watch" as const),
    warnings: aligned ? [] : ["current_leader_momentum_leader_split"],
  };
}

function buildLayerOneQuality(
  asOf: string | null,
  flow: QualityLayerOneFlow | undefined,
  sectors: QualitySector[],
  sourceFreshness: QualitySourceFreshnessItem[],
): QualityLayer {
  const issues: QualityIssue[] = [];
  if (!asOf || sectors.length === 0) {
    issues.push(blocking("sector_snapshot_missing", "Layer 1에 필요한 sector snapshot이 없습니다.", "sector_metrics_daily"));
  }
  const series = flow?.data_freshness?.series ?? [];
  const presentSeries = new Set(series.filter((item) => item.latest_date).map((item) => item.series_id));
  const missingSeries = REQUIRED_LAYER_ONE_SERIES.filter((seriesId) => !presentSeries.has(seriesId));
  if (missingSeries.length) {
    issues.push(
      warning(
        "layer1_helper_missing",
        `Layer 1 helper series 누락: ${missingSeries.join(", ")}`,
        "series_daily",
      ),
    );
  }
  const mismatch = series.filter((item) => item.latest_date && asOf && item.latest_date !== asOf);
  if (mismatch.length) {
    issues.push(warning("layer1_helper_date_mismatch", "Layer 1 helper 기준일이 sector snapshot과 다릅니다.", "series_daily"));
  }
  for (const warningText of flow?.warnings ?? []) {
    if (warningText.includes("proxy") || warningText.includes("supplemental")) {
      issues.push(info("layer1_proxy_breadth", "Layer 1 breadth 일부는 가격 기반 보조 지표입니다.", "layer1_flow"));
    }
  }
  addStaleSourceIssues(issues, sourceFreshness.filter((item) => item.provider === "yahoo_finance" && !item.id.startsWith("context:")));

  const completenessParts = [
    sectors.length >= MIN_SECTOR_PANEL ? 1 : sectors.length / MIN_SECTOR_PANEL,
    REQUIRED_LAYER_ONE_SERIES.length ? presentSeries.size / REQUIRED_LAYER_ONE_SERIES.length : 0,
  ];
  return qualityLayer(asOf, average(completenessParts), issues);
}

function buildLayerTwoQuality(
  asOf: string | null,
  marketContext: QualityMarketContextCard[],
  sourceFreshness: QualitySourceFreshnessItem[],
): QualityLayer {
  const issues: QualityIssue[] = [];
  const official = marketContext.filter((card) => card.source_class === "official");
  if (official.length < REQUIRED_CONTEXT_COUNT) {
    issues.push(warning("official_context_incomplete", `공식 Layer 2 context ${official.length}/${REQUIRED_CONTEXT_COUNT}개만 활성입니다.`, "market_context_daily"));
  }
  if (marketContext.some((card) => card.source_class === "proxy")) {
    issues.push(info("context_proxy_present", "보조 context가 섞여 있으면 공식 원천과 분리해 해석합니다.", "market_context_daily"));
  }
  addStaleSourceIssues(issues, sourceFreshness.filter((item) => item.provider === "fred" || item.id.startsWith("context:")));
  return qualityLayer(asOf, REQUIRED_CONTEXT_COUNT ? Math.min(1, official.length / REQUIRED_CONTEXT_COUNT) : null, issues);
}

function buildLayerThreeQuality(
  asOf: string | null,
  sectors: QualitySector[],
  sourceFreshness: QualitySourceFreshnessItem[],
): QualityLayer {
  const issues: QualityIssue[] = [];
  const missingMomentum = sectors.filter((sector) => !Number.isFinite(Number(sector.modules.relative_strength.evidence.rs_momentum)));
  const moduleWarnings = sectors.filter(
    (sector) =>
      sector.modules.relative_strength.warnings.length ||
      sector.modules.breadth.warnings.length ||
      sector.modules.participation.warnings.length,
  );
  if (sectors.length < MIN_SECTOR_PANEL) {
    issues.push(warning("sector_panel_incomplete", `섹터 패널이 ${sectors.length}/${MIN_SECTOR_PANEL}개로 부족합니다.`, "sector_metrics_daily"));
  }
  if (missingMomentum.length) {
    issues.push(warning("rs_momentum_missing", `${missingMomentum.length}개 섹터의 RS Momentum이 비어 있습니다.`, "sector_metrics_daily"));
  }
  if (moduleWarnings.length) {
    issues.push(info("module_warning_present", `${moduleWarnings.length}개 섹터에 module warning이 있습니다.`, "source_metrics_json"));
  }
  addStaleSourceIssues(issues, sourceFreshness.filter((item) => item.id === "snapshot:sector_metrics" || item.id === "provider:yahoo_finance"));
  return qualityLayer(asOf, sectors.length ? (sectors.length - missingMomentum.length) / sectors.length : 0, issues);
}

function addStaleSourceIssues(issues: QualityIssue[], items: QualitySourceFreshnessItem[]) {
  for (const item of items) {
    if (item.status === "live" && !item.stale) continue;
    issues.push(
      item.status === "unavailable"
        ? blocking("source_unavailable", `${item.label} 수집원이 사용 불가 상태입니다.`, item.id)
        : warning("source_stale", `${item.label} 기준일 확인이 필요합니다.`, item.id),
    );
  }
}

function qualityLayer(asOf: string | null, completeness: number | null, issues: QualityIssue[]): QualityLayer {
  const blockingIssues = issues.filter((issue) => issue.severity === "blocking");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");
  const status =
    blockingIssues.length > 0
      ? "blocked"
      : warningIssues.some((issue) => issue.code.includes("stale") || issue.code.includes("mismatch"))
        ? "stale"
        : warningIssues.length > 0
          ? "partial"
          : "complete";
  return {
    as_of: asOf,
    completeness: completeness === null ? null : Math.round(Math.min(1, Math.max(0, completeness)) * 100) / 100,
    issues,
    status,
  };
}

function info(code: string, message: string, source?: string): QualityIssue {
  return { code, message, severity: "info", source };
}

function warning(code: string, message: string, source?: string): QualityIssue {
  return { code, message, severity: "warning", source };
}

function blocking(code: string, message: string, source?: string): QualityIssue {
  return { code, message, severity: "blocking", source };
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numberMetric(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
