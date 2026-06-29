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
    const statuses = await store.readStatuses(["yahoo_finance", "fred", "krx_openapi"]);
    return Response.json({
      service: "sector-radar-ingest",
      providers: Object.fromEntries(
        statuses.map((status) => [
          status.provider,
          {
            status: status.status,
            latest_price_date: status.latest_price_date ?? null,
            last_success_at: status.last_success_at ?? null,
            next_allowed_at: status.next_allowed_at ?? null,
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
  });
  const interval = parseRefreshInterval(env.REFRESH_INTERVAL_MINUTES);
  const legacyBudget = parseNumber(env.YAHOO_FETCH_BUDGET, 38);
  const yahooOutcome = await refreshMarketData(store, yahooProvider, {
    coreFetchBudget: parseNumber(env.YAHOO_CORE_FETCH_BUDGET, legacyBudget),
    enableIntradayCoreRefresh: parseBoolean(env.ENABLE_INTRADAY_CORE_REFRESH),
    holdingFetchBudget: parseNumber(env.YAHOO_HOLDINGS_FETCH_BUDGET, legacyBudget),
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
  const krxOutcome = await refreshKrxMarketContext(
    store,
    new KrxOpenApiProvider({
      apiKey: readOptionalEnv(env, "KRX_API_KEY"),
      endpoint: readOptionalEnv(env, "KRX_CONTEXT_ENDPOINT"),
    }),
    {
      krxIntervalMinutes: parseNumber(readOptionalEnv(env, "KRX_REFRESH_INTERVAL_MINUTES"), 1440),
      now,
    },
  );

  console.log(
    JSON.stringify({
      event: "sector_radar_refresh",
      outcomes: {
        yahoo_finance: yahooOutcome.status,
        fred: fredOutcome,
        krx_openapi: krxOutcome,
      },
    }),
  );
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
