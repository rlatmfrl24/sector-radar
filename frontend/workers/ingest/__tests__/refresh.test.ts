import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DataRefreshStatusRow,
  InstrumentRow,
  MarketDataProvider,
  PriceBar,
  RefreshStore,
  RunLogRow,
  SectorMetricRow,
  SeriesRow,
} from "../contracts";
import { buildSectorMetricRows, priceBarsToSeriesRows } from "../engine";
import { YahooChartProvider } from "../providers";
import { refreshMarketData } from "../refresh";
import { allSymbols, buildFetchSymbols, coreSymbols } from "../universe";

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

  async readStatus(): Promise<DataRefreshStatusRow | null> {
    return this.status;
  }

  async upsertStatus(row: DataRefreshStatusRow): Promise<void> {
    this.status = row;
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
}

describe("Cloudflare ingest refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plans core symbols first and stays within the Yahoo fetch budget", () => {
    const planned = buildFetchSymbols(new Date("2026-06-24T00:00:00Z"), 38);

    expect(planned.slice(0, coreSymbols().length)).toEqual(coreSymbols());
    expect(planned.length).toBeLessThanOrEqual(38);
  });

  it("upserts Yahoo bars and sector snapshots without exposing probability", async () => {
    const store = new MemoryRefreshStore();
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T00:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect(provider.lastSymbols.length).toBeLessThanOrEqual(38);
    expect([...store.runLogs.values()].at(-1)?.status).toBe("success");
    expect(store.series.size).toBeGreaterThan(0);
    expect(store.metrics.size).toBeGreaterThanOrEqual(10);
    for (const row of store.metrics.values()) {
      expect(row.validation_status).toBe("unvalidated");
      expect(row.expose_probability).toBe(0);
      expect(row.source_metrics_json).toContain("market_context");
    }
  });

  it("does not call the provider inside the 15 minute rate gate", async () => {
    const store = new MemoryRefreshStore();
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T00:00:00Z"),
      refreshIntervalMinutes: 15,
    });
    const second = await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T00:05:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(second.status).toBe("skipped_rate_limited");
    expect(provider.calls).toBe(1);
    expect(store.status?.last_attempt_at).toBe("2026-06-24T00:05:00+00:00");
    expect([...store.runLogs.values()].at(-1)?.status).toBe("skipped_rate_limited");
  });

  it("recovers stale refreshing status and continues with the next cron run", async () => {
    const store = new MemoryRefreshStore();
    store.status = {
      provider: "yahoo_finance",
      status: "refreshing",
      last_attempt_at: "2026-06-24T00:00:00+00:00",
      last_success_at: "2026-06-23T23:45:00+00:00",
      next_allowed_at: "2026-06-24T00:15:00+00:00",
      latest_price_date: "2026-06-23",
      symbol_count: 38,
      rows_upserted: 0,
      message: "Prior run did not finalize.",
    };
    const provider = new FakeProvider(makeBars(allSymbols(), 260));

    const result = await refreshMarketData(store, provider, {
      now: new Date("2026-06-24T00:30:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("success");
    expect(provider.calls).toBe(1);
    expect([...store.runLogs.values()][0]?.message).toContain("did not finalize");
    expect(store.status?.status).toBe("success");
  });

  it("fetches existing symbols incrementally and only missing symbols with full history", async () => {
    const now = new Date("2026-06-24T00:00:00Z");
    const planned = buildFetchSymbols(now, 38);
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
    expect(store.status?.message).toContain("37 10d");
    expect(store.status?.message).toContain("1 1y");
  });

  it("succeeds when core symbols are present and non-core symbols fail", async () => {
    const store = new MemoryRefreshStore();
    const core = coreSymbols();
    const provider = new FakeProvider(makeBars(core, 260), [
      { symbol: "AAPL", host: "query1.finance.yahoo.com", message: "blocked", status: 403 },
    ]);

    const result = await refreshMarketData(store, provider, {
      fetchBudget: 38,
      now: new Date("2026-06-24T00:00:00Z"),
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
      now: new Date("2026-06-24T00:00:00Z"),
      refreshIntervalMinutes: 15,
    });

    expect(result.status).toBe("failed");
    expect(store.status?.symbol_count).toBe(38);
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
  });
});

function makeBars(symbols: string[], count: number): PriceBar[] {
  const start = Date.UTC(2025, 5, 1);
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
