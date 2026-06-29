import { Database } from "lucide-react";

import type { HistoryResponse, HistoryTimeframe, SectorSnapshot, ValidationResponse } from "../../../types";
import {
  clamp,
  directionLabel,
  formatSigned,
  groupByQuadrant,
  numberMetric,
  patternClass,
  quadrantLabels,
} from "../model";
import { LayerHeader, ListBlock, MiniMetric, ModuleMeter, PanelHeader } from "./common";
import { VerificationPanel } from "./VerificationPanel";

const RRG_MIN_POS = 12;
const RRG_MAX_POS = 88;

export function LayerThreeLeadership({
  history,
  historyTimeframe,
  onSelect,
  onHistoryTimeframeChange,
  sectors,
  selected,
  selectedCode,
  validation,
  warnings,
}: {
  history: HistoryResponse | null;
  historyTimeframe: HistoryTimeframe;
  onSelect: (sectorCode: string) => void;
  onHistoryTimeframeChange: (timeframe: HistoryTimeframe) => void;
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  selectedCode: string;
  validation: ValidationResponse | null;
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
      <TimeframeSelector active={historyTimeframe} onChange={onHistoryTimeframeChange} />
      <section className="leadership-workspace" aria-label="leadership dashboard">
        <SectorRail
          onSelect={onSelect}
          sectors={sectors}
          selectedCode={selectedCode}
          warnings={warnings}
        />
        <section className="analysis-stack" aria-label="leadership analysis">
          <RrgPlot history={history} onSelect={onSelect} sectors={sectors} selectedCode={selectedCode} />
          <SectorTreemap onSelect={onSelect} sectors={sectors} selectedCode={selectedCode} />
        </section>
        <SelectedSectorPanel sector={selected} validation={validation} />
      </section>
    </section>
  );
}

function TimeframeSelector({
  active,
  onChange,
}: {
  active: HistoryTimeframe;
  onChange: (timeframe: HistoryTimeframe) => void;
}) {
  const timeframes: HistoryTimeframe[] = ["30D", "90D", "180D"];
  return (
    <div className="timeframe-selector" aria-label="history timeframe">
      <span>History</span>
      {timeframes.map((timeframe) => (
        <button
          aria-pressed={active === timeframe}
          className={active === timeframe ? "active" : ""}
          key={timeframe}
          onClick={() => onChange(timeframe)}
          type="button"
        >
          {timeframe}
        </button>
      ))}
    </div>
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
  history,
  onSelect,
  sectors,
  selectedCode,
}: {
  history: HistoryResponse | null;
  onSelect: (sectorCode: string) => void;
  sectors: SectorSnapshot[];
  selectedCode: string;
}) {
  const selectedTrail = history?.sectors.find((item) => item.sector_code === selectedCode)?.trail ?? [];
  const trailPoints = selectedTrail
    .filter((point) => point.rs_ratio !== null && point.rs_momentum !== null)
    .map(
      (point) =>
        `${clamp(50 + (point.rs_ratio! - 100) * 4.8, RRG_MIN_POS, RRG_MAX_POS)},${clamp(
          50 - (point.rs_momentum! - 100) * 7.4,
          RRG_MIN_POS,
          RRG_MAX_POS,
        )}`,
    )
    .join(" ");
  const trailCoordinates = trailPoints
    ? trailPoints
        .split(" ")
        .map((point): [number, number] => {
          const [x, y] = point.split(",").map(Number);
          return [x, y];
        })
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    : [];
  const trailPath = buildTrailPath(trailCoordinates);
  const historicalTrailPoints = trailCoordinates.slice(0, -1);
  const trailMarkerStride = Math.max(1, Math.ceil(historicalTrailPoints.length / 5));
  const trailMarkers = historicalTrailPoints.filter(
    (_, index) => index % trailMarkerStride === 0 || index === historicalTrailPoints.length - 1,
  );

  return (
    <article className="dashboard-panel rrg-card">
      <PanelHeader eyebrow="RRG" title="순환매" meta="RS Ratio × RS Momentum" inverted />
      <div className="rrg-plot">
        {trailPath ? (
          <>
            <svg
              aria-hidden="true"
              className="rrg-trail"
              focusable="false"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path className="trail-underlay" d={trailPath} pathLength={100} vectorEffect="non-scaling-stroke" />
              <path className="trail-line" d={trailPath} pathLength={100} vectorEffect="non-scaling-stroke" />
            </svg>
            <div aria-hidden="true" className="rrg-trail-points">
              {trailMarkers.map(([x, y], index) => (
                <span
                  key={`${x}-${y}-${index}`}
                  style={{
                    left: `${x}%`,
                    opacity: 0.42 + (trailMarkers.length > 1 ? index / (trailMarkers.length - 1) : 1) * 0.24,
                    top: `${y}%`,
                  }}
                />
              ))}
            </div>
          </>
        ) : null}
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
                left: `${clamp(50 + (rs - 100) * 4.8, RRG_MIN_POS, RRG_MAX_POS)}%`,
                top: `${clamp(50 - (momentum - 100) * 7.4, RRG_MIN_POS, RRG_MAX_POS)}%`,
              }}
              type="button"
            >
              {sector.sector_code}
            </button>
          );
        })}
      </div>
      <RrgCompactSummary sectors={sectors} selectedCode={selectedCode} />
    </article>
  );
}

function buildTrailPath(points: [number, number][]) {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  const commands = [`M ${points[0][0]} ${points[0][1]}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index];
    const [nextX, nextY] = points[index + 1];
    commands.push(`Q ${x} ${y} ${(x + nextX) / 2} ${(y + nextY) / 2}`);
  }
  const [lastX, lastY] = points[points.length - 1];
  commands.push(`L ${lastX} ${lastY}`);
  return commands.join(" ");
}

function RrgCompactSummary({
  sectors,
  selectedCode,
}: {
  sectors: SectorSnapshot[];
  selectedCode: string;
}) {
  const grouped = groupByQuadrant(sectors);
  const selected = sectors.find((sector) => sector.sector_code === selectedCode) ?? sectors[0];
  const leaders = [...grouped.leading, ...grouped.improving].slice(0, 4);

  return (
    <div className="rrg-compact-summary" aria-label="compact RRG summary">
      <div className="rrg-compact-selected">
        <span>{selected?.sector_code ?? "N/A"}</span>
        <strong>{selected ? quadrantLabels[selected.quadrant] : "Unknown"}</strong>
        <small>
          RS {selected ? numberMetric(selected.modules.relative_strength.evidence.rs_ratio, 100).toFixed(1) : "N/A"} ·
          MOM {selected ? numberMetric(selected.modules.relative_strength.evidence.rs_momentum, 100).toFixed(1) : "N/A"}
        </small>
      </div>
      <div className="rrg-compact-grid">
        <MiniMetric label="Leading" value={`${grouped.leading.length}`} />
        <MiniMetric label="Improving" value={`${grouped.improving.length}`} />
        <MiniMetric label="Weakening" value={`${grouped.weakening.length}`} />
        <MiniMetric label="Lagging" value={`${grouped.lagging.length}`} />
      </div>
      <div className="rrg-compact-leaders">
        {leaders.length ? leaders.map((sector) => <span key={sector.sector_code}>{sector.sector_code}</span>) : <span>no leaders</span>}
      </div>
    </div>
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
  validation,
}: {
  sector: SectorSnapshot;
  validation: ValidationResponse | null;
}) {
  const rrgWindows = multiWindowRrg(sector);
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

      <div className="rrg-window-strip" aria-label="multi-window RRG">
        {rrgWindows.map((window) => (
          <span className={window.quadrant} key={window.label}>
            <strong>{window.label}</strong>
            {window.quadrant}
          </span>
        ))}
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
      <VerificationPanel validation={validation} />
    </aside>
  );
}

function multiWindowRrg(sector: SectorSnapshot) {
  const evidence = sector.modules.relative_strength.evidence;
  return ["1m", "3m", "6m", "12m"].map((label) => ({
    label,
    quadrant: String(evidence[`rrg_${label}_quadrant`] ?? "unknown"),
  }));
}
