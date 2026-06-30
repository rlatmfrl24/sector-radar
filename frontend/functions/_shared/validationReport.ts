export const LAYER4_VALIDATION_RUN_TYPE = "layer4_validation_audit";
export const LAYER4_VALIDATION_CRON = "Runs after each sector-radar-ingest scheduled refresh.";

export type ValidationStatus = "historical_ready" | "insufficient_history" | "unvalidated";
export type ReplayWindowStatus = "collecting" | "limited" | "ready";
export type PatternDiagnosticStatus = "collecting" | "ready" | "thin_sample";
export type ProbabilityMode = "hidden" | "sample_observed";
export type ReliabilityLabel = "low" | "medium" | "high";

export interface D1QueryDatabase {
  prepare(query: string): D1QueryStatement;
}

export interface D1QueryStatement {
  bind(...values: unknown[]): D1QueryStatement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

export interface ValidationMetricRow {
  benchmark: string;
  date: string;
  market: string;
  rrg_quadrant: string | null;
  rule_pattern: string | null;
  sector_code: string;
  strength: number | null;
}

export interface ValidationCloseRow {
  date: string;
  series_id: string;
  value: number;
}

export interface ValidationContextCoverage {
  market_context_days: number;
  market_context_points: number;
}

export interface ValidationRunLog {
  finished_at: string | null;
  message: string | null;
  started_at: string;
  status: string;
}

export interface PatternDiagnostic {
  evaluated_20d: number;
  evaluated_60d: number;
  fwd_rel_20d_median: number | null;
  fwd_rel_60d_median: number | null;
  leading_after_20d_count: number;
  max_drawdown_20d_median: number | null;
  next_step: string;
  observed_probability_20d: number | null;
  observed_probability_60d: number | null;
  pattern: string;
  positive_20d_count: number;
  positive_60d_count: number;
  reliability_label: ReliabilityLabel;
  reliability_score: number;
  sample_size: number;
  status: PatternDiagnosticStatus;
}

export interface ReplayWindowDiagnostic {
  available_sector_days: number;
  effective_days: number;
  limited_by_data: boolean;
  requested_days: number;
  status: ReplayWindowStatus;
  timeframe: "30D" | "90D" | "180D";
}

export interface LayerFourValidationReport {
  coverage: {
    market_context_days: number;
    market_context_points: number;
    sector_history_days: number;
    sector_snapshots: number;
  };
  expose_probability: boolean;
  limitations: string[];
  pattern_diagnostics: PatternDiagnostic[];
  probability_mode: ProbabilityMode;
  replay_windows: ReplayWindowDiagnostic[];
  schedule: {
    api: string;
    cron: string;
    last_run_at: string | null;
    last_run_status: string | null;
    run_type: string;
  };
  scorecard: {
    pattern_hit_rate: null;
    sample_size: number;
    sector_rrg_ic: null;
  };
  status: ValidationStatus;
}

interface ForwardObservation {
  drawdown20: number | null;
  fwd20: number | null;
  fwd60: number | null;
  futureQuadrant20: string | null;
}

export async function buildLayerFourValidationReport(
  db: D1QueryDatabase,
  options: { benchmark?: string; market?: string } = {},
): Promise<LayerFourValidationReport> {
  const market = options.market ?? "US";
  const benchmark = options.benchmark ?? "SPY";

  try {
    const metrics = await readMetricRows(db, market, benchmark);
    const contextCoverage = await readContextCoverage(db, market);
    const latestRun = await readLatestValidationRun(db);
    const symbols = uniqueStrings([benchmark, ...metrics.map((row) => row.sector_code)]);
    const closes = symbols.length ? await readCloseRows(db, symbols) : [];
    return buildLayerFourValidationReportFromRows(metrics, closes, contextCoverage, latestRun);
  } catch {
    return emptyValidationReport([
      "Validation tables are unavailable or not migrated yet.",
      "Historical diagnostics cannot be built until the D1 validation inputs are available.",
    ]);
  }
}

export function buildLayerFourValidationReportFromRows(
  metrics: ValidationMetricRow[],
  closes: ValidationCloseRow[],
  contextCoverage: ValidationContextCoverage = { market_context_days: 0, market_context_points: 0 },
  latestRun: ValidationRunLog | null = null,
): LayerFourValidationReport {
  const metricDates = uniqueStrings(metrics.map((row) => row.date));
  const sectorHistoryDays = metricDates.length;
  const sectorSnapshots = metrics.length;
  const closesBySeries = closeSeriesById(closes);
  const metricsBySectorDate = new Map(metrics.map((row) => [`${row.sector_code}|${row.date}`, row]));
  const patternBuckets = new Map<string, { observations: ForwardObservation[]; sampleSize: number }>();

  for (const row of metrics) {
    const pattern = row.rule_pattern?.trim() || "Unknown";
    const bucket = patternBuckets.get(pattern) ?? { observations: [], sampleSize: 0 };
    bucket.sampleSize += 1;
    bucket.observations.push(forwardObservation(row, closesBySeries, metricsBySectorDate));
    patternBuckets.set(pattern, bucket);
  }

  const patternDiagnostics = [...patternBuckets.entries()]
    .map(([pattern, bucket]) => patternDiagnostic(pattern, bucket.sampleSize, bucket.observations, sectorHistoryDays))
    .sort((a, b) => b.evaluated_20d - a.evaluated_20d || b.sample_size - a.sample_size || a.pattern.localeCompare(b.pattern));
  const evaluatedSamples = patternDiagnostics.reduce((sum, item) => sum + item.evaluated_20d, 0);
  const status = validationStatus(sectorHistoryDays, evaluatedSamples);
  const exposeProbability = status === "historical_ready" && evaluatedSamples > 0;

  return {
    coverage: {
      market_context_days: contextCoverage.market_context_days,
      market_context_points: contextCoverage.market_context_points,
      sector_history_days: sectorHistoryDays,
      sector_snapshots: sectorSnapshots,
    },
    expose_probability: exposeProbability,
    limitations: validationLimitations(status, evaluatedSamples),
    pattern_diagnostics: patternDiagnostics,
    probability_mode: exposeProbability ? "sample_observed" : "hidden",
    replay_windows: replayWindows(sectorHistoryDays),
    schedule: {
      api: "/api/validation/status",
      cron: LAYER4_VALIDATION_CRON,
      last_run_at: latestRun?.finished_at ?? latestRun?.started_at ?? null,
      last_run_status: latestRun?.status ?? null,
      run_type: LAYER4_VALIDATION_RUN_TYPE,
    },
    scorecard: {
      pattern_hit_rate: null,
      sample_size: evaluatedSamples,
      sector_rrg_ic: null,
    },
    status,
  };
}

export async function readLatestValidationRun(db: D1QueryDatabase): Promise<ValidationRunLog | null> {
  try {
    return await db
      .prepare(
        `
          SELECT started_at, finished_at, status, message
          FROM run_log
          WHERE run_type = ?
          ORDER BY started_at DESC
          LIMIT 1
        `,
      )
      .bind(LAYER4_VALIDATION_RUN_TYPE)
      .first<ValidationRunLog>();
  } catch {
    return null;
  }
}

function emptyValidationReport(limitations: string[]): LayerFourValidationReport {
  return {
    coverage: {
      market_context_days: 0,
      market_context_points: 0,
      sector_history_days: 0,
      sector_snapshots: 0,
    },
    expose_probability: false,
    limitations,
    pattern_diagnostics: [],
    probability_mode: "hidden",
    replay_windows: replayWindows(0),
    schedule: {
      api: "/api/validation/status",
      cron: LAYER4_VALIDATION_CRON,
      last_run_at: null,
      last_run_status: null,
      run_type: LAYER4_VALIDATION_RUN_TYPE,
    },
    scorecard: {
      pattern_hit_rate: null,
      sample_size: 0,
      sector_rrg_ic: null,
    },
    status: "unvalidated",
  };
}

async function readMetricRows(db: D1QueryDatabase, market: string, benchmark: string) {
  const result = await db
    .prepare(
      `
        SELECT market, sector_code, date, benchmark, rule_pattern, rrg_quadrant, strength
        FROM sector_metrics_daily
        WHERE market = ?
          AND benchmark = ?
        ORDER BY date ASC, sector_code ASC
      `,
    )
    .bind(market, benchmark)
    .all<ValidationMetricRow>();
  return result.results ?? [];
}

async function readCloseRows(db: D1QueryDatabase, symbols: string[]) {
  const placeholders = symbols.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
        SELECT series_id, date, value
        FROM series_daily
        WHERE field = 'close'
          AND series_id IN (${placeholders})
        ORDER BY series_id ASC, date ASC
      `,
    )
    .bind(...symbols)
    .all<ValidationCloseRow>();
  return result.results ?? [];
}

async function readContextCoverage(db: D1QueryDatabase, market: string) {
  try {
    const row = await db
      .prepare(
        `
          SELECT COUNT(*) AS market_context_points, COUNT(DISTINCT date) AS market_context_days
          FROM market_context_daily
          WHERE market = ?
        `,
      )
      .bind(market)
      .first<ValidationContextCoverage>();
    return {
      market_context_days: row?.market_context_days ?? 0,
      market_context_points: row?.market_context_points ?? 0,
    };
  } catch {
    return { market_context_days: 0, market_context_points: 0 };
  }
}

function closeSeriesById(rows: ValidationCloseRow[]) {
  const bySeries = new Map<string, ValidationCloseRow[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.value) || row.value <= 0) continue;
    const series = bySeries.get(row.series_id) ?? [];
    series.push(row);
    bySeries.set(row.series_id, series);
  }
  return bySeries;
}

function forwardObservation(
  row: ValidationMetricRow,
  closesBySeries: Map<string, ValidationCloseRow[]>,
  metricsBySectorDate: Map<string, ValidationMetricRow>,
): ForwardObservation {
  const sectorCloses = closesBySeries.get(row.sector_code) ?? [];
  const benchmarkCloses = closesBySeries.get(row.benchmark) ?? [];
  const currentIndex = sectorCloses.findIndex((close) => close.date === row.date);
  const currentSector = currentIndex >= 0 ? sectorCloses[currentIndex] : undefined;
  const currentBenchmark = benchmarkCloses.find((close) => close.date === row.date);

  if (!currentSector || !currentBenchmark) {
    return { drawdown20: null, fwd20: null, fwd60: null, futureQuadrant20: null };
  }

  const sector20 = sectorCloses[currentIndex + 20];
  const sector60 = sectorCloses[currentIndex + 60];
  const benchmark20 = sector20 ? benchmarkCloses.find((close) => close.date === sector20.date) : undefined;
  const benchmark60 = sector60 ? benchmarkCloses.find((close) => close.date === sector60.date) : undefined;
  const futureMetric20 = sector20 ? metricsBySectorDate.get(`${row.sector_code}|${sector20.date}`) : undefined;

  return {
    drawdown20: maxDrawdownFromCurrent(currentSector.value, sectorCloses.slice(currentIndex + 1, currentIndex + 21)),
    fwd20: sector20 && benchmark20 ? forwardRelativeReturn(currentSector, sector20, currentBenchmark, benchmark20) : null,
    fwd60: sector60 && benchmark60 ? forwardRelativeReturn(currentSector, sector60, currentBenchmark, benchmark60) : null,
    futureQuadrant20: futureMetric20?.rrg_quadrant ?? null,
  };
}

function forwardRelativeReturn(
  currentSector: ValidationCloseRow,
  futureSector: ValidationCloseRow,
  currentBenchmark: ValidationCloseRow,
  futureBenchmark: ValidationCloseRow,
) {
  const sectorReturn = (futureSector.value / currentSector.value - 1) * 100;
  const benchmarkReturn = (futureBenchmark.value / currentBenchmark.value - 1) * 100;
  return roundOne(sectorReturn - benchmarkReturn);
}

function maxDrawdownFromCurrent(current: number, futureRows: ValidationCloseRow[]) {
  if (futureRows.length === 0) return null;
  const drawdowns = futureRows.map((row) => (row.value / current - 1) * 100);
  return roundOne(Math.min(...drawdowns));
}

function patternDiagnostic(
  pattern: string,
  sampleSize: number,
  observations: ForwardObservation[],
  historyDays: number,
): PatternDiagnostic {
  const fwd20 = observations.map((item) => item.fwd20).filter(isNumber);
  const fwd60 = observations.map((item) => item.fwd60).filter(isNumber);
  const drawdown20 = observations.map((item) => item.drawdown20).filter(isNumber);
  const leadingAfter20 = observations.filter((item) => item.futureQuadrant20 === "leading").length;
  const status = patternStatus(historyDays, fwd20.length);
  const positive20 = fwd20.filter((value) => value > 0).length;
  const positive60 = fwd60.filter((value) => value > 0).length;
  const reliabilityScore = patternReliabilityScore(historyDays, fwd20.length, fwd60.length);

  return {
    evaluated_20d: fwd20.length,
    evaluated_60d: fwd60.length,
    fwd_rel_20d_median: median(fwd20),
    fwd_rel_60d_median: median(fwd60),
    leading_after_20d_count: leadingAfter20,
    max_drawdown_20d_median: median(drawdown20),
    next_step: patternNextStep(status),
    observed_probability_20d: observedProbability(positive20, fwd20.length),
    observed_probability_60d: observedProbability(positive60, fwd60.length),
    pattern,
    positive_20d_count: positive20,
    positive_60d_count: positive60,
    reliability_label: reliabilityLabel(reliabilityScore),
    reliability_score: reliabilityScore,
    sample_size: sampleSize,
    status,
  };
}

function observedProbability(positiveCount: number, sampleCount: number) {
  if (sampleCount === 0) return null;
  return roundOne((positiveCount / sampleCount) * 100);
}

function patternReliabilityScore(historyDays: number, evaluated20: number, evaluated60: number) {
  const sampleScore = Math.min(1, evaluated20 / 100);
  const historyScore = Math.min(1, historyDays / 252);
  const horizonScore = Math.min(1, evaluated60 / 60);
  return Math.round((sampleScore * 0.55 + historyScore * 0.25 + horizonScore * 0.2) * 100);
}

function reliabilityLabel(score: number): ReliabilityLabel {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function patternStatus(historyDays: number, evaluated20: number): PatternDiagnosticStatus {
  if (historyDays < 60 || evaluated20 === 0) return "collecting";
  if (evaluated20 < 20) return "thin_sample";
  return "ready";
}

function patternNextStep(status: PatternDiagnosticStatus) {
  if (status === "ready") return "Monitor with scheduled audit";
  if (status === "thin_sample") return "Collect more occurrences";
  return "Collect forward labels";
}

function validationStatus(historyDays: number, evaluatedSamples: number): ValidationStatus {
  if (historyDays < 60) return "insufficient_history";
  if (evaluatedSamples > 0) return "historical_ready";
  return "unvalidated";
}

function validationLimitations(status: ValidationStatus, evaluatedSamples: number) {
  const limitations: string[] = [];
  if (status === "insufficient_history") {
    limitations.push("At least 60 sector history days are required before Layer 4 can show diagnostics.");
  }
  if (evaluatedSamples === 0) {
    limitations.push("Forward labels are not available yet for the current history window.");
  }
  return limitations;
}

function replayWindows(availableDays: number): ReplayWindowDiagnostic[] {
  return [
    replayWindow("30D", 30, availableDays),
    replayWindow("90D", 90, availableDays),
    replayWindow("180D", 180, availableDays),
  ];
}

function replayWindow(timeframe: ReplayWindowDiagnostic["timeframe"], requestedDays: number, availableDays: number) {
  const effectiveDays = Math.min(requestedDays, Math.max(0, availableDays));
  return {
    available_sector_days: availableDays,
    effective_days: effectiveDays,
    limited_by_data: effectiveDays < requestedDays,
    requested_days: requestedDays,
    status: effectiveDays >= requestedDays ? "ready" : effectiveDays >= 60 ? "limited" : "collecting",
    timeframe,
  } satisfies ReplayWindowDiagnostic;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return roundOne(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
