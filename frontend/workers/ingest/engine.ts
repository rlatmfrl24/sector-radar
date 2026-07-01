import type { MarketContextCard, PriceBar, SectorMetricRow, SeriesRow } from "./contracts";
import { METRIC_THRESHOLDS, METRIC_WINDOWS } from "../../functions/_shared/metricThresholds";
import { buildMarketContextFromSeriesRows } from "./marketContext";
import { BENCHMARK, MARKET, SECTORS } from "./universe";

const RS_WINDOW = METRIC_WINDOWS.rs;
const MOMENTUM_WINDOW = METRIC_WINDOWS.rsMomentum;
const BREADTH_WINDOWS = METRIC_WINDOWS.breadth;
const PARTICIPATION_WINDOW = METRIC_WINDOWS.participation;
const DEFAULT_METRIC_HISTORY_DAYS = METRIC_WINDOWS.metricHistoryDefaultDays;
const MAX_METRIC_HISTORY_DAYS = METRIC_WINDOWS.metricHistoryMaxDays;

type Field = SeriesRow["field"];

interface DailyBar {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface SeriesMap {
  [symbol: string]: DailyBar[];
}

interface ModuleSnapshot {
  state: string;
  transition: string;
  strength: number;
  evidence: Record<string, number | string | null>;
  warnings: string[];
}

export function priceBarsToSeriesRows(
  bars: PriceBar[],
  source: string,
  fetchedAt: string,
): SeriesRow[] {
  const rows: SeriesRow[] = [];
  for (const bar of bars) {
    const symbol = normalizeSymbol(bar.symbol);
    pushField(rows, symbol, bar.date, "open", bar.open, source, fetchedAt);
    pushField(rows, symbol, bar.date, "high", bar.high, source, fetchedAt);
    pushField(rows, symbol, bar.date, "low", bar.low, source, fetchedAt);
    pushField(rows, symbol, bar.date, "close", bar.close, source, fetchedAt);
    pushField(rows, symbol, bar.date, "volume", bar.volume, source, fetchedAt);
  }
  return rows;
}

export interface SectorMetricBuildOptions {
  historyDays?: number;
  holdingCoverage?: {
    date: string | null;
    fresh: number;
    total: number;
  };
  partialHoldingRefresh?: boolean;
  refreshPhase?: string;
}

export function buildSectorMetricRows(
  seriesRows: SeriesRow[],
  computedAt: string,
  options: SectorMetricBuildOptions = {},
): SectorMetricRow[] {
  const series = toSeriesMap(seriesRows);
  const marketContext = buildMarketContextFromSeriesRows(seriesRows, computedAt);
  const latestDate = latestDateOf(series[BENCHMARK] ?? []);

  return latestDate ? buildSectorMetricRowsForDates(series, marketContext, computedAt, [latestDate], options) : [];
}

export function buildSectorMetricHistoryRows(
  seriesRows: SeriesRow[],
  computedAt: string,
  options: SectorMetricBuildOptions = {},
): SectorMetricRow[] {
  const series = toSeriesMap(seriesRows);
  const marketContext = buildMarketContextFromSeriesRows(seriesRows, computedAt);
  const dates = metricSnapshotDates(series[BENCHMARK] ?? [], options.historyDays ?? DEFAULT_METRIC_HISTORY_DAYS);

  return buildSectorMetricRowsForDates(series, marketContext, computedAt, dates, options);
}

function buildSectorMetricRowsForDates(
  series: SeriesMap,
  marketContext: MarketContextCard[],
  computedAt: string,
  dates: string[],
  options: SectorMetricBuildOptions,
): SectorMetricRow[] {
  const rows: SectorMetricRow[] = [];

  for (const snapshotDate of dates) {
    const benchmark = barsThroughDate(series[BENCHMARK] ?? [], snapshotDate);

    for (const sector of SECTORS) {
      const sectorBars = barsThroughDate(series[sector.symbol] ?? [], snapshotDate);
      const latestDate = latestCommonDate([sectorBars, benchmark]) ?? latestDateOf(sectorBars);

      if (latestDate !== snapshotDate) {
        continue;
      }

      const rs = buildRelativeStrength(sectorBars, benchmark);
      const breadth = buildBreadth(sector.representativeHoldings.map((symbol) => barsThroughDate(series[symbol] ?? [], snapshotDate)));
      if (options.partialHoldingRefresh && !breadth.warnings.includes("partial_holding_refresh")) {
        breadth.warnings.push("partial_holding_refresh");
      }
      const participation = buildParticipation(sectorBars);
      const rulebook = buildRulebook({
        sectorName: sector.name,
        rs,
        breadth,
        participation,
      });

      const sourceMetrics = {
        relative_strength: { ...rs.evidence, state: rs.state, strength: rs.strength, transition: rs.transition, warnings: rs.warnings },
        breadth: { ...breadth.evidence, state: breadth.state, strength: breadth.strength, transition: breadth.transition, warnings: breadth.warnings },
        participation: {
          ...participation.evidence,
          state: participation.state,
          strength: participation.strength,
          transition: participation.transition,
          warnings: participation.warnings,
        },
        market_context: marketContext,
      };
      const dataFreshness = {
        latest_price_date: latestDate,
        computed_at: computedAt,
        provider: "yahoo_finance",
        source: "yahoo_finance:chart",
        market_context_latest_date: latestMarketContextDate(marketContext),
        refresh_phase: options.refreshPhase ?? null,
        holding_coverage: options.holdingCoverage ?? null,
      };

      rows.push({
        market: MARKET,
        sector_code: sector.symbol,
        date: latestDate,
        benchmark: BENCHMARK,
        ret_1m: returnOverBars(sectorBars, 21),
        ret_3m: returnOverBars(sectorBars, 63),
        ret_6m: returnOverBars(sectorBars, 126),
        ret_12m: returnOverBars(sectorBars, 252),
        excess_ret_3m: excessReturn(sectorBars, benchmark, 63),
        rs_ratio: numericEvidence(rs, "rs_ratio"),
        rs_momentum: numericEvidence(rs, "rs_momentum"),
        rrg_quadrant: rs.state,
        pct_above_20ma: numericEvidence(breadth, "pct_above_20ma"),
        pct_above_50ma: numericEvidence(breadth, "pct_above_50ma"),
        pct_above_200ma: numericEvidence(breadth, "pct_above_200ma"),
        breadth_state: breadth.state,
        breadth_transition: breadth.transition,
        rvol_20: numericEvidence(participation, "rvol_20"),
        obv_slope_20: numericEvidence(participation, "obv_slope_20"),
        cmf_20: numericEvidence(participation, "cmf_20"),
        participation_state: participation.state,
        participation_transition: participation.transition,
        catalyst_state: null,
        catalyst_transition: null,
        rule_pattern: rulebook.leadPattern,
        direction: rulebook.direction,
        strength: rulebook.strength,
        conviction_label: rulebook.convictionLabel,
        narrative: rulebook.narrative,
        risks_json: JSON.stringify(rulebook.risks),
        invalidation_json: JSON.stringify(rulebook.invalidation),
        source_metrics_json: JSON.stringify(sourceMetrics),
        data_freshness_json: JSON.stringify(dataFreshness),
        validation_status: "unvalidated",
        expose_probability: 0,
        computed_at: computedAt,
      });
    }
  }

  return rows;
}

function metricSnapshotDates(benchmarkBars: DailyBar[], historyDays: number) {
  return benchmarkBars
    .filter((bar) => bar.close !== undefined && isPositive(bar.close))
    .map((bar) => bar.date)
    .slice(-normalizeHistoryDays(historyDays));
}

function normalizeHistoryDays(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_METRIC_HISTORY_DAYS;
  return Math.min(MAX_METRIC_HISTORY_DAYS, Math.max(1, Math.floor(value)));
}

function barsThroughDate(bars: DailyBar[], date: string) {
  return bars.filter((bar) => bar.date <= date);
}

export function shouldSkipRateLimited(nextAllowedAt: string | null | undefined, now: Date): boolean {
  if (!nextAllowedAt) return false;
  const next = new Date(nextAllowedAt);
  return Number.isFinite(next.getTime()) && next > now;
}

function buildRelativeStrength(sectorBars: DailyBar[], benchmarkBars: DailyBar[]): ModuleSnapshot {
  const benchmarkByDate = new Map(benchmarkBars.map((bar) => [bar.date, bar.close]));
  const rsRaw = sectorBars
    .map((bar) => {
      const benchmarkClose = benchmarkByDate.get(bar.date);
      if (!isPositive(bar.close) || !isPositive(benchmarkClose)) return null;
      return { date: bar.date, value: bar.close / benchmarkClose };
    })
    .filter(isDatedValue);
  const ratioSeries = rollingRatio(rsRaw, RS_WINDOW);
  const momentumSeries = rollingRatio(ratioSeries, MOMENTUM_WINDOW);
  const latestRatio = lastValue(ratioSeries);
  const latestMomentum = lastValue(momentumSeries);
  const quadrant = classifyQuadrant(latestRatio, latestMomentum);
  const warnings: string[] = [];

  if (latestRatio === null || latestMomentum === null) {
    warnings.push("insufficient_rs_history");
  }

  return {
    state: quadrant,
    transition: classifyMomentum(latestMomentum),
    strength: strengthFromQuadrant(quadrant),
    evidence: {
      rs_ratio: round(latestRatio),
      rs_momentum: round(latestMomentum),
      rs_window: RS_WINDOW,
      momentum_window: MOMENTUM_WINDOW,
      ...buildMultiWindowRrgEvidence(sectorBars, benchmarkBars),
    },
    warnings,
  };
}

function buildBreadth(holdingSeries: DailyBar[][]): ModuleSnapshot {
  const usable = holdingSeries.filter((bars) => bars.some((bar) => isPositive(bar.close)));
  const pct20 = percentAboveMa(usable, 20);
  const pct50 = percentAboveMa(usable, 50);
  const pct200 = percentAboveMa(usable, 200);
  const advancingRatio = percentAdvancing(usable);
  const warnings: string[] = [];

  if (usable.length === 0) warnings.push("no_representative_holding_prices");
  if (pct200 === null) warnings.push("insufficient_200ma_history");

  const state =
    pct20 === null || pct50 === null
      ? "unknown"
      : pct20 >= METRIC_THRESHOLDS.breadth.healthyPct20 && pct50 >= METRIC_THRESHOLDS.breadth.healthyPct50
        ? "healthy"
        : pct20 <= METRIC_THRESHOLDS.breadth.breakdownPct20 && pct50 <= METRIC_THRESHOLDS.breadth.breakdownPct50
          ? "breakdown"
          : pct20 >= METRIC_THRESHOLDS.breadth.narrowPct20 && pct50 < METRIC_THRESHOLDS.breadth.narrowPct50
            ? "narrow"
            : "mixed";
  const transition =
    advancingRatio === null
      ? "unknown"
      : advancingRatio >= METRIC_THRESHOLDS.breadth.strengtheningAdvancingRatio
        ? "strengthening"
        : advancingRatio <= METRIC_THRESHOLDS.breadth.weakeningAdvancingRatio
          ? "weakening"
          : "stable";

  return {
    state,
    transition,
    strength: state === "healthy" ? 3 : state === "mixed" || state === "narrow" ? 2 : state === "breakdown" ? 1 : 0,
    evidence: {
      pct_above_20ma: round(pct20),
      pct_above_50ma: round(pct50),
      pct_above_200ma: round(pct200),
      advancing_ratio: round(advancingRatio),
      holding_count: usable.length,
    },
    warnings,
  };
}

function buildParticipation(bars: DailyBar[]): ModuleSnapshot {
  const latest = bars.at(-1);
  const volumeWindow = bars.slice(-PARTICIPATION_WINDOW).map((bar) => bar.volume).filter(isFiniteNumber);
  const averageVolume = average(volumeWindow);
  const rvol = isPositive(latest?.volume) && isPositive(averageVolume) ? latest.volume / averageVolume : null;
  const obv = buildObv(bars);
  const obvSlope = obv.length > PARTICIPATION_WINDOW ? (obv.at(-1)! - obv.at(-1 - PARTICIPATION_WINDOW)!) / PARTICIPATION_WINDOW : null;
  const cmf = chaikinMoneyFlow(bars, PARTICIPATION_WINDOW);
  const warnings: string[] = [];

  if (!isPositive(latest?.volume)) warnings.push("latest_volume_missing_or_zero");
  if (rvol === null) warnings.push("insufficient_volume_history");

  const state =
    rvol === null || obvSlope === null || cmf === null
      ? "unknown"
      : rvol >= METRIC_THRESHOLDS.participation.accumulationRvol &&
          obvSlope > 0 &&
          cmf >= METRIC_THRESHOLDS.participation.accumulationCmf
        ? "accumulation"
        : obvSlope < 0 && cmf < METRIC_THRESHOLDS.participation.distributionCmf
          ? "distribution"
          : "neutral";
  const transition =
    rvol === null || cmf === null
      ? "unknown"
      : rvol >= METRIC_THRESHOLDS.participation.strengtheningRvol &&
          cmf > METRIC_THRESHOLDS.participation.strengtheningCmf
        ? "strengthening"
        : cmf < METRIC_THRESHOLDS.participation.weakeningCmf
          ? "weakening"
          : "stable";

  return {
    state,
    transition,
    strength: state === "accumulation" ? 3 : state === "neutral" ? 2 : state === "distribution" ? 1 : 0,
    evidence: {
      rvol_20: round(rvol),
      obv_slope_20: round(obvSlope),
      cmf_20: round(cmf),
      volume_confirmed_breakout: state === "accumulation" ? 1 : 0,
    },
    warnings,
  };
}

function buildRulebook({
  breadth,
  participation,
  rs,
  sectorName,
}: {
  sectorName: string;
  rs: ModuleSnapshot;
  breadth: ModuleSnapshot;
  participation: ModuleSnapshot;
}) {
  const risks: string[] = [];
  const invalidation: string[] = [];
  let leadPattern = "Neutral";
  let direction = "neutral";
  let strength = 35;
  let convictionLabel: "low" | "medium" | "high" = "low";

  if (rs.state === "leading" && breadth.state === "healthy" && participation.state === "accumulation") {
    leadPattern = "Strong Leader";
    direction = "constructive_up";
    strength = 85;
    convictionLabel = "high";
  } else if (rs.state === "improving" && participation.state !== "distribution") {
    leadPattern = "Emerging Leader";
    direction = "watchlist_up";
    strength = 68;
    convictionLabel = "medium";
  } else if (rs.state === "weakening") {
    leadPattern = "Late Leader";
    direction = "risk_rising";
    strength = 52;
    convictionLabel = "medium";
  } else if (rs.state === "leading" && ["narrow", "breakdown"].includes(breadth.state)) {
    leadPattern = "Mega-cap Dependence";
    direction = "caution";
    strength = 48;
    convictionLabel = "low";
  } else if (rs.state === "leading" && participation.state === "distribution") {
    leadPattern = "False Leadership";
    direction = "caution";
    strength = 42;
    convictionLabel = "low";
  } else if (rs.state === "lagging" && (participation.state === "distribution" || breadth.state === "breakdown")) {
    leadPattern = "Breakdown";
    direction = "risk_off_down";
    strength = 20;
    convictionLabel = "low";
  }

  if (rs.transition === "weakening") risks.push("상대강도 모멘텀이 약화되어 리더십 지속 여부를 재확인해야 합니다.");
  if (breadth.state === "narrow") risks.push("대표 구성종목 breadth가 좁아져 일부 대형주 의존 가능성이 있습니다.");
  if (breadth.state === "breakdown") risks.push("섹터 내부 확산이 약해져 리더십 신뢰도가 낮습니다.");
  if (participation.state === "distribution") risks.push("거래량 참여도가 분산 신호를 보여 가격 강세를 확인하지 못합니다.");
  if (risks.length === 0) risks.push("주요 리스크는 아직 rulebook 경고 조건에 걸리지 않았습니다.");

  invalidation.push("RS Ratio가 100 아래로 내려가고 Momentum도 100 아래에서 머물면 리더십 판단을 무효화합니다.");
  invalidation.push("Breadth가 breakdown으로 전환되거나 Participation이 distribution으로 악화되면 강세 해석을 낮춥니다.");

  return {
    leadPattern,
    direction,
    strength,
    convictionLabel,
    narrative: `${sectorName}는 ${leadPattern} 패턴으로 분류됩니다. 이 값은 확률이 아니라 RS, breadth, participation rule alignment입니다.`,
    risks,
    invalidation,
  };
}

function toSeriesMap(rows: SeriesRow[]): SeriesMap {
  const bySymbol = new Map<string, Map<string, DailyBar>>();
  for (const row of rows) {
    if (!isPriceField(row.field)) continue;
    const symbol = normalizeSymbol(row.series_id);
    const byDate = bySymbol.get(symbol) ?? new Map<string, DailyBar>();
    const day = byDate.get(row.date) ?? { date: row.date };
    day[row.field] = row.value;
    byDate.set(row.date, day);
    bySymbol.set(symbol, byDate);
  }

  return Object.fromEntries(
    [...bySymbol.entries()].map(([symbol, dates]) => [
      symbol,
      [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    ]),
  );
}

function pushField(
  rows: SeriesRow[],
  seriesId: string,
  date: string,
  field: Field,
  value: number | null,
  source: string,
  fetchedAt: string,
) {
  if (!isFiniteNumber(value)) return;
  rows.push({ series_id: seriesId, date, field, value, source, fetched_at: fetchedAt });
}

function rollingRatio(values: Array<{ date: string; value: number }>, window: number) {
  return values
    .map((point, index) => {
      const subset = values.slice(Math.max(0, index - window + 1), index + 1).map((item) => item.value);
      const avg = subset.length >= window ? average(subset) : null;
      if (!isPositive(avg)) return null;
      return { date: point.date, value: (100 * point.value) / avg };
    })
    .filter(isDatedValue);
}

function buildMultiWindowRrgEvidence(sectorBars: DailyBar[], benchmarkBars: DailyBar[]) {
  const windows = [
    ["1m", 21],
    ["3m", 63],
    ["6m", 126],
    ["12m", 252],
  ] as const;
  const evidence: Record<string, number | string | null> = {};

  for (const [label, window] of windows) {
    const snapshot = relativeStrengthForWindow(sectorBars, benchmarkBars, window, MOMENTUM_WINDOW);
    evidence[`rrg_${label}_ratio`] = round(snapshot.ratio);
    evidence[`rrg_${label}_momentum`] = round(snapshot.momentum);
    evidence[`rrg_${label}_quadrant`] = classifyQuadrant(snapshot.ratio, snapshot.momentum);
  }

  return evidence;
}

function relativeStrengthForWindow(
  sectorBars: DailyBar[],
  benchmarkBars: DailyBar[],
  rsWindow: number,
  momentumWindow: number,
) {
  const benchmarkByDate = new Map(benchmarkBars.map((bar) => [bar.date, bar.close]));
  const rsRaw = sectorBars
    .map((bar) => {
      const benchmarkClose = benchmarkByDate.get(bar.date);
      if (!isPositive(bar.close) || !isPositive(benchmarkClose)) return null;
      return { date: bar.date, value: bar.close / benchmarkClose };
    })
    .filter(isDatedValue);
  const ratioSeries = rollingRatio(rsRaw, rsWindow);
  const momentumSeries = rollingRatio(ratioSeries, momentumWindow);

  return {
    ratio: lastValue(ratioSeries),
    momentum: lastValue(momentumSeries),
  };
}

function percentAboveMa(seriesList: DailyBar[][], window: (typeof BREADTH_WINDOWS)[number]) {
  let usable = 0;
  let above = 0;
  for (const bars of seriesList) {
    const closes = bars.map((bar) => bar.close).filter(isFiniteNumber);
    if (closes.length < window) continue;
    const latest = closes.at(-1)!;
    const ma = average(closes.slice(-window));
    if (!isPositive(ma)) continue;
    usable += 1;
    if (latest > ma) above += 1;
  }
  return usable === 0 ? null : (100 * above) / usable;
}

function percentAdvancing(seriesList: DailyBar[][]) {
  let usable = 0;
  let advancing = 0;
  for (const bars of seriesList) {
    const closes = bars.map((bar) => bar.close).filter(isFiniteNumber);
    if (closes.length < 2) continue;
    usable += 1;
    if (closes.at(-1)! > closes.at(-2)!) advancing += 1;
  }
  return usable === 0 ? null : (100 * advancing) / usable;
}

function buildObv(bars: DailyBar[]) {
  const values: number[] = [];
  let current = 0;
  for (let index = 0; index < bars.length; index += 1) {
    const close = bars[index]?.close;
    const previousClose = bars[index - 1]?.close;
    const volume = bars[index]?.volume;
    if (index === 0 || !isFiniteNumber(close) || !isFiniteNumber(previousClose) || !isFiniteNumber(volume)) {
      values.push(current);
      continue;
    }
    if (close > previousClose) current += volume;
    if (close < previousClose) current -= volume;
    values.push(current);
  }
  return values;
}

function chaikinMoneyFlow(bars: DailyBar[], window: number) {
  const subset = bars.slice(-window);
  let mfv = 0;
  let volumeSum = 0;
  for (const bar of subset) {
    if (!isFiniteNumber(bar.high) || !isFiniteNumber(bar.low) || !isFiniteNumber(bar.close) || !isFiniteNumber(bar.volume)) {
      continue;
    }
    const range = bar.high - bar.low;
    if (range === 0) continue;
    const multiplier = ((bar.close - bar.low) - (bar.high - bar.close)) / range;
    mfv += multiplier * bar.volume;
    volumeSum += bar.volume;
  }
  return volumeSum === 0 ? null : mfv / volumeSum;
}

function classifyQuadrant(rsRatio: number | null, rsMomentum: number | null) {
  if (rsRatio === null || rsMomentum === null) return "unknown";
  if (rsRatio >= 100 && rsMomentum >= 100) return "leading";
  if (rsRatio < 100 && rsMomentum >= 100) return "improving";
  if (rsRatio >= 100 && rsMomentum < 100) return "weakening";
  return "lagging";
}

function classifyMomentum(rsMomentum: number | null) {
  if (rsMomentum === null) return "unknown";
  if (rsMomentum >= 101) return "strengthening";
  if (rsMomentum < 99) return "weakening";
  return "stable";
}

function strengthFromQuadrant(quadrant: string) {
  if (quadrant === "leading") return 4;
  if (quadrant === "improving") return 3;
  if (quadrant === "weakening") return 2;
  if (quadrant === "lagging") return 1;
  return 0;
}

function latestCommonDate(seriesList: DailyBar[][]) {
  const dates = seriesList.map((bars) => latestDateOf(bars));
  if (dates.some((date) => date === null)) return null;
  return dates.sort()[0] ?? null;
}

function latestDateOf(bars: DailyBar[]) {
  return bars.at(-1)?.date ?? null;
}

function latestMarketContextDate(cards: MarketContextCard[]) {
  const dates = cards
    .map((card) => card.data_freshness.latest_date)
    .filter((date): date is string => typeof date === "string" && date.length > 0);
  return dates.sort().at(-1) ?? null;
}

function returnOverBars(bars: DailyBar[], periods: number) {
  const closes = bars.map((bar) => bar.close).filter(isFiniteNumber);
  if (closes.length <= periods) return null;
  const latest = closes.at(-1)!;
  const prior = closes.at(-1 - periods)!;
  return isPositive(prior) ? latest / prior - 1 : null;
}

function excessReturn(sectorBars: DailyBar[], benchmarkBars: DailyBar[], periods: number) {
  const sectorReturn = returnOverBars(sectorBars, periods);
  const benchmarkReturn = returnOverBars(benchmarkBars, periods);
  return sectorReturn === null || benchmarkReturn === null ? null : sectorReturn - benchmarkReturn;
}

function numericEvidence(module: ModuleSnapshot, key: string) {
  const value = module.evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lastValue(values: Array<{ date: string; value: number }>) {
  return values.at(-1)?.value ?? null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null | undefined, decimals = 4) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDatedValue(value: { date: string; value: number } | null): value is { date: string; value: number } {
  return value !== null;
}

function isPriceField(value: string): value is keyof Omit<DailyBar, "date"> {
  return value === "open" || value === "high" || value === "low" || value === "close" || value === "volume";
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}
