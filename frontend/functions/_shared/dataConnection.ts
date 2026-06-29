interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
}

interface DataRefreshRow {
  provider: string;
  status: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_allowed_at: string | null;
  latest_price_date: string | null;
  symbol_count: number | null;
  rows_upserted: number | null;
  message: string | null;
}

export async function readDataConnection(
  env: Env,
  options: { message?: string; refreshIntervalMinutes?: number } = {},
) {
  const refreshIntervalMinutes = options.refreshIntervalMinutes ?? 15;
  try {
    const row = await env.DB.prepare("SELECT * FROM data_refresh_status WHERE provider = ?")
      .bind("yahoo_finance")
      .first<DataRefreshRow>();

    return {
      provider: row?.provider ?? "yahoo_finance",
      mode: modeFromRow(row),
      status: row?.status ?? "never_run",
      refresh_interval_minutes: refreshIntervalMinutes,
      last_attempt_at: row?.last_attempt_at ?? undefined,
      last_success_at: row?.last_success_at ?? undefined,
      next_allowed_at: normalizeNextAllowedAt(row, "yahoo_finance") ?? undefined,
      latest_price_date: row?.latest_price_date ?? undefined,
      symbol_count: row?.symbol_count ?? 0,
      rows_upserted: row?.rows_upserted ?? 0,
      manual_refresh_available: false,
      message: options.message ?? row?.message ?? defaultMessage(row),
    };
  } catch {
    return {
      provider: "yahoo_finance",
      mode: "stale",
      status: "never_run",
      refresh_interval_minutes: refreshIntervalMinutes,
      symbol_count: 0,
      rows_upserted: 0,
      manual_refresh_available: false,
      message: "Apply D1 migrations and deploy the scheduled ingest Worker to expose data connection details.",
    };
  }
}

export async function readDataConnections(env: Env) {
  const providers = ["yahoo_finance", "fred", "krx_openapi"];
  try {
    const rows = await env.DB.prepare(
      `SELECT * FROM data_refresh_status WHERE provider IN (?, ?, ?)`,
    )
      .bind(...providers)
      .all<DataRefreshRow>();
    const byProvider = new Map((rows.results ?? []).map((row) => [row.provider, row]));

    return Object.fromEntries(
      providers.map((provider) => [
        provider,
        toDataConnection(byProvider.get(provider) ?? null, provider, provider === "yahoo_finance" ? 15 : provider === "fred" ? 720 : 1440),
      ]),
    );
  } catch {
    return Object.fromEntries(
      providers.map((provider) => [
        provider,
        toDataConnection(null, provider, provider === "yahoo_finance" ? 15 : provider === "fred" ? 720 : 1440, {
          message: "Apply D1 migrations and deploy provider-specific refresh status tables.",
        }),
      ]),
    );
  }
}

function modeFromRow(row: DataRefreshRow | null) {
  if (!row) return "stale";
  if (row.status === "success") return "live";
  if (row.last_success_at) return "stale";
  return "stale";
}

function defaultMessage(row: DataRefreshRow | null) {
  if (!row) return "Cloudflare cron refresh has not run yet.";
  if (row.status === "success") return "Cloudflare cron refresh is updating D1 snapshots.";
  if (row.status === "refreshing") return "Cloudflare cron refresh is currently running.";
  if (row.status === "skipped_rate_limited") return "Refresh skipped because the 15 minute gate is active.";
  if (row.status === "failed") return row.message ?? "Cloudflare cron refresh failed.";
  return "Cloudflare cron owns Yahoo refresh; public manual refresh is disabled.";
}

function toDataConnection(
  row: DataRefreshRow | null,
  provider: string,
  refreshIntervalMinutes: number,
  options: { message?: string } = {},
) {
  return {
    provider: row?.provider ?? provider,
    mode: modeFromRow(row),
    status: row?.status ?? "never_run",
    refresh_interval_minutes: refreshIntervalMinutes,
    last_attempt_at: row?.last_attempt_at ?? undefined,
    last_success_at: row?.last_success_at ?? undefined,
    next_allowed_at: normalizeNextAllowedAt(row, provider) ?? undefined,
    latest_price_date: row?.latest_price_date ?? undefined,
    symbol_count: row?.symbol_count ?? 0,
    rows_upserted: row?.rows_upserted ?? 0,
    manual_refresh_available: false,
    message: options.message ?? row?.message ?? defaultMessage(row),
  };
}

export function normalizeNextAllowedAt(
  row: DataRefreshRow | null,
  provider: string,
  now = new Date(),
): string | null {
  const stored = parseTime(row?.next_allowed_at);
  if (stored && stored > now.getTime()) return row?.next_allowed_at ?? null;
  if (provider === "yahoo_finance") return toIso(nextScheduledQuarterHour(now, isYahooCollectionWindow));
  if (provider === "fred") return toIso(nextScheduledQuarterHour(now, isFredCollectionWindow));
  if (provider === "krx_openapi") return toIso(nextScheduledQuarterHour(now, isKrxCollectionWindow));
  return row?.next_allowed_at ?? null;
}

function isYahooCollectionWindow(date: Date) {
  const clock = zonedClock(date, "America/New_York");
  const isWeekday = clock.weekday >= 1 && clock.weekday <= 5;
  return isWeekday && clock.minute >= 16 * 60 + 20 && clock.minute < 20 * 60;
}

function isFredCollectionWindow(date: Date) {
  const clock = zonedClock(date, "America/New_York");
  return clock.weekday >= 1 && clock.weekday <= 5 && clock.minute >= 16 * 60 + 45 && clock.minute <= 18 * 60;
}

function isKrxCollectionWindow(date: Date) {
  const clock = zonedClock(date, "Asia/Seoul");
  return clock.weekday >= 1 && clock.weekday <= 5 && clock.minute >= 8 * 60 + 20 && clock.minute <= 9 * 60 + 25;
}

function nextScheduledQuarterHour(from: Date, accepts: (candidate: Date) => boolean): Date {
  let candidate = roundUpToQuarterHour(from);
  for (let attempts = 0; attempts < 10 * 24 * 4; attempts += 1) {
    if (accepts(candidate)) return candidate;
    candidate = addMinutes(candidate, 15);
  }
  return roundUpToQuarterHour(addMinutes(from, 24 * 60));
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
    minute: hour * 60 + Number(byType.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(byType.weekday)),
  };
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toIso(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}
