interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
}

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

interface SectorHistoryRow {
  sector_code: string;
  date: string;
  rs_ratio: number | null;
  rs_momentum: number | null;
  rrg_quadrant: string | null;
  strength: number | null;
}

interface ContextHistoryRow {
  context_code: string;
  date: string;
  state: string | null;
  transition: string | null;
  source_class: string | null;
  data_freshness_json: string | null;
}

interface HistoryCoverageRow {
  days: number | null;
}

interface HistoryCompleteness {
  complete_sector_days: number;
  max_sector_days: number;
  min_sector_days: number;
  missing_sector_codes: string[];
  sector_count: number;
}

const ACTIVE_MARKET_CONTEXT_CODES = ["S01", "S02", "S03", "S05"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const market = url.searchParams.get("market") ?? "US";
  const timeframe = boundedTimeframe(url.searchParams.get("timeframe"));
  const limit = boundedLimit(url.searchParams.get("limit"), timeframe);

  try {
    const [sectorRows, contextRows, coverageRows] = await Promise.all([
      env.DB.prepare(
        `
          WITH selected_dates AS (
            SELECT DISTINCT date
            FROM sector_metrics_daily
            WHERE market = ?
            ORDER BY date DESC
            LIMIT ?
          )
          SELECT sector_code, date, rs_ratio, rs_momentum, rrg_quadrant, strength
          FROM sector_metrics_daily
          WHERE market = ?
            AND date IN (SELECT date FROM selected_dates)
          ORDER BY date DESC, sector_code
        `,
      )
        .bind(market, limit, market)
        .all<SectorHistoryRow>(),
      env.DB.prepare(
        `
          SELECT context_code, date, state, transition, source_class, data_freshness_json
          FROM market_context_daily
          WHERE market = ?
            AND context_code IN (?, ?, ?, ?)
            AND source_class = 'official'
          ORDER BY date DESC, context_code
          LIMIT ?
        `,
      )
        .bind(market, ...ACTIVE_MARKET_CONTEXT_CODES, limit * 8)
        .all<ContextHistoryRow>(),
      env.DB.prepare(
        `
          SELECT COUNT(DISTINCT date) AS days
          FROM sector_metrics_daily
          WHERE market = ?
        `,
      )
        .bind(market)
        .all<HistoryCoverageRow>(),
    ]);
    const availableDays = coverageRows.results?.[0]?.days ?? 0;
    const sectorHistoryRows = sectorRows.results ?? [];
    const completeness = historyCompleteness(sectorHistoryRows, Math.min(requestedDaysForTimeframe(timeframe), availableDays));

    return json({
      market,
      timeframe,
      limit,
      coverage: buildHistoryCoverage(timeframe, availableDays, completeness),
      sectors: groupSectorHistory(sectorHistoryRows, limit),
      market_context: groupContextHistory(contextRows.results ?? [], limit),
      status: "ok",
    });
  } catch {
    return json({
      market,
      timeframe,
      coverage: buildHistoryCoverage(timeframe, 0),
      sectors: [],
      market_context: [],
      status: "degraded",
      message: "History tables are unavailable or not migrated yet.",
    });
  }
};

function groupSectorHistory(rows: SectorHistoryRow[], limit: number) {
  const byCode = new Map<string, SectorHistoryRow[]>();
  for (const row of rows.reverse()) {
    const trail = byCode.get(row.sector_code) ?? [];
    trail.push(row);
    byCode.set(row.sector_code, trail.slice(-limit));
  }
  return [...byCode.entries()].map(([sector_code, trail]) => ({
    sector_code,
    trail: trail.map((row) => ({
      date: row.date,
      rs_ratio: row.rs_ratio,
      rs_momentum: row.rs_momentum,
      quadrant: row.rrg_quadrant ?? "unknown",
      strength: row.strength,
    })),
  }));
}

function groupContextHistory(rows: ContextHistoryRow[], limit: number) {
  const byCode = new Map<string, ContextHistoryRow[]>();
  for (const row of rows.reverse()) {
    const points = byCode.get(row.context_code) ?? [];
    points.push(row);
    byCode.set(row.context_code, points.slice(-limit));
  }
  return [...byCode.entries()].map(([code, points]) => ({
    code,
    points: points.map((row) => ({
      date: row.date,
      state: row.state ?? "unknown",
      transition: row.transition ?? "unknown",
      source_class: row.source_class ?? "held",
      data_freshness: parseJson(row.data_freshness_json, {}),
    })),
  }));
}

export function boundedLimit(value: string | null, timeframe: "30D" | "90D" | "180D") {
  if (value === null || value.trim() === "") {
    if (timeframe === "30D") return 30;
    if (timeframe === "180D") return 180;
    return 90;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.min(180, Math.max(20, Math.floor(parsed)));
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
}

function boundedTimeframe(value: string | null): "30D" | "90D" | "180D" {
  if (value === "30D" || value === "90D" || value === "180D") return value;
  return "90D";
}

export function buildHistoryCoverage(
  timeframe: "30D" | "90D" | "180D",
  availableSectorDays: number | null | undefined,
  completeness?: Partial<HistoryCompleteness>,
) {
  const requestedDays = requestedDaysForTimeframe(timeframe);
  const availableDays = Math.max(0, Math.floor(Number(availableSectorDays) || 0));
  return {
    available_sector_days: availableDays,
    complete_sector_days: completeness?.complete_sector_days ?? availableDays,
    effective_days: Math.min(requestedDays, availableDays),
    limited_by_data: availableDays < requestedDays,
    max_sector_days: completeness?.max_sector_days ?? availableDays,
    min_sector_days: completeness?.min_sector_days ?? availableDays,
    missing_sector_codes: completeness?.missing_sector_codes ?? [],
    requested_days: requestedDays,
    sector_count: completeness?.sector_count ?? 0,
  };
}

function historyCompleteness(rows: SectorHistoryRow[], targetDays: number): HistoryCompleteness {
  const bySector = new Map<string, Set<string>>();
  const byDate = new Map<string, Set<string>>();
  for (const row of rows) {
    const sectorDates = bySector.get(row.sector_code) ?? new Set<string>();
    sectorDates.add(row.date);
    bySector.set(row.sector_code, sectorDates);

    const dateSectors = byDate.get(row.date) ?? new Set<string>();
    dateSectors.add(row.sector_code);
    byDate.set(row.date, dateSectors);
  }

  const sectorCount = bySector.size;
  const sectorDays = [...bySector.values()].map((dates) => dates.size);
  const maxSectorDays = sectorDays.length ? Math.max(...sectorDays) : 0;
  const minSectorDays = sectorDays.length ? Math.min(...sectorDays) : 0;
  const completeSectorDays = [...byDate.values()].filter((sectors) => sectorCount > 0 && sectors.size === sectorCount).length;
  const missingSectorCodes = [...bySector.entries()]
    .filter(([, dates]) => dates.size < targetDays)
    .map(([sectorCode]) => sectorCode)
    .sort();

  return {
    complete_sector_days: completeSectorDays,
    max_sector_days: maxSectorDays,
    min_sector_days: minSectorDays,
    missing_sector_codes: missingSectorCodes,
    sector_count: sectorCount,
  };
}

function requestedDaysForTimeframe(timeframe: "30D" | "90D" | "180D") {
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
