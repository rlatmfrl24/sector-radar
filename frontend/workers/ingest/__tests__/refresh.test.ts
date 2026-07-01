import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DataRefreshStatusRow,
  InstrumentRow,
  MarketDataProvider,
  MarketContextRow,
  PriceBar,
  RefreshStore,
  RunLogRow,
  SectorMetricRow,
  SeriesRow,
} from "../contracts";
import { refreshFredMarketContext, refreshKrxMarketContext } from "../contextRefresh";
import { buildSectorMetricHistoryRows, buildSectorMetricRows, priceBarsToSeriesRows } from "../engine";
import { FredProvider } from "../fredProvider";
import { KrxOpenApiProvider } from "../krxProvider";
import { YahooChartProvider } from "../providers";
import { refreshMarketData } from "../refresh";
import { allSymbols, buildCoreRefreshSymbols, coreSymbols, layerOneYahooSymbols } from "../universe";

class FakeProvider implements MarketDataProvider {
  readonly name = "yahoo_finance";
  calls = 0;
  lastSymbols: string[] = [];
  requests: Array<{ range: string; symbols: string[] }> = [];

  constructor(
    private readonly bars: PriceBar[],
    private readonly failures: { symbol: string; message: string; host?: string; status?: number }[] = [],
  ) {}

  async fetchDaily(symbols: string[], range: string): Promise<{ bars: PriceBar[]; failures: typeof this.failures }> {
    this.calls += 1;
    this.lastSymbols = symbols;
    this.requests.push({ range, symbols });
    const symbolSet = new Set(symbols.map((symbol) => symbol.toUpperCase()));
    return {
      bars: this.bars.filter((bar) => symbolSet.has(bar.symbol.toUpperCase())),
      failures: this.failures,
    };
  }
}

class MemoryRefreshStore implements RefreshStore {
  status: DataRefreshStatusRow | null = null;
  instruments = new Map<string, InstrumentRow>();
  runLogs = new Map<string, RunLogRow>();
  series = new Map<string, SeriesRow>();
  metrics = new Map<string, SectorMetricRow>();
  marketContext = new Map<string, MarketContextRow>();

  async readStatus(provider = "yahoo_finance"): Promise<DataRefreshStatusRow | null> {
    if (provider === "yahoo_finance") return this.status;
    return this.providerStatuses.get(provider) ?? null;
  }

  providerStatuses = new Map<string, DataRefreshStatusRow>();

  async readStatuses(providers: string[]): Promise<DataRefreshStatusRow[]> {
    return providers
      .map((provider) => (provider === "yahoo_finance" ? this.status : this.providerStatuses.get(provider)))
      .filter((row): row is DataRefreshStatusRow => row !== null && row !== undefined);
  }

  async upsertStatus(row: DataRefreshStatusRow): Promise<void> {
    if (row.provider === "yahoo_finance") {
      this.status = row;
    } else {
      this.providerStatuses.set(row.provider, row);
    }
  }

  async upsertRunLog(row: RunLogRow): Promise<void> {
    this.runLogs.set(row.run_id, row);
  }

  async upsertInstruments(rows: InstrumentRow[]): Promise<void> {
    rows.forEach((row) => this.instruments.set(row.instrument_id, row));
  }

  async upsertSeries(rows: SeriesRow[]): Promise<number> {
    rows.forEach((row) => this.series.set(`${row.series_id}|${row.date}|${row.field}`, row));
    return rows.length;
  }

  async readSeries(symbols: string[], startDate: string): Promise<SeriesRow[]> {
    const symbolSet = new Set(symbols);
    return [...this.series.values()]
      .filter((row) => symbolSet.has(row.series_id) && row.date >= startDate)
      .sort((a, b) => `${a.series_id}|${a.date}|${a.field}`.localeCompare(`${b.series_id}|${b.date}|${b.field}`));
  }

  async upsertSectorMetrics(rows: SectorMetricRow[]): Promise<void> {
    rows.forEach((row) => this.metrics.set(`${row.market}|${row.sector_code}|${row.date}|${row.benchmark}`, row));
  }

  async upsertMarketContext(rows: MarketContextRow[]): Promise<void> {
    rows.forEach((row) => this.marketContext.set(`${row.market}|${row.context_code}|${row.date}`, row));
  }

  async readLatestMarketContext(_market = "US"): Promise<MarketContextRow[]> {
    const latestByCode = new Map<string, MarketContextRow>();
    for (const row of this.marketContext.values()) {
      const current = latestByCode.get(row.context_code);
      if (
        !current ||
        row.computed_at > current.computed_at ||
        (row.computed_at === current.computed_at && row.date > current.date)
      ) {
        latestByCode.set(row.context_code, row);
      }
    }
    return [...latestByCode.values()].sort((a, b) => a.context_code.localeCompare(b.context_code));
  }
}

describe("Cloudflare ingest refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plans core symbols first and stays within the Yahoo fetch budget", () => {
    const planned = buildCoreRefreshSymbols(32);

    expect(planned.slice(0, coreSymbols().length)).toEqual(coreSymbols());
    expect(planned).toEqual(expect.arrayContaining(layerOneYahooSymbols()));
    expect(planned.length).toBeLessThanOrEqual(32);
  });

  it("selects one latest market context row when computed_at ties across dates", async () => {
    const store = new MemoryRefreshStore();
    await store.upsertMarketContext([
      marketContextRow("S01", "2026-06-24", "2026-06-29T20:30:00+00:00"),
      marketContextRow("S01", "2026-06-25", "2026-06-29T20:30:00+00:00"),
      marketContextRow("S02", "2026-06-24", "2026-06-29T20:15:00+00:00"),
      marketContextRow("S02", "2026-06-23", "2026-06-29T20:30:00+00:00"),
    ]);

    await expect(store.readLatestMarketContext()).resolves.toMatchObject([
      { context_code: "S01", date: "2026-06-25", computed_at: "2026-06-29T20:30:00+00:00" },
      { context_code: "S02", date: "2026-06-23", computed_at: "2026-06-29T20:30:00+00:00" },
    ]);
  });

  it("upserts Yahoo bars and sector snapshots without exposing probability", async () => {
    const store = new MemoryRefreshStore();
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect(provider.lastSymbols.length).toBeLessThanOrEqual(32);
    expect([...store.runLogs.values()].at(-1)?.status).toBe("success");
    expect(store.series.size).toBeGreaterThan(0);
    expect(store.metrics.size).toBeGreaterThanOrEqual(10);
    for (const row of store.metrics.values()) {
      expect(row.validation_status).toBe("unvalidated");
      expect(row.expose_probability).toBe(0);
      expect(row.source_metrics_json).toContain("market_context");
    }
  });

  it("keeps official market context evidence when Yahoo refresh rebuilds sector snapshots", async () => {
    const store = new MemoryRefreshStore();
    await store.upsertSeries([
      {
        series_id: "FRED:WALCL",
        date: "2026-06-20",
        field: "value",
        value: 6_400_000,
        source: "fred",
        fetched_at: "2026-06-23T20:00:00+00:00",
      },
    ]);
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    const latestMetric = [...store.metrics.values()].find((row) => row.date === "2026-06-23");
    const freshness = JSON.parse(latestMetric?.data_freshness_json ?? "{}") as Record<string, unknown>;
    const sourceMetrics = JSON.parse(latestMetric?.source_metrics_json ?? "{}") as {
      market_context?: Array<{ source_class?: string }>;
    };

    expect(freshness.market_context_latest_date).toBe("2026-06-20");
    expect(sourceMetrics.market_context?.some((card) => card.source_class === "official")).toBe(true);
  });

  it("does not call the provider inside the 15 minute rate gate", async () => {
    const store = new MemoryRefreshStore();
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });
    const second = await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T20:35:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(second.status).toBe("skipped_rate_limited");
    expect(provider.calls).toBe(1);
    expect(store.status?.last_attempt_at).toBe("2026-06-23T20:35:00+00:00");
    expect([...store.runLogs.values()].at(-1)?.status).toBe("skipped_rate_limited");
  });

  it("skips Yahoo calls outside optimized market refresh windows", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "success",
      last_attempt_at: "2026-06-23T20:30:00+00:00",
      last_success_at: "2026-06-23T20:30:00+00:00",
      next_allowed_at: "2026-06-23T20:45:00+00:00",
      latest_price_date: "2026-06-23",
      symbol_count: 32,
      rows_upserted: 100,
      message: "Prior success.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T03:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("skipped_market_schedule");
    expect(provider.calls).toBe(0);
    expect(store.status).toMatchObject({
      status: "success",
      last_attempt_at: "2026-06-24T03:00:00+00:00",
      last_success_at: "2026-06-23T20:30:00+00:00",
      latest_price_date: "2026-06-23",
      next_allowed_at: "2026-06-24T20:30:00+00:00",
      rows_upserted: 0,
    });
    expect([...store.runLogs.values()].at(-1)?.status).toBe("skipped_market_schedule");
  });

  it("recovers stale refreshing status and continues with the next cron run", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "refreshing",
      last_attempt_at: "2026-06-23T20:30:00+00:00",
      last_success_at: "2026-06-22T20:45:00+00:00",
      next_allowed_at: "2026-06-23T20:45:00+00:00",
      latest_price_date: "2026-06-23",
      symbol_count: 38,
      rows_upserted: 0,
      message: "Prior run did not finalize.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T21:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect([...store.runLogs.values()][0]?.message).toContain("did not finalize");
    expect(store.status?.status).toBe("success");
  });

  it("recovers stale refreshing status even when the next cron is off-window", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "refreshing",
      last_attempt_at: "2026-06-23T20:30:00+00:00",
      last_success_at: "2026-06-22T20:45:00+00:00",
      next_allowed_at: "2026-06-23T20:45:00+00:00",
      latest_price_date: "2026-06-23",
      symbol_count: 38,
      rows_upserted: 0,
      message: "Prior run did not finalize.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T03:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("skipped_market_schedule");
    expect(result.data_connection.status).toBe("success");
    expect(provider.calls).toBe(0);
    expect(store.status).toMatchObject({
      status: "success",
      last_success_at: "2026-06-22T20:45:00+00:00",
      latest_price_date: "2026-06-23",
    });
    expect(store.status?.message).toContain("restored last successful snapshot");
  });

  it("recovers old refreshing status even when next scheduled collection is in the future", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "refreshing",
      last_attempt_at: "2026-06-29T23:45:00+00:00",
      last_success_at: "2026-06-29T23:30:00+00:00",
      next_allowed_at: "2026-06-30T20:30:00+00:00",
      latest_price_date: "2026-06-29",
      symbol_count: 1,
      rows_upserted: 0,
      message: "Prior holdings shard did not finalize.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-30T00:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("skipped_market_schedule");
    expect(result.data_connection.status).toBe("success");
    expect(provider.calls).toBe(0);
    expect(store.status).toMatchObject({
      status: "success",
      last_success_at: "2026-06-29T23:30:00+00:00",
      latest_price_date: "2026-06-29",
    });
    expect(store.status?.message).toContain("restored last successful snapshot");
  });

  it("bypasses a future rate gate when an active-window refresh is stale", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "refreshing",
      last_attempt_at: "2026-06-23T19:45:00+00:00",
      last_success_at: "2026-06-22T20:45:00+00:00",
      next_allowed_at: "2026-06-24T20:30:00+00:00",
      latest_price_date: "2026-06-22",
      symbol_count: 38,
      rows_upserted: 0,
      message: "Prior active-window run did not finalize.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect(store.status?.status).toBe("success");
    expect(store.status?.message).toContain("Previous refresh from 2026-06-23T19:45:00+00:00 did not finalize");
  });

  it("fetches existing symbols incrementally and only missing symbols with full history", async () => {
    const now = new Date("2026-06-23T20:30:00Z");
    const planned = buildCoreRefreshSymbols(38);
    const missingSymbol = planned.at(-1)!;
    const store = new MemoryRefreshStore();
    await store.upsertSeries(
      priceBarsToSeriesRows(
        makeBars(allSymbols().filter((symbol) => symbol !== missingSymbol), 260),
        "fixture",
        "2026-06-23T00:00:00+00:00",
      ),
    );
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      fetchBudget: 38,
      now,
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[0]?.range).toBe("10d");
    expect(provider.requests[0]?.symbols).not.toContain(missingSymbol);
    expect(provider.requests[1]).toEqual({ range: "1y", symbols: [missingSymbol] });
    expect(store.status?.message).toContain(`${planned.length - 1} 10d`);
    expect(store.status?.message).toContain("1 1y");
  });

  it("uses the post-close holdings window for representative holding shards only", async () => {
    const store = new MemoryRefreshStore();
    await store.upsertSeries(
      priceBarsToSeriesRows(makeBars(coreSymbols(), 260), "fixture", "2026-06-23T20:30:00+00:00"),
    );
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      holdingFetchBudget: 38,
      now: new Date("2026-06-23T21:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect(provider.lastSymbols).not.toContain("SPY");
    expect(provider.lastSymbols.length).toBeLessThanOrEqual(38);
    expect(store.status?.message).toContain("post_close_holdings");
  });

  it("skips the holdings window when core and holdings already have the latest daily close", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "success",
      last_attempt_at: "2026-06-23T20:30:00+00:00",
      last_success_at: "2026-06-23T20:30:00+00:00",
      next_allowed_at: "2026-06-23T20:45:00+00:00",
      latest_price_date: "2026-06-23",
      symbol_count: 32,
      rows_upserted: 100,
      message: "Prior success.",
    };
    await store.upsertSeries(
      priceBarsToSeriesRows(makeBars(allSymbols(), 260), "fixture", "2026-06-23T20:30:00+00:00"),
    );
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-23T21:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("skipped_up_to_date");
    expect(provider.calls).toBe(0);
    expect(store.status).toMatchObject({
      status: "success",
      last_attempt_at: "2026-06-23T21:00:00+00:00",
      next_allowed_at: "2026-06-24T20:30:00+00:00",
      latest_price_date: "2026-06-23",
      rows_upserted: 0,
    });
  });

  it("succeeds when core symbols are present and non-core symbols fail", async () => {
    const store = new MemoryRefreshStore();
    const core = coreSymbols();
    const provider = new FakeProvider(makeBars(core, 260), [
      { symbol: "AAPL", host: "query1.finance.yahoo.com", message: "blocked", status: 403 },
    ]);

    const result = await refreshMarketData(store, provider, {
      fetchBudget: 38,
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(store.status?.message).toContain("Non-core warnings: 1");
    expect(store.metrics.size).toBeGreaterThanOrEqual(10);
  });

  it("fails with diagnostic details when a core symbol is missing", async () => {
    const store = new MemoryRefreshStore();
    const provider = new FakeProvider([], [
      {
        symbol: "SPY",
        host: "query1.finance.yahoo.com",
        message: "Yahoo chart returned HTTP 403",
        status: 403,
      },
    ]);

    const result = await refreshMarketData(store, provider, {
      fetchBudget: 38,
      now: new Date("2026-06-23T20:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("failed");
    expect(store.status?.symbol_count).toBe(buildCoreRefreshSymbols(38).length);
    expect(store.status?.message).toContain("Core Yahoo symbols failed");
    expect(store.status?.message).toContain("HTTP 403");
    expect([...store.runLogs.values()].at(-1)?.status).toBe("failed");
  });

  it("falls back from query2 to query1 for Yahoo chart requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("edge denied", { status: 403 }))
      .mockResolvedValueOnce(Response.json(yahooPayload("SPY")));
    const provider = new YahooChartProvider({ concurrency: 1 });

    const result = await provider.fetchDaily(["SPY"], "5d");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("query2.finance.yahoo.com");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("query1.finance.yahoo.com");
    expect(result.bars.length).toBe(2);
    expect(result.failures).toEqual([]);
  });

  it("uses the default global fetch safely for FRED requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        observations: [{ date: "2026-06-23", value: "4.25" }],
      }),
    );
    const provider = new FredProvider({ apiKey: "test-key" });

    const result = await provider.fetchSeries(["DFF"], "2026-06-01", "2026-06-25T00:00:00+00:00");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.failures).toEqual([]);
    expect(result.rows).toEqual([
      {
        series_id: "FRED:DFF",
        date: "2026-06-23",
        field: "value",
        value: 4.25,
        source: "fred",
        fetched_at: "2026-06-25T00:00:00+00:00",
      },
    ]);
  });

  it("uses the default global fetch safely for KRX requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        OutBlock_1: [{ BAS_DD: "20260624", FRGN_NTBY_TRDVAL: "1,234" }],
      }),
    );
    const provider = new KrxOpenApiProvider({
      apiKey: "test-key",
      endpoint: "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",
    });

    const result = await provider.fetchMarketContext("2026-06-24", "2026-06-25T00:00:00+00:00");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("https://data-dbg.krx.co.kr");
    expect(result.failures).toEqual([]);
    expect(result.rows).toEqual([
      {
        series_id: "KRX:FOREIGN_NET_BUY",
        date: "2026-06-24",
        field: "value",
        value: 1234,
        source: "krx_openapi",
        fetched_at: "2026-06-25T00:00:00+00:00",
      },
    ]);
  });

  it("upgrades configured KRX HTTP endpoints before sending the auth header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ OutBlock_1: [] }));
    const provider = new KrxOpenApiProvider({
      apiKey: "test-key",
      endpoint: "http://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",
    });

    await provider.fetchMarketContext("2026-06-24", "2026-06-25T00:00:00+00:00");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^https:\/\/data-dbg\.krx\.co\.kr/);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ AUTH_KEY: "test-key" });
  });

  it("requests the previous KST business date without UTC date drift", async () => {
    const store = new MemoryRefreshStore();
    let requestedDate = "";
    const provider = {
      name: "krx_openapi",
      async fetchMarketContext(date: string, fetchedAt: string) {
        requestedDate = date;
        return {
          failures: [],
          rows: [
            {
              date,
              fetched_at: fetchedAt,
              field: "value",
              series_id: "KRX:EQUITY_TRADE_VALUE",
              source: "krx_openapi",
              value: 1,
            },
          ],
        };
      },
    };

    const outcome = await refreshKrxMarketContext(store, provider, {
      ignoreSchedule: true,
      now: new Date("2026-06-25T00:30:00Z"),
    });

    expect(outcome).toBe("success");
    expect(requestedDate).toBe("2026-06-24");
  });

  it("records the next FRED collection window when a cron run is off schedule", async () => {
    const store = new MemoryRefreshStore();
    store.providerStatuses.set("fred", {
      provider: "fred",
      status: "success",
      last_attempt_at: "2026-06-26T21:45:00+00:00",
      last_success_at: "2026-06-26T21:45:00+00:00",
      next_allowed_at: "2026-06-27T09:45:00+00:00",
      latest_price_date: "2026-06-25",
      symbol_count: 10,
      rows_upserted: 100,
      message: "Prior success.",
    });
    const provider = {
      name: "fred",
      async fetchDefaultSeries() {
        throw new Error("should not fetch outside schedule");
      },
    };

    const outcome = await refreshFredMarketContext(store, provider, {
      now: new Date("2026-06-29T00:00:00Z"),
    });
    const status = store.providerStatuses.get("fred");

    expect(outcome).toBe("skipped_market_schedule");
    expect(status).toMatchObject({
      status: "success",
      last_attempt_at: "2026-06-29T00:00:00+00:00",
      last_success_at: "2026-06-26T21:45:00+00:00",
      latest_price_date: "2026-06-25",
      next_allowed_at: "2026-06-29T20:45:00+00:00",
      rows_upserted: 0,
    });
  });

  it("lets stale FRED refreshing status retry during its active window", async () => {
    const store = new MemoryRefreshStore();
    store.providerStatuses.set("fred", {
      provider: "fred",
      status: "refreshing",
      last_attempt_at: "2026-06-29T20:00:00+00:00",
      last_success_at: "2026-06-26T21:00:00+00:00",
      next_allowed_at: "2026-06-30T20:45:00+00:00",
      latest_price_date: "2026-06-25",
      symbol_count: 5,
      rows_upserted: 0,
      message: "Prior FRED run did not finalize.",
    });
    let calls = 0;
    const provider = {
      name: "fred",
      async fetchDefaultSeries() {
        calls += 1;
        return {
          failures: [],
          rows: [
            {
              series_id: "FRED:WALCL",
              date: "2026-06-26",
              field: "value",
              value: 6_400_000,
              source: "fred",
              fetched_at: "2026-06-29T20:45:00+00:00",
            },
          ],
        };
      },
    };

    const outcome = await refreshFredMarketContext(store, provider, {
      now: new Date("2026-06-29T20:45:00Z"),
    });

    expect(outcome).toBe("success");
    expect(calls).toBe(1);
    expect(store.providerStatuses.get("fred")).toMatchObject({
      status: "success",
      latest_price_date: "2026-06-26",
    });
  });

  it("records the next KRX collection window when a cron run is off schedule", async () => {
    const store = new MemoryRefreshStore();
    store.providerStatuses.set("krx_openapi", {
      provider: "krx_openapi",
      status: "success",
      last_attempt_at: "2026-06-29T00:15:00+00:00",
      last_success_at: "2026-06-28T23:30:00+00:00",
      next_allowed_at: "2026-06-29T23:30:00+00:00",
      latest_price_date: "2026-06-26",
      symbol_count: 9,
      rows_upserted: 9,
      message: "Prior success.",
    });
    const provider = {
      name: "krx_openapi",
      async fetchMarketContext() {
        throw new Error("should not fetch outside schedule");
      },
    };

    const outcome = await refreshKrxMarketContext(store, provider, {
      now: new Date("2026-06-29T01:00:00Z"),
    });
    const status = store.providerStatuses.get("krx_openapi");

    expect(outcome).toBe("skipped_market_schedule");
    expect(status).toMatchObject({
      status: "success",
      last_attempt_at: "2026-06-29T01:00:00+00:00",
      last_success_at: "2026-06-28T23:30:00+00:00",
      latest_price_date: "2026-06-26",
      next_allowed_at: "2026-06-29T23:30:00+00:00",
      rows_upserted: 0,
    });
  });

  it("preserves prior official freshness when a provider refresh fails", async () => {
    const store = new MemoryRefreshStore();
    store.providerStatuses.set("fred", {
      provider: "fred",
      status: "success",
      last_attempt_at: "2026-06-24T21:00:00+00:00",
      last_success_at: "2026-06-24T21:00:00+00:00",
      next_allowed_at: "2026-06-24T22:00:00+00:00",
      latest_price_date: "2026-06-24",
      symbol_count: 4,
      rows_upserted: 20,
      message: "Prior success.",
    });
    const provider = {
      name: "fred",
      async fetchDefaultSeries() {
        return {
          failures: [{ symbol: "FRED:WALCL", message: "temporary upstream failure" }],
          rows: [],
        };
      },
    };

    const outcome = await refreshFredMarketContext(store, provider, {
      ignoreSchedule: true,
      now: new Date("2026-06-25T21:00:00Z"),
    });
    const status = store.providerStatuses.get("fred");

    expect(outcome).toBe("failed");
    expect(status).toMatchObject({
      status: "failed",
      last_success_at: "2026-06-24T21:00:00+00:00",
      latest_price_date: "2026-06-24",
    });
    expect(status?.message).toContain("temporary upstream failure");
  });

  it("stores official KRX daily trading fields as market reference series", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          OutBlock_1: [
            {
              BAS_DD: "20260624",
              MKT_NM: "KOSPI",
              ACC_TRDVOL: "10",
              ACC_TRDVAL: "1,000",
              MKTCAP: "50,000",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          OutBlock_1: [
            {
              BAS_DD: "20260624",
              MKT_NM: "KOSDAQ",
              ACC_TRDVOL: "20",
              ACC_TRDVAL: "2,000",
              MKTCAP: "60,000",
            },
          ],
        }),
      );
    const provider = new KrxOpenApiProvider({
      apiKey: "test-key",
      endpoint:
        "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd,https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd",
    });

    const result = await provider.fetchMarketContext("2026-06-24", "2026-06-25T00:00:00+00:00");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.failures).toEqual([]);
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ series_id: "KRX:KOSPI_TRADE_VALUE", value: 1000 }),
        expect.objectContaining({ series_id: "KRX:KOSDAQ_TRADE_VALUE", value: 2000 }),
        expect.objectContaining({ series_id: "KRX:EQUITY_TRADE_VALUE", value: 3000 }),
        expect.objectContaining({ series_id: "KRX:EQUITY_MARKET_CAP", value: 110000 }),
      ]),
    );
  });

  it("converts OHLCV bars to deterministic long-format rows", () => {
    const rows = priceBarsToSeriesRows(
      [
        {
          symbol: "SPY",
          date: "2026-06-24",
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 0,
        },
      ],
      "fixture",
      "2026-06-24T00:00:00+00:00",
    );

    expect(rows.map((row) => row.field)).toEqual(["open", "high", "low", "close", "volume"]);
    expect(rows.at(-1)?.value).toBe(0);
  });

  it("builds unvalidated metric rows from synthetic series", () => {
    const bars = makeBars(allSymbols(), 260);
    const rows = priceBarsToSeriesRows(bars, "fixture", "2026-06-24T00:00:00+00:00");
    const metrics = buildSectorMetricRows(rows, "2026-06-24T00:00:00+00:00");

    expect(metrics.length).toBeGreaterThanOrEqual(10);
    expect(metrics[0]?.validation_status).toBe("unvalidated");
    expect(metrics[0]?.expose_probability).toBe(0);
    const sourceMetrics = JSON.parse(metrics[0]?.source_metrics_json ?? "{}") as {
      breadth?: { state?: string; strength?: number };
      participation?: { state?: string; strength?: number };
      relative_strength?: { momentum_window?: number; rs_window?: number; state?: string; strength?: number };
    };
    expect(sourceMetrics.relative_strength).toMatchObject({
      momentum_window: 10,
      rs_window: 50,
    });
    expect(sourceMetrics.relative_strength?.state).toBeTruthy();
    expect(sourceMetrics.breadth?.strength).toBeTypeOf("number");
    expect(sourceMetrics.participation?.strength).toBeTypeOf("number");
  });

  it("backfills bounded sector metric history from stored price series", () => {
    const bars = makeBars(allSymbols(), 260);
    const rows = priceBarsToSeriesRows(bars, "fixture", "2026-06-24T00:00:00+00:00");
    const metrics = buildSectorMetricHistoryRows(rows, "2026-06-24T00:00:00+00:00", { historyDays: 30 });
    const dates = new Set(metrics.map((row) => row.date));

    expect(dates.size).toBe(30);
    expect(metrics.length).toBeGreaterThanOrEqual(30 * 10);
    for (const row of metrics) {
      expect(row.validation_status).toBe("unvalidated");
      expect(row.expose_probability).toBe(0);
    }
  });

  it("uses the latest market context date across all context cards", () => {
    const bars = makeBars(allSymbols(), 260);
    const priceRows = priceBarsToSeriesRows(bars, "fixture", "2026-06-24T00:00:00+00:00");
    const contextRows: SeriesRow[] = [
      {
        series_id: "FRED:WALCL",
        date: "2026-06-20",
        field: "value",
        value: 7_100_000,
        source: "fred",
        fetched_at: "2026-06-24T00:00:00+00:00",
      },
      {
        series_id: "FRED:DEXKOUS",
        date: "2026-06-24",
        field: "value",
        value: 1390,
        source: "fred",
        fetched_at: "2026-06-24T00:00:00+00:00",
      },
    ];

    const metrics = buildSectorMetricRows([...priceRows, ...contextRows], "2026-06-24T00:00:00+00:00");
    const freshness = JSON.parse(metrics[0]?.data_freshness_json ?? "{}") as Record<string, unknown>;

    expect(freshness.market_context_latest_date).toBe("2026-06-24");
  });
});

function marketContextRow(contextCode: string, date: string, computedAt: string): MarketContextRow {
  return {
    market: "US",
    context_code: contextCode,
    date,
    state: "neutral",
    transition: "stable",
    availability: "live",
    source_class: "official",
    title: contextCode,
    source: "fixture",
    meaning: "fixture",
    evidence_json: "{}",
    warnings_json: "[]",
    data_freshness_json: "{}",
    computed_at: computedAt,
  };
}

function makeBars(symbols: string[], count: number): PriceBar[] {
  const start = Date.UTC(2025, 9, 7);
  const bars: PriceBar[] = [];
  symbols.forEach((symbol, symbolIndex) => {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
      const drift = symbol === "SPY" ? 0.1 : 0.08 + (symbolIndex % 7) * 0.01;
      const close = 100 + symbolIndex * 0.3 + index * drift;
      bars.push({
        symbol,
        date,
        open: close - 0.4,
        high: close + 0.8,
        low: close - 0.8,
        close,
        volume: 1_000_000 + symbolIndex * 1_000 + index * 100,
      });
    }
  });
  return bars;
}

function yahooPayload(symbol: string) {
  return {
    chart: {
      result: [
        {
          meta: { symbol },
          timestamp: [1_781_568_000, 1_781_654_400],
          indicators: {
            quote: [
              {
                close: [100, 101],
                high: [101, 102],
                low: [99, 100],
                open: [99.5, 100.5],
                volume: [1_000_000, 1_100_000],
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}
