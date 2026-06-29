import type { ProviderFailure, ProviderSeriesResult, SeriesRow } from "./contracts";

interface KrxResponse {
  OutBlock_1?: Array<Record<string, unknown>>;
  output?: Array<Record<string, unknown>>;
  result?: {
    OutBlock_1?: Array<Record<string, unknown>>;
  };
}

const DEFAULT_KRX_ENDPOINT = "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd";
const DEFAULT_KRX_ENDPOINTS = [
  DEFAULT_KRX_ENDPOINT,
  "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd",
] as const;
const BODY_PREVIEW_LIMIT = 240;

export interface KrxProviderOptions {
  apiKey?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
}

export class KrxOpenApiProvider {
  readonly name = "krx_openapi";

  private readonly apiKey?: string;
  private readonly endpoints: string[];
  private readonly fetcher: typeof fetch;

  constructor(options: KrxProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.endpoints = parseEndpoints(options.endpoint);
    this.fetcher = options.fetcher ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
  }

  async fetchMarketContext(date: string, fetchedAt: string): Promise<ProviderSeriesResult> {
    if (!this.apiKey) {
      return {
        rows: [],
        failures: [{ symbol: "KRX", message: "KRX_API_KEY is not configured." }],
      };
    }

    const records: Array<{ endpoint: string; record: Record<string, unknown> }> = [];
    const failures: ProviderFailure[] = [];

    const apiKey = this.apiKey;
    for (const endpoint of this.endpoints) {
      const result = await this.fetchEndpoint(endpoint, date, apiKey);
      records.push(...result.records.map((record) => ({ endpoint, record })));
      failures.push(...result.failures);
    }

    const rows = [
      ...records.flatMap(({ record }) => parseRecord(record, date, fetchedAt)),
      ...aggregateMarketRows(records, date, fetchedAt),
    ];

    if (rows.length === 0) {
      return {
        rows: [],
        failures:
          failures.length > 0
            ? failures
            : [
                {
                  symbol: "KRX",
                  message:
                    "KRX response had no recognized investor, credit, short-selling, or market trading fields. Current KRX OpenAPI stock endpoints expose daily trading fields, not investor flow.",
                },
              ],
      };
    }

    try {
      return { rows, failures };
    } catch (error) {
      return failure(error instanceof Error ? error.message : "KRX OpenAPI request failed.");
    }
  }

  private async fetchEndpoint(
    endpoint: string,
    date: string,
    apiKey: string,
  ): Promise<{ failures: ProviderFailure[]; records: Array<Record<string, unknown>> }> {
    const url = new URL(endpoint);
    url.searchParams.set("basDd", compactDate(date));

    try {
      const response = await this.fetcher(url.toString(), {
        headers: {
          accept: "application/json",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.5",
          AUTH_KEY: apiKey,
        },
      });

      if (!response.ok) {
        return {
          records: [],
          failures: [
            {
              symbol: endpointLabel(endpoint),
              message: `KRX returned HTTP ${response.status}`,
              body_preview: await readBodyPreview(response),
              status: response.status,
            },
          ],
        };
      }

      const payload = (await response.json()) as KrxResponse;
      const records = extractRecords(payload);
      return { records, failures: [] };
    } catch (error) {
      return {
        records: [],
        failures: [
          {
            symbol: endpointLabel(endpoint),
            message: error instanceof Error ? error.message : "KRX OpenAPI request failed.",
          },
        ],
      };
    }
  }
}

export function parseKrxOutBlockRows(records: Array<Record<string, unknown>>, fallbackDate: string, fetchedAt: string): SeriesRow[] {
  return records.flatMap((record) => parseRecord(record, fallbackDate, fetchedAt));
}

function parseRecord(record: Record<string, unknown>, fallbackDate: string, fetchedAt: string): SeriesRow[] {
  const date = parseDateField(record) ?? fallbackDate;
  const rows: SeriesRow[] = [];
  pushCandidate(rows, record, date, fetchedAt, "KRX:FOREIGN_NET_BUY", [
    "FRGN_NTBY_TRDVAL",
    "FRGN_NETBUY_AMT",
    "FORN_NTBY_TRDVAL",
    "외국인순매수거래대금",
  ]);
  pushCandidate(rows, record, date, fetchedAt, "KRX:INSTITUTION_NET_BUY", [
    "INST_NTBY_TRDVAL",
    "INST_NETBUY_AMT",
    "기관순매수거래대금",
  ]);
  pushCandidate(rows, record, date, fetchedAt, "KRX:CREDIT_BALANCE", [
    "CRDT_BAL",
    "CRDT_BALANCE",
    "신용잔고",
  ]);
  pushCandidate(rows, record, date, fetchedAt, "KRX:SHORT_SELLING_VALUE", [
    "SRTN_TRDVAL",
    "SHORT_SELLING_TRDVAL",
    "공매도거래대금",
  ]);
  return rows;
}

function aggregateMarketRows(
  records: Array<{ endpoint: string; record: Record<string, unknown> }>,
  fallbackDate: string,
  fetchedAt: string,
): SeriesRow[] {
  const byMarketDate = new Map<
    string,
    {
      date: string;
      market: "KOSDAQ" | "KOSPI" | "UNKNOWN";
      marketCap: number;
      tradeValue: number;
      tradeVolume: number;
    }
  >();

  for (const { endpoint, record } of records) {
    const date = parseDateField(record) ?? fallbackDate;
    const market = inferMarket(record, endpoint);
    const key = `${market}|${date}`;
    const bucket = byMarketDate.get(key) ?? {
      date,
      market,
      marketCap: 0,
      tradeValue: 0,
      tradeVolume: 0,
    };
    bucket.tradeValue += firstNumeric(record, ["ACC_TRDVAL", "ACC_TRD_VAL", "거래대금"]) ?? 0;
    bucket.tradeVolume += firstNumeric(record, ["ACC_TRDVOL", "ACC_TRD_VOL", "거래량"]) ?? 0;
    bucket.marketCap += firstNumeric(record, ["MKTCAP", "MKT_CAP", "시가총액"]) ?? 0;
    byMarketDate.set(key, bucket);
  }

  const rows: SeriesRow[] = [];
  const equityByDate = new Map<string, { marketCap: number; tradeValue: number; tradeVolume: number }>();

  for (const bucket of byMarketDate.values()) {
    if (bucket.market === "KOSPI" || bucket.market === "KOSDAQ") {
      pushAggregateRows(rows, `KRX:${bucket.market}`, bucket.date, fetchedAt, bucket);
    }
    const total = equityByDate.get(bucket.date) ?? { marketCap: 0, tradeValue: 0, tradeVolume: 0 };
    total.tradeValue += bucket.tradeValue;
    total.tradeVolume += bucket.tradeVolume;
    total.marketCap += bucket.marketCap;
    equityByDate.set(bucket.date, total);
  }

  for (const [date, total] of equityByDate.entries()) {
    pushAggregateRows(rows, "KRX:EQUITY", date, fetchedAt, total);
  }

  return rows;
}

function pushAggregateRows(
  rows: SeriesRow[],
  prefix: string,
  date: string,
  fetchedAt: string,
  values: { marketCap: number; tradeValue: number; tradeVolume: number },
) {
  pushAggregateRow(rows, `${prefix}_TRADE_VALUE`, date, fetchedAt, values.tradeValue);
  pushAggregateRow(rows, `${prefix}_TRADE_VOLUME`, date, fetchedAt, values.tradeVolume);
  pushAggregateRow(rows, `${prefix}_MARKET_CAP`, date, fetchedAt, values.marketCap);
}

function pushAggregateRow(
  rows: SeriesRow[],
  seriesId: string,
  date: string,
  fetchedAt: string,
  value: number,
) {
  if (!Number.isFinite(value) || value === 0) return;
  rows.push({
    series_id: seriesId,
    date,
    field: "value",
    value,
    source: "krx_openapi",
    fetched_at: fetchedAt,
  });
}

function pushCandidate(
  rows: SeriesRow[],
  record: Record<string, unknown>,
  date: string,
  fetchedAt: string,
  seriesId: string,
  fieldNames: string[],
) {
  const value = firstNumeric(record, fieldNames);
  if (value === null) return;
  rows.push({
    series_id: seriesId,
    date,
    field: "value",
    value,
    source: "krx_openapi",
    fetched_at: fetchedAt,
  });
}

function firstNumeric(record: Record<string, unknown>, fieldNames: string[]) {
  for (const field of fieldNames) {
    const value = parseNumber(record[field]);
    if (value !== null) return value;
  }
  return null;
}

function parseDateField(record: Record<string, unknown>) {
  const raw = record.BAS_DD ?? record.basDd ?? record.TRD_DD ?? record.date;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).replace(/\D/g, "");
  if (value.length !== 8) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRecords(payload: KrxResponse): Array<Record<string, unknown>> {
  return payload.OutBlock_1 ?? payload.result?.OutBlock_1 ?? payload.output ?? [];
}

function inferMarket(record: Record<string, unknown>, endpoint: string): "KOSDAQ" | "KOSPI" | "UNKNOWN" {
  const marketName = String(record.MKT_NM ?? record.mktNm ?? "");
  if (/KOSDAQ|코스닥/i.test(marketName) || /ksq_/i.test(endpoint)) return "KOSDAQ";
  if (/KOSPI|유가증권/i.test(marketName) || /stk_/i.test(endpoint)) return "KOSPI";
  return "UNKNOWN";
}

function endpointLabel(endpoint: string) {
  try {
    return `KRX:${new URL(endpoint).pathname.split("/").at(-1) ?? "endpoint"}`;
  } catch {
    return "KRX:endpoint";
  }
}

function parseEndpoints(endpoint: string | undefined) {
  const endpoints = endpoint
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeSecureEndpoint)
    .filter((value): value is string => typeof value === "string");
  return endpoints && endpoints.length > 0 ? endpoints : [...DEFAULT_KRX_ENDPOINTS];
}

function normalizeSecureEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

async function readBodyPreview(response: Response): Promise<string | undefined> {
  const text = await response.text();
  return text.slice(0, BODY_PREVIEW_LIMIT).replace(/\s+/g, " ").trim() || undefined;
}

function failure(message: string, details: Omit<ProviderFailure, "message" | "symbol"> = {}): ProviderSeriesResult {
  return { rows: [], failures: [{ symbol: "KRX", message, ...details }] };
}
