import type {
  DataRefreshStatusRow,
  MarketDataProvider,
  ProviderFailure,
  ProviderFetchResult,
  RefreshOutcome,
  RefreshStatus,
  RefreshStore,
  SeriesRow,
} from "./contracts";
import { buildSectorMetricRows, priceBarsToSeriesRows, shouldSkipRateLimited } from "./engine";
import { allSymbols, buildFetchSymbols, buildInstrumentRows, coreSymbols, hasPartialHoldingRefresh } from "./universe";

const SOURCE = "yahoo_finance:chart";
const DEFAULT_REFRESH_INTERVAL_MINUTES = 15;
const DEFAULT_FETCH_BUDGET = 38;
const FIRST_RUN_RANGE = "1y";
const INCREMENTAL_RANGE = "10d";
const LOOKBACK_DAYS = 430;
const RUN_TYPE = "cloudflare_yahoo_refresh";

export interface RefreshOptions {
  fetchBudget?: number;
  now?: Date;
  refreshIntervalMinutes?: number;
}

export async function refreshMarketData(
  store: RefreshStore,
  provider: MarketDataProvider,
  options: RefreshOptions = {},
): Promise<RefreshOutcome> {
  const now = options.now ?? new Date();
  const refreshIntervalMinutes = options.refreshIntervalMinutes ?? DEFAULT_REFRESH_INTERVAL_MINUTES;
  const fetchBudget = normalizeFetchBudget(options.fetchBudget);
  const attemptedAt = toIso(now);
  const existing = await store.readStatus(provider.name);

  if (shouldSkipRateLimited(existing?.next_allowed_at, now)) {
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
  const fetchSymbols = buildFetchSymbols(now, fetchBudget);
  const lookbackStart = toDate(addDays(now, -LOOKBACK_DAYS));
  const preFetchRows = await store.readSeries(fetchSymbols, lookbackStart);
  const fetchPlan = buildFetchPlan(fetchSymbols, preFetchRows);
  const partialHoldingRefresh = hasPartialHoldingRefresh(fetchSymbols);
  const runId = buildRunId(provider.name, attemptedAt);
  const staleRecoveryMessage = isStaleRefreshing(existing, now)
    ? ` Previous refresh from ${existing?.last_attempt_at ?? "unknown"} did not finalize and will be recovered.`
    : "";
  const staleRecoveryFinalMessage = staleRecoveryMessage.trim()
    ? `${staleRecoveryMessage.trim()} `
    : "";
  const startMessage =
    `Cloudflare cron refresh is collecting ${fetchSymbols.length}/${symbols.length} Yahoo symbols.` +
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
    next_allowed_at: toIso(addMinutes(now, refreshIntervalMinutes)),
    symbol_count: fetchSymbols.length,
    rows_upserted: 0,
    message: startMessage,
  });

  let finalStatus: DataRefreshStatusRow;
  try {
    await store.upsertInstruments(buildInstrumentRows());
    const fetched = await fetchByPlan(provider, fetchPlan);
    const missingCore = coreSymbols().filter(
      (symbol) => !fetched.bars.some((bar) => bar.symbol.toUpperCase() === symbol),
    );

    if (missingCore.length > 0) {
      throw new Error(
        `Core Yahoo symbols failed: ${missingCore.join(", ")}. ${formatFailures(fetched.failures, missingCore)}`,
      );
    }

    const rows = priceBarsToSeriesRows(fetched.bars, SOURCE, attemptedAt);
    const rowsUpserted = await store.upsertSeries(rows);
    const historicalRows = await store.readSeries(symbols, lookbackStart);
    const metricRows = buildSectorMetricRows(historicalRows, attemptedAt, {
      partialHoldingRefresh,
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
      partialHoldingRefresh,
      totalSymbols: symbols.length,
    });
    finalStatus = {
      provider: provider.name,
      status: "success",
      last_attempt_at: attemptedAt,
      last_success_at: attemptedAt,
      next_allowed_at: toIso(addMinutes(now, refreshIntervalMinutes)),
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
      next_allowed_at: toIso(addMinutes(now, refreshIntervalMinutes)),
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
  partialHoldingRefresh,
  totalSymbols,
}: {
  fetchedFailures: ProviderFailure[];
  fetchPlan: FetchPlanItem[];
  fetchSymbols: string[];
  partialHoldingRefresh: boolean;
  totalSymbols: number;
}) {
  const base = `Yahoo refresh completed for ${fetchSymbols.length}/${totalSymbols} symbols with ranges ${formatFetchPlan(fetchPlan)}.`;
  const shard = partialHoldingRefresh ? " Representative holdings are being refreshed by deterministic shard." : "";
  const failures =
    fetchedFailures.length > 0
      ? ` Non-core warnings: ${fetchedFailures.length}. ${formatFailures(fetchedFailures)}`
      : "";
  return `${base}${shard}${failures}`;
}

function isStaleRefreshing(existing: DataRefreshStatusRow | null | undefined, now: Date) {
  if (existing?.status !== "refreshing") return false;
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

function normalizeFetchBudget(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FETCH_BUDGET;
  return Math.min(45, Math.max(coreSymbols().length, Math.floor(value)));
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
