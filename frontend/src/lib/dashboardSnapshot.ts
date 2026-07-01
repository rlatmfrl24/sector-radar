import { loadHistory, loadSectors, loadValidation } from "./api";
import type {
  DashboardDataQuality,
  DataQualityIssue,
  HistoryResponse,
  HistoryTimeframe,
  SectorsResponse,
  SectorSnapshot,
  ValidationResponse,
} from "../types";

export const SNAPSHOT_SYNC_INTERVAL_MS = 30_000;
export const SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS = 5_000;

export interface DashboardSnapshot {
  data: SectorsResponse;
  history: HistoryResponse;
  quality: DashboardDataQuality;
  validation: ValidationResponse;
}

export interface DashboardSnapshotLoaders {
  loadHistory: (timeframe: HistoryTimeframe) => Promise<HistoryResponse>;
  loadSectors: () => Promise<SectorsResponse>;
  loadValidation: () => Promise<ValidationResponse>;
}

const defaultLoaders: DashboardSnapshotLoaders = {
  loadHistory,
  loadSectors,
  loadValidation,
};

export async function loadDashboardSnapshot(
  timeframe: HistoryTimeframe,
  loaders: DashboardSnapshotLoaders = defaultLoaders,
): Promise<DashboardSnapshot> {
  const [data, history, validation] = await Promise.all([
    loaders.loadSectors(),
    loaders.loadHistory(timeframe),
    loaders.loadValidation(),
  ]);
  return { data, history, quality: deriveDashboardSnapshotQuality(data, history, validation), validation };
}

export function selectSnapshotSectorCode(
  currentCode: string,
  sectors: SectorSnapshot[],
  preserveSelected: boolean,
) {
  if (preserveSelected && currentCode && sectors.some((sector) => sector.sector_code === currentCode)) {
    return currentCode;
  }
  return sectors[0]?.sector_code ?? "";
}

export function snapshotSyncInterval(status?: string) {
  return status === "refreshing" ? SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS : SNAPSHOT_SYNC_INTERVAL_MS;
}

export function deriveDashboardSnapshotQuality(
  data: SectorsResponse,
  history: HistoryResponse,
  validation: ValidationResponse,
): DashboardDataQuality {
  const base = data.data_quality;
  const layer4Issues: DataQualityIssue[] = [];
  const historyAsOf = latestHistoryDate(history);
  const validationAsOf = validation.coverage.sector_history_days > 0 ? data.as_of : null;
  const lag = maxEndpointLagDays([data.as_of, historyAsOf, validationAsOf]);

  if (history.status === "degraded") {
    layer4Issues.push({
      code: "history_api_degraded",
      message: history.message ?? "History API가 degraded 상태입니다.",
      severity: "blocking",
      source: "/api/history",
    });
  }
  if ((history.coverage?.complete_sector_days ?? history.coverage?.available_sector_days ?? 0) < 60) {
    layer4Issues.push({
      code: "history_coverage_under_60_days",
      message: "Layer 4 replay와 패턴 진단에 필요한 complete sector history가 부족합니다.",
      severity: "warning",
      source: "/api/history",
    });
  }
  if ((validation.coverage.pattern_ready_count ?? 0) === 0) {
    layer4Issues.push({
      code: "no_ready_pattern_diagnostics",
      message: "충분한 표본을 통과한 pattern diagnostics가 아직 없습니다.",
      severity: validation.status === "historical_ready" ? "warning" : "blocking",
      source: "/api/validation",
    });
  }
  if ((validation.coverage.thin_pattern_count ?? 0) > 0) {
    layer4Issues.push({
      code: "thin_pattern_diagnostics",
      message: `${validation.coverage.thin_pattern_count}개 패턴은 thin sample로 분리됩니다.`,
      severity: "info",
      source: "/api/validation",
    });
  }
  if (lag !== null && lag > 1) {
    layer4Issues.push({
      code: "endpoint_as_of_mismatch",
      message: `/api/sectors, /api/history, /api/validation 기준일 차이가 ${lag}일입니다.`,
      severity: "warning",
      source: "dashboard_snapshot",
    });
  }

  const layer4 = {
    as_of: validationAsOf,
    completeness: layerFourCompleteness(history, validation),
    issues: layer4Issues,
    status: qualityStatus(layer4Issues),
  };

  return {
    generated_at: new Date().toISOString(),
    layers: {
      layer1: base?.layers.layer1 ?? fallbackLayerQuality(data.as_of, data.sectors.length > 0),
      layer2: base?.layers.layer2 ?? fallbackLayerQuality(data.as_of, Boolean(data.market_context?.length)),
      layer3: base?.layers.layer3 ?? fallbackLayerQuality(data.as_of, data.sectors.length > 0),
      layer4,
    },
    snapshot_as_of: data.as_of,
  };
}

function fallbackLayerQuality(asOf: string | null, complete: boolean) {
  const issues: DataQualityIssue[] = complete
    ? []
    : [{ code: "quality_metadata_missing", message: "API 품질 메타데이터가 없어 기본 상태로 표시합니다.", severity: "warning" }];
  return {
    as_of: asOf,
    completeness: complete ? 1 : 0,
    issues,
    status: qualityStatus(issues),
  };
}

function layerFourCompleteness(history: HistoryResponse, validation: ValidationResponse) {
  const completeHistoryDays = history.coverage?.complete_sector_days ?? history.coverage?.available_sector_days ?? 0;
  const historyScore = Math.min(1, completeHistoryDays / 90);
  const readyPatterns = validation.coverage.pattern_ready_count ?? 0;
  const totalPatterns = validation.pattern_diagnostics?.length ?? 0;
  const patternScore = totalPatterns ? readyPatterns / totalPatterns : 0;
  return Math.round(((historyScore + patternScore) / 2) * 100) / 100;
}

function qualityStatus(issues: DataQualityIssue[]): DashboardDataQuality["layers"]["layer1"]["status"] {
  if (issues.some((issue) => issue.severity === "blocking")) return "blocked";
  if (issues.some((issue) => issue.code.includes("stale") || issue.code.includes("mismatch"))) return "stale";
  if (issues.some((issue) => issue.severity === "warning")) return "partial";
  return "complete";
}

function latestHistoryDate(history: HistoryResponse) {
  const dates = history.sectors.flatMap((sector) => sector.trail.map((point) => point.date)).filter(Boolean).sort();
  return dates.at(-1) ?? null;
}

function maxEndpointLagDays(dates: Array<string | null | undefined>) {
  const times = dates
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(`${date}T00:00:00Z`).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  return Math.round((times.at(-1)! - times[0]) / 86_400_000);
}
