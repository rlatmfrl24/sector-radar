export type RefreshStatus =
  | "never_run"
  | "success"
  | "refreshing"
  | "skipped_rate_limited"
  | "failed";

export interface DataRefreshStatusRow {
  provider: string;
  status: RefreshStatus;
  last_attempt_at?: string | null;
  last_success_at?: string | null;
  next_allowed_at?: string | null;
  latest_price_date?: string | null;
  symbol_count: number;
  rows_upserted: number;
  message?: string | null;
}

export interface PriceBar {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface SeriesRow {
  series_id: string;
  date: string;
  field: "open" | "high" | "low" | "close" | "volume";
  value: number;
  source: string;
  fetched_at: string;
}

export interface InstrumentRow {
  instrument_id: string;
  symbol: string;
  name: string;
  asset_type: "benchmark" | "etf" | "equity" | "macro_proxy";
  market: string;
  sector_code: string | null;
  is_active: 0 | 1;
}

export interface SectorMetricRow {
  market: string;
  sector_code: string;
  date: string;
  benchmark: string;
  ret_1m: number | null;
  ret_3m: number | null;
  ret_6m: number | null;
  ret_12m: number | null;
  excess_ret_3m: number | null;
  rs_ratio: number | null;
  rs_momentum: number | null;
  rrg_quadrant: string;
  pct_above_20ma: number | null;
  pct_above_50ma: number | null;
  pct_above_200ma: number | null;
  breadth_state: string;
  breadth_transition: string;
  rvol_20: number | null;
  obv_slope_20: number | null;
  cmf_20: number | null;
  participation_state: string;
  participation_transition: string;
  catalyst_state: string | null;
  catalyst_transition: string | null;
  rule_pattern: string;
  direction: string;
  strength: number;
  conviction_label: "low" | "medium" | "high";
  narrative: string;
  risks_json: string;
  invalidation_json: string;
  source_metrics_json: string;
  data_freshness_json: string;
  validation_status: "unvalidated";
  expose_probability: 0;
  computed_at: string;
}

export interface ProviderFailure {
  symbol: string;
  message: string;
  body_preview?: string;
  host?: string;
  status?: number;
}

export interface ProviderFetchResult {
  bars: PriceBar[];
  failures: ProviderFailure[];
}

export interface RunLogRow {
  run_id: string;
  run_type: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  message?: string | null;
}

export interface MarketDataProvider {
  readonly name: string;
  fetchDaily(symbols: string[], range: string): Promise<ProviderFetchResult>;
}

export interface RefreshStore {
  readStatus(provider: string): Promise<DataRefreshStatusRow | null>;
  upsertStatus(row: DataRefreshStatusRow): Promise<void>;
  upsertRunLog(row: RunLogRow): Promise<void>;
  upsertInstruments(rows: InstrumentRow[]): Promise<void>;
  upsertSeries(rows: SeriesRow[]): Promise<number>;
  readSeries(symbols: string[], startDate: string): Promise<SeriesRow[]>;
  upsertSectorMetrics(rows: SectorMetricRow[]): Promise<void>;
}

export interface RefreshOutcome {
  status: RefreshStatus;
  data_connection: {
    provider: string;
    mode: "live" | "stale" | "sample" | "read_only";
    status: RefreshStatus;
    refresh_interval_minutes: number;
    last_attempt_at?: string;
    last_success_at?: string;
    next_allowed_at?: string;
    latest_price_date?: string;
    symbol_count?: number;
    rows_upserted?: number;
    manual_refresh_available: boolean;
    message?: string;
  };
}
