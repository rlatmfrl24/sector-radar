import { describe, expect, it } from "vitest";

import { sourceExampleSectorsResponse } from "../data/sampleSectors";
import type { HistoryResponse, ValidationResponse } from "../types";
import {
  loadDashboardSnapshot,
  selectSnapshotSectorCode,
  SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS,
  SNAPSHOT_SYNC_INTERVAL_MS,
  snapshotSyncInterval,
} from "./dashboardSnapshot";

const validation: ValidationResponse = {
  status: "unvalidated",
  expose_probability: false,
  scorecard: {
    pattern_hit_rate: null,
    sample_size: 0,
    sector_rrg_ic: null,
  },
  coverage: {
    market_context_days: 0,
    market_context_points: 0,
    sector_history_days: 0,
    sector_snapshots: 0,
  },
  limitations: ["Fixture validation only."],
};

const history: HistoryResponse = {
  market: "US",
  timeframe: "90D",
  sectors: [],
  market_context: [],
  status: "ok",
};

describe("dashboard snapshot flow", () => {
  it("uses the full sectors response as the dashboard data source", async () => {
    const snapshot = await loadDashboardSnapshot("90D", {
      loadSectors: async () => sourceExampleSectorsResponse,
      loadHistory: async () => history,
      loadValidation: async () => validation,
    });

    expect(snapshot.data).toBe(sourceExampleSectorsResponse);
    expect(snapshot.history).toBe(history);
    expect(snapshot.validation).toBe(validation);
    expect(snapshot.data.market_context?.length).toBeGreaterThan(0);
    expect(snapshot.data.layer1_flow?.state).toBeDefined();
  });

  it("preserves the selected sector only when it still exists in the new snapshot", () => {
    const sectors = sourceExampleSectorsResponse.sectors;

    expect(selectSnapshotSectorCode(sectors[1].sector_code, sectors, true)).toBe(sectors[1].sector_code);
    expect(selectSnapshotSectorCode("REMOVED", sectors, true)).toBe(sectors[0].sector_code);
    expect(selectSnapshotSectorCode(sectors[1].sector_code, sectors, false)).toBe(sectors[0].sector_code);
  });

  it("polls faster while a refresh is in progress", () => {
    expect(snapshotSyncInterval("refreshing")).toBe(SNAPSHOT_SYNC_ACTIVE_REFRESH_INTERVAL_MS);
    expect(snapshotSyncInterval("success")).toBe(SNAPSHOT_SYNC_INTERVAL_MS);
    expect(snapshotSyncInterval()).toBe(SNAPSHOT_SYNC_INTERVAL_MS);
  });
});
