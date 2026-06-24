import { Database } from "lucide-react";

import type { SectorSnapshot } from "../../../types";
import {
  clamp,
  directionLabel,
  formatSigned,
  numberMetric,
  patternClass,
  quadrantLabels,
} from "../model";
import { LayerHeader, ListBlock, MiniMetric, ModuleMeter, PanelHeader } from "./common";

export function LayerThreeLeadership({
  onSelect,
  sectors,
  selected,
  selectedCode,
  warnings,
}: {
  onSelect: (sectorCode: string) => void;
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  selectedCode: string;
  warnings: SectorSnapshot[];
}) {
  return (
    <section className="layer-section layer-three" aria-label="layer three leadership">
      <LayerHeader
        description="상대강도, RRG, breadth, participation, rulebook 판정을 한 곳에서 확인합니다."
        eyebrow="Layer 3"
        meta={`${sectors.length} sector snapshots`}
        title="주도 (섹터)"
      />
      <section className="leadership-workspace" aria-label="leadership dashboard">
        <SectorRail
          onSelect={onSelect}
          sectors={sectors}
          selectedCode={selectedCode}
          warnings={warnings}
        />
        <section className="analysis-stack" aria-label="leadership analysis">
          <RrgPlot onSelect={onSelect} sectors={sectors} selectedCode={selectedCode} />
          <SectorTreemap onSelect={onSelect} sectors={sectors} selectedCode={selectedCode} />
        </section>
        <SelectedSectorPanel sector={selected} />
      </section>
    </section>
  );
}

function SectorRail({
  onSelect,
  sectors,
  selectedCode,
  warnings,
}: {
  onSelect: (sectorCode: string) => void;
  sectors: SectorSnapshot[];
  selectedCode: string;
  warnings: SectorSnapshot[];
}) {
  return (
    <aside className="sector-rail" aria-label="sector selector">
      <PanelHeader eyebrow="Sector Tier" title="리더십 순위" meta={`${warnings.length} warnings`} />
      <div className="sector-list">
        {sectors.map((sector, index) => (
          <button
            className={`sector-row ${patternClass(sector)} ${
              sector.sector_code === selectedCode ? "selected" : ""
            }`}
            key={sector.sector_code}
            onClick={() => onSelect(sector.sector_code)}
            type="button"
          >
            <span className="rank">{String(index + 1).padStart(2, "0")}</span>
            <span className="sector-row-main">
              <strong>{sector.sector_name}</strong>
              <em>
                {sector.sector_code} · {sector.rulebook.lead_pattern}
              </em>
            </span>
            <span className="sector-row-rs">
              {numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100).toFixed(1)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function RrgPlot({
  onSelect,
  sectors,
  selectedCode,
}: {
  onSelect: (sectorCode: string) => void;
  sectors: SectorSnapshot[];
  selectedCode: string;
}) {
  return (
    <article className="dashboard-panel rrg-card">
      <PanelHeader eyebrow="RRG" title="순환매" meta="RS Ratio × RS Momentum" inverted />
      <div className="rrg-plot">
        <div className="axis vertical" />
        <div className="axis horizontal" />
        <span className="corner top-left">IMPROVING</span>
        <span className="corner top-right">LEADING</span>
        <span className="corner bottom-left">LAGGING</span>
        <span className="corner bottom-right">WEAKENING</span>
        {sectors.map((sector) => {
          const rs = numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100);
          const momentum = numberMetric(sector.modules.relative_strength.evidence.rs_momentum, 100);
          return (
            <button
              aria-label={`${sector.sector_code} ${quadrantLabels[sector.quadrant]}`}
              className={`plot-dot ${sector.quadrant} ${
                sector.sector_code === selectedCode ? "active" : ""
              }`}
              key={sector.sector_code}
              onClick={() => onSelect(sector.sector_code)}
              style={{
                left: `${clamp(50 + (rs - 100) * 4.8, 8, 92)}%`,
                top: `${clamp(50 - (momentum - 100) * 7.4, 8, 92)}%`,
              }}
              type="button"
            >
              {sector.sector_code}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function SectorTreemap({
  onSelect,
  sectors,
  selectedCode,
}: {
  onSelect: (sectorCode: string) => void;
  sectors: SectorSnapshot[];
  selectedCode: string;
}) {
  return (
    <article className="dashboard-card treemap-card">
      <PanelHeader eyebrow="Map" title="섹터 트리맵" meta="pattern color" />
      <div className="treemap">
        {sectors.map((sector) => (
          <button
            className={`tree-tile ${patternClass(sector)} ${
              sector.sector_code === selectedCode ? "selected" : ""
            }`}
            key={sector.sector_code}
            onClick={() => onSelect(sector.sector_code)}
            style={{ flexGrow: Math.max(1, sector.rulebook.strength || 1) }}
            type="button"
          >
            <strong>{sector.sector_code}</strong>
            <span>{sector.sector_name}</span>
            <em>{formatSigned(numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100) - 100)}</em>
          </button>
        ))}
      </div>
    </article>
  );
}

function SelectedSectorPanel({
  sector,
}: {
  sector: SectorSnapshot;
}) {
  return (
    <aside className="selected-panel" aria-label="selected sector details">
      <PanelHeader eyebrow="Selected Sector" title={sector.sector_name} meta={sector.sector_code} />

      <div className="selected-summary">
        <div className={`quadrant-token ${sector.quadrant}`}>{quadrantLabels[sector.quadrant]}</div>
        <strong>{sector.rulebook.lead_pattern}</strong>
        <span>
          {directionLabel(sector)} · {sector.rulebook.conviction_label}
        </span>
      </div>

      <div className="metric-pair">
        <MiniMetric
          label="RS Ratio"
          value={numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100).toFixed(1)}
        />
        <MiniMetric
          label="RS Momentum"
          value={numberMetric(sector.modules.relative_strength.evidence.rs_momentum, 100).toFixed(1)}
        />
      </div>

      <div className="module-stack">
        <ModuleMeter label="Relative Strength" module={sector.modules.relative_strength} />
        <ModuleMeter label="Breadth" module={sector.modules.breadth} />
        <ModuleMeter label="Participation" module={sector.modules.participation} />
      </div>

      <div className="narrative-box">
        <span>Narrative</span>
        <p>{sector.rulebook.narrative}</p>
      </div>

      <div className="split-list">
        <ListBlock title="Risks" items={sector.rulebook.risks} />
        <ListBlock title="Invalidation" items={sector.rulebook.invalidation} />
      </div>

      <div className="freshness-row">
        <Database size={14} />
        <span>{sector.data_freshness.latest_price_date ?? sector.as_of} latest</span>
        <span>{sector.validation.status}</span>
      </div>
    </aside>
  );
}
