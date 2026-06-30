import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SectorMetricRow, SeriesRow } from "../workers/ingest/contracts";
import { buildSectorMetricHistoryRows } from "../workers/ingest/engine";

const DATABASE = "sector-radar";
const CONFIG = "wrangler.jsonc";
const HISTORY_DAYS = Number(process.env.SECTOR_HISTORY_BACKFILL_DAYS ?? 180);
const SQL_CHUNK_SIZE = 10;
const WRANGLER_BIN = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");

const columns: Array<keyof SectorMetricRow> = [
  "market",
  "sector_code",
  "date",
  "benchmark",
  "ret_1m",
  "ret_3m",
  "ret_6m",
  "ret_12m",
  "excess_ret_3m",
  "rs_ratio",
  "rs_momentum",
  "rrg_quadrant",
  "pct_above_20ma",
  "pct_above_50ma",
  "pct_above_200ma",
  "breadth_state",
  "breadth_transition",
  "rvol_20",
  "obv_slope_20",
  "cmf_20",
  "participation_state",
  "participation_transition",
  "catalyst_state",
  "catalyst_transition",
  "rule_pattern",
  "direction",
  "strength",
  "conviction_label",
  "narrative",
  "risks_json",
  "invalidation_json",
  "source_metrics_json",
  "data_freshness_json",
  "validation_status",
  "expose_probability",
  "computed_at",
];

const updateColumns = columns.filter((column) => !["market", "sector_code", "date", "benchmark"].includes(column));

main();

function main() {
  const computedAt = toIso(new Date());
  const rows = readRemoteSeriesRows();
  const metrics = buildSectorMetricHistoryRows(rows, computedAt, { historyDays: HISTORY_DAYS });

  if (metrics.length === 0) {
    throw new Error("No sector metric rows were generated from remote series_daily.");
  }

  const tmp = mkdtempSync(join(tmpdir(), "sector-radar-backfill-"));
  const sqlPath = join(tmp, "sector-history-backfill.sql");

  try {
    writeFileSync(sqlPath, buildUpsertSql(metrics), "utf8");
    runWrangler(["d1", "execute", DATABASE, "--remote", "--config", CONFIG, "--file", sqlPath], 100 * 1024 * 1024);
  } finally {
    rmSync(tmp, { force: true, recursive: true });
  }

  const dates = [...new Set(metrics.map((row) => row.date))].sort();
  console.log(
    JSON.stringify({
      event: "sector_history_backfill",
      first_date: dates[0],
      last_date: dates.at(-1),
      rows: metrics.length,
      sector_days: dates.length,
    }),
  );
}

function readRemoteSeriesRows(): SeriesRow[] {
  const sql = `
    SELECT series_id, date, field, value, source, fetched_at
    FROM series_daily
    WHERE field IN ('open', 'high', 'low', 'close', 'volume', 'value')
      AND date >= date((SELECT MAX(date) FROM series_daily WHERE series_id = 'SPY' AND field = 'close'), '-430 day')
    ORDER BY series_id, date, field
  `;
  const output = runWrangler(
    ["d1", "execute", DATABASE, "--remote", "--config", CONFIG, "--json", "--command", compactSql(sql)],
    120 * 1024 * 1024,
  );
  const parsed = parseWranglerJson<Array<{ results?: SeriesRow[]; success?: boolean }>>(output);
  const result = parsed[0];
  if (!result?.success) {
    throw new Error("Remote D1 series_daily query failed.");
  }
  return result.results ?? [];
}

function buildUpsertSql(rows: SectorMetricRow[]) {
  const statements: string[] = [];
  for (let index = 0; index < rows.length; index += SQL_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + SQL_CHUNK_SIZE);
    statements.push(
      [
        `INSERT INTO sector_metrics_daily (${columns.join(", ")}) VALUES`,
        chunk.map((row) => `(${columns.map((column) => sqlValue(row[column])).join(", ")})`).join(",\n"),
        `ON CONFLICT(market, sector_code, date, benchmark) DO UPDATE SET`,
        updateColumns.map((column) => `${column} = excluded.${column}`).join(", "),
        ";",
      ].join("\n"),
    );
  }
  return statements.join("\n\n");
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runWrangler(args: string[], maxBuffer: number) {
  return execFileSync(process.execPath, [WRANGLER_BIN, ...args], {
    encoding: "utf8",
    maxBuffer,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function parseWranglerJson<T>(output: string): T {
  const lines = output.split(/\r?\n/);
  const jsonStart = lines.findIndex((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("[") || trimmed.startsWith("{");
  });
  if (jsonStart < 0) {
    throw new Error(`Wrangler did not return JSON output. Output preview: ${output.slice(0, 200)}`);
  }
  return JSON.parse(lines.slice(jsonStart).join("\n")) as T;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function toIso(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}
