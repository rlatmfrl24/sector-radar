import { loadHistory, loadSectors, loadValidation } from "./api";
import type { HistoryResponse, HistoryTimeframe, SectorsResponse, SectorSnapshot, ValidationResponse } from "../types";

export const SNAPSHOT_SYNC_INTERVAL_MS = 30_000;
export const SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS = 5_000;

export interface DashboardSnapshot {
  data: SectorsResponse;
  history: HistoryResponse;
  validation: ValidationResponse;
}

export interface DashboardSnapshotLoaders {
  loadHistory: (timeframe: HistoryTimeframe) => Promise<HistoryResponse>;
  loadSectors: () => Promise<SectorsResponse>;
  loadValidation: () => Promise<ValidationResponse>;
}

const defaultLoaders: DashboardSnapshotLoaders = {
  loadHistory,
  loadSectors,
  loadValidation,
};

export async function loadDashboardSnapshot(
  timeframe: HistoryTimeframe,
  loaders: DashboardSnapshotLoaders = defaultLoaders,
): Promise<DashboardSnapshot> {
  const [data, history, validation] = await Promise.all([
    loaders.loadSectors(),
    loaders.loadHistory(timeframe),
    loaders.loadValidation(),
  ]);
  return { data, history, validation };
}

export function selectSnapshotSectorCode(
  currentCode: string,
  sectors: SectorSnapshot[],
  preserveSelected: boolean,
) {
  if (preserveSelected && currentCode && sectors.some((sector) => sector.sector_code === currentCode)) {
    return currentCode;
  }
  return sectors[0]?.sector_code ?? "";
}

export function snapshotSyncInterval(status?: string) {
  return status === "refreshing" ? SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS : SNAPSHOT_SYNC_INTERVAL_MS;
}
