import { readDataConnection } from "../_shared/dataConnection";

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

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

interface SectorMetricRow {
  market: string;
  sector_code: string;
  date: string;
  benchmark: string;
  rs_ratio: number | null;
  rs_momentum: number | null;
  rrg_quadrant: string | null;
  breadth_state: string | null;
  breadth_transition: string | null;
  participation_state: string | null;
  participation_transition: string | null;
  rule_pattern: string | null;
  direction: string | null;
  strength: number | null;
  conviction_label: string | null;
  narrative: string | null;
  risks_json: string | null;
  invalidation_json: string | null;
  source_metrics_json: string | null;
  data_freshness_json: string | null;
  validation_status: string | null;
  expose_probability: number | null;
  computed_at: string;
}

interface SourceMetrics {
  breadth?: unknown;
  participation?: unknown;
  [key: string]: unknown;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const dataConnection = await readDataConnection(env);
  const latest = await env.DB.prepare(
    "SELECT MAX(date) AS as_of FROM sector_metrics_daily",
  ).first<{ as_of: string | null }>();

  if (!latest?.as_of) {
    return json({
      as_of: null,
      benchmark: "SPY",
      sectors: [],
      validation: { status: "unvalidated", expose_probability: false },
      source: "d1",
      data_connection: dataConnection,
    });
  }

  const rows = await env.DB.prepare(
    `
      SELECT *
      FROM sector_metrics_daily
      WHERE date = ?
      ORDER BY
        CASE rrg_quadrant
          WHEN 'leading' THEN 1
          WHEN 'improving' THEN 2
          WHEN 'weakening' THEN 3
          WHEN 'lagging' THEN 4
          ELSE 5
        END,
        rs_ratio DESC
    `,
  )
    .bind(latest.as_of)
    .all<SectorMetricRow>();

  const sectors = (rows.results ?? []).map(toSectorSnapshot);
  return json({
    as_of: latest.as_of,
    benchmark: sectors[0]?.benchmark ?? "SPY",
    sectors,
    validation: { status: "unvalidated", expose_probability: false },
    source: "d1",
    data_connection: dataConnection,
  });
};

function toSectorSnapshot(row: SectorMetricRow) {
  const sourceMetrics = parseJson<SourceMetrics>(row.source_metrics_json, {});
  const dataFreshness = parseJson(row.data_freshness_json, {
    latest_price_date: row.date,
    computed_at: row.computed_at,
  });

  return {
    as_of: row.date,
    benchmark: row.benchmark,
    sector_code: row.sector_code,
    sector_name: row.sector_code,
    quadrant: row.rrg_quadrant ?? "unknown",
    modules: {
      relative_strength: {
        state: classifyRs(row.rs_ratio),
        transition: classifyMomentum(row.rs_momentum),
        strength: row.rs_ratio == null ? 0 : Math.min(4, Math.max(1, Math.round(row.rs_ratio / 34))),
        evidence: {
          rs_ratio: row.rs_ratio,
          rs_momentum: row.rs_momentum,
        },
        warnings: [],
      },
      breadth: {
        state: row.breadth_state ?? "unknown",
        transition: row.breadth_transition ?? "unknown",
        strength: row.breadth_state ? 2 : 0,
        evidence: moduleEvidence(sourceMetrics.breadth),
        warnings: moduleWarnings(sourceMetrics.breadth, row.breadth_state ? [] : ["not_available"]),
      },
      participation: {
        state: row.participation_state ?? "unknown",
        transition: row.participation_transition ?? "unknown",
        strength: row.participation_state ? 2 : 0,
        evidence: moduleEvidence(sourceMetrics.participation),
        warnings: moduleWarnings(sourceMetrics.participation, row.participation_state ? [] : ["not_available"]),
      },
    },
    rulebook: {
      lead_pattern: row.rule_pattern ?? "Neutral",
      direction: row.direction ?? "neutral",
      strength: row.strength ?? 0,
      conviction_label: row.conviction_label ?? "low",
      narrative: row.narrative ?? "아직 계산된 Rulebook narrative가 없습니다.",
      risks: parseJson(row.risks_json, []),
      invalidation: parseJson(row.invalidation_json, []),
      source_metrics: sourceMetrics,
      data_freshness: dataFreshness,
    },
    validation: {
      status: row.validation_status ?? "unvalidated",
      expose_probability: row.expose_probability === 1,
    },
    data_freshness: dataFreshness,
  };
}

function classifyRs(value: number | null): string {
  if (value == null) return "unknown";
  if (value >= 102) return "strong";
  if (value < 98) return "weak";
  return "average";
}

function classifyMomentum(value: number | null): string {
  if (value == null) return "unknown";
  if (value >= 101) return "strengthening";
  if (value < 99) return "weakening";
  return "stable";
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function moduleEvidence(value: unknown): Record<string, unknown> {
  const evidence = { ...objectValue(value) };
  delete evidence.warnings;
  return evidence;
}

function moduleWarnings(value: unknown, fallback: string[]): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const warnings = (value as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return fallback;
  return warnings.filter((warning): warning is string => typeof warning === "string");
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
