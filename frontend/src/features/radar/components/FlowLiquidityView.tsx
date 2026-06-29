import type { ReactNode } from "react";

import type {
  ContextReconciliation,
  HistoryResponse,
  LayerOneFlowSnapshot,
  MarketContextCard as ApiMarketContextCard,
  SectorSnapshot,
  TriggerWatchlistItem,
} from "../../../types";
import {
  formatSigned,
  groupByQuadrant,
  type LiquidityAvailability,
  liquidityInputs,
  numberMetric,
} from "../model";
import { LayerHeader, MiniMetric, ModuleMeter, PanelHeader } from "./common";

export function FlowLiquidityView({
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  contextHistory,
  contextReconciliation,
  sectors,
  selected,
  watchlist,
  warnings,
  weakBreadthCount,
  marketContext,
}: {
  contextHistory: HistoryResponse["market_context"];
  contextReconciliation?: ContextReconciliation;
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  marketContext: ApiMarketContextCard[];
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  watchlist: TriggerWatchlistItem[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  return (
    <div className="flow-liquidity-view">
      <LayerOneFlow
        grouped={grouped}
        healthyBreadthCount={healthyBreadthCount}
        layerOneFlow={layerOneFlow}
        reconciliation={contextReconciliation}
        sectors={sectors}
        warnings={warnings}
        weakBreadthCount={weakBreadthCount}
      />
      <LayerTwoLiquidity
        contextHistory={contextHistory}
        marketContext={marketContext}
        sectors={sectors}
        selected={selected}
        watchlist={watchlist}
      />
    </div>
  );
}

function LayerOneFlow({
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const constructiveCount = grouped.leading.length + grouped.improving.length;
  const direction =
    layerOneFlow?.state === "constructive"
      ? "Constructive"
      : layerOneFlow?.state === "caution"
        ? "Caution"
      : layerOneFlow?.state === "data_insufficient"
        ? "Data Pending"
        : layerOneFlow?.state === "mixed"
          ? "Mixed"
          : constructiveCount >= Math.ceil(sectors.length / 2)
            ? "Constructive"
            : warnings.length > sectors.length / 2
              ? "Caution"
              : "Mixed";
  const topLeader = sectors[0];
  const flowMeta = `${grouped.leading.length} leading · ${grouped.improving.length} improving · ${warnings.length} warnings`;

  return (
    <section className="layer-section layer-one" aria-label="layer one flow">
      <LayerHeader
        description="시장 tape, breadth, volatility, 정합성을 한 줄 흐름으로 묶어 봅니다."
        eyebrow="Layer 1"
        meta={flowMeta}
        title="흐름"
      />
      <div className="flow-board">
        <article className="flow-overview dashboard-card">
          <div className="flow-overview-head">
            <div>
              <span className="flow-path">흐름 · breadth · 정합성</span>
              <h2>{direction}</h2>
            </div>
            <strong>{topLeader ? `${topLeader.sector_code} lead` : "no leader"}</strong>
          </div>
          <p>
            {layerOneFlow?.narrative ??
              `리더 ${grouped.leading.length}개와 순환 후보 ${grouped.improving.length}개가 시장 흐름을 만들고, 경고 ${warnings.length}개와 breadth ${healthyBreadthCount}/${sectors.length}가 내부 건강도를 제한합니다.`}
          </p>
          <LayerOneSignalPanel flow={layerOneFlow} />
          {reconciliation ? (
            <div className={`reconciliation-badge ${reconciliation.state}`}>
              <strong>{reconciliationLabel(reconciliation.state)}</strong>
              <span>{reconciliation.narrative}</span>
            </div>
          ) : null}
        </article>
        <FlowDistributionPanel
          grouped={grouped}
          healthyBreadthCount={healthyBreadthCount}
          layerOneFlow={layerOneFlow}
          reconciliation={reconciliation}
          sectors={sectors}
          warnings={warnings}
          weakBreadthCount={weakBreadthCount}
        />
      </div>
    </section>
  );
}

function QuadrantMix({
  grouped,
  total,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  total: number;
}) {
  const segments = [
    { className: "leading", label: "Leading", value: grouped.leading.length },
    { className: "improving", label: "Improving", value: grouped.improving.length },
    { className: "weakening", label: "Weakening", value: grouped.weakening.length },
    { className: "lagging", label: "Lagging", value: grouped.lagging.length },
  ];

  return (
    <div className="quadrant-mix" aria-label="RRG quadrant mix">
      <div className="quadrant-bar">
        {segments.map((segment) => (
          <i
            className={segment.className}
            key={segment.label}
            style={{ width: `${total ? Math.max(5, (segment.value / total) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="quadrant-legend">
        {segments.map((segment) => (
          <span className={segment.className} key={segment.label}>
            {segment.label} <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function FlowSparkline({ sectors }: { sectors: SectorSnapshot[] }) {
  const samples = sectors.map((sector) => ({
    code: sector.sector_code,
    value: numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100),
  }));
  const values = samples.map((sample) => sample.value);
  const width = 520;
  const height = 142;
  const plot = { bottom: 28, left: 42, right: 24, top: 16 };
  const rawMin = Math.min(100, ...values);
  const rawMax = Math.max(100, ...values);
  const spread = Math.max(1, rawMax - rawMin);
  const domainMin = Math.floor(rawMin - spread * 0.16);
  const domainMax = Math.ceil(rawMax + spread * 0.16);
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const scaleX = (index: number) =>
    samples.length <= 1 ? plot.left + plotWidth / 2 : plot.left + (index / (samples.length - 1)) * plotWidth;
  const scaleY = (value: number) => plot.top + ((domainMax - value) / Math.max(1, domainMax - domainMin)) * plotHeight;
  const points = samples.map((sample, index) => `${scaleX(index).toFixed(1)},${scaleY(sample.value).toFixed(1)}`).join(" ");
  const neutralY = scaleY(100);
  const leader = samples[0];
  const median = samples[Math.floor(samples.length / 2)];
  const tail = samples.at(-1);
  const gap = values.length ? values[0] - 100 : 0;
  const range = values.length ? Math.max(...values) - Math.min(...values) : 0;

  return (
    <article className="flow-trend" aria-label="relative strength distribution">
      <div>
        <span>RS Ratio Distribution</span>
        <strong>{formatSigned(gap)} leader gap</strong>
        <small>Y: RS Ratio · X: sector rank</small>
      </div>
      <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <line className="flow-axis-line" x1={plot.left} x2={plot.left} y1={plot.top} y2={height - plot.bottom} />
        <line className="flow-axis-line" x1={plot.left} x2={width - plot.right} y1={height - plot.bottom} y2={height - plot.bottom} />
        <line className="flow-neutral-line" x1={plot.left} x2={width - plot.right} y1={neutralY} y2={neutralY} />
        {[domainMax, 100, domainMin].map((tick) => (
          <g key={tick}>
            <line className="flow-grid-line" x1={plot.left} x2={width - plot.right} y1={scaleY(tick)} y2={scaleY(tick)} />
            <text className="flow-y-label" x={plot.left - 8} y={scaleY(tick) + 3}>
              {tick.toFixed(0)}
            </text>
          </g>
        ))}
        {samples.length ? <polyline points={points} /> : null}
        {samples.length
          ? samples.map((sample, index) => (
              <circle
                className={index === 0 ? "leader" : index === samples.length - 1 ? "tail" : undefined}
                cx={scaleX(index)}
                cy={scaleY(sample.value)}
                key={sample.code}
                r={index === 0 || index === samples.length - 1 ? 3.2 : 2.1}
              />
            ))
          : null}
        {leader ? (
          <text className="flow-x-label leader" x={scaleX(0)} y={height - 8}>
            {leader.code}
          </text>
        ) : null}
        {median ? (
          <text className="flow-x-label" x={scaleX(Math.floor(samples.length / 2))} y={height - 8}>
            mid
          </text>
        ) : null}
        {tail ? (
          <text className="flow-x-label tail" x={scaleX(samples.length - 1)} y={height - 8}>
            {tail.code}
          </text>
        ) : null}
      </svg>
      <div className="flow-trend-meta">
        <span>
          Lead <strong>{leader ? `${leader.code} ${leader.value.toFixed(1)}` : "N/A"}</strong>
        </span>
        <span>
          Median <strong>{median ? median.value.toFixed(1) : "N/A"}</strong>
        </span>
        <span>
          Tail <strong>{tail ? `${tail.code} ${tail.value.toFixed(1)}` : "N/A"}</strong>
        </span>
        <span>
          Range <strong>{range.toFixed(1)}</strong>
        </span>
      </div>
    </article>
  );
}

function FlowDistributionPanel({
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const constructive = [...grouped.leading, ...grouped.improving];
  const neutralBreadth = Math.max(0, sectors.length - healthyBreadthCount - weakBreadthCount);

  return (
    <article className="flow-distribution-card dashboard-card" aria-label="layer one distribution">
      <PanelHeader eyebrow="Evidence" title="근거와 확인 지점" meta={`${sectors.length} sectors`} />
      <div className="flow-distribution-body">
        <div className="flow-visual-stack">
          <QuadrantMix grouped={grouped} total={sectors.length} />
          <FlowSparkline sectors={sectors} />
        </div>
        <div className="flow-cluster-grid">
          <FlowCluster
            detail="leading + improving"
            items={constructive}
            label="주도·순환"
            tone="positive"
            value={`${constructive.length}`}
          />
          <FlowCluster
            detail="rulebook warnings"
            items={warnings}
            label="경고"
            tone={warnings.length ? "risk" : "neutral"}
            value={`${warnings.length}`}
          />
          <BreadthProfile
            healthy={healthyBreadthCount}
            neutral={neutralBreadth}
            total={sectors.length}
            weak={weakBreadthCount}
          />
          <FlowCheckpointList
            healthyBreadthCount={healthyBreadthCount}
            layerOneFlow={layerOneFlow}
            sectors={sectors}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
          <FlowFinalReadout
            constructiveCount={constructive.length}
            healthyBreadthCount={healthyBreadthCount}
            layerOneFlow={layerOneFlow}
            reconciliation={reconciliation}
            sectors={sectors}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
        </div>
      </div>
    </article>
  );
}

function LayerOneSignalPanel({ flow }: { flow?: LayerOneFlowSnapshot }) {
  const range = flow?.tape.range_52w_position ?? null;
  const vix = flow?.risk.vix_latest ?? null;
  const rsp = flow?.breadth_quality.rsp_vs_spy_1m ?? null;
  const iwm = flow?.breadth_quality.iwm_vs_spy_1m ?? null;
  const qqq = flow?.breadth_quality.qqq_vs_spy_1m ?? null;

  return (
    <div className="layer-one-signal-panel" aria-label="Layer 1 additional market evidence">
      <SignalRow
        label="Market Tape"
        meta={flow?.tape.latest_date ?? "waiting"}
        value={formatPercent(flow?.tape.ret_1m)}
        subValue={`1D ${formatPercent(flow?.tape.ret_1d)}`}
      >
        <RangeTrack label="52w" value={range} />
      </SignalRow>
      <SignalRow
        label="Risk / Vol"
        meta={flow?.risk.transition ?? "unknown"}
        value={vix === null ? "unknown" : `${vix.toFixed(1)} VIX`}
        subValue={`RV20 ${formatPercentFromWhole(flow?.risk.realized_vol_20)}`}
      >
        <RangeTrack label="pressure" tone={flow?.risk.state === "elevated" ? "risk" : "default"} value={vix === null ? null : Math.min(100, (vix / 40) * 100)} />
      </SignalRow>
      <SignalRow
        label="Breadth Proxy"
        meta={flow?.breadth_quality.state ?? "unknown"}
        value={`RSP ${formatPercent(rsp)}`}
        subValue={`IWM ${formatPercent(iwm)} · QQQ ${formatPercent(qqq)}`}
      >
        <RangeTrack label="coverage" value={coveragePercent(flow)} />
      </SignalRow>
    </div>
  );
}

function SignalRow({
  children,
  label,
  meta,
  subValue,
  value,
}: {
  children: ReactNode;
  label: string;
  meta: string;
  subValue: string;
  value: string;
}) {
  return (
    <div className="signal-row">
      <div>
        <span>{label}</span>
        <small>{meta}</small>
      </div>
      <strong>{value}</strong>
      <em>{subValue}</em>
      {children}
    </div>
  );
}

function RangeTrack({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "risk";
  value: number | null;
}) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className={`signal-track ${tone}`}>
      <i style={{ width: `${width}%` }} />
      <small>{label}</small>
    </div>
  );
}

function FlowCluster({
  detail,
  items,
  label,
  tone,
  value,
}: {
  detail: string;
  items: SectorSnapshot[];
  label: string;
  tone: "neutral" | "positive" | "risk";
  value: string;
}) {
  const visibleItems = items.slice(0, 4);
  const overflowItems = items.slice(4);

  return (
    <div className={`flow-cluster ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small>{detail}</small>
      <div className="flow-chip-row" aria-label={`${label} 섹터 목록`}>
        {visibleItems.map((sector) => (
          <b
            aria-label={`${sector.sector_name}: ${sector.rulebook.lead_pattern}`}
            key={sector.sector_code}
            title={`${sector.sector_name} · ${sector.rulebook.lead_pattern}`}
          >
            {sector.sector_code}
          </b>
        ))}
        {overflowItems.length ? (
          <b
            aria-label={`추가 ${overflowItems.length}개: ${sectorCodes(overflowItems)}`}
            className="more"
            title={overflowItems.map((sector) => `${sector.sector_code} · ${sector.rulebook.lead_pattern}`).join("\n")}
          >
            +{overflowItems.length}
          </b>
        ) : null}
        {items.length === 0 ? <b className="empty">none</b> : null}
      </div>
    </div>
  );
}

function BreadthProfile({
  healthy,
  neutral,
  total,
  weak,
}: {
  healthy: number;
  neutral: number;
  total: number;
  weak: number;
}) {
  const segments = [
    { className: "healthy", label: "healthy", value: healthy },
    { className: "neutral", label: "neutral", value: neutral },
    { className: "weak", label: "weak", value: weak },
  ];

  return (
    <div className="breadth-profile">
      <div>
        <span>Breadth Profile</span>
        <strong>
          {healthy}/{total}
        </strong>
      </div>
      <div className="breadth-bar" aria-label="breadth distribution">
        {segments.map((segment) => (
          <i
            className={segment.className}
            key={segment.label}
            style={{ width: `${total ? Math.max(5, (segment.value / total) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="breadth-legend">
        {segments.map((segment) => (
          <small className={segment.className} key={segment.label}>
            {segment.label} <b>{segment.value}</b>
          </small>
        ))}
      </div>
    </div>
  );
}

function FlowCheckpointList({
  healthyBreadthCount,
  layerOneFlow,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const topLeader = sectors[0];
  const warningCodes = sectorCodes(warnings);
  const checkpoints = [
    {
      label: "리더 유지",
      value: topLeader ? `${topLeader.sector_code} · ${topLeader.rulebook.lead_pattern}` : "no leader",
    },
    {
      label: "Tape 확인",
      value:
        layerOneFlow?.tape.ret_1m !== undefined
          ? `SPY 1M ${formatPercent(layerOneFlow.tape.ret_1m)}`
          : healthyBreadthCount > weakBreadthCount
            ? `${healthyBreadthCount} healthy breadth`
            : `${weakBreadthCount} weak breadth`,
    },
    {
      label: "폭 확인",
      value: layerOneFlow
        ? `RSP ${formatPercent(layerOneFlow.breadth_quality.rsp_vs_spy_1m)}`
        : warnings.length
          ? warningCodes || `${warnings.length} sectors`
          : "none",
    },
  ];

  return (
    <div className="flow-checkpoints">
      <span>다음 확인</span>
      {checkpoints.map((checkpoint) => (
        <div key={checkpoint.label}>
          <strong>{checkpoint.label}</strong>
          <small>{checkpoint.value}</small>
        </div>
      ))}
    </div>
  );
}

function FlowFinalReadout({
  constructiveCount,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  constructiveCount: number;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const topLeader = sectors[0];
  const riskText = warnings.length
    ? `경고 섹터는 ${sectorCodes(warnings)} 중심으로 확인됩니다.`
    : "명확한 rulebook 경고 섹터는 제한적입니다.";
  const breadthText =
    healthyBreadthCount > weakBreadthCount
      ? `breadth는 ${healthyBreadthCount}/${sectors.length}개 섹터에서 우호적으로 확인됩니다.`
      : `breadth는 ${healthyBreadthCount}/${sectors.length}개 건강 신호에 머물러 확산 확인이 필요합니다.`;
  const transitionLabel = layerOneFlow ? transitionKorean(layerOneFlow.transition) : "전환 정보는 제한적";
  const reconciliationText = reconciliation
    ? `${reconciliationLabel(reconciliation.state)} 맥락입니다.`
    : "Layer 2 맥락은 아직 보류 상태입니다.";

  return (
    <div className="flow-final-readout" aria-label="Layer 1 final readout">
      <div>
        <span>Final Read</span>
        <strong>{layerOneFlow ? stateKorean(layerOneFlow.state) : "섹터 흐름 요약"}</strong>
        <em>{transitionLabel}</em>
      </div>
      <p>
        {topLeader ? `${topLeader.sector_code}가 현재 흐름을 이끌고 ` : ""}
        주도·순환 축은 {constructiveCount}개 섹터에서 형성됩니다. {breadthText} {riskText}{" "}
        {reconciliationText} 이 판단은 확률이 아니라 현재 모듈 정렬과 불일치를 서술한 리서치 판독입니다.
      </p>
    </div>
  );
}

function sectorCodes(sectors: SectorSnapshot[]) {
  const codes = sectors.slice(0, 4).map((sector) => sector.sector_code);
  if (sectors.length > 4) codes.push(`+${sectors.length - 4}`);
  return codes.join(", ");
}

function coveragePercent(flow?: LayerOneFlowSnapshot) {
  const fresh = flow?.breadth_quality.holding_coverage_fresh;
  const total = flow?.breadth_quality.holding_coverage_total;
  if (fresh === null || fresh === undefined || total === null || total === undefined || total <= 0) return null;
  return (fresh / total) * 100;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatPercentFromWhole(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  return `${value.toFixed(1)}%`;
}

function LayerTwoLiquidity({
  contextHistory,
  marketContext,
  sectors,
  selected,
  watchlist,
}: {
  contextHistory: HistoryResponse["market_context"];
  marketContext: ApiMarketContextCard[];
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  watchlist: TriggerWatchlistItem[];
}) {
  const accumulationCount = sectors.filter((sector) => sector.modules.participation.state === "accumulation").length;
  const distributionCount = sectors.filter((sector) => sector.modules.participation.state === "distribution").length;
  const cards = marketContextCards(selected, marketContext);
  const activeCards = cards.filter(isActiveMarketContextCard);
  const sourceMix = contextSourceMix(activeCards);
  const firedCount = watchlist.filter((item) => item.status === "fired").length;
  const liquidityNarrative = buildLiquidityNarrative({
    activeCards,
    accumulationCount,
    distributionCount,
    firedCount,
    selected,
    watchlistCount: watchlist.length,
  });

  return (
    <section className="layer-section layer-two" aria-label="layer two liquidity">
      <LayerHeader
        description="ETF 거래량은 Yahoo 가격으로 확인하고, 매크로 입력은 official/proxy/held를 분리해서 봅니다."
        eyebrow="Layer 2"
        meta="participation + market context"
        title="여력 (유동성)"
      />
      <div className="liquidity-board">
        <article className="liquidity-overview dashboard-card">
          <PanelHeader eyebrow="Fuel Mix" title="요약" meta={selected.sector_code} />
          <ModuleMeter label="Selected ETF volume" module={selected.modules.participation} />
          <div className="metric-pair compact">
            <MiniMetric label="Accumulation" value={`${accumulationCount}`} />
            <MiniMetric label="Distribution" value={`${distributionCount}`} />
          </div>
          <SourceMixBar sourceMix={sourceMix} />
          <div className="flow-metric-grid compact" aria-label="liquidity checks">
            <MiniMetric label="Official" value={`${sourceMix.official}`} />
            <MiniMetric label="Proxy" value={`${sourceMix.proxy}`} />
            <MiniMetric label="Triggers" value={`${firedCount}/${watchlist.length}`} />
          </div>
          <p className="liquidity-narrative">{liquidityNarrative}</p>
        </article>
        <div className="liquidity-context-tools">
          <MarketContextMatrix history={contextHistory} marketContext={activeCards} />
          <TriggerWatchlistPanel items={watchlist} />
        </div>
      </div>
    </section>
  );
}

interface MarketContextCard {
  availability: LiquidityAvailability;
  code: string;
  data_freshness: Record<string, number | string | null>;
  evidence: Record<string, number | string | null>;
  meaning: string;
  source: string;
  source_class: "official" | "proxy" | "manual" | "held";
  state: string;
  title: string;
  transition: string;
  warnings: string[];
}

function SourceMixBar({
  sourceMix,
}: {
  sourceMix: Record<MarketContextCard["source_class"], number>;
}) {
  const total = Object.values(sourceMix).reduce((sum, value) => sum + value, 0);
  const segments: Array<{ className: MarketContextCard["source_class"]; label: string; value: number }> = [
    { className: "official", label: "Official", value: sourceMix.official },
    { className: "proxy", label: "Proxy", value: sourceMix.proxy },
    { className: "manual", label: "Manual", value: sourceMix.manual },
    { className: "held", label: "Held", value: sourceMix.held },
  ];
  const visibleSegments = segments.filter(
    (segment) => segment.value > 0 || segment.className === "official" || segment.className === "proxy",
  );

  return (
    <div className="source-mix" aria-label="Layer 2 source mix">
      <div className="source-mix-bar">
        {visibleSegments.map((segment) => (
          <i
            className={segment.className}
            key={segment.className}
            style={{ width: `${total ? Math.max(4, (segment.value / total) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="source-mix-legend">
        {visibleSegments.map((segment) => (
          <span className={segment.className} key={segment.className}>
            {segment.label} <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function contextSourceMix(cards: MarketContextCard[]) {
  return cards.reduce<Record<MarketContextCard["source_class"], number>>(
    (counts, card) => {
      counts[card.source_class] += 1;
      return counts;
    },
    { held: 0, manual: 0, official: 0, proxy: 0 },
  );
}

function isActiveMarketContextCard(card: MarketContextCard) {
  return card.source_class !== "held" && card.source_class !== "manual";
}

function buildLiquidityNarrative({
  activeCards,
  accumulationCount,
  distributionCount,
  firedCount,
  selected,
  watchlistCount,
}: {
  activeCards: MarketContextCard[];
  accumulationCount: number;
  distributionCount: number;
  firedCount: number;
  selected: SectorSnapshot;
  watchlistCount: number;
}) {
  const supportive = activeCards.filter((card) => card.state === "supportive").length;
  const pressure = activeCards.filter((card) => card.state === "pressure").length;
  const neutral = activeCards.filter((card) => card.state === "neutral" || card.state === "pending").length;
  const participation = judgementLabel(selected.modules.participation.state);
  const transition = transitionLabel(selected.modules.participation.transition);
  const triggerText =
    firedCount > 0
      ? `리스크 트리거 ${firedCount}/${watchlistCount}개가 켜져 있어 확인이 필요합니다.`
      : `리스크 트리거는 ${watchlistCount}개 중 발동된 항목이 없습니다.`;

  return `선택 섹터의 ETF 거래량 판단은 ${participation}이며 전환은 ${transition}입니다. Market Context는 완화 ${supportive}개, 압박 ${pressure}개, 중립/대기 ${neutral}개로 나뉩니다. 섹터 전체 participation은 accumulation ${accumulationCount}개, distribution ${distributionCount}개입니다. ${triggerText}`;
}

function marketContextCards(
  selected: SectorSnapshot,
  topLevelContext: ApiMarketContextCard[],
): MarketContextCard[] {
  const context = selected.rulebook.source_metrics.market_context;
  const byCode = new Map<string, MarketContextCard>();

  for (const item of topLevelContext) {
    byCode.set(item.code, item);
  }

  if (Array.isArray(context)) {
    for (const item of context) {
      if (!isMarketContextCard(item)) continue;
      if (byCode.has(item.code)) continue;
      byCode.set(item.code, item);
    }
  }

  return liquidityInputs.map((input) => {
    const live = byCode.get(input.code);
    return {
      availability: live?.availability ?? input.availability,
      code: input.code,
      data_freshness: live?.data_freshness ?? {},
      evidence: live?.evidence ?? {},
      meaning: live?.meaning ?? input.meaning,
      source: live?.source ?? input.source,
      source_class: live?.source_class ?? (input.availability === "hold" ? "held" : "proxy"),
      state: live?.state ?? (input.availability === "hold" ? "held" : "pending"),
      title: live?.source_class === "held" ? input.title : live?.title ?? input.title,
      transition: live?.transition ?? (input.availability === "hold" ? "external_source_needed" : "waiting_for_cron"),
      warnings: live?.warnings?.length ? live.warnings : input.warning ? [input.warning] : [],
    };
  });
}

function isMarketContextCard(value: unknown): value is MarketContextCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<MarketContextCard>;
  return typeof card.code === "string" && typeof card.title === "string";
}

function sourceClassLabel(input: MarketContextCard) {
  if (input.source_class === "official") return "official";
  if (input.source_class === "manual") return "manual";
  if (input.source_class === "proxy") return "proxy";
  return "hold";
}

function freshnessLabel(input: MarketContextCard) {
  const latest = input.data_freshness.latest_date ?? input.data_freshness.date;
  return typeof latest === "string" ? `${input.source_class} · ${latest}` : null;
}

function MarketContextMatrix({
  history,
  marketContext,
}: {
  history: HistoryResponse["market_context"];
  marketContext: MarketContextCard[];
}) {
  const byCode = new Map(history.map((item) => [item.code, item.points.slice(-4)]));
  return (
    <article className="market-context-panel dashboard-card">
      <PanelHeader eyebrow="Market Context" title="마켓 컨텍스트" meta={`${marketContext.length} active`} />
      <div className="market-context-grid">
        {marketContext.map((card) => {
          const points = byCode.get(card.code) ?? [];
          const fallback = points.length ? points : [{ state: card.state, transition: card.transition, date: "current" }];
          const evidence = contextEvidenceItems(card);
          return (
            <div className={`market-context-row ${card.source_class}`} key={card.code}>
              <span>{card.code}</span>
              <div>
                <strong>{card.title}</strong>
                <small>{card.meaning}</small>
              </div>
              <em>
                <span className="context-dots" aria-label={`${card.code} trend`}>
                  {fallback.map((point, index) => (
                    <mark className={stateClass(point.state)} key={`${card.code}-${point.date}-${index}`} />
                  ))}
                </span>
                {sourceClassLabel(card)}
              </em>
              <b>{judgementLabel(card.state)}</b>
              <i>{updateLabel(card)}</i>
              <small>{evidence.length ? evidence.join(" · ") : card.warnings[0] ?? freshnessLabel(card) ?? card.source}</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function contextEvidenceItems(card: MarketContextCard) {
  const skip = new Set(["latest_date", "official_latest_date"]);
  return Object.entries(card.evidence)
    .filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined)
    .slice(0, 2)
    .map(([label, value]) => {
      const cleanLabel = label.replaceAll("_", " ").replace(/\bret 21d\b/i, "21D");
      if (typeof value === "number") return `${cleanLabel} ${formatCompactNumber(value)}`;
      return `${cleanLabel} ${value}`;
    });
}

function TriggerWatchlistPanel({ items }: { items: TriggerWatchlistItem[] }) {
  const visible = items.length ? items : [emptyWatchlistItem()];
  return (
    <article className="trigger-panel dashboard-card">
      <PanelHeader eyebrow="Trigger Watchlist" title="리스크 트리거" meta={`${items.length} checks`} />
      <div className="trigger-grid">
        {visible.map((item) => (
          <article className={`trigger-item ${item.status}`} key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>{statusLabel(item.status)}</span>
            </div>
            <p>
              <b>조건</b>
              {item.trigger}
            </p>
            <p>
              <b>의미</b>
              {item.meaning}
            </p>
            {item.warnings[0] ? <small>{item.warnings[0]}</small> : null}
          </article>
        ))}
      </div>
    </article>
  );
}

function emptyWatchlistItem(): TriggerWatchlistItem {
  return {
    evidence: {},
    id: "watchlist_empty",
    label: "Watchlist pending",
    meaning: "API 응답에 watchlist가 아직 없습니다.",
    source_class: "held",
    status: "unknown",
    trigger: "waiting for derived checks",
    warnings: ["watchlist_unavailable"],
  };
}

function reconciliationLabel(state: ContextReconciliation["state"]) {
  if (state === "supportive") return "정합";
  if (state === "divergent") return "불일치";
  if (state === "risk_rising") return "리스크 상승";
  if (state === "rotation_watch") return "회전 감시";
  return "데이터 부족";
}

function stateKorean(state: LayerOneFlowSnapshot["state"]) {
  if (state === "constructive") return "구성적 흐름";
  if (state === "caution") return "주의 흐름";
  if (state === "mixed") return "혼조 흐름";
  return "데이터 부족";
}

function judgementLabel(state: string) {
  if (state === "supportive" || state === "accumulation" || state === "confirmed") return "완화/확인";
  if (state === "pressure" || state === "distribution" || state === "diverging") return "압박/분산";
  if (state === "neutral" || state === "mixed") return "중립";
  if (state === "pending" || state === "unknown") return "대기";
  if (state === "calm") return "안정";
  if (state === "elevated") return "변동성 상승";
  return state;
}

function transitionLabel(transition: string) {
  if (transition === "strengthening") return "강화";
  if (transition === "weakening") return "약화";
  if (transition === "stable") return "안정";
  if (transition === "waiting_for_cron") return "갱신 대기";
  if (transition === "unknown") return "불명";
  return transition;
}

function updateLabel(card: MarketContextCard) {
  const latest = card.data_freshness.latest_date ?? card.data_freshness.date;
  if (typeof latest === "string" && latest) return `updated ${latest}`;
  if (card.transition === "waiting_for_cron") return "waiting";
  return "not ready";
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(3);
}

function transitionKorean(transition: LayerOneFlowSnapshot["transition"]) {
  if (transition === "strengthening") return "강화 전환";
  if (transition === "weakening") return "약화 전환";
  if (transition === "stable") return "안정 전환";
  return "전환 불명";
}

function statusLabel(status: TriggerWatchlistItem["status"]) {
  if (status === "fired") return "fired";
  if (status === "manual_check") return "manual";
  if (status === "unknown") return "unknown";
  return "quiet";
}

function stateClass(state: string) {
  if (state === "supportive") return "supportive";
  if (state === "pressure") return "pressure";
  if (state === "held" || state === "unknown") return "unknown";
  return "neutral";
}
