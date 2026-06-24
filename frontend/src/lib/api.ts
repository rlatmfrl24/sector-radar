import { sampleSectorsResponse } from "../data/sampleSectors";
import type { DataConnection, RefreshResponse, SectorsResponse } from "../types";

export async function loadSectors(): Promise<SectorsResponse> {
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
