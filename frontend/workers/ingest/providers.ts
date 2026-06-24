import type { MarketDataProvider, PriceBar, ProviderFailure, ProviderFetchResult } from "./contracts";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      description?: string;
    } | null;
  };
}

const YAHOO_HOSTS = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
const BODY_PREVIEW_LIMIT = 240;

export interface YahooChartProviderOptions {
  concurrency?: number;
}

export class YahooChartProvider implements MarketDataProvider {
  readonly name = "yahoo_finance";

  private readonly concurrency: number;

  constructor(options: YahooChartProviderOptions = {}) {
    this.concurrency = normalizeConcurrency(options.concurrency);
  }

  async fetchDaily(symbols: string[], range: string): Promise<ProviderFetchResult> {
    const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
    const results = await mapWithConcurrency(uniqueSymbols, this.concurrency, (symbol) => this.fetchSymbol(symbol, range));
    const bars: PriceBar[] = [];
    const failures: ProviderFailure[] = [];

    for (const result of results) {
      bars.push(...result.bars);
      failures.push(...result.failures);
    }

    return { bars, failures };
  }

  private async fetchSymbol(symbol: string, range: string): Promise<ProviderFetchResult> {
    const failures: ProviderFailure[] = [];

    for (const host of YAHOO_HOSTS) {
      const result = await this.fetchSymbolFromHost(symbol, range, host);
      if (result.bars.length > 0) {
        return result;
      }
      failures.push(...result.failures);
    }

    return { bars: [], failures };
  }

  private async fetchSymbolFromHost(symbol: string, range: string, host: string): Promise<ProviderFetchResult> {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=1d&includePrePost=false&events=history&lang=en-US&region=US&corsDomain=finance.yahoo.com`;
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          accept: "application/json,text/plain,*/*",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          pragma: "no-cache",
          referer: "https://finance.yahoo.com/",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });
      if (!response.ok) {
        return failure(symbol, `Yahoo chart returned HTTP ${response.status}`, {
          body_preview: await readBodyPreview(response),
          host,
          status: response.status,
        });
      }

      const payload = (await response.json()) as YahooChartResponse;
      const result = payload.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const timestamps = result?.timestamp ?? [];
      if (!result || !quote || timestamps.length === 0) {
        return failure(symbol, payload.chart?.error?.description ?? "Yahoo chart response did not include daily bars.", {
          host,
        });
      }

      const bars: PriceBar[] = timestamps
        .map((timestamp, index) => {
          const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
          return {
            symbol,
            date,
            open: finiteOrNull(quote.open?.[index]),
            high: finiteOrNull(quote.high?.[index]),
            low: finiteOrNull(quote.low?.[index]),
            close: finiteOrNull(quote.close?.[index]),
            volume: finiteOrNull(quote.volume?.[index]),
          };
        })
        .filter((bar) => bar.close !== null);

      if (bars.length === 0) {
        return failure(symbol, "Yahoo chart returned no usable close prices.", { host });
      }

      return { bars, failures: [] };
    } catch (error) {
      return failure(symbol, error instanceof Error ? error.message : "Yahoo chart request failed.", { host });
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function readBodyPreview(response: Response): Promise<string | undefined> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let preview = "";

  try {
    while (preview.length < BODY_PREVIEW_LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      preview += decoder.decode(value, { stream: true });
    }
    preview += decoder.decode();
  } finally {
    void reader.cancel().catch(() => undefined);
  }

  return preview.slice(0, BODY_PREVIEW_LIMIT).replace(/\s+/g, " ").trim() || undefined;
}

function failure(symbol: string, message: string, details: Omit<ProviderFailure, "message" | "symbol"> = {}): ProviderFetchResult {
  return { bars: [], failures: [{ symbol, message, ...details }] };
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeConcurrency(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.min(4, Math.max(1, Math.floor(value)));
}
