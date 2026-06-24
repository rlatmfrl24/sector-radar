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
}

export interface RefreshResponse {
  status: "success" | "skipped_rate_limited" | "failed" | "refresh_unavailable_in_pages";
  data_connection: DataConnection;
}
