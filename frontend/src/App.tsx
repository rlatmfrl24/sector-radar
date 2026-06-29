import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ContextRail,
  DashboardTopBar,
  FlowLiquidityView,
  FreshnessBar,
  LayerThreeLeadership,
  LoadingScreen,
} from "./features/radar/components";
import {
  groupByQuadrant,
  hasHealthyBreadth,
  isWarningSector,
  isWeakBreadth,
  sortSectors,
  type RadarView,
} from "./features/radar/model";
import { loadHistory, refreshData } from "./lib/api";
import {
  loadDashboardSnapshot,
  selectSnapshotSectorCode,
  snapshotSyncInterval,
  type DashboardSnapshot,
} from "./lib/dashboardSnapshot";
import type { HistoryResponse, HistoryTimeframe, SectorsResponse, ValidationResponse } from "./types";

function App() {
  const [data, setData] = useState<SectorsResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [activeView, setActiveView] = useState<RadarView>("flow");
  const [historyTimeframe, setHistoryTimeframe] = useState<HistoryTimeframe>("90D");
  const [selectedCode, setSelectedCode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyDashboardSnapshot = useCallback(
    (snapshot: DashboardSnapshot, preserveSelected: boolean) => {
      setData(snapshot.data);
      setHistory(snapshot.history);
      setValidation(snapshot.validation);
      setSelectedCode((current) => selectSnapshotSectorCode(current, snapshot.data.sectors, preserveSelected));
    },
    [],
  );

  const reloadDashboardSnapshot = useCallback(
    async (preserveSelected = true) => {
      const snapshot = await loadDashboardSnapshot(historyTimeframe);
      applyDashboardSnapshot(snapshot, preserveSelected);
      return snapshot;
    },
    [applyDashboardSnapshot, historyTimeframe],
  );

  useEffect(() => {
    let active = true;
    void loadDashboardSnapshot("90D").then((snapshot) => {
      if (!active) return;
      applyDashboardSnapshot(snapshot, false);
    });
    return () => {
      active = false;
    };
  }, [applyDashboardSnapshot]);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const syncSnapshot = () => {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      void loadDashboardSnapshot(historyTimeframe)
        .then((snapshot) => {
          if (active) applyDashboardSnapshot(snapshot, true);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };

    const intervalMs = snapshotSyncInterval(data?.data_connection.status);
    const intervalId = window.setInterval(syncSnapshot, intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncSnapshot();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyDashboardSnapshot, data?.data_connection.status, historyTimeframe]);


  const sectors = data?.sectors ?? [];
  const selected = sectors.find((sector) => sector.sector_code === selectedCode) ?? sectors[0];
  const rankedSectors = useMemo(() => sortSectors(sectors), [sectors]);
  const grouped = useMemo(() => groupByQuadrant(sectors), [sectors]);
  const warnings = useMemo(() => sectors.filter(isWarningSector), [sectors]);
  const healthyBreadthCount = sectors.filter(hasHealthyBreadth).length;
  const weakBreadthCount = sectors.filter(isWeakBreadth).length;

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshData();
      await reloadDashboardSnapshot(true);
    } catch {
      await reloadDashboardSnapshot(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleHistoryTimeframeChange(timeframe: HistoryTimeframe) {
    setHistoryTimeframe(timeframe);
    setHistory(await loadHistory(timeframe));
  }

  if (!data || !selected) {
    return <LoadingScreen />;
  }

  return (
    <main className="dashboard-shell">
      <DashboardTopBar
        activeView={activeView}
        data={data}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onViewChange={setActiveView}
      />
      <section className="view-workspace" aria-label="sector radar workspace">
        <FreshnessBar data={data} />
        <ContextRail data={data} />
        {activeView === "flow" ? (
          <FlowLiquidityView
            grouped={grouped}
            healthyBreadthCount={healthyBreadthCount}
            layerOneFlow={data.layer1_flow}
            marketContext={data.market_context ?? []}
            contextHistory={history?.market_context ?? []}
            contextReconciliation={data.context_reconciliation}
            sectors={rankedSectors}
            selected={selected}
            watchlist={data.watchlist ?? []}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
        ) : (
          <LayerThreeLeadership
            onSelect={setSelectedCode}
            sectors={rankedSectors}
            selected={selected}
            selectedCode={selected.sector_code}
            history={history}
            historyTimeframe={historyTimeframe}
            onHistoryTimeframeChange={handleHistoryTimeframeChange}
            validation={validation}
            warnings={warnings}
          />
        )}
      </section>
    </main>
  );
}

export default App;
