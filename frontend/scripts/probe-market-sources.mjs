import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FRED_SERIES = ["WALCL", "DEXKOUS", "BAMLH0A0HYM2", "VIXCLS", "WRESBAL"];
const KRX_ENDPOINTS = [
  "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",
  "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd",
];

await loadLocalEnv();

const fetchedAt = new Date().toISOString();
const probeDate = readArg("--date") ?? previousBusinessDate(new Date());
const result = {
  fetched_at: fetchedAt,
  fred: await probeFred(fetchedAt),
  krx_openapi: await probeKrx(probeDate, fetchedAt),
};

console.log(JSON.stringify(result, null, 2));

async function probeFred(fetchedAt) {
  const apiKey = process.env.FRED_API_KEY;
  const rows = [];
  const failures = [];

  for (const seriesId of FRED_SERIES) {
    try {
      const observations = apiKey
        ? await fetchFredApiSeries(seriesId, apiKey)
        : await fetchFredCsvSeries(seriesId);
      const latest = observations.at(-1);
      if (!latest) {
        failures.push({ series_id: `FRED:${seriesId}`, message: "No usable observations." });
        continue;
      }
      rows.push({
        series_id: `FRED:${seriesId}`,
        date: latest.date,
        field: "value",
        value: latest.value,
        source: apiKey ? "fred_api" : "fred_csv_public",
        fetched_at: fetchedAt,
      });
    } catch (error) {
      failures.push({
        series_id: `FRED:${seriesId}`,
        message: error instanceof Error ? error.message : "FRED probe failed.",
      });
    }
  }

  return {
    configured: Boolean(apiKey),
    status: rows.length ? "success" : "failed",
    latest_date: latestDate(rows),
    rows,
    failures,
    note: apiKey
      ? "Used FRED official API key from local environment."
      : "FRED_API_KEY was not found; used public FRED CSV graph endpoint for local probe only.",
  };
}

async function fetchFredApiSeries(seriesId, apiKey) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", daysAgo(90));
  url.searchParams.set("sort_order", "asc");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`FRED API HTTP ${response.status}: ${await bodyPreview(response)}`);
  const payload = await response.json();
  if (payload.error_message) throw new Error(String(payload.error_message));
  return (payload.observations ?? []).map(toFredObservation).filter(Boolean);
}

async function fetchFredCsvSeries(seriesId) {
  const url = new URL("https://fred.stlouisfed.org/graph/fredgraph.csv");
  url.searchParams.set("id", seriesId);
  const response = await fetch(url, {
    headers: {
      accept: "text/csv",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`FRED CSV HTTP ${response.status}: ${await bodyPreview(response)}`);
  return (await response.text())
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, raw] = line.split(",");
      const value = Number(raw);
      if (!date || !Number.isFinite(value)) return null;
      return { date, value };
    })
    .filter(Boolean);
}

function toFredObservation(observation) {
  const value = Number(observation.value);
  if (!observation.date || !Number.isFinite(value)) return null;
  return { date: observation.date, value };
}

async function probeKrx(date, fetchedAt) {
  const apiKey = process.env.KRX_API_KEY;
  if (!apiKey) {
    return {
      configured: false,
      status: "skipped_missing_key",
      latest_date: null,
      rows: [],
      failures: [{ symbol: "KRX", message: "KRX_API_KEY is not configured in local environment." }],
      note: "Add KRX_API_KEY to frontend/.dev.vars or shell env, then rerun npm run source:probe.",
    };
  }

  const endpoints = (process.env.KRX_CONTEXT_ENDPOINT ?? KRX_ENDPOINTS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^http:/, "https:"));
  const rows = [];
  const failures = [];

  for (const endpoint of endpoints) {
    try {
      const endpointRows = await fetchKrxEndpoint(endpoint, date, apiKey, fetchedAt);
      rows.push(...endpointRows);
    } catch (error) {
      failures.push({
        symbol: endpointLabel(endpoint),
        message: error instanceof Error ? error.message : "KRX probe failed.",
      });
    }
  }

  return {
    configured: true,
    status: rows.length ? "success" : "failed",
    latest_date: latestDate(rows),
    rows: rows.slice(0, 24),
    failures,
    note: rows.length
      ? "KRX OpenAPI responded with recognized reference fields."
      : "KRX responded, but no recognized reference fields were parsed. Check endpoint permission and field mapping.",
  };
}

async function fetchKrxEndpoint(endpoint, date, apiKey, fetchedAt) {
  const url = new URL(endpoint);
  url.searchParams.set("basDd", date.replaceAll("-", ""));
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.5",
      AUTH_KEY: apiKey,
    },
  });
  if (!response.ok) throw new Error(`KRX HTTP ${response.status}: ${await bodyPreview(response)}`);
  const payload = await response.json();
  const records = payload.OutBlock_1 ?? payload.result?.OutBlock_1 ?? payload.output ?? [];
  return records.flatMap((record) => krxRowsFromRecord(record, date, fetchedAt));
}

function krxRowsFromRecord(record, fallbackDate, fetchedAt) {
  const date = krxDate(record) ?? fallbackDate;
  const rows = [];
  pushKrxCandidate(rows, record, date, fetchedAt, "KRX:FOREIGN_NET_BUY", [
    "FRGN_NTBY_TRDVAL",
    "FRGN_NETBUY_AMT",
    "FORN_NTBY_TRDVAL",
    "외국인순매수거래대금",
  ]);
  pushKrxCandidate(rows, record, date, fetchedAt, "KRX:INSTITUTION_NET_BUY", [
    "INST_NTBY_TRDVAL",
    "INST_NETBUY_AMT",
    "기관순매수거래대금",
  ]);
  pushKrxCandidate(rows, record, date, fetchedAt, "KRX:CREDIT_BALANCE", ["CRDT_BAL", "CRDT_BALANCE", "신용잔고"]);
  pushKrxCandidate(rows, record, date, fetchedAt, "KRX:SHORT_SELLING_VALUE", [
    "SRTN_TRDVAL",
    "SHORT_SELLING_TRDVAL",
    "공매도거래대금",
  ]);
  pushKrxCandidate(rows, record, date, fetchedAt, `KRX:${inferMarket(record)}_TRADE_VALUE`, ["ACC_TRDVAL", "ACC_TRD_VAL", "거래대금"]);
  pushKrxCandidate(rows, record, date, fetchedAt, `KRX:${inferMarket(record)}_MARKET_CAP`, ["MKTCAP", "MKT_CAP", "시가총액"]);
  return rows;
}

function pushKrxCandidate(rows, record, date, fetchedAt, seriesId, fields) {
  const value = firstNumber(record, fields);
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

function firstNumber(record, fields) {
  for (const field of fields) {
    const raw = record[field];
    const value = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function krxDate(record) {
  const raw = record.BAS_DD ?? record.basDd ?? record.TRD_DD ?? record.date;
  const compact = String(raw ?? "").replace(/\D/g, "");
  if (compact.length !== 8) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function inferMarket(record) {
  const market = String(record.MKT_NM ?? record.mktNm ?? "EQUITY").toUpperCase();
  if (market.includes("KOSDAQ") || market.includes("코스닥")) return "KOSDAQ";
  if (market.includes("KOSPI") || market.includes("유가")) return "KOSPI";
  return "EQUITY";
}

async function loadLocalEnv() {
  for (const file of [resolve(".dev.vars"), resolve("../.dev.vars"), resolve("../.env")]) {
    try {
      const text = await readFile(file, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Local env files are optional for this probe.
    }
  }
}

function latestDate(rows) {
  return rows.map((row) => row.date).filter(Boolean).sort().at(-1) ?? null;
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function previousBusinessDate(date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  do {
    copy.setUTCDate(copy.getUTCDate() - 1);
  } while (copy.getUTCDay() === 0 || copy.getUTCDay() === 6);
  return copy.toISOString().slice(0, 10);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function bodyPreview(response) {
  return (await response.text()).replace(/\s+/g, " ").trim().slice(0, 220);
}

function endpointLabel(endpoint) {
  try {
    return `KRX:${new URL(endpoint).pathname.split("/").at(-1)}`;
  } catch {
    return "KRX:endpoint";
  }
}
