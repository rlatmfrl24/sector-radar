import { readDataConnection, readDataConnections } from "../_shared/dataConnection";
import { buildLeadershipReconciliation, buildSectorsDataQuality } from "../_shared/dataQuality";
import {
  buildLayerOneFlowSnapshot,
  LAYER_ONE_SERIES,
  type LayerOneSeriesRow,
} from "../_shared/layerOneFlow";
import { readLatestMarketContext } from "../_shared/marketContext";
import {
  breadthStateStrength,
  classifyRelativeStrengthState,
  classifyRelativeStrengthTransition,
  participationStateStrength,
  relativeStrengthClassStrength,
} from "../_shared/metricThresholds";
import { buildRadarDerived } from "../_shared/radarDerived";
import { normalizeSectorName } from "../../src/lib/sectorNames";

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
  relative_strength?: unknown;
  breadth?: unknown;
  participation?: unknown;
  [key: string]: unknown;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const dataConnection = await readDataConnection(env);
  const dataConnections = await readDataConnections(env);
  const marketContext = await readLatestMarketContext(env);
  const latest = await env.DB.prepare(
    "SELECT MAX(date) AS as_of FROM sector_metrics_daily",
  ).first<{ as_of: string | null }>();

  if (!latest?.as_of) {
    const concentration = emptyConcentration();
    const layer1Flow = buildLayerOneFlowSnapshot({
      asOf: null,
      rows: [],
      sectors: [],
    });
    const derived = buildRadarDerived({
      asOf: null,
      concentration,
      dataConnection,
      dataConnections,
      marketContext,
      sectors: [],
    });
    const dataQuality = buildSectorsDataQuality({
      asOf: null,
      layer1Flow,
      marketContext,
      sectors: [],
      sourceFreshness: derived.source_freshness ?? [],
    });

    return json({
      as_of: null,
      benchmark: "SPY",
      sectors: [],
      validation: { status: "unvalidated", expose_probability: false },
      source: "d1",
      data_connection: dataConnection,
      data_connections: dataConnections,
      market_context: marketContext,
      layer1_flow: layer1Flow,
      concentration,
      data_quality: dataQuality,
      leadership_reconciliation: buildLeadershipReconciliation([]),
      ...derived,
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
  const layerOneRows = await readLayerOneSeries(env, latest.as_of);
  const layer1Flow = buildLayerOneFlowSnapshot({
    asOf: latest.as_of,
    rows: layerOneRows,
    sectors,
  });
  const concentration = buildConcentration(sectors);
  const derived = buildRadarDerived({
    asOf: latest.as_of,
    concentration,
    dataConnection,
    dataConnections,
    marketContext,
    sectors,
  });
  const dataQuality = buildSectorsDataQuality({
    asOf: latest.as_of,
    layer1Flow,
    marketContext,
    sectors,
    sourceFreshness: derived.source_freshness ?? [],
  });

  return json({
    as_of: latest.as_of,
    benchmark: sectors[0]?.benchmark ?? "SPY",
    sectors,
    validation: { status: "unvalidated", expose_probability: false },
    source: "d1",
    data_connection: dataConnection,
    data_connections: dataConnections,
    market_context: marketContext,
    layer1_flow: layer1Flow,
    concentration,
    data_quality: dataQuality,
    leadership_reconciliation: buildLeadershipReconciliation(sectors),
    ...derived,
  });
};

function toSectorSnapshot(row: SectorMetricRow) {
  const sourceMetrics = parseJson<SourceMetrics>(row.source_metrics_json, {});
  const dataFreshness = parseJson(row.data_freshness_json, {
    latest_price_date: row.date,
    computed_at: row.computed_at,
  });
  const relativeStrengthEvidence = {
    ...moduleEvidence(sourceMetrics.relative_strength),
    rs_ratio: row.rs_ratio,
    rs_momentum: row.rs_momentum,
  };
  const rsState = moduleState(sourceMetrics.relative_strength) ?? classifyRelativeStrengthState(row.rs_ratio);
  const rsTransition =
    moduleTransition(sourceMetrics.relative_strength) ?? classifyRelativeStrengthTransition(row.rs_momentum);

  return {
    as_of: row.date,
    benchmark: row.benchmark,
    sector_code: row.sector_code,
    sector_name: normalizeSectorName(row.sector_code, row.sector_code),
    quadrant: row.rrg_quadrant ?? "unknown",
    modules: {
      relative_strength: {
        state: rsState,
        transition: rsTransition,
        strength: moduleStrength(sourceMetrics.relative_strength) ?? relativeStrengthClassStrength(rsState),
        evidence: relativeStrengthEvidence,
        warnings: moduleWarnings(sourceMetrics.relative_strength, row.rs_ratio == null || row.rs_momentum == null ? ["insufficient_rs_history"] : []),
      },
      breadth: {
        state: row.breadth_state ?? "unknown",
        transition: row.breadth_transition ?? "unknown",
        strength: moduleStrength(sourceMetrics.breadth) ?? breadthStateStrength(row.breadth_state),
        evidence: moduleEvidence(sourceMetrics.breadth),
        warnings: moduleWarnings(sourceMetrics.breadth, row.breadth_state ? [] : ["not_available"]),
      },
      participation: {
        state: row.participation_state ?? "unknown",
        transition: row.participation_transition ?? "unknown",
        strength: moduleStrength(sourceMetrics.participation) ?? participationStateStrength(row.participation_state),
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
  delete evidence.state;
  delete evidence.transition;
  delete evidence.strength;
  return evidence;
}

function moduleWarnings(value: unknown, fallback: string[]): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const warnings = (value as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return fallback;
  return warnings.filter((warning): warning is string => typeof warning === "string");
}

function moduleState(value: unknown): string | null {
  const state = objectValue(value).state;
  return typeof state === "string" ? state : null;
}

function moduleTransition(value: unknown): string | null {
  const transition = objectValue(value).transition;
  return typeof transition === "string" ? transition : null;
}

function moduleStrength(value: unknown): number | null {
  const strength = Number(objectValue(value).strength);
  return Number.isFinite(strength) ? strength : null;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function buildConcentration(sectors: ReturnType<typeof toSectorSnapshot>[]) {
  const weights = sectors
    .map((sector) => ({
      sector_code: sector.sector_code,
      weight: Math.max(0, Number(sector.modules.relative_strength.evidence.rs_ratio) - 100),
    }))
    .filter((item) => item.weight > 0);
  const total = weights.reduce((sum, item) => sum + item.weight, 0);

  if (total <= 0) return emptyConcentration(["no_positive_rs_leadership_weight"]);

  const normalized = weights
    .map((item) => ({ ...item, share: item.weight / total }))
    .sort((a, b) => b.share - a.share);
  const hhi = normalized.reduce((sum, item) => sum + item.share ** 2, 0);
  const top3 = normalized.slice(0, 3).reduce((sum, item) => sum + item.share, 0);

  return {
    method: "rs_leadership_estimate",
    source_class: "proxy",
    hhi: round(hhi),
    effective_sector_count: round(1 / hhi),
    top1: normalized[0]?.sector_code ?? null,
    top1_contribution: round(normalized[0]?.share ?? null),
    top3_contribution: round(top3),
    warnings: [
      "market_cap_contribution_not_available",
      ...(hhi > 0.35 || top3 > 0.75 ? ["narrow_leadership_estimate"] : []),
    ],
  };
}

async function readLayerOneSeries(env: Env, asOf: string): Promise<LayerOneSeriesRow[]> {
  const startDate = addDays(asOf, -370);
  const placeholders = LAYER_ONE_SERIES.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `
      SELECT series_id, date, field, value, source, fetched_at
      FROM series_daily
      WHERE date >= ?
        AND series_id IN (${placeholders})
        AND field = 'close'
      ORDER BY series_id, date
    `,
  )
    .bind(startDate, ...LAYER_ONE_SERIES)
    .all<LayerOneSeriesRow>();
  return rows.results ?? [];
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function emptyConcentration(warnings: string[] = ["insufficient_sector_snapshots"]) {
  return {
    method: "rs_leadership_estimate",
    source_class: "proxy",
    hhi: null,
    effective_sector_count: null,
    top1: null,
    top1_contribution: null,
    top3_contribution: null,
    warnings,
  };
}

function round(value: number | null, decimals = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
