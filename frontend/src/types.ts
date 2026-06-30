export type ConvictionLabel = "low" | "medium" | "high";

export interface ModuleState {
  state: string;
  transition: string;
  strength: number;
  evidence: Record<string, number | string | null>;
  warnings: string[];
}

export interface RulebookOutput {
  lead_pattern: string;
  direction: string;
  strength: number;
  conviction_label: ConvictionLabel;
  narrative: string;
  risks: string[];
  invalidation: string[];
  source_metrics: Record<string, unknown>;
  data_freshness: Record<string, unknown>;
}

export interface SectorSnapshot {
  as_of: string;
  benchmark: string;
  sector_code: string;
  sector_name: string;
  quadrant: "leading" | "improving" | "weakening" | "lagging" | "unknown";
  modules: {
    relative_strength: ModuleState;
    momentum?: ModuleState;
    breadth: ModuleState;
    participation: ModuleState;
  };
  rulebook: RulebookOutput;
  validation: {
    status: string;
    expose_probability: boolean;
  };
  data_freshness: {
    latest_price_date?: string;
    computed_at?: string;
    [key: string]: unknown;
  };
}

export type DataConnectionMode = "live" | "stale" | "sample" | "read_only";
export type DataConnectionStatus =
  | "never_run"
  | "success"
  | "refreshing"
  | "skipped_rate_limited"
  | "failed";

export interface DataConnection {
  provider: "yahoo_finance" | "none" | string;
  mode: DataConnectionMode;
  status: DataConnectionStatus;
  refresh_interval_minutes: number;
  last_attempt_at?: string;
  last_success_at?: string;
  next_allowed_at?: string;
  latest_price_date?: string;
  symbol_count?: number;
  rows_upserted?: number;
  manual_refresh_available: boolean;
  message?: string;
}

export type MarketContextAvailability = "live" | "proxy" | "manual" | "hold";
export type MarketContextSourceClass = "official" | "proxy" | "manual" | "held";

export interface MarketContextCard {
  availability: MarketContextAvailability;
  code: string;
  data_freshness: Record<string, number | string | null>;
  evidence: Record<string, number | string | null>;
  meaning: string;
  source: string;
  source_class: MarketContextSourceClass;
  state: string;
  title: string;
  transition: string;
  warnings: string[];
}

export type DataConnections = Record<string, DataConnection>;

export interface LeadershipConcentration {
  method: string;
  source_class: "proxy" | "official" | string;
  hhi: number | null;
  effective_sector_count: number | null;
  top1: string | null;
  top1_contribution: number | null;
  top3_contribution: number | null;
  warnings: string[];
}

export type SourceFreshnessProvider =
  | "yahoo_finance"
  | "fred"
  | "krx_openapi"
  | "manual"
  | "unknown";
export type SourceFreshnessStatus = "live" | "stale" | "unavailable" | "manual_check";
export type SourceFreshnessFrequency = "intraday_gate" | "daily" | "weekly" | "manual" | "unknown";

export interface SourceFreshnessItem {
  id: string;
  label: string;
  provider: SourceFreshnessProvider;
  series_id?: string;
  source_class: MarketContextSourceClass;
  frequency: SourceFreshnessFrequency;
  latest_date?: string;
  stale: boolean;
  status: SourceFreshnessStatus;
  warning?: string;
}

export type SourceExpansionLayer = "layer1" | "layer2";
export type SourceExpansionKind = "official" | "price" | "supplemental" | "manual" | "held";
export type SourceExpansionStatus = "active" | "candidate" | "deferred";

export interface SourceExpansionItem {
  id: string;
  layer: SourceExpansionLayer;
  area: string;
  label: string;
  provider: SourceFreshnessProvider | "cboe" | "sec_edgar" | "treasury_fiscaldata" | "finra";
  route: string;
  source_kind: SourceExpansionKind;
  status: SourceExpansionStatus;
  cadence: string;
  purpose: string;
  current_signal: string;
  next_step: string;
  latest_date?: string;
  warning?: string;
}

export type TriggerWatchlistStatus = "quiet" | "fired" | "unknown" | "manual_check";

export interface TriggerWatchlistItem {
  id: string;
  label: string;
  trigger: string;
  meaning: string;
  status: TriggerWatchlistStatus;
  source_class: MarketContextSourceClass;
  evidence: Record<string, string | number | null>;
  warnings: string[];
}

export type ContextReconciliationState =
  | "supportive"
  | "divergent"
  | "risk_rising"
  | "rotation_watch"
  | "data_insufficient";
export type ContextReconciliationTransition = "strengthening" | "weakening" | "stable" | "unknown";

export interface ContextReconciliation {
  state: ContextReconciliationState;
  transition: ContextReconciliationTransition;
  narrative: string;
  evidence: Record<string, string | number | null>;
  warnings: string[];
}

export interface LayerOneFlowSnapshot {
  as_of?: string;
  state: "constructive" | "caution" | "mixed" | "data_insufficient";
  transition: "strengthening" | "weakening" | "stable" | "unknown";
  narrative: string;
  tape: {
    benchmark: "SPY";
    latest_close: number | null;
    latest_date?: string;
    ret_1d: number | null;
    ret_1w: number | null;
    ret_1m: number | null;
    ret_3m: number | null;
    range_52w_position: number | null;
    realized_vol_20: number | null;
  };
  risk: {
    state: "calm" | "elevated" | "unknown";
    transition: "cooling" | "heating" | "stable" | "unknown";
    vix_latest: number | null;
    vix_change_5d: number | null;
    realized_vol_20: number | null;
  };
  breadth_quality: {
    state: "broad" | "narrow" | "mixed" | "unknown";
    transition: "improving" | "weakening" | "stable" | "unknown";
    healthy_sectors: number;
    weak_sectors: number;
    total_sectors: number;
    rsp_vs_spy_1m: number | null;
    iwm_vs_spy_1m: number | null;
    qqq_vs_spy_1m: number | null;
    holding_coverage_fresh: number | null;
    holding_coverage_total: number | null;
  };
  evidence: Record<string, number | string | null>;
  warnings: string[];
  data_freshness: {
    provider: "yahoo_finance";
    source_class: "proxy";
    series: Array<{
      series_id: string;
      latest_date?: string;
      source?: string;
      fetched_at?: string;
    }>;
  };
}

export interface SectorsResponse {
  as_of: string | null;
  benchmark: string;
  sectors: SectorSnapshot[];
  validation: {
    status: string;
    expose_probability: boolean;
  };
  source: "local_sqlite" | "d1" | "sample";
  data_connection: DataConnection;
  data_connections?: DataConnections;
  market_context?: MarketContextCard[];
  layer1_flow?: LayerOneFlowSnapshot;
  concentration?: LeadershipConcentration;
  source_freshness?: SourceFreshnessItem[];
  source_expansion?: SourceExpansionItem[];
  watchlist?: TriggerWatchlistItem[];
  context_reconciliation?: ContextReconciliation;
}

export interface RefreshResponse {
  status: "success" | "skipped_rate_limited" | "failed" | "refresh_unavailable_in_pages";
  data_connection: DataConnection;
}

export interface HistoryResponse {
  market: string;
  timeframe?: HistoryTimeframe;
  limit?: number;
  coverage?: {
    requested_days: number;
    available_sector_days: number;
    effective_days: number;
    limited_by_data: boolean;
  };
  sectors: Array<{
    sector_code: string;
    trail: Array<{
      date: string;
      rs_ratio: number | null;
      rs_momentum: number | null;
      quadrant: string;
      strength: number | null;
    }>;
  }>;
  market_context: Array<{
    code: string;
    points: Array<{
      date: string;
      state: string;
      transition: string;
      source_class: string;
      data_freshness: Record<string, unknown>;
    }>;
  }>;
  status: "ok" | "degraded";
  message?: string;
}

export type HistoryTimeframe = "30D" | "90D" | "180D";

export type ValidationStatus = "historical_ready" | "insufficient_history" | "unvalidated";
export type ValidationReplayStatus = "collecting" | "limited" | "ready";
export type ValidationPatternStatus = "collecting" | "ready" | "thin_sample";
export type ValidationProbabilityMode = "hidden" | "sample_observed";
export type ValidationReliabilityLabel = "low" | "medium" | "high";

export interface ValidationResponse {
  status: ValidationStatus;
  expose_probability: boolean;
  scorecard: {
    sector_rrg_ic: number | null;
    pattern_hit_rate: number | null;
    sample_size: number;
  };
  coverage: {
    sector_snapshots: number;
    sector_history_days: number;
    market_context_points: number;
    market_context_days: number;
  };
  replay_windows?: Array<{
    timeframe: HistoryTimeframe;
    requested_days: number;
    available_sector_days: number;
    effective_days: number;
    limited_by_data: boolean;
    status: ValidationReplayStatus;
  }>;
  pattern_diagnostics?: Array<{
    pattern: string;
    sample_size: number;
    evaluated_20d: number;
    evaluated_60d: number;
    fwd_rel_20d_median: number | null;
    fwd_rel_60d_median: number | null;
    max_drawdown_20d_median: number | null;
    leading_after_20d_count: number;
    observed_probability_20d?: number | null;
    observed_probability_60d?: number | null;
    positive_20d_count?: number;
    positive_60d_count?: number;
    reliability_label?: ValidationReliabilityLabel;
    reliability_score?: number;
    status: ValidationPatternStatus;
    next_step: string;
  }>;
  probability_mode?: ValidationProbabilityMode;
  schedule?: {
    api: string;
    cron: string;
    last_run_at: string | null;
    last_run_status: string | null;
    run_type: string;
  };
  limitations: string[];
}
