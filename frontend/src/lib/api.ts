import { sampleSectorsResponse, sourceExampleSectorsResponse } from "../data/sampleSectors";
import type {
  DataConnection,
  HistoryResponse,
  HistoryTimeframe,
  RefreshResponse,
  SectorsResponse,
  ValidationResponse,
} from "../types";
import { normalizeSectorName } from "./sectorNames";

export async function loadSectors(): Promise<SectorsResponse> {
  if (useSourceExamples()) {
    return normalizeSectorsResponse(sourceExampleSectorsResponse);
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
      return normalizeSectorsResponse(sampleSectorsResponse);
    }
    return normalizeSectorsResponse(data);
  } catch {
    return normalizeSectorsResponse(sampleSectorsResponse);
  }
}

export function normalizeSectorsResponse(data: SectorsResponse): SectorsResponse {
  return {
    ...data,
    sectors: data.sectors.map((sector) => ({
      ...sector,
      sector_name: normalizeSectorName(sector.sector_code, sector.sector_name),
    })),
  };
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
      coverage: {
        requested_days: timeframeDays(timeframe),
        available_sector_days: 0,
        effective_days: 0,
        limited_by_data: true,
      },
      sectors: [],
      market_context: [],
      status: "degraded",
      message: "History API unavailable.",
    };
  }
}

function timeframeDays(timeframe: HistoryTimeframe) {
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
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
