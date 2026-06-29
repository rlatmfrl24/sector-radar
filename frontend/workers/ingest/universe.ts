import type { InstrumentRow } from "./contracts";

export interface SectorDefinition {
  symbol: string;
  name: string;
  group: "risk_on" | "cyclical" | "defensive";
  representativeHoldings: string[];
}

export interface LayerTwoInput {
  code: string;
  title: string;
  source: string;
  meaning: string;
  yahooSymbols: string[];
  availability: "live" | "proxy" | "hold";
  warning?: string;
}

export interface LayerOneInput {
  symbol: string;
  title: string;
  source: string;
  meaning: string;
}

export const MARKET = "US";
export const BENCHMARK = "SPY";
export const OPTIONAL_BENCHMARKS = ["QQQ"];

export const LAYER_ONE_INPUTS: LayerOneInput[] = [
  {
    symbol: "RSP",
    title: "Equal-weight S&P 500 breadth proxy",
    source: "Yahoo Finance chart",
    meaning: "SPY 대비 equal-weight 시장 폭을 확인합니다.",
  },
  {
    symbol: "IWM",
    title: "Small-cap risk appetite proxy",
    source: "Yahoo Finance chart",
    meaning: "SPY 대비 중소형주 위험선호를 확인합니다.",
  },
  {
    symbol: "^VIX",
    title: "Volatility proxy",
    source: "Yahoo Finance chart",
    meaning: "Layer 1 변동성 압력을 확인합니다.",
  },
];

export const SECTORS: SectorDefinition[] = [
  {
    symbol: "XLK",
    name: "Technology",
    group: "risk_on",
    representativeHoldings: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "AMD", "CRM", "ADBE", "CSCO", "ACN"],
  },
  {
    symbol: "SMH",
    name: "Semiconductors",
    group: "risk_on",
    representativeHoldings: ["NVDA", "TSM", "AVGO", "ASML", "AMD", "MU", "AMAT", "LRCX", "KLAC", "MRVL"],
  },
  {
    symbol: "XLF",
    name: "Financials",
    group: "risk_on",
    representativeHoldings: ["BRK-B", "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "SPGI"],
  },
  {
    symbol: "XLY",
    name: "Consumer Discretionary",
    group: "risk_on",
    representativeHoldings: ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "CMG"],
  },
  {
    symbol: "XLI",
    name: "Industrials",
    group: "risk_on",
    representativeHoldings: ["GE", "CAT", "RTX", "HON", "UNP", "ETN", "DE", "BA", "UPS", "LMT"],
  },
  {
    symbol: "XLE",
    name: "Energy",
    group: "cyclical",
    representativeHoldings: ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "HES"],
  },
  {
    symbol: "XLV",
    name: "Health Care",
    group: "defensive",
    representativeHoldings: ["LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "DHR", "PFE", "ISRG"],
  },
  {
    symbol: "XLP",
    name: "Consumer Staples",
    group: "defensive",
    representativeHoldings: ["PG", "COST", "KO", "PEP", "WMT", "PM", "MDLZ", "CL", "MO", "KMB"],
  },
  {
    symbol: "XLU",
    name: "Utilities",
    group: "defensive",
    representativeHoldings: ["NEE", "SO", "DUK", "CEG", "SRE", "AEP", "D", "EXC", "XEL", "ED"],
  },
  {
    symbol: "XLB",
    name: "Materials",
    group: "cyclical",
    representativeHoldings: ["LIN", "SHW", "APD", "FCX", "ECL", "NEM", "DOW", "DD", "PPG", "NUE"],
  },
  {
    symbol: "XLRE",
    name: "Real Estate",
    group: "defensive",
    representativeHoldings: ["PLD", "AMT", "EQIX", "WELL", "SPG", "PSA", "O", "CCI", "DLR", "VICI"],
  },
  {
    symbol: "XLC",
    name: "Communication Services",
    group: "risk_on",
    representativeHoldings: ["META", "GOOGL", "GOOG", "NFLX", "DIS", "TMUS", "VZ", "T", "CMCSA", "EA"],
  },
];

export const LAYER_TWO_INPUTS: LayerTwoInput[] = [
  {
    code: "S01",
    title: "중앙은행 정책",
    source: "FRED official / Yahoo rate ETF fallback",
    meaning: "금리·대차대조표 기반 유동성 여력",
    yahooSymbols: ["^IRX", "^TNX", "TLT", "IEF"],
    availability: "proxy",
    warning: "FRED 미연결 시 Fed balance sheet / WALCL 대신 금리 ETF proxy만 사용합니다.",
  },
  {
    code: "S02",
    title: "달러·FX 게이트",
    source: "FRED official / Yahoo DXY-USDKRW fallback",
    meaning: "달러와 원화 흐름으로 위험자산 압박을 확인",
    yahooSymbols: ["DX-Y.NYB", "KRW=X"],
    availability: "live",
  },
  {
    code: "S03",
    title: "글로벌 신용환경",
    source: "FRED official / Yahoo credit ETF fallback",
    meaning: "변동성과 HY/IG ETF 상대 흐름으로 신용 압력을 proxy",
    yahooSymbols: ["^VIX", "HYG", "JNK", "LQD", "TLT"],
    availability: "proxy",
    warning: "FRED 미연결 시 HY OAS 원자료 대신 ETF proxy로만 해석합니다.",
  },
  {
    code: "S04",
    title: "외국인 자금 (보류)",
    source: "KRX investor-flow source needed",
    meaning: "수급 게이트와 한계매수자 추적",
    yahooSymbols: [],
    availability: "hold",
    warning: "현재 연결된 KRX 일별매매 endpoint로는 외국인 순매수 원자료를 안정적으로 갱신할 수 없습니다.",
  },
  {
    code: "S05",
    title: "예비금·현금 Proxy",
    source: "FRED WRESBAL / Yahoo cash ETF fallback",
    meaning: "연준 지급준비금과 초단기 채권 ETF로 현금성 여력을 proxy",
    yahooSymbols: ["BIL", "SGOV", "SHV"],
    availability: "proxy",
    warning: "WRESBAL은 reserve balance proxy이며 공식 MMF 총자산으로 표시하지 않습니다.",
  },
  {
    code: "S06",
    title: "레버리지 ETF Proxy",
    source: "Yahoo leverage ETF proxy / FRED-FINRA later",
    meaning: "레버리지 ETF 수요로 위험선호와 과열을 보조 확인",
    yahooSymbols: ["TQQQ", "SQQQ", "SPXL", "SPXS"],
    availability: "proxy",
    warning: "Margin debt 원자료가 아니며 FINRA/FRED 연결 전까지 ETF proxy로만 해석합니다.",
  },
];

export function allSymbols(): string[] {
  const symbols = new Set<string>([BENCHMARK, ...OPTIONAL_BENCHMARKS]);
  for (const input of LAYER_ONE_INPUTS) {
    symbols.add(input.symbol);
  }
  for (const sector of SECTORS) {
    symbols.add(sector.symbol);
    sector.representativeHoldings.forEach((symbol) => symbols.add(symbol));
  }
  for (const input of LAYER_TWO_INPUTS) {
    input.yahooSymbols.forEach((symbol) => symbols.add(symbol));
  }
  return [...symbols].sort();
}

export function coreSymbols(): string[] {
  return [BENCHMARK, ...SECTORS.map((sector) => sector.symbol)];
}

export function layerTwoYahooSymbols(): string[] {
  return uniqueSymbols(LAYER_TWO_INPUTS.flatMap((input) => input.yahooSymbols));
}

export function layerOneYahooSymbols(): string[] {
  return uniqueSymbols(LAYER_ONE_INPUTS.map((input) => input.symbol));
}

export function representativeHoldingSymbols(): string[] {
  return uniqueSymbols(SECTORS.flatMap((sector) => sector.representativeHoldings));
}

export function buildFetchSymbols(now: Date, budget: number): string[] {
  const core = coreSymbols();
  const layerOne = layerOneYahooSymbols().filter((symbol) => !core.includes(symbol));
  const layerTwo = layerTwoYahooSymbols().filter((symbol) => !core.includes(symbol));
  const required = uniqueSymbols([...core, ...OPTIONAL_BENCHMARKS, ...layerOne, ...layerTwo]);
  if (required.length >= budget) {
    return required.slice(0, budget);
  }

  const holdings = representativeHoldingSymbols().filter((symbol) => !required.includes(symbol));
  const shardStart = holdings.length === 0 ? 0 : Math.floor(now.getTime() / (15 * 60_000)) % holdings.length;
  const orderedHoldings = [...holdings.slice(shardStart), ...holdings.slice(0, shardStart)];
  return uniqueSymbols([...required, ...orderedHoldings]).slice(0, budget);
}

export function buildCoreRefreshSymbols(budget: number): string[] {
  const required = uniqueSymbols([
    ...coreSymbols(),
    ...OPTIONAL_BENCHMARKS,
    ...layerOneYahooSymbols(),
    ...layerTwoYahooSymbols(),
  ]);
  return required.slice(0, Math.max(coreSymbols().length, budget));
}

export function buildHoldingRefreshSymbols(now: Date, budget: number, candidates = representativeHoldingSymbols()): string[] {
  const holdings = uniqueSymbols(candidates);
  if (holdings.length === 0) return [];
  const shardStart = Math.floor(now.getTime() / (15 * 60_000)) % holdings.length;
  const orderedHoldings = [...holdings.slice(shardStart), ...holdings.slice(0, shardStart)];
  return orderedHoldings.slice(0, Math.max(0, budget));
}

export function hasPartialHoldingRefresh(fetchSymbols: string[]): boolean {
  const fetched = new Set(fetchSymbols);
  return representativeHoldingSymbols().some((symbol) => !fetched.has(symbol));
}

export function buildInstrumentRows(): InstrumentRow[] {
  const bySymbol = new Map<string, InstrumentRow>();
  bySymbol.set(BENCHMARK, instrument(BENCHMARK, "SPDR S&P 500 ETF Trust", "benchmark", null));
  OPTIONAL_BENCHMARKS.forEach((symbol) => bySymbol.set(symbol, instrument(symbol, symbol, "benchmark", null)));

  for (const sector of SECTORS) {
    bySymbol.set(sector.symbol, instrument(sector.symbol, sector.name, "etf", sector.symbol));
    for (const holding of sector.representativeHoldings) {
      if (!bySymbol.has(holding)) {
        bySymbol.set(holding, instrument(holding, holding, "equity", sector.symbol));
      }
    }
  }

  for (const input of LAYER_TWO_INPUTS) {
    for (const symbol of input.yahooSymbols) {
      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, instrument(symbol, input.title, "macro_proxy", null));
      }
    }
  }

  for (const input of LAYER_ONE_INPUTS) {
    if (!bySymbol.has(input.symbol)) {
      bySymbol.set(input.symbol, instrument(input.symbol, input.title, "macro_proxy", null));
    }
  }

  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function uniqueSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

function instrument(
  symbol: string,
  name: string,
  assetType: InstrumentRow["asset_type"],
  sectorCode: string | null,
): InstrumentRow {
  return {
    instrument_id: symbol,
    symbol,
    name,
    asset_type: assetType,
    market: MARKET,
    sector_code: sectorCode,
    is_active: 1,
  };
}
