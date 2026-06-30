import type {
  DataRefreshStatusRow,
  MarketDataProvider,
  ProviderFailure,
  ProviderFetchResult,
  RefreshOutcomeStatus,
  RefreshOutcome,
  RefreshStatus,
  RefreshStore,
  SeriesRow,
} from "./contracts";
import { buildSectorMetricHistoryRows, priceBarsToSeriesRows, shouldSkipRateLimited } from "./engine";
import { buildMarketContextFromSeriesRows, marketContextCardsToRows, marketContextSeriesIds } from "./marketContext";
import {
  MARKET,
  allSymbols,
  buildCoreRefreshSymbols,
  buildHoldingRefreshSymbols,
  buildInstrumentRows,
  coreSymbols,
  representativeHoldingSymbols,
} from "./universe";

const SOURCE = "yahoo_finance:chart";
const DEFAULT_REFRESH_INTERVAL_MINUTES = 15;
const DEFAULT_CORE_FETCH_BUDGET = 32;
const DEFAULT_HOLDING_FETCH_BUDGET = 38;
const FIRST_RUN_RANGE = "1y";
const INCREMENTAL_RANGE = "10d";
const LOOKBACK_DAYS = 430;
const RUN_TYPE = "cloudflare_yahoo_refresh";
const MARKET_TIME_ZONE = "America/New_York";
const STALE_REFRESHING_AFTER_MINUTES = 30;
const POST_CLOSE_CORE_START_MINUTE = 16 * 60 + 20;
const POST_CLOSE_CORE_END_MINUTE = 16 * 60 + 45;
const POST_CLOSE_HOLDINGS_END_MINUTE = 20 * 60;
const INTRADAY_CORE_MINUTES = new Set([10 * 60, 12 * 60, 14 * 60, 15 * 60 + 45]);

export interface RefreshOptions {
  coreFetchBudget?: number;
  enableIntradayCoreRefresh?: boolean;
  fetchBudget?: number;
  holdingFetchBudget?: number;
  now?: Date;
  refreshIntervalMinutes?: number;
}

interface RefreshExecutionPlan {
  fetchSymbols: string[];
  phase: "intraday_core" | "post_close_core" | "post_close_holdings";
  marketDate: string;
  message: string;
  requireFetchedCore: boolean;
}

interface RefreshSkipPlan {
  marketDate: string;
  message: string;
  phase: "off_window" | "up_to_date";
  status: "skipped_market_schedule" | "skipped_up_to_date";
}

type RefreshPlan = RefreshExecutionPlan | RefreshSkipPlan;

export async function refreshMarketData(
  store: RefreshStore,
  provider: MarketDataProvider,
  options: RefreshOptions = {},
): Promise<RefreshOutcome> {
  const now = options.now ?? new Date();
  const refreshIntervalMinutes = options.refreshIntervalMinutes ?? DEFAULT_REFRESH_INTERVAL_MINUTES;
  const coreFetchBudget = normalizeCoreFetchBudget(options.coreFetchBudget ?? options.fetchBudget);
  const holdingFetchBudget = normalizeHoldingFetchBudget(options.holdingFetchBudget ?? options.fetchBudget);
  const attemptedAt = toIso(now);
  const existing = await store.readStatus(provider.name);
  const lookbackStart = toDate(addDays(now, -LOOKBACK_DAYS));
  const plan = await buildRefreshPlan(store, now, lookbackStart, {
    coreFetchBudget,
    enableIntradayCoreRefresh: Boolean(options.enableIntradayCoreRefresh),
    holdingFetchBudget,
  });

  if ("status" in plan) {
    const skippedStatus = buildSkippedStatus({
      attemptedAt,
      enableIntradayCoreRefresh: Boolean(options.enableIntradayCoreRefresh),
      existing,
      plan,
      provider: provider.name,
      refreshIntervalMinutes,
      now,
    });
    await store.upsertStatus(skippedStatus);
    await store.upsertRunLog({
      run_id: buildRunId(provider.name, attemptedAt),
      run_type: RUN_TYPE,
      started_at: attemptedAt,
      finished_at: toIso(new Date()),
      status: plan.status,
      message: plan.message,
    });
    return skippedOutcome(plan.status, provider.name, skippedStatus, skippedStatus.message ?? plan.message, refreshIntervalMinutes);
  }

  const staleRefreshing = isStaleRefreshing(existing, now);

  if (shouldSkipRateLimited(existing?.next_allowed_at, now) && !staleRefreshing) {
    const skipped = {
      ...baseStatus(provider.name, existing),
      status: "skipped_rate_limited" as const,
      last_attempt_at: attemptedAt,
      message: "Refresh skipped because the 15 minute upstream gate is still active.",
    };
    await store.upsertStatus(skipped);
    await store.upsertRunLog({
      run_id: buildRunId(provider.name, attemptedAt),
      run_type: RUN_TYPE,
      started_at: attemptedAt,
      finished_at: toIso(new Date()),
      status: skipped.status,
      message: skipped.message,
    });
    return outcome(skipped, refreshIntervalMinutes);
  }

  const symbols = allSymbols();
  const fetchSymbols = plan.fetchSymbols;
  const preFetchRows = await store.readSeries(fetchSymbols, lookbackStart);
  const fetchPlan = buildFetchPlan(fetchSymbols, preFetchRows);
  const runId = buildRunId(provider.name, attemptedAt);
  const staleRecoveryMessage = staleRefreshing
    ? ` Previous refresh from ${existing?.last_attempt_at ?? "unknown"} did not finalize and will be recovered.`
    : "";
  const staleRecoveryFinalMessage = staleRecoveryMessage.trim()
    ? `${staleRecoveryMessage.trim()} `
    : "";
  const startMessage =
    `Cloudflare ${plan.phase} refresh is collecting ${fetchSymbols.length}/${symbols.length} Yahoo symbols for ${plan.marketDate}.` +
    ` ${formatFetchPlan(fetchPlan)}.${staleRecoveryMessage}`;

  await store.upsertRunLog({
    run_id: runId,
    run_type: RUN_TYPE,
    started_at: attemptedAt,
    status: "running",
    message: startMessage,
  });
  await store.upsertStatus({
    ...baseStatus(provider.name, existing),
    status: "refreshing",
    last_attempt_at: attemptedAt,
    next_allowed_at: toIso(
      nextYahooCollectionAt(addMinutes(now, refreshIntervalMinutes), Boolean(options.enableIntradayCoreRefresh)),
    ),
    symbol_count: fetchSymbols.length,
    rows_upserted: 0,
    message: startMessage,
  });

  let finalStatus: DataRefreshStatusRow;
  try {
    await store.upsertInstruments(buildInstrumentRows());
    const fetched = await fetchByPlan(provider, fetchPlan);
    const missingCore = plan.requireFetchedCore
      ? coreSymbols().filter((symbol) => !fetched.bars.some((bar) => bar.symbol.toUpperCase() === symbol))
      : [];

    if (missingCore.length > 0) {
      throw new Error(
        `Core Yahoo symbols failed: ${missingCore.join(", ")}. ${formatFailures(fetched.failures, missingCore)}`,
      );
    }

    const rows = priceBarsToSeriesRows(fetched.bars, SOURCE, attemptedAt);
    const rowsUpserted = await store.upsertSeries(rows);
    const historicalRows = await store.readSeries(uniqueStrings([...symbols, ...marketContextSeriesIds()]), lookbackStart);
    const marketContext = buildMarketContextFromSeriesRows(historicalRows, attemptedAt);
    await store.upsertMarketContext(marketContextCardsToRows(marketContext, MARKET, attemptedAt));
    const latestCoreDate = latestCommonCloseDate(historicalRows, coreSymbols());
    const holdingCoverage = holdingFreshnessCoverage(historicalRows, latestCoreDate);
    const metricRows = buildSectorMetricHistoryRows(historicalRows, attemptedAt, {
      holdingCoverage,
      historyDays: 180,
      partialHoldingRefresh: holdingCoverage.fresh < holdingCoverage.total,
      refreshPhase: plan.phase,
    });

    if (metricRows.length === 0) {
      throw new Error("Refresh collected prices but could not compute sector snapshots.");
    }

    await store.upsertSectorMetrics(metricRows);

    const latestPriceDate = metricRows.map((row) => row.date).sort().at(-1) ?? null;
    const partialMessage = buildSuccessMessage({
      fetchedFailures: fetched.failures,
      fetchPlan,
      fetchSymbols,
      holdingCoverage,
      phase: plan.phase,
      totalSymbols: symbols.length,
    });
    finalStatus = {
      provider: provider.name,
      status: "success",
      last_attempt_at: attemptedAt,
      last_success_at: attemptedAt,
      next_allowed_at: toIso(nextYahooCollectionAt(addMinutes(now, refreshIntervalMinutes), Boolean(options.enableIntradayCoreRefresh))),
      latest_price_date: latestPriceDate,
      symbol_count: fetchSymbols.length,
      rows_upserted: rowsUpserted,
      message: `${staleRecoveryFinalMessage}${partialMessage}`,
    };
  } catch (error) {
    finalStatus = {
      ...baseStatus(provider.name, existing),
      status: "failed",
      last_attempt_at: attemptedAt,
      next_allowed_at: toIso(nextYahooCollectionAt(addMinutes(now, refreshIntervalMinutes), Boolean(options.enableIntradayCoreRefresh))),
      symbol_count: fetchSymbols.length,
      rows_upserted: 0,
      message: `${staleRecoveryFinalMessage}${error instanceof Error ? error.message : "Cloudflare cron refresh failed."}`,
    };
  }

  await store.upsertStatus(finalStatus);
  await store.upsertRunLog({
    run_id: runId,
    run_type: RUN_TYPE,
    started_at: attemptedAt,
    finished_at: toIso(new Date()),
    status: finalStatus.status,
    message: finalStatus.message,
  });
  return outcome(finalStatus, refreshIntervalMinutes);
}

interface FetchPlanItem {
  range: string;
  symbols: string[];
}

interface PlanOptions {
  coreFetchBudget: number;
  enableIntradayCoreRefresh: boolean;
  holdingFetchBudget: number;
}

interface MarketWindow {
  date: string;
  minute: number;
  phase: "intraday_core" | "post_close_core" | "post_close_holdings" | "off_window";
  weekday: number;
}

interface HoldingCoverage {
  date: string | null;
  fresh: number;
  total: number;
}

async function buildRefreshPlan(
  store: RefreshStore,
  now: Date,
  lookbackStart: string,
  options: PlanOptions,
): Promise<RefreshPlan> {
  const window = classifyMarketWindow(now, options.enableIntradayCoreRefresh);
  if (window.phase === "off_window") {
    return {
      marketDate: window.date,
      message:
        `Skipped Yahoo refresh outside optimized US market windows. ` +
        `Current ${MARKET_TIME_ZONE} minute=${window.minute}; cron is reserved for post-close daily snapshots and holding shards.`,
      phase: "off_window",
      status: "skipped_market_schedule",
    };
  }

  const coreRows = await store.readSeries(coreSymbols(), lookbackStart);
  const latestCoreDate = latestCommonCloseDate(coreRows, coreSymbols());
  const coreLooksFresh = latestCoreDate !== null && latestCoreDate >= window.date;

  if (window.phase === "intraday_core" || window.phase === "post_close_core" || !coreLooksFresh) {
    const reason = !coreLooksFresh && window.phase === "post_close_holdings" ? "core catch-up" : window.phase;
    return {
      fetchSymbols: buildCoreRefreshSymbols(options.coreFetchBudget),
      marketDate: window.date,
      message: `Fetch ${reason} symbols for ${window.date}.`,
      phase: window.phase === "intraday_core" ? "intraday_core" : "post_close_core",
      requireFetchedCore: true,
    };
  }

  const missingHoldings = await missingHoldingSymbolsForDate(store, latestCoreDate, options.holdingFetchBudget);
  if (missingHoldings.length === 0) {
    return {
      marketDate: window.date,
      message:
        `Skipped Yahoo refresh because core symbols and representative holdings already have close data for ${latestCoreDate}.`,
      phase: "up_to_date",
      status: "skipped_up_to_date",
    };
  }

  return {
    fetchSymbols: buildHoldingRefreshSymbols(now, options.holdingFetchBudget, missingHoldings),
    marketDate: window.date,
    message: `Fetch representative holding shard for ${latestCoreDate}.`,
    phase: "post_close_holdings",
    requireFetchedCore: false,
  };
}

function classifyMarketWindow(now: Date, enableIntradayCoreRefresh: boolean): MarketWindow {
  const clock = newYorkClock(now);
  const isWeekday = clock.weekday >= 1 && clock.weekday <= 5;
  let phase: MarketWindow["phase"] = "off_window";

  if (isWeekday && enableIntradayCoreRefresh && INTRADAY_CORE_MINUTES.has(clock.minute)) {
    phase = "intraday_core";
  } else if (isWeekday && clock.minute >= POST_CLOSE_CORE_START_MINUTE && clock.minute < POST_CLOSE_CORE_END_MINUTE) {
    phase = "post_close_core";
  } else if (isWeekday && clock.minute >= POST_CLOSE_CORE_END_MINUTE && clock.minute < POST_CLOSE_HOLDINGS_END_MINUTE) {
    phase = "post_close_holdings";
  }

  return {
    date: clock.date,
    minute: clock.minute,
    phase,
    weekday: clock.weekday,
  };
}

function nextYahooCollectionAt(
  from: Date,
  enableIntradayCoreRefresh: boolean,
  options: { skipMarketDate?: string } = {},
): Date {
  return nextScheduledQuarterHour(from, (candidate) => {
    const window = classifyMarketWindow(candidate, enableIntradayCoreRefresh);
    return window.phase !== "off_window" && window.date !== options.skipMarketDate;
  });
}

function nextScheduledQuarterHour(from: Date, accepts: (candidate: Date) => boolean): Date {
  let candidate = roundUpToQuarterHour(from);
  for (let attempts = 0; attempts < 10 * 24 * 4; attempts += 1) {
    if (accepts(candidate)) return candidate;
    candidate = addMinutes(candidate, 15);
  }
  return roundUpToQuarterHour(addDays(from, 1));
}

function roundUpToQuarterHour(date: Date) {
  const rounded = new Date(date);
  rounded.setUTCSeconds(0, 0);
  const remainder = rounded.getUTCMinutes() % 15;
  if (remainder !== 0) {
    rounded.setUTCMinutes(rounded.getUTCMinutes() + (15 - remainder));
  }
  return rounded;
}

function newYorkClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(byType.hour) % 24;
  const minute = hour * 60 + Number(byType.minute);
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    minute,
    weekday: weekdayNumber(String(byType.weekday)),
  };
}

function weekdayNumber(value: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value);
}

async function missingHoldingSymbolsForDate(store: RefreshStore, date: string, budget: number) {
  const holdings = representativeHoldingSymbols();
  const rows = await store.readSeries(holdings, date);
  const fresh = new Set(
    rows
      .filter((row) => row.field === "close" && row.date === date)
      .map((row) => row.series_id.toUpperCase()),
  );
  return holdings.filter((symbol) => !fresh.has(symbol)).slice(0, Math.max(1, budget * 3));
}

function buildFetchPlan(fetchSymbols: string[], rows: SeriesRow[]): FetchPlanItem[] {
  const symbolsWithClose = new Set(
    rows.filter((row) => row.field === "close").map((row) => row.series_id.toUpperCase()),
  );
  const fullRangeSymbols = fetchSymbols.filter((symbol) => !symbolsWithClose.has(symbol.toUpperCase()));
  const incrementalSymbols = fetchSymbols.filter((symbol) => symbolsWithClose.has(symbol.toUpperCase()));
  return [
    { range: INCREMENTAL_RANGE, symbols: incrementalSymbols },
    { range: FIRST_RUN_RANGE, symbols: fullRangeSymbols },
  ].filter((item) => item.symbols.length > 0);
}

async function fetchByPlan(provider: MarketDataProvider, plan: FetchPlanItem[]): Promise<ProviderFetchResult> {
  const results: ProviderFetchResult[] = [];
  for (const item of plan) {
    results.push(await provider.fetchDaily(item.symbols, item.range));
  }
  return {
    bars: results.flatMap((result) => result.bars),
    failures: results.flatMap((result) => result.failures),
  };
}

function formatFetchPlan(plan: FetchPlanItem[]) {
  return plan.map((item) => `${item.symbols.length} ${item.range}`).join(", ");
}

function buildSuccessMessage({
  fetchedFailures,
  fetchPlan,
  fetchSymbols,
  holdingCoverage,
  phase,
  totalSymbols,
}: {
  fetchedFailures: ProviderFailure[];
  fetchPlan: FetchPlanItem[];
  fetchSymbols: string[];
  holdingCoverage: HoldingCoverage;
  phase: RefreshExecutionPlan["phase"];
  totalSymbols: number;
}) {
  const base = `Yahoo ${phase} refresh completed for ${fetchSymbols.length}/${totalSymbols} symbols with ranges ${formatFetchPlan(fetchPlan)}.`;
  const shard =
    holdingCoverage.fresh < holdingCoverage.total
      ? ` Representative holdings coverage ${holdingCoverage.fresh}/${holdingCoverage.total}` +
        `${holdingCoverage.date ? ` for ${holdingCoverage.date}` : ""}; deterministic shard will continue.`
      : ` Representative holdings coverage ${holdingCoverage.fresh}/${holdingCoverage.total}` +
        `${holdingCoverage.date ? ` for ${holdingCoverage.date}` : ""}.`;
  const failures =
    fetchedFailures.length > 0
      ? ` Non-core warnings: ${fetchedFailures.length}. ${formatFailures(fetchedFailures)}`
      : "";
  return `${base}${shard}${failures}`;
}

function isStaleRefreshing(existing: DataRefreshStatusRow | null | undefined, now: Date) {
  if (existing?.status !== "refreshing") return false;
  const lastAttempt = parseTime(existing.last_attempt_at);
  if (lastAttempt && now.getTime() - lastAttempt >= STALE_REFRESHING_AFTER_MINUTES * 60_000) return true;
  if (!existing.next_allowed_at) return true;
  const next = new Date(existing.next_allowed_at);
  return !Number.isFinite(next.getTime()) || next <= now;
}

function buildRunId(provider: string, attemptedAt: string) {
  return `${RUN_TYPE}:${provider}:${attemptedAt}`;
}

function formatFailures(failures: ProviderFailure[], symbols?: string[]) {
  const symbolSet = symbols ? new Set(symbols) : null;
  const scoped = symbolSet ? failures.filter((failure) => symbolSet.has(failure.symbol)) : failures;
  const details = scoped
    .slice(0, 5)
    .map((failure) => {
      const status = failure.status ? ` HTTP ${failure.status}` : "";
      const host = failure.host ? ` via ${failure.host}` : "";
      const body = failure.body_preview ? ` body="${failure.body_preview}"` : "";
      return `${failure.symbol}${host}${status}: ${failure.message}${body}`;
    })
    .join(" | ");
  return details || "No provider failure details were returned.";
}

function latestCommonCloseDate(rows: SeriesRow[], symbols: string[]) {
  const latestBySymbol = new Map<string, string>();
  const expected = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  for (const row of rows) {
    const symbol = row.series_id.toUpperCase();
    if (row.field !== "close" || !expected.has(symbol)) continue;
    const current = latestBySymbol.get(symbol);
    if (!current || row.date > current) latestBySymbol.set(symbol, row.date);
  }
  if (latestBySymbol.size < expected.size) return null;
  return [...latestBySymbol.values()].sort()[0] ?? null;
}

function holdingFreshnessCoverage(rows: SeriesRow[], date: string | null): HoldingCoverage {
  const holdings = representativeHoldingSymbols();
  if (!date) return { date: null, fresh: 0, total: holdings.length };
  const fresh = new Set(
    rows
      .filter((row) => row.field === "close" && row.date === date)
      .map((row) => row.series_id.toUpperCase()),
  );
  return {
    date,
    fresh: holdings.filter((symbol) => fresh.has(symbol)).length,
    total: holdings.length,
  };
}

function normalizeCoreFetchBudget(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CORE_FETCH_BUDGET;
  return Math.min(45, Math.max(coreSymbols().length, Math.floor(value)));
}

function normalizeHoldingFetchBudget(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_HOLDING_FETCH_BUDGET;
  return Math.min(45, Math.max(1, Math.floor(value)));
}

function baseStatus(provider: string, existing: DataRefreshStatusRow | null | undefined): DataRefreshStatusRow {
  return {
    provider,
    status: existing?.status ?? "never_run",
    last_attempt_at: existing?.last_attempt_at ?? null,
    last_success_at: existing?.last_success_at ?? null,
    next_allowed_at: existing?.next_allowed_at ?? null,
    latest_price_date: existing?.latest_price_date ?? null,
    symbol_count: existing?.symbol_count ?? 0,
    rows_upserted: existing?.rows_upserted ?? 0,
    message: existing?.message ?? null,
  };
}

function buildSkippedStatus({
  attemptedAt,
  enableIntradayCoreRefresh,
  existing,
  now,
  plan,
  provider,
  refreshIntervalMinutes,
}: {
  attemptedAt: string;
  enableIntradayCoreRefresh: boolean;
  existing: DataRefreshStatusRow | null | undefined;
  now: Date;
  plan: RefreshSkipPlan;
  provider: string;
  refreshIntervalMinutes: number;
}): DataRefreshStatusRow {
  const recovered = recoverSkippedStatus(provider, existing, plan.message, attemptedAt, now);
  const base = recovered ?? baseStatus(provider, existing);
  const skipMarketDate = plan.phase === "up_to_date" ? plan.marketDate : undefined;
  const nextAllowed = nextYahooCollectionAt(addMinutes(now, refreshIntervalMinutes), enableIntradayCoreRefresh, {
    skipMarketDate,
  });
  const status: RefreshStatus =
    recovered?.status ??
    (base.last_success_at ? "success" : base.status === "failed" ? "failed" : "skipped_rate_limited");

  return {
    ...base,
    status,
    last_attempt_at: attemptedAt,
    next_allowed_at: toIso(nextAllowed),
    rows_upserted: 0,
    message:
      plan.phase === "up_to_date"
        ? `${plan.message} Next scheduled Yahoo collection window is ${toIso(nextAllowed)}.`
        : `${base.message && recovered ? base.message : plan.message} Next scheduled Yahoo collection window is ${toIso(nextAllowed)}.`,
  };
}

function outcome(row: DataRefreshStatusRow, refreshIntervalMinutes: number): RefreshOutcome {
  return {
    status: row.status,
    data_connection: {
      provider: row.provider,
      mode: modeFromStatus(row.status, row.last_success_at),
      status: row.status,
      refresh_interval_minutes: refreshIntervalMinutes,
      last_attempt_at: row.last_attempt_at ?? undefined,
      last_success_at: row.last_success_at ?? undefined,
      next_allowed_at: row.next_allowed_at ?? undefined,
      latest_price_date: row.latest_price_date ?? undefined,
      symbol_count: row.symbol_count,
      rows_upserted: row.rows_upserted,
      manual_refresh_available: false,
      message: row.message ?? undefined,
    },
  };
}

function skippedOutcome(
  status: RefreshOutcomeStatus,
  provider: string,
  existing: DataRefreshStatusRow | null | undefined,
  message: string,
  refreshIntervalMinutes: number,
): RefreshOutcome {
  const connection = outcome(baseStatus(provider, existing), refreshIntervalMinutes).data_connection;
  return {
    status,
    data_connection: {
      ...connection,
      message,
    },
  };
}

function recoverSkippedStatus(
  provider: string,
  existing: DataRefreshStatusRow | null | undefined,
  message: string,
  attemptedAt: string,
  now: Date,
): DataRefreshStatusRow | null {
  if (!isStaleRefreshing(existing, now)) return null;
  const recoveredStatus: RefreshStatus = existing?.last_success_at ? "success" : "failed";
  const recoveryMessage =
    existing?.last_success_at
      ? `${message} Previous refresh from ${existing.last_attempt_at ?? "unknown"} did not finalize; restored last successful snapshot.`
      : `${message} Previous refresh from ${existing?.last_attempt_at ?? "unknown"} did not finalize and no successful snapshot exists.`;
  return {
    ...baseStatus(provider, existing),
    status: recoveredStatus,
    last_attempt_at: attemptedAt,
    rows_upserted: 0,
    message: recoveryMessage,
  };
}

function modeFromStatus(status: RefreshStatus, lastSuccessAt: string | null | undefined) {
  if (status === "success") return "live";
  if (lastSuccessAt) return "stale";
  return "stale";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function toIso(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
