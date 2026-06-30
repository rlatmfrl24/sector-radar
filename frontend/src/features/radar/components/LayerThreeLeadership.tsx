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
const RRG_X_SCALE = 4.8;
const RRG_Y_SCALE = 7.4;

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
        description="최근 상대 흐름이 좋아지는 섹터를 먼저 찾고, 순환매 위치와 판정 품질을 함께 확인합니다."
        eyebrow="Layer 3"
        meta={`${sectors.length} sector snapshots`}
        title="모멘텀 (섹터)"
      />
      <TimeframeSelector active={historyTimeframe} history={history} onChange={onHistoryTimeframeChange} />
      <section className="leadership-workspace" aria-label="leadership dashboard">
        <SectorRail
          onSelect={onSelect}
          sectors={sectors}
          selectedCode={selectedCode}
          warnings={warnings}
        />
        <section className="analysis-stack" aria-label="leadership analysis">
          <div className="rrg-analysis-pair">
            <RrgPlot
              onSelect={onSelect}
              sectors={sectors}
              selectedCode={selectedCode}
            />
            <RrgMovementChart history={history} historyTimeframe={historyTimeframe} sectors={sectors} selectedCode={selectedCode} />
          </div>
          <SectorTreemap onSelect={onSelect} sectors={sectors} selectedCode={selectedCode} />
        </section>
        <SelectedSectorPanel sector={selected} validation={validation} />
      </section>
    </section>
  );
}

function TimeframeSelector({
  active,
  history,
  onChange,
}: {
  active: HistoryTimeframe;
  history: HistoryResponse | null;
  onChange: (timeframe: HistoryTimeframe) => void;
}) {
  const timeframes: HistoryTimeframe[] = ["30D", "90D", "180D"];
  const coverage = historyCoverage(history, active);
  const coverageLabel = coverage.available_sector_days
    ? `사용 가능 ${coverage.available_sector_days}일`
    : "히스토리 준비 중";
  const coverageDetail = coverage.limited_by_data
    ? `${coverage.requested_days}D 중 ${coverage.effective_days}D만 표시`
    : `${coverage.effective_days}D 표시 가능`;
  const tooltip = [
    "현재 순위와 트리맵은 최신 기준입니다.",
    "이 선택은 선택 섹터의 RRG 이동선 길이만 바꿉니다.",
    coverageDetail,
  ].join("\n");

  return (
    <div className="timeframe-selector" aria-label="history timeframe">
      <span>RRG 경로</span>
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
      <span
        aria-label={tooltip}
        className={`history-coverage-chip ${coverage.limited_by_data ? "limited" : ""} has-tooltip`}
        data-tooltip={tooltip}
        tabIndex={0}
        title={tooltip}
      >
        {coverageLabel}
      </span>
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
      <PanelHeader eyebrow="Momentum" title="좋은 모멘텀 섹터" meta={`${warnings.length} warnings`} />
      <div className="sector-list">
        {sectors.map((sector, index) => {
          const rsRatio = numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100);
          const rsMomentum = numberMetric(sector.modules.relative_strength.evidence.rs_momentum, 100);
          return (
            <button
              className={`sector-row ${patternClass(sector)} ${
                sector.sector_code === selectedCode ? "selected" : ""
              }`}
              key={sector.sector_code}
              onClick={() => onSelect(sector.sector_code)}
              title={`${sector.sector_name}: 모멘텀 ${rsMomentum.toFixed(1)}, 상대강도 ${rsRatio.toFixed(1)}`}
              type="button"
            >
              <span className="rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="sector-row-main">
                <strong>{sector.sector_name}</strong>
                <em>
                  {sector.sector_code} · 상대강도 {rsRatio.toFixed(1)} · {sector.rulebook.lead_pattern}
                </em>
              </span>
              <span className="sector-row-rs" aria-label={`모멘텀 ${rsMomentum.toFixed(1)}`}>
                {rsMomentum.toFixed(1)}
              </span>
            </button>
          );
        })}
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
      <PanelHeader eyebrow="RRG" title="순환매" meta="현재 위치" inverted />
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
          const [x, y] = toRrgCoordinate(rs, momentum);
          return (
            <button
              aria-label={`${sector.sector_code} ${quadrantLabels[sector.quadrant]}`}
              className={`plot-dot ${sector.quadrant} ${
                sector.sector_code === selectedCode ? "active" : ""
              }`}
              key={sector.sector_code}
              onClick={() => onSelect(sector.sector_code)}
              style={{
                left: `${x}%`,
                top: `${y}%`,
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

function RrgMovementChart({
  history,
  historyTimeframe,
  sectors,
  selectedCode,
}: {
  history: HistoryResponse | null;
  historyTimeframe: HistoryTimeframe;
  sectors: SectorSnapshot[];
  selectedCode: string;
}) {
  const selectedSector = sectors.find((sector) => sector.sector_code === selectedCode);
  const selectedTrail = history?.sectors.find((item) => item.sector_code === selectedCode)?.trail ?? [];
  const validTrail = selectedTrail.filter((point) => point.rs_ratio !== null && point.rs_momentum !== null);
  const coverage = historyCoverage(history, historyTimeframe);
  const ratioSeries = validTrail.map((point) => ({ date: point.date, value: point.rs_ratio! }));
  const momentumSeries = validTrail.map((point) => ({ date: point.date, value: point.rs_momentum! }));
  const values = [...ratioSeries, ...momentumSeries].map((point) => point.value);
  const domain = buildMovementDomain(values);
  const ratioPath = buildMovementPath(ratioSeries, domain);
  const momentumPath = buildMovementPath(momentumSeries, domain);
  const ratioChange = changeOverSeries(ratioSeries);
  const momentumChange = changeOverSeries(momentumSeries);
  const dateRange = dateRangeLabel(validTrail.map((point) => point.date));
  const latestQuadrant = selectedSector ? quadrantLabels[selectedSector.quadrant] : "Unknown";
  const effectiveLabel = coverage.limited_by_data
    ? `${coverage.requested_days}D 중 ${coverage.effective_days}D`
    : `${coverage.effective_days}D`;

  return (
    <article className="dashboard-card rrg-movement-card">
      <PanelHeader eyebrow="Path" title="선택 섹터 경로 무빙" meta={`${selectedCode} · ${effectiveLabel}`} />
      <div className="movement-body">
        <div className="movement-copy">
          <strong>{selectedSector?.sector_name ?? selectedCode}</strong>
          <span>{dateRange || "히스토리 준비 중"}</span>
          <p>
            시간순 변화는 이 차트에서만 봅니다. 100 위는 기준 대비 우위, 아래는 열위를 의미합니다.
          </p>
        </div>
        <div className="movement-metrics" aria-label="selected sector path metrics">
          <MiniMetric label="상대강도 변화" value={formatSigned(ratioChange)} />
          <MiniMetric label="모멘텀 변화" value={formatSigned(momentumChange)} />
          <MiniMetric label="현재 위치" value={latestQuadrant} />
        </div>
        <div className="movement-chart" aria-label={`${selectedCode} 상대강도와 모멘텀 시간 경로`}>
          {validTrail.length > 1 ? (
            <svg viewBox="0 0 100 56" preserveAspectRatio="none" role="img">
              <line className="movement-grid top" x1="0" x2="100" y1="10" y2="10" />
              <line className="movement-grid mid" x1="0" x2="100" y1={movementY(100, domain)} y2={movementY(100, domain)} />
              <line className="movement-grid bottom" x1="0" x2="100" y1="46" y2="46" />
              <path className="movement-line ratio" d={ratioPath} vectorEffect="non-scaling-stroke" />
              <path className="movement-line momentum" d={momentumPath} vectorEffect="non-scaling-stroke" />
              <circle className="movement-end ratio" cx="100" cy={movementY(ratioSeries.at(-1)?.value ?? 100, domain)} r="1.6" />
              <circle className="movement-end momentum" cx="100" cy={movementY(momentumSeries.at(-1)?.value ?? 100, domain)} r="1.6" />
            </svg>
          ) : (
            <div className="movement-empty">히스토리 누적 후 경로 무빙 표시</div>
          )}
          <div className="movement-axis-labels" aria-hidden="true">
            <span>{roundPathPoint(domain.max)}</span>
            <span>100</span>
            <span>{roundPathPoint(domain.min)}</span>
          </div>
        </div>
        <div className="movement-legend" aria-label="movement chart legend">
          <span className="ratio">상대강도</span>
          <span className="momentum">모멘텀</span>
        </div>
      </div>
    </article>
  );
}

function toRrgCoordinate(rsRatio: number, rsMomentum: number): [number, number] {
  return [
    clamp(50 + (rsRatio - 100) * RRG_X_SCALE, RRG_MIN_POS, RRG_MAX_POS),
    clamp(50 - (rsMomentum - 100) * RRG_Y_SCALE, RRG_MIN_POS, RRG_MAX_POS),
  ];
}

function buildMovementPath(points: Array<{ value: number }>, domain: { min: number; max: number }) {
  if (points.length < 2) {
    return "";
  }

  const denominator = Math.max(1, points.length - 1);
  return points
    .map((point, index) => {
      const x = (100 * index) / denominator;
      const y = movementY(point.value, domain);
      return `${index === 0 ? "M" : "L"} ${roundPathPoint(x)} ${roundPathPoint(y)}`;
    })
    .join(" ");
}

function movementY(value: number, domain: { min: number; max: number }) {
  const span = Math.max(1, domain.max - domain.min);
  return roundPathPoint(46 - ((value - domain.min) / span) * 36);
}

function buildMovementDomain(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return { min: 96, max: 104 };
  const min = Math.min(100, ...finiteValues);
  const max = Math.max(100, ...finiteValues);
  const padding = Math.max(1.2, (max - min) * 0.12);
  return {
    min: Math.floor((min - padding) * 10) / 10,
    max: Math.ceil((max + padding) * 10) / 10,
  };
}

function changeOverSeries(points: Array<{ value: number }>) {
  if (points.length < 2) return 0;
  return points.at(-1)!.value - points[0]!.value;
}

function roundPathPoint(value: number) {
  return Math.round(value * 100) / 100;
}

function historyCoverage(history: HistoryResponse | null, timeframe: HistoryTimeframe): NonNullable<HistoryResponse["coverage"]> {
  if (history?.coverage) {
    return history.coverage;
  }
  const requestedDays = timeframeDays(timeframe);
  const availableDays = countDistinctTrailDates(history);
  return {
    requested_days: requestedDays,
    available_sector_days: availableDays,
    effective_days: Math.min(requestedDays, availableDays),
    limited_by_data: availableDays < requestedDays,
  };
}

function countDistinctTrailDates(history: HistoryResponse | null) {
  const dates = new Set<string>();
  for (const sector of history?.sectors ?? []) {
    for (const point of sector.trail) {
      if (point.date) dates.add(point.date);
    }
  }
  return dates.size;
}

function timeframeDays(timeframe: HistoryTimeframe) {
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
}

function dateRangeLabel(dates: string[]) {
  const uniqueDates = [...new Set(dates.filter(Boolean))].sort();
  if (!uniqueDates.length) return "";
  const first = uniqueDates[0];
  const last = uniqueDates.at(-1) ?? first;
  return first === last ? first : `${first}~${last}`;
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
          강도 {selected ? numberMetric(selected.modules.relative_strength.evidence.rs_ratio, 100).toFixed(1) : "N/A"} ·
          모멘텀 {selected ? numberMetric(selected.modules.relative_strength.evidence.rs_momentum, 100).toFixed(1) : "N/A"}
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
          label="상대강도"
          value={numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100).toFixed(1)}
        />
        <MiniMetric
          label="모멘텀"
          value={numberMetric(sector.modules.relative_strength.evidence.rs_momentum, 100).toFixed(1)}
        />
      </div>

      <div className="module-stack">
        <ModuleMeter label="상대강도" module={sector.modules.relative_strength} />
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
        <span>{validationStatusLabel(sector.validation.status)}</span>
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

function validationStatusLabel(status: string) {
  if (status === "unvalidated") return "검증 전";
  return status;
}
