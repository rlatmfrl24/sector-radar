interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
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
      next_allowed_at: row?.next_allowed_at ?? undefined,
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
