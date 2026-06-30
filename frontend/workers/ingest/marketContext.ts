import type { MarketContextCard, MarketContextRow, SeriesRow } from "./contracts";
import { LAYER_TWO_INPUTS, MARKET, layerTwoYahooSymbols } from "./universe";

export const FRED_SERIES_IDS = [
  "WALCL",
  "DFF",
  "SOFR",
  "DGS2",
  "DFII5",
  "DEXKOUS",
  "DTWEXBGS",
  "BAMLH0A0HYM2",
  "VIXCLS",
  "WRESBAL",
] as const;

export const KRX_SERIES_IDS = [] as const;

interface DailyBar {
  date: string;
  close?: number;
}

interface DatedValue {
  date: string;
  value: number;
}

type ScalarSeriesMap = Record<string, DatedValue[]>;
type PriceSeriesMap = Record<string, DailyBar[]>;

export function marketContextSeriesIds(): string[] {
  return [
    ...FRED_SERIES_IDS.map((seriesId) => `FRED:${seriesId}`),
    ...KRX_SERIES_IDS,
    ...layerTwoYahooSymbols(),
  ];
}

export function buildMarketContextFromSeriesRows(
  rows: SeriesRow[],
  computedAt: string,
): MarketContextCard[] {
  const prices = toPriceSeriesMap(rows);
  const scalars = toScalarSeriesMap(rows);

  return LAYER_TWO_INPUTS.map((input) => {
    const official = buildOfficialCard(input.code, scalars, computedAt);
    const proxy = buildYahooProxyCard(input, prices, computedAt);
    if (official) return official;
    if (proxy) return proxy;

    return {
      code: input.code,
      title: input.title,
      availability: "hold",
      state: "held",
      transition: "external_source_needed",
      source_class: "held",
      source: input.source,
      meaning: input.meaning,
      evidence: {},
      warnings: [input.warning ?? "official_source_needed"],
      data_freshness: {
        computed_at: computedAt,
        latest_date: null,
      },
    };
  });
}

export function marketContextCardsToRows(
  cards: MarketContextCard[],
  market = MARKET,
  computedAt: string,
): MarketContextRow[] {
  return cards.map((card) => ({
    market,
    context_code: card.code,
    date: contextDate(card, computedAt),
    state: card.state,
    transition: card.transition,
    availability: card.availability,
    source_class: card.source_class,
    title: card.title,
    source: card.source,
    meaning: card.meaning,
    evidence_json: JSON.stringify(card.evidence),
    warnings_json: JSON.stringify(card.warnings),
    data_freshness_json: JSON.stringify(card.data_freshness),
    computed_at: computedAt,
  }));
}

function buildOfficialCard(
  code: string,
  scalars: ScalarSeriesMap,
  computedAt: string,
): MarketContextCard | null {
  if (code === "S01") return centralBankPolicy(scalars, computedAt);
  if (code === "S02") return dollarFxGate(scalars, computedAt);
  if (code === "S03") return globalCredit(scalars, computedAt);
  if (code === "S05") return reserveBalance(scalars, computedAt);
  return null;
}

function centralBankPolicy(scalars: ScalarSeriesMap, computedAt: string): MarketContextCard | null {
  const walcl = latestScalar(scalars, "FRED:WALCL");
  const dff = latestScalar(scalars, "FRED:DFF") ?? latestScalar(scalars, "FRED:SOFR");
  const dgs2 = latestScalar(scalars, "FRED:DGS2");
  const dfii5 = latestScalar(scalars, "FRED:DFII5");
  if (!walcl && !dff && !dgs2 && !dfii5) return null;

  const walclChange = scalarChange(scalars, "FRED:WALCL", 4);
  const dffChange = scalarChange(scalars, dff?.series_id ?? "FRED:DFF", 21);
  const realYieldChange = scalarChange(scalars, "FRED:DFII5", 21);
  const state =
    isPositiveChange(walclChange) && !isPositiveChange(realYieldChange)
      ? "supportive"
      : isNegativeChange(walclChange) || isPositiveChange(dffChange, 0.15)
        ? "pressure"
        : "neutral";

  return officialCard({
    code: "S01",
    title: "중앙은행 정책",
    meaning: "금리·대차대조표 기반 유동성 여력",
    source: "FRED: WALCL, DFF/SOFR, DGS2, DFII5",
    state,
    transition: transitionFromState(state),
    evidence: {
      WALCL_latest: round(walcl?.value),
      WALCL_change_4obs: round(walclChange),
      policy_rate_latest: round(dff?.value),
      policy_rate_change_21obs: round(dffChange),
      DGS2_latest: round(dgs2?.value),
      DFII5_latest: round(dfii5?.value),
      latest_date: latestDate([walcl, dff, dgs2, dfii5]),
    },
    warnings: missingWarnings([
      ["WALCL", walcl],
      ["DFF_or_SOFR", dff],
      ["DGS2", dgs2],
      ["DFII5", dfii5],
    ]),
    computedAt,
  });
}

function dollarFxGate(scalars: ScalarSeriesMap, computedAt: string): MarketContextCard | null {
  const usdkrw = latestScalar(scalars, "FRED:DEXKOUS");
  const broadDollar = latestScalar(scalars, "FRED:DTWEXBGS");
  if (!usdkrw && !broadDollar) return null;

  const usdkrwRet = scalarReturn(scalars, "FRED:DEXKOUS", 21);
  const dollarRet = scalarReturn(scalars, "FRED:DTWEXBGS", 21);
  const state =
    isPositiveChange(usdkrwRet, 0.02) || isPositiveChange(dollarRet, 0.02)
      ? "pressure"
      : isNegativeChange(usdkrwRet, -0.02) || isNegativeChange(dollarRet, -0.02)
        ? "supportive"
        : "neutral";

  return officialCard({
    code: "S02",
    title: "달러·FX 게이트",
    meaning: "달러와 원화 흐름으로 위험자산 압박 또는 완화를 확인",
    source: "FRED: DEXKOUS, DTWEXBGS",
    state,
    transition: transitionFromState(state),
    evidence: {
      DEXKOUS_latest: round(usdkrw?.value),
      DEXKOUS_ret_21obs: round(usdkrwRet),
      DTWEXBGS_latest: round(broadDollar?.value),
      DTWEXBGS_ret_21obs: round(dollarRet),
      latest_date: latestDate([usdkrw, broadDollar]),
    },
    warnings: missingWarnings([
      ["DEXKOUS", usdkrw],
      ["DTWEXBGS", broadDollar],
    ]),
    computedAt,
  });
}

function globalCredit(scalars: ScalarSeriesMap, computedAt: string): MarketContextCard | null {
  const oas = latestScalar(scalars, "FRED:BAMLH0A0HYM2");
  const vix = latestScalar(scalars, "FRED:VIXCLS");
  if (!oas && !vix) return null;

  const oasChange = scalarChange(scalars, "FRED:BAMLH0A0HYM2", 21);
  const vixChange = scalarChange(scalars, "FRED:VIXCLS", 21);
  const state =
    isPositiveChange(oasChange, 0.25) || isPositiveChange(vixChange, 4) || (vix?.value ?? 0) >= 25
      ? "pressure"
      : isNegativeChange(oasChange, -0.25) && (vix?.value ?? 99) < 20
        ? "supportive"
        : "neutral";

  return officialCard({
    code: "S03",
    title: "글로벌 신용환경",
    meaning: "스프레드와 변동성 레짐 확인",
    source: "FRED: BAMLH0A0HYM2, VIXCLS",
    state,
    transition: transitionFromState(state),
    evidence: {
      HY_OAS_latest: round(oas?.value),
      HY_OAS_change_21obs: round(oasChange),
      VIXCLS_latest: round(vix?.value),
      VIXCLS_change_21obs: round(vixChange),
      latest_date: latestDate([oas, vix]),
    },
    warnings: missingWarnings([
      ["BAMLH0A0HYM2", oas],
      ["VIXCLS", vix],
    ]),
    computedAt,
  });
}

function reserveBalance(scalars: ScalarSeriesMap, computedAt: string): MarketContextCard | null {
  const reserve = latestScalar(scalars, "FRED:WRESBAL");
  if (!reserve) return null;

  const reserveChange = scalarChange(scalars, "FRED:WRESBAL", 4);
  const state = isPositiveChange(reserveChange) ? "supportive" : isNegativeChange(reserveChange) ? "pressure" : "neutral";

  return officialCard({
    code: "S05",
    title: "은행 지급준비금",
    meaning: "연준 지급준비금으로 현금성 여력을 확인",
    source: "FRED: WRESBAL",
    state,
    transition: transitionFromState(state),
    evidence: {
      WRESBAL_latest: round(reserve.value),
      WRESBAL_change_4obs: round(reserveChange),
      latest_date: reserve.date,
    },
    warnings: ["WRESBAL은 공식 MMF 총자산이 아니라 은행 지급준비금입니다."],
    computedAt,
  });
}

function officialCard({
  code,
  computedAt,
  evidence,
  meaning,
  source,
  state,
  title,
  transition,
  warnings,
}: {
  code: string;
  computedAt: string;
  evidence: Record<string, number | string | null>;
  meaning: string;
  source: string;
  state: string;
  title: string;
  transition: string;
  warnings: string[];
}): MarketContextCard {
  return {
    code,
    title,
    availability: "live",
    state,
    transition,
    source_class: "official",
    source,
    meaning,
    evidence,
    warnings,
    data_freshness: {
      computed_at: computedAt,
      latest_date: stringOrNull(evidence.latest_date),
      provider: source.startsWith("KRX") ? "krx_openapi" : "fred",
      source_class: "official",
    },
  };
}

function buildYahooProxyCard(
  input: (typeof LAYER_TWO_INPUTS)[number],
  prices: PriceSeriesMap,
  computedAt: string,
): MarketContextCard | null {
  const returns = input.yahooSymbols
    .map((symbol) => {
      const ret = returnOverBars(prices[normalize(symbol)] ?? [], 21);
      return ret === null ? null : ([symbol, ret] as const);
    })
    .filter((entry): entry is readonly [string, number] => entry !== null);

  if (returns.length === 0) return null;

  const evidence = Object.fromEntries(
    returns.map(([symbol, value]) => [`${symbol}_ret_21d`, round(value)]),
  ) as Record<string, number | string | null>;
  evidence.latest_date = latestPriceDate(input.yahooSymbols, prices);
  const averageReturn = average(returns.map(([, value]) => value));
  const state =
    input.code === "S02"
      ? dollarProxyState(evidence)
      : averageReturn === null
        ? "unknown"
        : averageReturn >= 0.03
          ? "supportive"
          : averageReturn <= -0.03
            ? "pressure"
            : "neutral";

  return {
    code: input.code,
    title: input.title,
    availability: input.availability === "live" ? "live" : "proxy",
    state,
    transition: averageReturn === null ? "unknown" : averageReturn >= 0 ? "strengthening" : "weakening",
    source_class: "proxy",
    source: input.source,
    meaning: input.meaning,
    evidence,
    warnings: input.warning ? [input.warning] : ["official_source_not_connected_yet"],
    data_freshness: {
      computed_at: computedAt,
      latest_date: stringOrNull(evidence.latest_date),
      provider: "yahoo_finance",
      source_class: "proxy",
    },
  };
}

function toPriceSeriesMap(rows: SeriesRow[]): PriceSeriesMap {
  const bySymbol = new Map<string, DailyBar[]>();
  const byDate = new Map<string, DailyBar>();
  for (const row of rows) {
    if (row.field !== "close") continue;
    const symbol = normalize(row.series_id);
    const key = `${symbol}|${row.date}`;
    const day = byDate.get(key) ?? { date: row.date };
    day.close = row.value;
    byDate.set(key, day);
    const series = bySymbol.get(symbol) ?? [];
    if (!series.some((item) => item.date === row.date)) {
      series.push(day);
      bySymbol.set(symbol, series);
    }
  }

  return Object.fromEntries(
    [...bySymbol.entries()].map(([symbol, values]) => [
      symbol,
      values.sort((a, b) => a.date.localeCompare(b.date)),
    ]),
  );
}

function toScalarSeriesMap(rows: SeriesRow[]): ScalarSeriesMap {
  const bySeries = new Map<string, DatedValue[]>();
  for (const row of rows) {
    if (row.field !== "value") continue;
    const seriesId = normalize(row.series_id);
    const series = bySeries.get(seriesId) ?? [];
    series.push({ date: row.date, value: row.value });
    bySeries.set(seriesId, series);
  }

  return Object.fromEntries(
    [...bySeries.entries()].map(([seriesId, values]) => [
      seriesId,
      values.sort((a, b) => a.date.localeCompare(b.date)),
    ]),
  );
}

function latestScalar(scalars: ScalarSeriesMap, seriesId: string) {
  const point = scalars[normalize(seriesId)]?.at(-1);
  return point ? { ...point, series_id: normalize(seriesId) } : null;
}

function scalarChange(scalars: ScalarSeriesMap, seriesId: string, periods: number) {
  const values = scalars[normalize(seriesId)] ?? [];
  if (values.length <= periods) return null;
  return values.at(-1)!.value - values.at(-1 - periods)!.value;
}

function scalarReturn(scalars: ScalarSeriesMap, seriesId: string, periods: number) {
  const values = scalars[normalize(seriesId)] ?? [];
  if (values.length <= periods) return null;
  const latest = values.at(-1)!.value;
  const prior = values.at(-1 - periods)!.value;
  return prior > 0 ? latest / prior - 1 : null;
}

function returnOverBars(bars: DailyBar[], periods: number) {
  const closes = bars.map((bar) => bar.close).filter(isFiniteNumber);
  if (closes.length <= periods) return null;
  const latest = closes.at(-1)!;
  const prior = closes.at(-1 - periods)!;
  return prior > 0 ? latest / prior - 1 : null;
}

function latestPriceDate(symbols: string[], prices: PriceSeriesMap) {
  const dates = symbols
    .map((symbol) => prices[normalize(symbol)]?.at(-1)?.date)
    .filter((date): date is string => typeof date === "string");
  return dates.sort().at(-1) ?? null;
}

function latestDate(values: Array<{ date: string } | null | undefined>) {
  return values
    .map((value) => value?.date)
    .filter((date): date is string => typeof date === "string")
    .sort()
    .at(-1) ?? null;
}

function contextDate(card: MarketContextCard, computedAt: string) {
  const latest = card.data_freshness.latest_date;
  return typeof latest === "string" && latest ? latest : computedAt.slice(0, 10);
}

function transitionFromState(state: string) {
  if (state === "supportive") return "strengthening";
  if (state === "pressure") return "weakening";
  return "stable";
}

function missingWarnings(values: Array<[string, unknown]>): string[] {
  return values
    .filter(([, value]) => !value)
    .map(([name]) => `${name}_missing`);
}

function dollarProxyState(evidence: Record<string, number | string | null>) {
  const dxy = Number(evidence["DX-Y.NYB_ret_21d"]);
  const krw = Number(evidence["KRW=X_ret_21d"]);
  if (!Number.isFinite(dxy) && !Number.isFinite(krw)) return "unknown";
  if ((Number.isFinite(dxy) && dxy > 0.02) || (Number.isFinite(krw) && krw > 0.02)) return "pressure";
  if ((Number.isFinite(dxy) && dxy < -0.02) || (Number.isFinite(krw) && krw < -0.02)) return "supportive";
  return "neutral";
}

function isPositiveChange(value: number | null, threshold = 0) {
  return value !== null && value > threshold;
}

function isNegativeChange(value: number | null, threshold = 0) {
  return value !== null && value < threshold;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null | undefined, decimals = 4) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalize(value: string) {
  return value.trim().toUpperCase();
}
