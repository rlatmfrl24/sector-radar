import type {
  DataRefreshStatusRow,
  ProviderSeriesResult,
  RefreshOutcomeStatus,
  RefreshStore,
} from "./contracts";
import { shouldSkipRateLimited } from "./engine";
import {
  buildMarketContextFromSeriesRows,
  marketContextCardsToRows,
  marketContextSeriesIds,
} from "./marketContext";

const MARKET = "US";
const RUN_TYPE = "cloudflare_market_context_refresh";
const CONTEXT_LOOKBACK_DAYS = 430;
const DEFAULT_FRED_INTERVAL_MINUTES = 12 * 60;
const DEFAULT_KRX_INTERVAL_MINUTES = 24 * 60;
const STALE_REFRESHING_AFTER_MINUTES = 30;

interface FredLikeProvider {
  readonly name: "fred" | string;
  fetchDefaultSeries(observationStart: string, fetchedAt: string): Promise<ProviderSeriesResult>;
}

interface KrxLikeProvider {
  readonly name: "krx_openapi" | string;
  fetchMarketContext(date: string, fetchedAt: string): Promise<ProviderSeriesResult>;
}

export interface OfficialRefreshOptions {
  fredIntervalMinutes?: number;
  ignoreSchedule?: boolean;
  krxIntervalMinutes?: number;
  now?: Date;
}

export async function refreshFredMarketContext(
  store: RefreshStore,
  provider: FredLikeProvider,
  options: OfficialRefreshOptions = {},
): Promise<RefreshOutcomeStatus> {
  const now = options.now ?? new Date();
  const attemptedAt = toIso(now);
  const interval = normalizeInterval(options.fredIntervalMinutes, DEFAULT_FRED_INTERVAL_MINUTES);
  const existing = await store.readStatus(provider.name);
  const staleRefreshing = isStaleRefreshing(existing, now);

  if (!options.ignoreSchedule && !isFredWindow(now)) {
    const skipped = scheduledSkipStatus(
      provider.name,
      existing,
      attemptedAt,
      nextFredCollectionAt(now),
      "Skipped FRED outside the post-close polling window.",
    );
    await store.upsertStatus(skipped);
    await writeSkippedRunLog(store, provider.name, attemptedAt, "skipped_market_schedule", skipped.message ?? "");
    return "skipped_market_schedule";
  }

  if (shouldSkipRateLimited(existing?.next_allowed_at, now) && !staleRefreshing) {
    const skipped = statusRow(provider.name, existing, {
      status: "skipped_rate_limited",
      last_attempt_at: attemptedAt,
      message: "FRED refresh skipped because the provider refresh gate is still active.",
    });
    await store.upsertStatus(skipped);
    await writeSkippedRunLog(store, provider.name, attemptedAt, skipped.status, skipped.message ?? "");
    return skipped.status;
  }

  await store.upsertStatus(
    statusRow(provider.name, existing, {
      status: "refreshing",
      last_attempt_at: attemptedAt,
      next_allowed_at: toIso(nextFredCollectionAt(addMinutes(now, interval))),
      message: "FRED market context refresh is running.",
    }),
  );

  const runId = buildRunId(provider.name, attemptedAt);
  await store.upsertRunLog({
    run_id: runId,
    run_type: RUN_TYPE,
    started_at: attemptedAt,
    status: "running",
    message: "FRED official Layer 2 context refresh started.",
  });

  const result = await fetchSeriesSafely(
    provider.name,
    () => provider.fetchDefaultSeries(toDate(addDays(now, -CONTEXT_LOOKBACK_DAYS)), attemptedAt),
  );
  const finalStatus = await finalizeProviderRefresh({
    attemptedAt,
    existing,
    interval,
    provider: provider.name,
    result,
    runId,
    store,
    successPrefix: "FRED official market context refresh completed.",
  });
  return finalStatus.status;
}

export async function refreshKrxMarketContext(
  store: RefreshStore,
  provider: KrxLikeProvider,
  options: OfficialRefreshOptions = {},
): Promise<RefreshOutcomeStatus> {
  const now = options.now ?? new Date();
  const attemptedAt = toIso(now);
  const interval = normalizeInterval(options.krxIntervalMinutes, DEFAULT_KRX_INTERVAL_MINUTES);
  const existing = await store.readStatus(provider.name);
  const staleRefreshing = isStaleRefreshing(existing, now);

  if (!options.ignoreSchedule && !isKrxWindow(now)) {
    const skipped = scheduledSkipStatus(
      provider.name,
      existing,
      attemptedAt,
      nextKrxCollectionAt(now),
      "Skipped KRX outside the KST morning retry window.",
    );
    await store.upsertStatus(skipped);
    await writeSkippedRunLog(store, provider.name, attemptedAt, "skipped_market_schedule", skipped.message ?? "");
    return "skipped_market_schedule";
  }

  if (shouldSkipRateLimited(existing?.next_allowed_at, now) && !staleRefreshing) {
    const skipped = statusRow(provider.name, existing, {
      status: "skipped_rate_limited",
      last_attempt_at: attemptedAt,
      message: "KRX refresh skipped because the provider refresh gate is still active.",
    });
    await store.upsertStatus(skipped);
    await writeSkippedRunLog(store, provider.name, attemptedAt, skipped.status, skipped.message ?? "");
    return skipped.status;
  }

  await store.upsertStatus(
    statusRow(provider.name, existing, {
      status: "refreshing",
      last_attempt_at: attemptedAt,
      next_allowed_at: toIso(nextKrxCollectionAt(addMinutes(now, interval))),
      message: "KRX market context refresh is running.",
    }),
  );

  const runId = buildRunId(provider.name, attemptedAt);
  await store.upsertRunLog({
    run_id: runId,
    run_type: RUN_TYPE,
    started_at: attemptedAt,
    status: "running",
    message: "KRX official Layer 2 context refresh started.",
  });

  const result = await fetchSeriesSafely(
    provider.name,
    () => provider.fetchMarketContext(previousKstBusinessDate(now), attemptedAt),
  );
  const finalStatus = await finalizeProviderRefresh({
    attemptedAt,
    existing,
    interval,
    provider: provider.name,
    result,
    runId,
    store,
    successPrefix: "KRX official market context refresh completed.",
  });
  return finalStatus.status;
}

export async function rebuildMarketContextSnapshot(
  store: RefreshStore,
  computedAt: string,
): Promise<number> {
  const rows = await store.readSeries(marketContextSeriesIds(), toDate(addDays(new Date(computedAt), -CONTEXT_LOOKBACK_DAYS)));
  const cards = buildMarketContextFromSeriesRows(rows, computedAt);
  await store.upsertMarketContext(marketContextCardsToRows(cards, MARKET, computedAt));
  return cards.length;
}

async function finalizeProviderRefresh({
  attemptedAt,
  existing,
  interval,
  provider,
  result,
  runId,
  store,
  successPrefix,
}: {
  attemptedAt: string;
  existing: DataRefreshStatusRow | null | undefined;
  interval: number;
  provider: string;
  result: ProviderSeriesResult;
  runId: string;
  store: RefreshStore;
  successPrefix: string;
}): Promise<DataRefreshStatusRow> {
  const now = new Date(attemptedAt);
  let finalStatus: DataRefreshStatusRow;

  try {
    const rowsUpserted = result.rows.length > 0 ? await store.upsertSeries(result.rows) : 0;
    if (rowsUpserted > 0) {
      await rebuildMarketContextSnapshot(store, attemptedAt);
    }

    const latestPriceDate = result.rows.map((row) => row.date).sort().at(-1) ?? null;
    const failureMessage = formatFailures(result.failures);
    const successful = rowsUpserted > 0;

    finalStatus = {
      provider,
      status: successful ? "success" : "failed",
      last_attempt_at: attemptedAt,
      last_success_at: successful ? attemptedAt : existing?.last_success_at ?? null,
      next_allowed_at: toIso(nextProviderCollectionAt(provider, addMinutes(now, interval))),
      latest_price_date: successful ? latestPriceDate : existing?.latest_price_date ?? null,
      symbol_count: uniqueSeriesCount(result.rows, result.failures),
      rows_upserted: rowsUpserted,
      message:
        successful
          ? `${successPrefix} rows=${rowsUpserted}.${failureMessage ? ` Warnings: ${failureMessage}` : ""}`
          : `Official context refresh failed. ${failureMessage || "No rows were returned."}`,
    };
  } catch (error) {
    finalStatus = {
      provider,
      status: "failed",
      last_attempt_at: attemptedAt,
      last_success_at: existing?.last_success_at ?? null,
      next_allowed_at: toIso(nextProviderCollectionAt(provider, addMinutes(now, interval))),
      latest_price_date: existing?.latest_price_date ?? null,
      symbol_count: uniqueSeriesCount(result.rows, result.failures),
      rows_upserted: 0,
      message: error instanceof Error ? error.message : "Official context refresh failed.",
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

  return finalStatus;
}

async function fetchSeriesSafely(provider: string, fetcher: () => Promise<ProviderSeriesResult>): Promise<ProviderSeriesResult> {
  try {
    return await fetcher();
  } catch (error) {
    return {
      rows: [],
      failures: [
        {
          symbol: provider,
          message: error instanceof Error ? error.message : "Official context provider threw before returning rows.",
        },
      ],
    };
  }
}

function statusRow(
  provider: string,
  existing: DataRefreshStatusRow | null | undefined,
  updates: Partial<DataRefreshStatusRow>,
): DataRefreshStatusRow {
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
    ...updates,
  };
}

async function writeSkippedRunLog(
  store: RefreshStore,
  provider: string,
  attemptedAt: string,
  status: string,
  message: string,
) {
  await store.upsertRunLog({
    run_id: buildRunId(provider, attemptedAt),
    run_type: RUN_TYPE,
    started_at: attemptedAt,
    finished_at: toIso(new Date()),
    status,
    message,
  });
}

function isFredWindow(now: Date) {
  const clock = zonedClock(now, "America/New_York");
  return clock.weekday >= 1 && clock.weekday <= 5 && clock.minute >= 16 * 60 + 45 && clock.minute <= 18 * 60;
}

function isKrxWindow(now: Date) {
  const clock = zonedClock(now, "Asia/Seoul");
  return clock.weekday >= 1 && clock.weekday <= 5 && clock.minute >= 8 * 60 + 20 && clock.minute <= 9 * 60 + 25;
}

function nextProviderCollectionAt(provider: string, from: Date) {
  return provider === "krx_openapi" ? nextKrxCollectionAt(from) : nextFredCollectionAt(from);
}

function nextFredCollectionAt(from: Date) {
  return nextScheduledQuarterHour(from, isFredWindow);
}

function nextKrxCollectionAt(from: Date) {
  return nextScheduledQuarterHour(from, isKrxWindow);
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

function scheduledSkipStatus(
  provider: string,
  existing: DataRefreshStatusRow | null | undefined,
  attemptedAt: string,
  nextAllowedAt: Date,
  message: string,
): DataRefreshStatusRow {
  const status = existing?.last_success_at
    ? "success"
    : existing?.status === "failed"
      ? "failed"
      : "skipped_rate_limited";
  return statusRow(provider, existing, {
    status,
    last_attempt_at: attemptedAt,
    next_allowed_at: toIso(nextAllowedAt),
    rows_upserted: 0,
    message: `${message} Next scheduled provider collection window is ${toIso(nextAllowedAt)}.`,
  });
}

function isStaleRefreshing(existing: DataRefreshStatusRow | null | undefined, now: Date) {
  if (existing?.status !== "refreshing") return false;
  const lastAttempt = parseTime(existing.last_attempt_at);
  return Boolean(lastAttempt && now.getTime() - lastAttempt >= STALE_REFRESHING_AFTER_MINUTES * 60_000);
}

function previousKstBusinessDate(now: Date) {
  let date = addKstCalendarDays(zonedClock(now, "Asia/Seoul").date, -1);
  while ([0, 6].includes(kstWeekday(date))) {
    date = addKstCalendarDays(date, -1);
  }
  return date;
}

function addKstCalendarDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00+09:00`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return zonedClock(parsed, "Asia/Seoul").date;
}

function kstWeekday(date: string) {
  return zonedClock(new Date(`${date}T12:00:00+09:00`), "Asia/Seoul").weekday;
}

function zonedClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(byType.hour) % 24;
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    minute: hour * 60 + Number(byType.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(byType.weekday)),
  };
}

function uniqueSeriesCount(rows: ProviderSeriesResult["rows"], failures: ProviderSeriesResult["failures"]) {
  return new Set([...rows.map((row) => row.series_id), ...failures.map((failure) => failure.symbol)]).size;
}

function formatFailures(failures: ProviderSeriesResult["failures"]) {
  return failures
    .slice(0, 5)
    .map((failure) => {
      const status = failure.status ? ` HTTP ${failure.status}` : "";
      const body = failure.body_preview ? ` body="${failure.body_preview}"` : "";
      return `${failure.symbol}${status}: ${failure.message}${body}`;
    })
    .join(" | ");
}

function buildRunId(provider: string, attemptedAt: string) {
  return `${RUN_TYPE}:${provider}:${attemptedAt}`;
}

function normalizeInterval(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
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
