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

interface MarketContextRow {
  context_code: string;
  title: string;
  date: string;
  state: string;
  transition: string;
  availability: "live" | "proxy" | "manual" | "hold";
  source_class: "official" | "proxy" | "manual" | "held";
  source: string;
  meaning: string;
  evidence_json: string | null;
  warnings_json: string | null;
  data_freshness_json: string | null;
  computed_at: string | null;
}

const ACTIVE_MARKET_CONTEXT_CODES = ["S01", "S02", "S03", "S05"] as const;

export async function readLatestMarketContext(env: Env, market = "US") {
  try {
    const rows = await env.DB.prepare(
      `
        WITH ranked_context AS (
          SELECT
            context.*,
            ROW_NUMBER() OVER (
              PARTITION BY context.context_code
              ORDER BY
                CASE context.source_class
                  WHEN 'official' THEN 1
                  WHEN 'proxy' THEN 2
                  WHEN 'manual' THEN 3
                  ELSE 4
                END,
                context.date DESC,
                context.computed_at DESC
            ) AS source_rank
          FROM market_context_daily context
          WHERE context.market = ?
            AND context.context_code IN (?, ?, ?, ?)
            AND context.source_class = 'official'
          )
        SELECT *
        FROM ranked_context
        WHERE source_rank = 1
        ORDER BY context_code
      `,
    )
      .bind(market, ...ACTIVE_MARKET_CONTEXT_CODES)
      .all<MarketContextRow>();

    return (rows.results ?? []).map((row) => ({
      code: row.context_code,
      title: row.title,
      availability: row.availability,
      state: row.state,
      transition: row.transition,
      source_class: row.source_class,
      source: row.source,
      meaning: row.meaning,
      evidence: parseJson<Record<string, number | string | null>>(row.evidence_json, {}),
      warnings: parseJson<string[]>(row.warnings_json, []),
      data_freshness: {
        ...parseJson<Record<string, number | string | null>>(row.data_freshness_json, {}),
        date: row.date,
        computed_at: row.computed_at,
      },
    }));
  } catch {
    return [];
  }
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
