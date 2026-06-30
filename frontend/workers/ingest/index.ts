import {
  buildLayerFourValidationReport,
  LAYER4_VALIDATION_RUN_TYPE,
} from "../../functions/_shared/validationReport";
import { refreshFredMarketContext, refreshKrxMarketContext } from "./contextRefresh";
import { FredProvider } from "./fredProvider";
import { KrxOpenApiProvider } from "./krxProvider";
import { YahooChartProvider } from "./providers";
import { refreshMarketData } from "./refresh";
import { D1RefreshStore } from "./store";

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const task = runRefresh(env, new Date(controller.scheduledTime)).catch((error) => {
      console.error(
        JSON.stringify({
          event: "sector_radar_refresh_unhandled_error",
          message: error instanceof Error ? error.message : "Unknown refresh error",
        }),
      );
    });
    ctx.waitUntil(task);
  },

  async fetch(_request: Request, env: Env): Promise<Response> {
    const store = new D1RefreshStore(env.DB);
    const statuses = await store.readStatuses(activeStatusProviders(env));
    return Response.json({
      service: "sector-radar-ingest",
      providers: Object.fromEntries(
        statuses.map((status) => [
          status.provider,
          {
            status: status.status,
            latest_price_date: status.latest_price_date ?? null,
            last_success_at: status.last_success_at ?? null,
            next_allowed_at: normalizeNextAllowedAt(status.provider, status.next_allowed_at),
            message: status.message ?? null,
          },
        ]),
      ),
      message: "Public manual refresh is disabled. Scheduled cron owns Cloudflare ingestion.",
    });
  },
};

async function runRefresh(env: Env, now: Date): Promise<void> {
  const store = new D1RefreshStore(env.DB);
  const yahooProvider = new YahooChartProvider({
    concurrency: parseNumber(env.YAHOO_FETCH_CONCURRENCY, 2),
    fetchTimeoutMs: parseNumber(readOptionalEnv(env, "YAHOO_FETCH_TIMEOUT_MS"), 8_000),
  });
  const interval = parseRefreshInterval(env.REFRESH_INTERVAL_MINUTES);
  const legacyBudget = parseNumber(env.YAHOO_FETCH_BUDGET, 38);
  const yahooOutcome = await refreshMarketData(store, yahooProvider, {
    coreFetchBudget: parseNumber(env.YAHOO_CORE_FETCH_BUDGET, legacyBudget),
    enableIntradayCoreRefresh: parseBoolean(env.ENABLE_INTRADAY_CORE_REFRESH),
    holdingFetchBudget: parseNumber(env.YAHOO_HOLDINGS_FETCH_BUDGET, legacyBudget),
    metricHistoryDays: parseNumber(readOptionalEnv(env, "VALIDATION_HISTORY_DAYS"), 260),
    now,
    refreshIntervalMinutes: interval,
  });

  const fredOutcome = await refreshFredMarketContext(
    store,
    new FredProvider({
      apiKey: readOptionalEnv(env, "FRED_API_KEY"),
    }),
    {
      fredIntervalMinutes: parseNumber(readOptionalEnv(env, "FRED_REFRESH_INTERVAL_MINUTES"), 720),
      now,
    },
  );
  const krxOutcome = parseBoolean(readOptionalEnv(env, "ENABLE_KRX_CONTEXT_REFRESH"))
    ? await refreshKrxMarketContext(
        store,
        new KrxOpenApiProvider({
          apiKey: readOptionalEnv(env, "KRX_API_KEY"),
          endpoint: readOptionalEnv(env, "KRX_CONTEXT_ENDPOINT"),
        }),
        {
          krxIntervalMinutes: parseNumber(readOptionalEnv(env, "KRX_REFRESH_INTERVAL_MINUTES"), 1440),
          now,
        },
      )
    : "disabled";
  const validationAudit = await runLayerFourValidationAudit(store, env, now);

  console.log(
    JSON.stringify({
      event: "sector_radar_refresh",
      outcomes: {
        yahoo_finance: yahooOutcome.status,
        fred: fredOutcome,
        krx_openapi: krxOutcome,
        layer4_validation: validationAudit.status,
      },
    }),
  );
}

async function runLayerFourValidationAudit(store: D1RefreshStore, env: Env, now: Date) {
  const startedAt = toIso(now);
  const runId = `${LAYER4_VALIDATION_RUN_TYPE}:${startedAt}`;

  try {
    const report = await buildLayerFourValidationReport(env.DB);
    const readyPatterns = report.pattern_diagnostics.filter((item) => item.status === "ready").length;
    const status = report.status === "historical_ready" ? "success" : "insufficient_data";
    const message = [
      `Layer 4 validation audit ${report.status}.`,
      `history_days=${report.coverage.sector_history_days}.`,
      `evaluated_samples=${report.scorecard.sample_size}.`,
      `ready_patterns=${readyPatterns}/${report.pattern_diagnostics.length}.`,
    ].join(" ");

    await store.upsertRunLog({
      run_id: runId,
      run_type: LAYER4_VALIDATION_RUN_TYPE,
      started_at: startedAt,
      finished_at: toIso(new Date()),
      status,
      message,
    });
    return { status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Layer 4 validation audit failed.";
    await store.upsertRunLog({
      run_id: runId,
      run_type: LAYER4_VALIDATION_RUN_TYPE,
      started_at: startedAt,
      finished_at: toIso(new Date()),
      status: "failed",
      message,
    });
    return { status: "failed" };
  }
}

function activeStatusProviders(env: Env): string[] {
  return parseBoolean(readOptionalEnv(env, "ENABLE_KRX_CONTEXT_REFRESH"))
    ? ["yahoo_finance", "fred", "krx_openapi"]
    : ["yahoo_finance", "fred"];
}

function parseRefreshInterval(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 15 ? parsed : 15;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function readOptionalEnv(env: Env, key: string): string | undefined {
  const value = (env as unknown as Record<string, string | undefined>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeNextAllowedAt(provider: string, storedValue: string | null | undefined, now = new Date()): string | null {
  const stored = parseTime(storedValue);
  if (stored && stored > now.getTime()) return storedValue ?? null;
  if (provider === "yahoo_finance") return toIso(nextScheduledQuarterHour(now, isYahooCollectionWindow));
  if (provider === "fred") return toIso(nextScheduledQuarterHour(now, isFredCollectionWindow));
  if (provider === "krx_openapi") return toIso(nextScheduledQuarterHour(now, isKrxCollectionWindow));
  return storedValue ?? null;
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
