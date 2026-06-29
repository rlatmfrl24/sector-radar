import {
  resolveLayerOneFlowThresholds,
  type LayerOneFlowThresholds,
} from "./thresholdConfig";

export const LAYER_ONE_SERIES = ["SPY", "QQQ", "RSP", "IWM", "^VIX"] as const;

export interface LayerOneSeriesRow {
  series_id: string;
  date: string;
  field: string;
  value: number;
  source: string;
  fetched_at: string;
}

export interface LayerOneSectorLike {
  sector_code: string;
  quadrant: string;
  modules: {
    breadth: {
      state: string;
      transition: string;
      warnings: string[];
    };
    relative_strength: {
      evidence: Record<string, number | string | null>;
    };
  };
  data_freshness?: Record<string, unknown>;
}

export interface LayerOneFlowSnapshot {
  as_of?: string;
  state: "constructive" | "caution" | "mixed" | "data_insufficient";
  transition: "strengthening" | "weakening" | "stable" | "unknown";
  narrative: string;
  tape: {
    benchmark: "SPY";
    latest_close: number | null;
    latest_date?: string;
    ret_1d: number | null;
    ret_1w: number | null;
    ret_1m: number | null;
    ret_3m: number | null;
    range_52w_position: number | null;
    realized_vol_20: number | null;
  };
  risk: {
    state: "calm" | "elevated" | "unknown";
    transition: "cooling" | "heating" | "stable" | "unknown";
    vix_latest: number | null;
    vix_change_5d: number | null;
    realized_vol_20: number | null;
  };
  breadth_quality: {
    state: "broad" | "narrow" | "mixed" | "unknown";
    transition: "improving" | "weakening" | "stable" | "unknown";
    healthy_sectors: number;
    weak_sectors: number;
    total_sectors: number;
    rsp_vs_spy_1m: number | null;
    iwm_vs_spy_1m: number | null;
    qqq_vs_spy_1m: number | null;
    holding_coverage_fresh: number | null;
    holding_coverage_total: number | null;
  };
  evidence: Record<string, number | string | null>;
  warnings: string[];
  data_freshness: {
    provider: "yahoo_finance";
    source_class: "proxy";
    series: Array<{
      series_id: string;
      latest_date?: string;
      source?: string;
      fetched_at?: string;
    }>;
  };
}

interface DailyClose {
  close?: number;
  date: string;
  fetched_at?: string;
  source?: string;
}

export function buildLayerOneFlowSnapshot({
  asOf,
  rows,
  sectors,
  thresholds: thresholdOverrides,
}: {
  asOf: string | null;
  rows: LayerOneSeriesRow[];
  sectors: LayerOneSectorLike[];
  thresholds?: Partial<LayerOneFlowThresholds>;
}): LayerOneFlowSnapshot {
  const thresholds = resolveLayerOneFlowThresholds(thresholdOverrides);
  const bySymbol = closeSeriesBySymbol(rows);
  const spy = bySymbol.get("SPY") ?? [];
  const qqq = bySymbol.get("QQQ") ?? [];
  const rsp = bySymbol.get("RSP") ?? [];
  const iwm = bySymbol.get("IWM") ?? [];
  const vix = bySymbol.get("^VIX") ?? [];
  const warnings: string[] = [];

  if (spy.length === 0) warnings.push("benchmark_tape_unavailable");
  if (rsp.length === 0) warnings.push("rsp_equal_weight_proxy_unavailable");
  if (iwm.length === 0) warnings.push("iwm_smallcap_proxy_unavailable");
  if (vix.length === 0) warnings.push("vix_proxy_unavailable");

  const ret1d = returnOverBars(spy, 1);
  const ret1w = returnOverBars(spy, 5);
  const ret1m = returnOverBars(spy, 21);
  const ret3m = returnOverBars(spy, 63);
  const range52w = rangePosition(spy, 252);
  const realizedVol20 = realizedVolatility(spy, 20);
  const vixLatest = latestClose(vix);
  const vixChange5d = pointChange(vix, 5);
  const sectorBreadth = sectorBreadthProfile(sectors);
  const holdingCoverage = latestHoldingCoverage(sectors);
  const rspVsSpy = relativeReturn(rsp, spy, 21);
  const iwmVsSpy = relativeReturn(iwm, spy, 21);
  const qqqVsSpy = relativeReturn(qqq, spy, 21);
  const breadthState = classifyBreadthQuality(sectorBreadth.healthy, sectorBreadth.weak, sectorBreadth.total, rspVsSpy, thresholds);
  const riskState = classifyRisk(vixLatest, thresholds);
  const transition = classifyFlowTransition(ret1d, ret1m, vixChange5d, thresholds);
  const state = classifyFlowState({
    breadthRatio: sectorBreadth.total ? sectorBreadth.healthy / sectorBreadth.total : null,
    range52w,
    ret1m,
    riskState,
    spyAvailable: spy.length > 0,
    thresholds,
  });
  const narrative = buildNarrative({
    breadthState,
    state,
    transition,
    vixLatest,
  });

  return {
    as_of: asOf ?? undefined,
    state,
    transition,
    narrative,
    tape: {
      benchmark: "SPY",
      latest_close: round(latestClose(spy), 2),
      latest_date: latestDate(spy) ?? undefined,
      ret_1d: round(ret1d),
      ret_1w: round(ret1w),
      ret_1m: round(ret1m),
      ret_3m: round(ret3m),
      range_52w_position: round(range52w, 2),
      realized_vol_20: round(realizedVol20, 2),
    },
    risk: {
      state: riskState,
      transition: classifyRiskTransition(vixChange5d, thresholds),
      vix_latest: round(vixLatest, 2),
      vix_change_5d: round(vixChange5d, 2),
      realized_vol_20: round(realizedVol20, 2),
    },
    breadth_quality: {
      state: breadthState,
      transition: classifyBreadthTransition(sectorBreadth, rspVsSpy),
      healthy_sectors: sectorBreadth.healthy,
      weak_sectors: sectorBreadth.weak,
      total_sectors: sectorBreadth.total,
      rsp_vs_spy_1m: round(rspVsSpy),
      iwm_vs_spy_1m: round(iwmVsSpy),
      qqq_vs_spy_1m: round(qqqVsSpy),
      holding_coverage_fresh: holdingCoverage.fresh,
      holding_coverage_total: holdingCoverage.total,
    },
    evidence: {
      benchmark: "SPY",
      spy_ret_1m: round(ret1m),
      spy_range_52w_position: round(range52w, 2),
      vix_latest: round(vixLatest, 2),
      rsp_vs_spy_1m: round(rspVsSpy),
      iwm_vs_spy_1m: round(iwmVsSpy),
      qqq_vs_spy_1m: round(qqqVsSpy),
      healthy_sector_count: sectorBreadth.healthy,
      weak_sector_count: sectorBreadth.weak,
      holding_coverage:
        holdingCoverage.fresh === null || holdingCoverage.total === null
          ? null
          : `${holdingCoverage.fresh}/${holdingCoverage.total}`,
    },
    warnings,
    data_freshness: {
      provider: "yahoo_finance",
      source_class: "proxy",
      series: LAYER_ONE_SERIES.map((symbol) => {
        const series = bySymbol.get(symbol) ?? [];
        const latest = series.at(-1);
        return {
          series_id: symbol,
          latest_date: latest?.date,
          source: latest?.source,
          fetched_at: latest?.fetched_at,
        };
      }),
    },
  };
}

function closeSeriesBySymbol(rows: LayerOneSeriesRow[]) {
  const bySymbol = new Map<string, DailyClose[]>();
  for (const row of rows) {
    if (row.field !== "close" || !isFiniteNumber(row.value)) continue;
    const symbol = normalizeSymbol(row.series_id);
    const series = bySymbol.get(symbol) ?? [];
    series.push({
      close: row.value,
      date: row.date,
      fetched_at: row.fetched_at,
      source: row.source,
    });
    bySymbol.set(symbol, series);
  }

  for (const [symbol, series] of bySymbol) {
    bySymbol.set(symbol, series.sort((a, b) => a.date.localeCompare(b.date)));
  }

  return bySymbol;
}

function classifyFlowState({
  breadthRatio,
  range52w,
  ret1m,
  riskState,
  spyAvailable,
  thresholds,
}: {
  breadthRatio: number | null;
  range52w: number | null;
  ret1m: number | null;
  riskState: LayerOneFlowSnapshot["risk"]["state"];
  spyAvailable: boolean;
  thresholds: LayerOneFlowThresholds;
}): LayerOneFlowSnapshot["state"] {
  if (!spyAvailable) return "data_insufficient";
  const riskPressure = riskState === "elevated" || (ret1m !== null && ret1m <= thresholds.cautionReturn1m);
  if (riskPressure && breadthRatio !== null && breadthRatio < thresholds.healthyBreadthRatio) {
    return "caution";
  }

  const constructiveSignals = [
    ret1m !== null && ret1m > 0,
    range52w !== null && range52w >= thresholds.constructiveRange52w,
    breadthRatio !== null && breadthRatio >= thresholds.healthyBreadthRatio,
    riskState !== "elevated",
  ].filter(Boolean).length;

  return constructiveSignals >= 3 ? "constructive" : "mixed";
}

function classifyFlowTransition(
  ret1d: number | null,
  ret1m: number | null,
  vixChange5d: number | null,
  thresholds: LayerOneFlowThresholds,
): LayerOneFlowSnapshot["transition"] {
  if (ret1d === null || ret1m === null) return "unknown";
  if (ret1d > 0 && ret1m > 0 && (vixChange5d === null || vixChange5d <= 0)) return "strengthening";
  if (ret1d < 0 && (ret1m < 0 || (vixChange5d ?? 0) > thresholds.weakeningVixChange5d)) {
    return "weakening";
  }
  return "stable";
}

function classifyRisk(vixLatest: number | null, thresholds: LayerOneFlowThresholds): LayerOneFlowSnapshot["risk"]["state"] {
  if (vixLatest === null) return "unknown";
  return vixLatest >= thresholds.elevatedVix ? "elevated" : "calm";
}

function classifyRiskTransition(
  vixChange5d: number | null,
  thresholds: LayerOneFlowThresholds,
): LayerOneFlowSnapshot["risk"]["transition"] {
  if (vixChange5d === null) return "unknown";
  if (vixChange5d > thresholds.weakeningVixChange5d) return "heating";
  if (vixChange5d < -thresholds.weakeningVixChange5d) return "cooling";
  return "stable";
}

function classifyBreadthQuality(
  healthy: number,
  weak: number,
  total: number,
  rspVsSpy: number | null,
  thresholds: LayerOneFlowThresholds,
): LayerOneFlowSnapshot["breadth_quality"]["state"] {
  if (total === 0) return "unknown";
  const healthyRatio = healthy / total;
  const weakRatio = weak / total;
  if (healthyRatio >= thresholds.healthyBreadthRatio && (rspVsSpy ?? 0) >= -0.01) return "broad";
  if (weakRatio >= thresholds.healthyBreadthRatio || (rspVsSpy !== null && rspVsSpy < -0.02)) return "narrow";
  return "mixed";
}

function classifyBreadthTransition(
  profile: { healthy: number; total: number; weak: number },
  rspVsSpy: number | null,
): LayerOneFlowSnapshot["breadth_quality"]["transition"] {
  if (profile.total === 0) return "unknown";
  if (profile.healthy > profile.weak && (rspVsSpy ?? 0) >= 0) return "improving";
  if (profile.weak >= profile.healthy || (rspVsSpy !== null && rspVsSpy < -0.02)) return "weakening";
  return "stable";
}

function buildNarrative({
  breadthState,
  state,
  transition,
  vixLatest,
}: {
  breadthState: LayerOneFlowSnapshot["breadth_quality"]["state"];
  state: LayerOneFlowSnapshot["state"];
  transition: LayerOneFlowSnapshot["transition"];
  vixLatest: number | null;
}) {
  if (state === "data_insufficient") {
    return "SPY 기준 tape 데이터가 부족해 Layer 1 흐름 판단을 보류합니다.";
  }
  const stateText =
    state === "constructive" ? "시장 tape는 우호적" : state === "caution" ? "시장 tape는 방어 확인이 필요" : "시장 tape는 혼조";
  const breadthText =
    breadthState === "broad" ? "breadth가 넓게 받쳐줍니다" : breadthState === "narrow" ? "breadth가 좁아져 확인이 필요합니다" : "breadth는 중립적입니다";
  const vixText = vixLatest === null ? "VIX proxy는 아직 비어 있습니다" : `VIX ${vixLatest.toFixed(1)} 기준으로 변동성 상태를 함께 봅니다`;
  return `${stateText}이고 ${breadthText}. ${vixText}. 전환은 ${transition}으로 분리해 표시합니다.`;
}

function sectorBreadthProfile(sectors: LayerOneSectorLike[]) {
  return sectors.reduce(
    (counts, sector) => {
      counts.total += 1;
      if (["healthy", "broad_strength"].includes(sector.modules.breadth.state)) counts.healthy += 1;
      if (["narrow", "breakdown"].includes(sector.modules.breadth.state)) counts.weak += 1;
      return counts;
    },
    { healthy: 0, total: 0, weak: 0 },
  );
}

function latestHoldingCoverage(sectors: LayerOneSectorLike[]) {
  for (const sector of sectors) {
    const coverage = objectValue(sector.data_freshness?.holding_coverage);
    const fresh = numberOrNull(coverage.fresh);
    const total = numberOrNull(coverage.total);
    if (fresh !== null || total !== null) {
      return { fresh, total };
    }
  }
  return { fresh: null, total: null };
}

function relativeReturn(target: DailyClose[], benchmark: DailyClose[], periods: number) {
  const targetReturn = returnOverBars(target, periods);
  const benchmarkReturn = returnOverBars(benchmark, periods);
  return targetReturn === null || benchmarkReturn === null ? null : targetReturn - benchmarkReturn;
}

function returnOverBars(series: DailyClose[], periods: number) {
  const closes = series.map((point) => point.close).filter(isFiniteNumber);
  if (closes.length <= periods) return null;
  const latest = closes.at(-1)!;
  const prior = closes.at(-1 - periods)!;
  return prior > 0 ? latest / prior - 1 : null;
}

function pointChange(series: DailyClose[], periods: number) {
  const closes = series.map((point) => point.close).filter(isFiniteNumber);
  if (closes.length <= periods) return null;
  return closes.at(-1)! - closes.at(-1 - periods)!;
}

function rangePosition(series: DailyClose[], window: number) {
  const closes = series.map((point) => point.close).filter(isFiniteNumber).slice(-window);
  if (closes.length < Math.min(60, window)) return null;
  const latest = closes.at(-1)!;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  return max === min ? 50 : ((latest - min) / (max - min)) * 100;
}

function realizedVolatility(series: DailyClose[], window: number) {
  const closes = series.map((point) => point.close).filter(isFiniteNumber);
  if (closes.length <= window) return null;
  const returns = closes.slice(-window - 1).slice(1).map((close, index) => {
    const prior = closes.at(-window - 1 + index);
    return prior && prior > 0 ? Math.log(close / prior) : null;
  }).filter(isFiniteNumber);
  if (returns.length < window) return null;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function latestClose(series: DailyClose[]) {
  return numberOrNull(series.at(-1)?.close);
}

function latestDate(series: DailyClose[]) {
  return series.at(-1)?.date ?? null;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numberOrNull(value: unknown) {
  return isFiniteNumber(value) ? value : null;
}

function round(value: number | null | undefined, decimals = 4) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}
