import { buildLayerFourValidationReport } from "../../_shared/validationReport";

interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const market = url.searchParams.get("market") ?? "US";
  const benchmark = url.searchParams.get("benchmark") ?? "SPY";
  const report = await buildLayerFourValidationReport(env.DB, { benchmark, market });

  return json({
    service: "layer4-validation",
    status: report.status,
    expose_probability: report.expose_probability,
    probability_mode: report.probability_mode,
    coverage: report.coverage,
    diagnostics_ready: report.pattern_diagnostics.filter((item) => item.status === "ready").length,
    diagnostics_total: report.pattern_diagnostics.length,
    probability_ready: report.pattern_diagnostics.filter((item) => item.observed_probability_20d !== null).length,
    reliability: {
      high: report.pattern_diagnostics.filter((item) => item.reliability_label === "high").length,
      medium: report.pattern_diagnostics.filter((item) => item.reliability_label === "medium").length,
      low: report.pattern_diagnostics.filter((item) => item.reliability_label === "low").length,
    },
    replay_windows: report.replay_windows,
    schedule: report.schedule,
    limitations: report.limitations,
  });
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
