import {
  sampleSectorsResponse,
  sourceExampleHistoryResponse,
  sourceExampleSectorsResponse,
  sourceExampleValidationResponse,
} from "../data/sampleSectors";
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
  if (useSourceExamples()) {
    return sourceExampleHistoryResponse(timeframe);
  }

  try {
    const response = await fetch(`/api/history?timeframe=${encodeURIComponent(timeframe)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`History returned ${response.status}`);
    const data = (await response.json()) as HistoryResponse;
    if (!hasHistoryCoverage(data)) {
      return sourceExampleHistoryResponse(
        timeframe,
        "degraded",
        "History API returned no rows; temporary Layer 4 fixture is displayed.",
      );
    }
    return data;
  } catch {
    return sourceExampleHistoryResponse(
      timeframe,
      "degraded",
      "History API unavailable; temporary Layer 4 fixture is displayed.",
    );
  }
}

function hasHistoryCoverage(data: HistoryResponse) {
  const coverageDays = data.coverage?.available_sector_days ?? 0;
  const trailPoints = data.sectors.reduce((count, sector) => count + sector.trail.length, 0);
  return coverageDays > 0 || trailPoints > 0;
}

export async function loadValidation(): Promise<ValidationResponse> {
  if (useSourceExamples()) {
    return sourceExampleValidationResponse;
  }

  try {
    const response = await fetch("/api/validation", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Validation returned ${response.status}`);
    const data = (await response.json()) as ValidationResponse;
    if (!hasValidationCoverage(data)) {
      return sourceExampleValidationResponse;
    }
    return data;
  } catch {
    return sourceExampleValidationResponse;
  }
}

function hasValidationCoverage(data: ValidationResponse) {
  return (
    data.coverage.sector_snapshots > 0 ||
    data.coverage.sector_history_days > 0 ||
    data.coverage.market_context_points > 0 ||
    data.coverage.market_context_days > 0
  );
}
