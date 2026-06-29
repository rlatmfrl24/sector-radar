import { sampleSectorsResponse, sourceExampleSectorsResponse } from "../data/sampleSectors";
import type {
  DataConnection,
  HistoryResponse,
  HistoryTimeframe,
  RefreshResponse,
  SectorsResponse,
  ValidationResponse,
} from "../types";

export async function loadSectors(): Promise<SectorsResponse> {
  if (useSourceExamples()) {
    return sourceExampleSectorsResponse;
  }

  try {
    const response = await fetch("/api/sectors", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const data = (await response.json()) as SectorsResponse;
    if (!data.sectors.length) {
      return sampleSectorsResponse;
    }
    return data;
  } catch {
    return sampleSectorsResponse;
  }
}

function useSourceExamples() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("qa") === "source-examples" || params.get("sourceExamples") === "1";
}

export async function refreshData(): Promise<RefreshResponse> {
  const response = await fetch("/api/refresh", {
    method: "POST",
    headers: { accept: "application/json" },
  });
  const data = (await response.json()) as RefreshResponse;
  if (!response.ok && data.status !== "failed") {
    throw new Error(`Refresh returned ${response.status}`);
  }
  return data;
}

export async function loadDataStatus(): Promise<DataConnection> {
  const response = await fetch("/api/data/status", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Status returned ${response.status}`);
  }
  return (await response.json()) as DataConnection;
}

export async function loadHistory(timeframe: HistoryTimeframe = "90D"): Promise<HistoryResponse> {
  try {
    const response = await fetch(`/api/history?timeframe=${encodeURIComponent(timeframe)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`History returned ${response.status}`);
    return (await response.json()) as HistoryResponse;
  } catch {
    return {
      market: "US",
      timeframe,
      sectors: [],
      market_context: [],
      status: "degraded",
      message: "History API unavailable.",
    };
  }
}

export async function loadValidation(): Promise<ValidationResponse> {
  try {
    const response = await fetch("/api/validation", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Validation returned ${response.status}`);
    return (await response.json()) as ValidationResponse;
  } catch {
    return {
      status: "unvalidated",
      expose_probability: false,
      scorecard: {
        sector_rrg_ic: null,
        pattern_hit_rate: null,
        sample_size: 0,
      },
      coverage: {
        sector_snapshots: 0,
        sector_history_days: 0,
        market_context_points: 0,
        market_context_days: 0,
      },
      limitations: ["Validation API unavailable; probability remains hidden."],
    };
  }
}
