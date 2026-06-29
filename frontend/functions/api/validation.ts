interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  first<T = unknown>(): Promise<T | null>;
}

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const sample = await readSample(env);
  return json({
    status: "unvalidated",
    expose_probability: false,
    scorecard: {
      sector_rrg_ic: null,
      pattern_hit_rate: null,
      sample_size: sample.sector_snapshots,
    },
    coverage: sample,
    limitations: [
      "Walk-forward validation and calibration are not implemented yet.",
      "Any numeric strength in the dashboard is rule alignment, not probability.",
      "Verification metrics remain separated from sector 판단 문구 until validation is complete.",
    ],
  });
};

async function readSample(env: Env) {
  try {
    const sectors = await env.DB.prepare(
      "SELECT COUNT(*) AS count, COUNT(DISTINCT date) AS days FROM sector_metrics_daily",
    ).first<{ count: number | null; days: number | null }>();
    const context = await env.DB.prepare(
      "SELECT COUNT(*) AS count, COUNT(DISTINCT date) AS days FROM market_context_daily",
    ).first<{ count: number | null; days: number | null }>();
    return {
      sector_snapshots: sectors?.count ?? 0,
      sector_history_days: sectors?.days ?? 0,
      market_context_points: context?.count ?? 0,
      market_context_days: context?.days ?? 0,
    };
  } catch {
    return {
      sector_snapshots: 0,
      sector_history_days: 0,
      market_context_points: 0,
      market_context_days: 0,
    };
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
