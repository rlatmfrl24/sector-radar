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
    const status = await new D1RefreshStore(env.DB).readStatus("yahoo_finance");
    return Response.json({
      service: "sector-radar-ingest",
      provider: "yahoo_finance",
      status: status?.status ?? "never_run",
      latest_price_date: status?.latest_price_date ?? null,
      last_success_at: status?.last_success_at ?? null,
      next_allowed_at: status?.next_allowed_at ?? null,
      message: "Public manual refresh is disabled. Scheduled cron owns Cloudflare ingestion.",
    });
  },
};

async function runRefresh(env: Env, now: Date): Promise<void> {
  const store = new D1RefreshStore(env.DB);
  const provider = new YahooChartProvider({
    concurrency: parseNumber(env.YAHOO_FETCH_CONCURRENCY, 2),
  });
  const interval = parseRefreshInterval(env.REFRESH_INTERVAL_MINUTES);
  const outcome = await refreshMarketData(store, provider, {
    fetchBudget: parseNumber(env.YAHOO_FETCH_BUDGET, 38),
    now,
    refreshIntervalMinutes: interval,
  });
  console.log(JSON.stringify({ event: "sector_radar_refresh", outcome }));
}

function parseRefreshInterval(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 15 ? parsed : 15;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
