import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ContextRail,
  DashboardTopBar,
  FreshnessBar,
  LayerOneFlowView,
  LayerThreeLeadership,
  LayerTwoLiquidityView,
  LoadingScreen,
} from "./features/radar/components";
import {
  groupByQuadrant,
  hasHealthyBreadth,
  isWarningSector,
  isWeakBreadth,
  sortSectors,
  sortSectorsByMomentum,
  type RadarView,
} from "./features/radar/model";
import { loadHistory, refreshData } from "./lib/api";
import {
  loadDashboardSnapshot,
  selectSnapshotSectorCode,
  snapshotSyncInterval,
  type DashboardSnapshot,
} from "./lib/dashboardSnapshot";
import { readExplainModePreference, writeExplainModePreference } from "./lib/explainMode";
import type { HistoryResponse, HistoryTimeframe, SectorsResponse, ValidationResponse } from "./types";

function App() {
  const [data, setData] = useState<SectorsResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [activeView, setActiveView] = useState<RadarView>("layer1");
  const [explainMode, setExplainMode] = useState(() => readExplainModePreference());
  const [historyTimeframe, setHistoryTimeframe] = useState<HistoryTimeframe>("90D");
  const [selectedCode, setSelectedCode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyDashboardSnapshot = useCallback(
    (snapshot: DashboardSnapshot, preserveSelected: boolean) => {
      setData(snapshot.data);
      setHistory(snapshot.history);
      setValidation(snapshot.validation);
      setSelectedCode((current) => selectSnapshotSectorCode(current, sortSectors(snapshot.data.sectors), preserveSelected));
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
  const rankedSectors = useMemo(() => sortSectors(sectors), [sectors]);
  const momentumSectors = useMemo(() => sortSectorsByMomentum(sectors), [sectors]);
  const selected = sectors.find((sector) => sector.sector_code === selectedCode) ?? rankedSectors[0] ?? sectors[0];
  const selectedLeadershipSector =
    rankedSectors.find((sector) => sector.sector_code === selectedCode) ?? rankedSectors[0] ?? selected;
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

  function handleExplainModeChange(nextExplainMode: boolean) {
    setExplainMode(nextExplainMode);
    writeExplainModePreference(nextExplainMode);
  }

  if (!data || !selected) {
    return <LoadingScreen />;
  }

  return (
    <main className="dashboard-shell">
      <DashboardTopBar
        activeView={activeView}
        data={data}
        explainMode={explainMode}
        isRefreshing={isRefreshing}
        onExplainModeChange={handleExplainModeChange}
        onRefresh={handleRefresh}
        onViewChange={setActiveView}
      />
      <section className="view-workspace" aria-label="sector radar workspace">
        <FreshnessBar activeView={activeView} data={data} />
        <ContextRail activeView={activeView} data={data} />
        {activeView === "layer1" ? (
          <LayerOneFlowView
            explainMode={explainMode}
            grouped={grouped}
            healthyBreadthCount={healthyBreadthCount}
            layerOneFlow={data.layer1_flow}
            reconciliation={data.context_reconciliation}
            sectors={rankedSectors}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
        ) : activeView === "layer2" ? (
          <LayerTwoLiquidityView
            contextHistory={history?.market_context ?? []}
            marketContext={data.market_context ?? []}
            sectors={rankedSectors}
            selected={selected}
            watchlist={data.watchlist ?? []}
          />
        ) : (
          <LayerThreeLeadership
            currentLeader={rankedSectors[0]}
            onSelect={setSelectedCode}
            momentumLeader={momentumSectors[0]}
            sectors={momentumSectors}
            selected={selectedLeadershipSector}
            selectedCode={selectedLeadershipSector.sector_code}
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
