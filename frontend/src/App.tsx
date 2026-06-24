import { useEffect, useMemo, useState } from "react";

import {
  DashboardTopBar,
  FlowLiquidityView,
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
import { loadSectors, refreshData } from "./lib/api";
import type { SectorsResponse } from "./types";

function App() {
  const [data, setData] = useState<SectorsResponse | null>(null);
  const [activeView, setActiveView] = useState<RadarView>("flow");
  const [selectedCode, setSelectedCode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSectors().then((response) => {
      if (!active) return;
      setData(response);
      setSelectedCode(response.sectors[0]?.sector_code ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

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
      const refresh = await refreshData();
      const response = await loadSectors();
      setData({
        ...response,
        data_connection: refresh.data_connection ?? response.data_connection,
      });
      setSelectedCode((current) => current || (response.sectors[0]?.sector_code ?? ""));
    } catch {
      setData(await loadSectors());
    } finally {
      setIsRefreshing(false);
    }
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
        {activeView === "flow" ? (
          <FlowLiquidityView
            grouped={grouped}
            healthyBreadthCount={healthyBreadthCount}
            sectors={rankedSectors}
            selected={selected}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
        ) : (
          <LayerThreeLeadership
            onSelect={setSelectedCode}
            sectors={rankedSectors}
            selected={selected}
            selectedCode={selected.sector_code}
            warnings={warnings}
          />
        )}
      </section>
    </main>
  );
}

export default App;
