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

export async function readLatestMarketContext(env: Env, market = "US") {
  try {
    const rows = await env.DB.prepare(
      `
        SELECT context.*
        FROM market_context_daily context
        INNER JOIN (
          SELECT context_code, MAX(date) AS latest_date
          FROM market_context_daily
          WHERE market = ?
          GROUP BY context_code
        ) latest
          ON latest.context_code = context.context_code
         AND latest.latest_date = context.date
        WHERE context.market = ?
        ORDER BY context.context_code
      `,
    )
      .bind(market, market)
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
