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

type GroupedQuadrants = ReturnType<typeof groupByQuadrant>;

interface LayerOneFlowProps {
  grouped: GroupedQuadrants;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}

interface LayerOneFlowViewProps extends LayerOneFlowProps {
  explainMode: boolean;
}

interface LayerTwoLiquidityViewProps {
  contextHistory: HistoryResponse["market_context"];
  marketContext: ApiMarketContextCard[];
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  watchlist: TriggerWatchlistItem[];
}

export function FlowLiquidityView({
  explainMode,
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
  explainMode: boolean;
  grouped: GroupedQuadrants;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  marketContext: ApiMarketContextCard[];
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  watchlist: TriggerWatchlistItem[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  if (explainMode) {
    return (
      <BeginnerFlowGuide
        contextReconciliation={contextReconciliation}
        grouped={grouped}
        healthyBreadthCount={healthyBreadthCount}
        layerOneFlow={layerOneFlow}
        marketContext={marketContext}
        sectors={sectors}
        selected={selected}
        watchlist={watchlist}
        warnings={warnings}
        weakBreadthCount={weakBreadthCount}
      />
    );
  }

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

export function LayerOneFlowView({
  explainMode,
  ...props
}: LayerOneFlowViewProps) {
  if (explainMode) {
    return <BeginnerLayerOneGuide {...props} />;
  }

  return <LayerOneFlow {...props} />;
}

export function LayerTwoLiquidityView(props: LayerTwoLiquidityViewProps) {
  return <LayerTwoLiquidity {...props} />;
}

function BeginnerLayerOneGuide({
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  warnings,
  weakBreadthCount,
}: LayerOneFlowProps) {
  const constructiveCount = grouped.leading.length + grouped.improving.length;
  const neutralBreadthCount = Math.max(0, sectors.length - healthyBreadthCount - weakBreadthCount);
  const topLeader = sectors[0];
  const headline =
    layerOneFlow?.state === "constructive"
      ? "시장 흐름은 우호적이지만 확산 품질을 같이 봅니다"
      : layerOneFlow?.state === "caution"
        ? "시장 흐름에 경계 신호가 있어 확인이 먼저입니다"
        : topLeader
          ? `${topLeader.sector_code}가 앞서지만 흐름 확인이 필요합니다`
          : "아직 결론보다 데이터 확인이 먼저입니다";
  const narrative =
    layerOneFlow?.narrative ??
    "Layer 1 가격 흐름과 breadth 보조 지표가 충분히 모이면 시장 tape 판단을 표시합니다.";
  const signals = buildLayerOneBeginnerSignals({
    constructiveCount,
    grouped,
    healthyBreadthCount,
    layerOneFlow,
    sectors,
    warnings,
    weakBreadthCount,
  });
  const readout = buildLayerOneBeginnerReadout({
    constructiveCount,
    healthyBreadthCount,
    layerOneFlow,
    reconciliation,
    sectors,
    topLeader,
    warnings,
    weakBreadthCount,
  });

  return (
    <section className="beginner-flow-view" aria-label="easy Layer 1 explanation">
      <LayerHeader
        description="시장 tape, breadth, 변동성, 섹터 경고를 Layer 1 흐름만 따로 읽습니다."
        eyebrow="Easy Guide"
        meta="Layer 1"
        title="쉬운 흐름 해설"
      />
      <div className="beginner-top-grid">
        <article className="beginner-verdict-card dashboard-card">
          <span>Layer 1 쉬운 결론</span>
          <h2>{headline}</h2>
          <p>{narrative}</p>
          <div className="beginner-verdict-note">
            <strong>{layerOneFlow ? stateKorean(layerOneFlow.state) : "데이터 대기"}</strong>
            <small>확률이나 매수·매도 판단이 아니라, 가격 흐름과 내부 확산의 정렬 상태를 쉽게 읽은 리서치 판독입니다.</small>
          </div>
        </article>
        <BeginnerFlowDiagram signals={signals} />
      </div>
      <div className="beginner-visual-grid">
        <BeginnerSignalBoard readout={readout} signals={signals} />
        <article className="beginner-balance-panel dashboard-card" aria-label="easy Layer 1 visual charts">
          <PanelHeader eyebrow="Visual Check" title="Layer 1 분포" meta="quadrant · breadth · warnings" />
          <div className="beginner-chart-stack">
            <BeginnerStackedBar
              items={[
                { className: "good", label: "leading", value: grouped.leading.length },
                { className: "good", label: "improving", value: grouped.improving.length },
                { className: "neutral", label: "weakening", value: grouped.weakening.length },
                { className: "risk", label: "lagging", value: grouped.lagging.length },
              ]}
              label="상대강도 경로"
              total={Math.max(1, sectors.length)}
              value={`주도 ${constructiveCount}/${sectors.length}`}
            />
            <BeginnerStackedBar
              items={[
                { className: "good", label: "healthy", value: healthyBreadthCount },
                { className: "neutral", label: "neutral", value: neutralBreadthCount },
                { className: "risk", label: "weak", value: weakBreadthCount },
              ]}
              label="내부 확산"
              total={Math.max(1, sectors.length)}
              value={`${healthyBreadthCount}/${sectors.length} healthy`}
            />
            <BeginnerStackedBar
              items={[
                { className: "good", label: "quiet", value: Math.max(0, sectors.length - warnings.length) },
                { className: "risk", label: "warning", value: warnings.length },
              ]}
              label="섹터 경고"
              total={Math.max(1, sectors.length)}
              value={`${warnings.length}/${sectors.length} warnings`}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

function BeginnerFlowGuide({
  contextReconciliation,
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  marketContext,
  sectors,
  selected,
  watchlist,
  warnings,
  weakBreadthCount,
}: {
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
  const constructiveCount = grouped.leading.length + grouped.improving.length;
  const activeCards = marketContextCards(selected, marketContext).filter(isActiveMarketContextCard);
  const supportiveCount = activeCards.filter((card) => card.state === "supportive").length;
  const pressureCount = activeCards.filter((card) => card.state === "pressure").length;
  const firedTriggers = watchlist.filter((item) => item.status === "fired");
  const topLeader = sectors[0];
  const finalState = contextReconciliation?.state ?? "data_insufficient";
  const headline = beginnerHeadline({
    finalState,
    layerOneState: layerOneFlow?.state,
    pressureCount,
    topLeader,
  });
  const finalNarrative = contextReconciliation?.narrative ?? "아직 Layer 2 원자료가 충분하지 않아 시장 흐름과 유동성 정합성을 보류합니다.";
  const resultReadout = buildBeginnerResultReadout({
    activeCards,
    constructiveCount,
    contextReconciliation,
    firedTriggers,
    healthyBreadthCount,
    layerOneFlow,
    pressureCount,
    sectors,
    supportiveCount,
    topLeader,
    warnings,
    weakBreadthCount,
  });
  const signals = buildBeginnerSignals({
    activeCards,
    firedTriggers,
    healthyBreadthCount,
    layerOneFlow,
    pressureCount,
    sectors,
    supportiveCount,
    warnings,
    watchlist,
    weakBreadthCount,
  });
  const neutralContextCount = Math.max(0, activeCards.length - supportiveCount - pressureCount);
  const neutralBreadthCount = Math.max(0, sectors.length - healthyBreadthCount - weakBreadthCount);

  return (
    <section className="beginner-flow-view" aria-label="easy Layer 1 and 2 explanation">
      <LayerHeader
        description="전문 지표를 줄이고, 시장 흐름과 유동성 환경을 읽는 순서대로 쉽게 봅니다."
        eyebrow="Easy Guide"
        meta="Layer 1 + 2"
        title="쉬운 흐름 해설"
      />
      <div className="beginner-top-grid">
        <article className="beginner-verdict-card dashboard-card">
          <span>오늘의 쉬운 결론</span>
          <h2>{headline}</h2>
          <p>{finalNarrative}</p>
          <div className="beginner-verdict-note">
            <strong>{reconciliationLabel(finalState)}</strong>
            <small>확률이나 매수·매도 판단이 아니라, 현재 모듈의 정렬과 불일치를 쉽게 읽은 리서치 판독입니다.</small>
          </div>
        </article>
        <BeginnerFlowDiagram signals={signals} />
      </div>
      <div className="beginner-visual-grid">
        <BeginnerSignalBoard readout={resultReadout} signals={signals} />
        <BeginnerBalancePanel
          firedTriggers={firedTriggers.length}
          healthyBreadthCount={healthyBreadthCount}
          neutralBreadthCount={neutralBreadthCount}
          neutralContextCount={neutralContextCount}
          pressureCount={pressureCount}
          sectorsCount={sectors.length}
          supportiveCount={supportiveCount}
          watchlistCount={watchlist.length}
          weakBreadthCount={weakBreadthCount}
        />
      </div>
      <div className="beginner-detail-grid">
        <BeginnerContextPanel cards={activeCards} />
        <BeginnerTriggerPanel items={watchlist} />
      </div>
    </section>
  );
}

interface BeginnerSignal {
  definition: string;
  id: string;
  interpretation: string;
  label: string;
  meta: string;
  score: number;
  tone: "good" | "neutral" | "risk";
  value: string;
}

function BeginnerFlowDiagram({ signals }: { signals: BeginnerSignal[] }) {
  return (
    <article className="beginner-flow-diagram dashboard-card" aria-label="easy reading order">
      <PanelHeader eyebrow="Reading Order" title="읽는 순서" meta="4 checks" />
      <div className="beginner-flow-lane">
        {signals.map((signal, index) => (
          <div className={`beginner-flow-node ${signal.tone}`} key={signal.id}>
            <span>{index + 1}</span>
            <strong>{signal.label}</strong>
            <em>{signal.value}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function BeginnerSignalBoard({
  readout,
  signals,
}: {
  readout: {
    positives: string[];
    cautions: string[];
    nextChecks: string[];
  };
  signals: BeginnerSignal[];
}) {
  return (
    <article className="beginner-signal-board dashboard-card" aria-label="easy signal map">
      <PanelHeader eyebrow="Signal Map" title="지표 뜻과 현재 결과" meta="metric + readout" />
      <div className="beginner-signal-list">
        {signals.map((signal) => (
          <div className={`beginner-signal-row ${signal.tone}`} key={signal.id}>
            <div className="beginner-signal-main">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.meta}</small>
            </div>
            <div className="beginner-signal-bar" aria-label={`${signal.label} ${signal.score}`}>
              <i style={{ width: `${signal.score}%` }} />
            </div>
            <p>
              <b>지표 뜻</b>
              {signal.definition}
            </p>
            <p>
              <b>현재 해석</b>
              {signal.interpretation}
            </p>
          </div>
        ))}
      </div>
      <div className="beginner-readout-strip">
        <BeginnerResultColumn items={readout.positives} label="좋은 점" tone="good" />
        <BeginnerResultColumn items={readout.cautions} label="확인할 점" tone="risk" />
        <BeginnerResultColumn items={readout.nextChecks} label="다음 확인" tone="neutral" />
      </div>
    </article>
  );
}

function BeginnerResultColumn({
  items,
  label,
  tone,
}: {
  label: string;
  items: string[];
  tone: "good" | "neutral" | "risk";
}) {
  return (
    <div className={`beginner-result-column ${tone}`}>
      <strong>{label}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function BeginnerBalancePanel({
  firedTriggers,
  healthyBreadthCount,
  neutralBreadthCount,
  neutralContextCount,
  pressureCount,
  sectorsCount,
  supportiveCount,
  watchlistCount,
  weakBreadthCount,
}: {
  firedTriggers: number;
  healthyBreadthCount: number;
  neutralBreadthCount: number;
  neutralContextCount: number;
  pressureCount: number;
  sectorsCount: number;
  supportiveCount: number;
  watchlistCount: number;
  weakBreadthCount: number;
}) {
  const contextTotal = Math.max(1, supportiveCount + pressureCount + neutralContextCount);
  const watchlistTotal = Math.max(1, watchlistCount);
  return (
    <article className="beginner-balance-panel dashboard-card" aria-label="easy visual charts">
      <PanelHeader eyebrow="Visual Check" title="숫자를 그림으로 보기" meta="breadth · liquidity · risk" />
      <div className="beginner-chart-stack">
        <BeginnerStackedBar
          items={[
            { className: "good", label: "healthy", value: healthyBreadthCount },
            { className: "neutral", label: "neutral", value: neutralBreadthCount },
            { className: "risk", label: "weak", value: weakBreadthCount },
          ]}
          label="섹터 확산"
          total={Math.max(1, sectorsCount)}
          value={`${healthyBreadthCount}/${sectorsCount}`}
        />
        <BeginnerStackedBar
          items={[
            { className: "good", label: "완화", value: supportiveCount },
            { className: "neutral", label: "중립", value: neutralContextCount },
            { className: "risk", label: "압박", value: pressureCount },
          ]}
          label="유동성 컨텍스트"
          total={contextTotal}
          value={`완화 ${supportiveCount} · 압박 ${pressureCount}`}
        />
        <BeginnerStackedBar
          items={[
            { className: "good", label: "꺼짐", value: Math.max(0, watchlistCount - firedTriggers) },
            { className: "risk", label: "켜짐", value: firedTriggers },
          ]}
          label="리스크 경고등"
          total={watchlistTotal}
          value={`${firedTriggers}/${watchlistCount}`}
        />
      </div>
    </article>
  );
}

function BeginnerStackedBar({
  items,
  label,
  total,
  value,
}: {
  items: Array<{ className: "good" | "neutral" | "risk"; label: string; value: number }>;
  label: string;
  total: number;
  value: string;
}) {
  return (
    <div className="beginner-chart-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="beginner-stacked-bar">
        {items.map((item) => (
          <i
            className={item.className}
            key={item.label}
            style={{ width: `${Math.max(item.value > 0 ? 6 : 0, (item.value / total) * 100)}%` }}
          />
        ))}
      </div>
      <small>{items.map((item) => `${item.label} ${item.value}`).join(" · ")}</small>
    </div>
  );
}

function BeginnerContextPanel({ cards }: { cards: MarketContextCard[] }) {
  return (
    <article className="beginner-panel dashboard-card">
      <PanelHeader eyebrow="Market Context" title="마켓 컨텍스트" meta={`${cards.length} items`} />
      <div className="beginner-context-list">
        {cards.map((card) => (
          <div className={`beginner-context-item ${card.state}`} key={card.code}>
            <header>
              <span>{card.code}</span>
              <strong>{card.title}</strong>
              <em>{judgementLabel(card.state)}</em>
            </header>
            <p>{marketContextExplanation(card.code)}</p>
            <small>{contextResultExplanation(card)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function BeginnerTriggerPanel({ items }: { items: TriggerWatchlistItem[] }) {
  const visible = items.length ? items : [emptyWatchlistItem()];
  return (
    <article className="beginner-panel dashboard-card">
      <PanelHeader eyebrow="Risk Trigger" title="리스크 경고등" meta={`${items.length} checks`} />
      <div className="beginner-trigger-list">
        {visible.map((item) => (
          <div className={`beginner-trigger-item ${item.status}`} key={item.id}>
            <header>
              <strong>{item.label}</strong>
              <em>{statusLabel(item.status)}</em>
            </header>
            <p>
              {triggerStatusExplanation(item.status)} {triggerItemExplanation(item.id)}
            </p>
            <small>{triggerCurrentExplanation(item)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function beginnerHeadline({
  finalState,
  layerOneState,
  pressureCount,
  topLeader,
}: {
  finalState: ContextReconciliation["state"];
  layerOneState?: LayerOneFlowSnapshot["state"];
  pressureCount: number;
  topLeader?: SectorSnapshot;
}) {
  const leaderText = topLeader ? `${topLeader.sector_code}가 앞서지만` : "리더 섹터는 아직 뚜렷하지 않고";
  if (finalState === "supportive") return `${leaderText} 시장 환경도 크게 충돌하지 않습니다`;
  if (finalState === "rotation_watch") return "유동성은 나쁘지 않지만 섹터 회전은 더 확인해야 합니다";
  if (finalState === "risk_rising") return "시장 흐름과 외부 압박이 겹쳐 방어 확인이 필요합니다";
  if (finalState === "divergent") return `${leaderText} 일부 리스크가 같이 켜져 있습니다`;
  if (layerOneState === "constructive" && pressureCount === 0) return `${leaderText} 흐름은 비교적 우호적입니다`;
  return "아직 결론보다 데이터 확인이 먼저입니다";
}

function buildBeginnerSignals({
  activeCards,
  firedTriggers,
  healthyBreadthCount,
  layerOneFlow,
  pressureCount,
  sectors,
  supportiveCount,
  warnings,
  watchlist,
  weakBreadthCount,
}: {
  activeCards: MarketContextCard[];
  firedTriggers: TriggerWatchlistItem[];
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  pressureCount: number;
  sectors: SectorSnapshot[];
  supportiveCount: number;
  warnings: SectorSnapshot[];
  watchlist: TriggerWatchlistItem[];
  weakBreadthCount: number;
}): BeginnerSignal[] {
  const marketScore =
    layerOneFlow?.state === "constructive"
      ? 78
      : layerOneFlow?.state === "mixed"
        ? 52
        : layerOneFlow?.state === "caution"
          ? 28
          : 40;
  const breadthScore = sectors.length ? Math.round((healthyBreadthCount / sectors.length) * 100) : 0;
  const contextTotal = Math.max(1, activeCards.length);
  const liquidityScore = Math.round(((supportiveCount + Math.max(0, contextTotal - supportiveCount - pressureCount) * 0.5) / contextTotal) * 100);
  const riskScore = watchlist.length ? Math.round(((watchlist.length - firedTriggers.length) / watchlist.length) * 100) : 45;

  return [
    {
      definition: "SPY 같은 대표 지수와 VIX를 보며 시장 전체가 순풍인지 역풍인지 확인합니다.",
      id: "market",
      interpretation: marketWindInterpretation(layerOneFlow),
      label: "시장 바람",
      meta: layerOneFlow ? `SPY 1M ${formatPercent(layerOneFlow.tape.ret_1m)} · VIX ${formatVix(layerOneFlow)}` : "SPY와 VIX 수집 후 판단",
      score: marketScore,
      tone: scoreTone(marketScore),
      value: layerOneFlow ? stateKorean(layerOneFlow.state) : "데이터 대기",
    },
    {
      definition: "상승이 일부 섹터에만 몰렸는지, 여러 섹터로 퍼지는지 확인합니다.",
      id: "breadth",
      interpretation: breadthInterpretation({ healthyBreadthCount, sectors, warnings, weakBreadthCount }),
      label: "내부 확산",
      meta: `약한 breadth ${weakBreadthCount}개 · 경고 ${warnings.length}개`,
      score: breadthScore,
      tone: scoreTone(breadthScore),
      value: `${healthyBreadthCount}/${sectors.length} 건강`,
    },
    {
      definition: "시장 움직임을 밀어줄 유동성, 달러, 신용, 현금성 여력이 남아 있는지 봅니다.",
      id: "liquidity",
      interpretation: liquidityInterpretation({ pressureCount, supportiveCount }),
      label: "유동성 여력",
      meta: `${activeCards.length}개 컨텍스트 사용 · ${sourceClassSummary(activeCards)}`,
      score: liquidityScore,
      tone: scoreTone(liquidityScore),
      value: `완화 ${supportiveCount} · 압박 ${pressureCount}`,
    },
    {
      definition: "유동성·달러·신용·집중도 중 지금 다시 확인해야 할 경고등입니다.",
      id: "risk",
      interpretation: triggerInterpretation(firedTriggers, watchlist.length),
      label: "리스크 경고등",
      meta: firedTriggers.length ? firedTriggers.map((item) => item.label).join(", ") : "현재 주요 경고등은 꺼져 있음",
      score: riskScore,
      tone: scoreTone(riskScore),
      value: `${firedTriggers.length}/${watchlist.length} 켜짐`,
    },
  ];
}

function buildLayerOneBeginnerSignals({
  constructiveCount,
  grouped,
  healthyBreadthCount,
  layerOneFlow,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  constructiveCount: number;
  grouped: GroupedQuadrants;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}): BeginnerSignal[] {
  const marketScore =
    layerOneFlow?.state === "constructive"
      ? 78
      : layerOneFlow?.state === "mixed"
        ? 52
        : layerOneFlow?.state === "caution"
          ? 28
          : 40;
  const breadthScore = sectors.length ? Math.round((healthyBreadthCount / sectors.length) * 100) : 0;
  const volatilityScore =
    layerOneFlow?.risk.state === "calm"
      ? 74
      : layerOneFlow?.risk.state === "elevated"
        ? 30
        : 42;
  const rotationScore = sectors.length ? Math.round((constructiveCount / sectors.length) * 100) : 0;

  return [
    {
      definition: "SPY 가격 흐름과 1D/1M 변화를 보며 시장 전체가 순풍인지 역풍인지 확인합니다.",
      id: "market",
      interpretation: marketWindInterpretation(layerOneFlow),
      label: "시장 바람",
      meta: layerOneFlow ? `SPY 1M ${formatPercent(layerOneFlow.tape.ret_1m)} · 52w ${formatRangePosition(layerOneFlow.tape.range_52w_position)}` : "SPY 수집 후 판단",
      score: marketScore,
      tone: scoreTone(marketScore),
      value: layerOneFlow ? stateKorean(layerOneFlow.state) : "데이터 대기",
    },
    {
      definition: "상승이 일부 섹터에만 몰렸는지, 여러 섹터로 넓게 퍼지는지 확인합니다.",
      id: "breadth",
      interpretation: breadthInterpretation({ healthyBreadthCount, sectors, warnings, weakBreadthCount }),
      label: "내부 확산",
      meta: `약한 breadth ${weakBreadthCount}개 · 경고 ${warnings.length}개`,
      score: breadthScore,
      tone: scoreTone(breadthScore),
      value: `${healthyBreadthCount}/${sectors.length} healthy`,
    },
    {
      definition: "VIX와 실현변동성으로 시장 불안이 Layer 1 흐름을 방해하는지 확인합니다.",
      id: "volatility",
      interpretation:
        layerOneFlow?.risk.state === "elevated"
          ? "변동성이 높아져 좋은 가격 흐름도 되돌림 위험과 함께 봅니다."
          : layerOneFlow?.risk.state === "calm"
            ? "변동성 압력은 제한적이라 흐름을 크게 방해하지 않는 상태입니다."
            : "변동성 데이터가 부족해 위험 압력 해석을 보류합니다.",
      label: "변동성 압력",
      meta: `VIX ${formatVix(layerOneFlow)} · ${transitionLabel(layerOneFlow?.risk.transition ?? "unknown")}`,
      score: volatilityScore,
      tone: scoreTone(volatilityScore),
      value: judgementLabel(layerOneFlow?.risk.state ?? "unknown"),
    },
    {
      definition: "Leading과 Improving 섹터가 많을수록 시장 내부 회전이 더 건설적으로 보입니다.",
      id: "rotation",
      interpretation:
        constructiveCount > warnings.length
          ? "주도·순환 섹터가 경고 섹터보다 많아 흐름의 폭은 우호적인 편입니다."
          : "경고 섹터가 많아 리더십 품질과 확산 여부를 다시 확인합니다.",
      label: "섹터 회전",
      meta: `Leading ${grouped.leading.length} · Improving ${grouped.improving.length}`,
      score: rotationScore,
      tone: scoreTone(rotationScore),
      value: `주도 ${constructiveCount}/${sectors.length}`,
    },
  ];
}

function scoreTone(score: number): BeginnerSignal["tone"] {
  if (score >= 64) return "good";
  if (score <= 42) return "risk";
  return "neutral";
}

function buildLayerOneBeginnerReadout({
  constructiveCount,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  topLeader,
  warnings,
  weakBreadthCount,
}: {
  constructiveCount: number;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  topLeader?: SectorSnapshot;
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const positives: string[] = [];
  const cautions: string[] = [];
  const nextChecks: string[] = [];

  if (topLeader) positives.push(`${topLeader.sector_code}가 현재 가장 앞선 섹터로 잡힙니다.`);
  if (layerOneFlow?.state === "constructive") positives.push("시장 tape는 대체로 우호적인 쪽으로 읽힙니다.");
  if (constructiveCount > sectors.length / 2) positives.push(`Leading/Improving 섹터가 ${constructiveCount}개로 절반 이상입니다.`);
  if (healthyBreadthCount > weakBreadthCount) positives.push(`healthy breadth ${healthyBreadthCount}개가 weak ${weakBreadthCount}개보다 많습니다.`);
  if (positives.length === 0) positives.push("아직 강하게 우호적인 Layer 1 항목은 제한적입니다.");

  if (layerOneFlow?.risk.state === "elevated") cautions.push("VIX 또는 변동성 압력이 높아져 흐름 판정을 보수적으로 봅니다.");
  if (weakBreadthCount >= healthyBreadthCount) cautions.push(`weak breadth ${weakBreadthCount}개가 healthy ${healthyBreadthCount}개보다 많거나 비슷합니다.`);
  if (warnings.length) cautions.push(`경고 섹터가 ${warnings.length}개 있어 리더십 품질 확인이 필요합니다.`);
  if (reconciliation?.state === "divergent") cautions.push("Layer 1 흐름과 외부 컨텍스트가 완전히 같은 방향은 아닙니다.");
  if (cautions.length === 0) cautions.push("현재 핵심 경고는 제한적이지만, breadth와 변동성은 다음 갱신에서도 확인합니다.");

  nextChecks.push("다음 갱신 후 SPY 1M 흐름과 52주 위치가 같은 방향을 유지하는지 확인합니다.");
  nextChecks.push("Leading/Improving 섹터 수가 줄어들면 회전 품질 약화로 표시합니다.");
  nextChecks.push("VIX 상승과 weak breadth 증가가 동시에 나오면 Layer 1 판단을 낮춥니다.");

  return { cautions, nextChecks, positives };
}

function buildBeginnerResultReadout({
  activeCards,
  constructiveCount,
  contextReconciliation,
  firedTriggers,
  healthyBreadthCount,
  layerOneFlow,
  pressureCount,
  sectors,
  supportiveCount,
  topLeader,
  warnings,
  weakBreadthCount,
}: {
  activeCards: MarketContextCard[];
  constructiveCount: number;
  contextReconciliation?: ContextReconciliation;
  firedTriggers: TriggerWatchlistItem[];
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  pressureCount: number;
  sectors: SectorSnapshot[];
  supportiveCount: number;
  topLeader?: SectorSnapshot;
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const positives: string[] = [];
  const cautions: string[] = [];
  const nextChecks: string[] = [];

  if (topLeader) positives.push(`${topLeader.sector_code}가 현재 가장 앞선 섹터로 잡힙니다.`);
  if (layerOneFlow?.state === "constructive") positives.push("시장 바람은 대체로 우호적인 쪽으로 읽힙니다.");
  if (constructiveCount > sectors.length / 2) positives.push(`주도·순환 섹터가 ${constructiveCount}개로 절반 이상입니다.`);
  if (supportiveCount > pressureCount) positives.push(`마켓 컨텍스트는 완화 ${supportiveCount}개가 압박 ${pressureCount}개보다 많습니다.`);
  if (positives.length === 0) positives.push("아직 강하게 우호적인 항목은 제한적이며, 데이터 확인이 먼저입니다.");

  if (warnings.length) cautions.push(`경고 섹터가 ${warnings.length}개 있어 리더십 품질 확인이 필요합니다.`);
  if (weakBreadthCount >= healthyBreadthCount) cautions.push(`weak breadth ${weakBreadthCount}개가 healthy ${healthyBreadthCount}개보다 많거나 비슷합니다.`);
  if (pressureCount > 0) cautions.push(`유동성·달러·신용 중 압박 컨텍스트가 ${pressureCount}개 있습니다.`);
  if (firedTriggers.length) cautions.push(`켜진 리스크 경고등: ${firedTriggers.map((item) => item.label).join(", ")}.`);
  if (contextReconciliation?.state === "divergent") cautions.push("섹터 리더십과 외부 환경이 완전히 같은 방향은 아닙니다.");
  if (cautions.length === 0) cautions.push("현재 핵심 경고는 제한적이지만, 데이터 최신성과 breadth는 계속 확인합니다.");

  nextChecks.push("다음 갱신 후에도 같은 섹터가 리더인지 확인합니다.");
  nextChecks.push("healthy breadth가 늘어나는지, 아니면 소수 섹터만 버티는지 확인합니다.");
  if (activeCards.some((card) => card.source_class === "proxy")) nextChecks.push("보조 지표 항목은 원자료가 아니므로 방향 참고용으로만 봅니다.");
  if (firedTriggers.length) {
    nextChecks.push("켜진 리스크 경고등이 다음 수집에서도 유지되는지 확인합니다.");
  } else {
    nextChecks.push("리스크 경고등이 새로 켜지는지 확인합니다.");
  }

  return {
    cautions: cautions.slice(0, 3),
    nextChecks: nextChecks.slice(0, 3),
    positives: positives.slice(0, 3),
  };
}

function marketWindInterpretation(flow?: LayerOneFlowSnapshot) {
  if (!flow) return "아직 SPY와 VIX 기반 판단이 충분하지 않아 시장 바람은 대기 상태입니다.";
  if (flow.state === "constructive") return "지수 흐름과 변동성 조합은 시장을 밀어주는 쪽에 가깝습니다.";
  if (flow.state === "caution") return "시장 방향보다 방어 확인이 먼저입니다. 변동성이나 약한 수익률이 부담입니다.";
  if (flow.state === "mixed") return "상승·하락 어느 한쪽으로 단정하기보다 다음 breadth와 변동성 변화를 봅니다.";
  return "데이터가 부족해 결론을 보류합니다.";
}

function breadthInterpretation({
  healthyBreadthCount,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  healthyBreadthCount: number;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  if (healthyBreadthCount > weakBreadthCount) {
    return `건강한 breadth가 더 많아 상승이 일부 섹터에만 갇힌 상태는 아닙니다. 다만 경고 ${warnings.length}개는 함께 봅니다.`;
  }
  if (weakBreadthCount > 0) {
    return `약한 breadth가 ${weakBreadthCount}/${sectors.length}개라서 리더 섹터의 내부 품질 확인이 필요합니다.`;
  }
  return "아직 breadth가 뚜렷하게 좋거나 나쁘다고 보기 어려워 다음 수집을 기다립니다.";
}

function liquidityInterpretation({
  pressureCount,
  supportiveCount,
}: {
  pressureCount: number;
  supportiveCount: number;
}) {
  if (pressureCount > supportiveCount) return "압박 항목이 더 많아 가격 흐름이 좋아도 외부 환경은 조심스럽게 봅니다.";
  if (supportiveCount > pressureCount) return "완화 항목이 더 많아 현재 흐름을 방해하는 외부 압박은 제한적으로 보입니다.";
  return "완화와 압박이 비슷해 유동성 환경은 중립적으로 해석합니다.";
}

function triggerInterpretation(firedTriggers: TriggerWatchlistItem[], total: number) {
  if (total === 0) return "아직 계산된 리스크 경고등이 없어 결과 해석을 보류합니다.";
  if (firedTriggers.length === 0) return "현재 주요 경고등은 꺼져 있어 즉시 확인할 위험 신호는 제한적입니다.";
  return `${firedTriggers.length}개 경고등이 켜져 있어 해당 항목이 일시적인지 반복되는지 확인합니다.`;
}

function sourceClassSummary(cards: MarketContextCard[]) {
  const official = cards.filter((card) => card.source_class === "official").length;
  const supplemental = cards.filter((card) => card.source_class === "proxy").length;
  return `공식 ${official} · 보조 ${supplemental}`;
}

type InsightTone = "good" | "neutral" | "risk" | "pending";

interface LayerVerdictItem {
  label: string;
  value: string;
  detail: string;
  tone: InsightTone;
}

interface DataInsight {
  category: string;
  id: string;
  label: string;
  source: string;
  meaning: string;
  value: string;
  judgement: string;
  interpretation: string;
  meter: number | null;
  meterLabel: string;
  tone: InsightTone;
}

interface FlowCheckpoint {
  detail: string;
  label: string;
  reason: string;
  value: string;
}

interface SourceDisclosureItem {
  label: string;
  value: string;
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
  const verdictItems = buildLayerOneVerdictItems({
    constructiveCount,
    healthyBreadthCount,
    layerOneFlow,
    reconciliation,
    sectors,
    topLeader,
    warnings,
    weakBreadthCount,
  });

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
          <FlowFinalReadout
            constructiveCount={constructiveCount}
            healthyBreadthCount={healthyBreadthCount}
            layerOneFlow={layerOneFlow}
            reconciliation={reconciliation}
            sectors={sectors}
            warnings={warnings}
            weakBreadthCount={weakBreadthCount}
          />
          <LayerVerdictList items={verdictItems} title="전체 판단" />
          <LayerOneSignalPanel flow={layerOneFlow} />
        </article>
        <FlowDistributionPanel
          grouped={grouped}
          healthyBreadthCount={healthyBreadthCount}
          layerOneFlow={layerOneFlow}
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
  sectors,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const constructive = [...grouped.leading, ...grouped.improving];
  const neutralBreadth = Math.max(0, sectors.length - healthyBreadthCount - weakBreadthCount);
  const detailInsights = buildLayerOneInsights({
    constructive,
    healthyBreadthCount,
    layerOneFlow,
    sectors,
    warnings,
    weakBreadthCount,
  });

  return (
    <article className="flow-distribution-card dashboard-card" aria-label="layer one distribution">
      <PanelHeader eyebrow="Evidence" title="근거와 확인 지점" meta={`${sectors.length} sectors`} />
      <div className="flow-distribution-body">
        <div className="flow-visual-stack">
          <QuadrantMix grouped={grouped} total={sectors.length} />
          <FlowSparkline sectors={sectors} />
        </div>
        <div className="flow-cluster-grid">
          <DataInsightPanel
            items={detailInsights}
            meta="meaning + value + readout"
            title="지표별 해석"
          />
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
        label="Breadth 보조지표"
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
  const checkpoints: FlowCheckpoint[] = [
    {
      detail: "다음 수집 뒤에도 같은 섹터가 앞에 있으면 흐름 지속으로 봅니다.",
      label: "리더 유지",
      value: topLeader ? `${topLeader.sector_code} · ${topLeader.rulebook.lead_pattern}` : "no leader",
      reason: "좋은 모멘텀이 한 번 반짝인지, 지속되는 힘인지 구분합니다.",
    },
    {
      detail: "SPY와 시장 tape가 섹터 리더십을 함께 밀어주는지 확인합니다.",
      label: "Tape 확인",
      value:
        layerOneFlow?.tape.ret_1m !== undefined
          ? `SPY 1M ${formatPercent(layerOneFlow.tape.ret_1m)}`
          : healthyBreadthCount > weakBreadthCount
            ? `${healthyBreadthCount} healthy breadth`
            : `${weakBreadthCount} weak breadth`,
      reason: "섹터만 강하고 시장 자체가 약하면 리더십 신뢰도가 낮아집니다.",
    },
    {
      detail: "소수 대형 섹터가 아니라 여러 섹터로 강세가 퍼지는지 봅니다.",
      label: "폭 확인",
      value: layerOneFlow
        ? `RSP ${formatPercent(layerOneFlow.breadth_quality.rsp_vs_spy_1m)}`
        : warnings.length
          ? warningCodes || `${warnings.length} sectors`
          : "none",
      reason: "폭이 좁으면 강한 리더가 있어도 흔들릴 때 방어력이 약합니다.",
    },
  ];

  return (
    <div className="flow-checkpoints">
      <div className="flow-checkpoints-head">
        <span>확인 체크리스트</span>
        <p>현재 판단이 유지되는지 다음 수집에서 다시 볼 핵심 조건입니다.</p>
      </div>
      {checkpoints.map((checkpoint) => (
        <article key={checkpoint.label}>
          <header>
            <strong>{checkpoint.label}</strong>
            <b>{checkpoint.value}</b>
          </header>
          <p>{checkpoint.detail}</p>
          <small>{checkpoint.reason}</small>
        </article>
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
    ? `외부 정합성은 ${reconciliationLabel(reconciliation.state)}로 요약되며 상세 원천과 리스크는 Layer 2에서 확인합니다.`
    : "Layer 2 맥락은 아직 보류 상태입니다.";
  const fallbackNarrative =
    topLeader
      ? `${topLeader.sector_code}가 현재 흐름을 이끌고, 주도·순환 축은 ${constructiveCount}개 섹터에서 형성됩니다.`
      : `주도·순환 축은 ${constructiveCount}개 섹터에서 형성됩니다.`;
  const mergedNarrative = layerOneFlow?.narrative ?? fallbackNarrative;

  return (
    <div className="flow-final-readout" aria-label="Layer 1 final readout">
      <div>
        <span>흐름 최종 판단</span>
        <strong>{layerOneFlow ? stateKorean(layerOneFlow.state) : "섹터 흐름 요약"}</strong>
        <em>{transitionLabel}</em>
      </div>
      <p>
        {mergedNarrative} {breadthText} {riskText} {reconciliationText} 이 판단은 확률이 아니라 현재 모듈 정렬과
        불일치를 서술한 리서치 판독입니다.
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

function formatRangePosition(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}% 위치`;
}

function formatVix(flow?: LayerOneFlowSnapshot) {
  const vix = flow?.risk.vix_latest;
  return typeof vix === "number" && Number.isFinite(vix) ? vix.toFixed(1) : "unknown";
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
  const firedCount = watchlist.filter((item) => item.status === "fired").length;
  const liquidityNarrative = buildLiquidityNarrative({
    activeCards,
    accumulationCount,
    distributionCount,
    firedCount,
    selected,
    watchlistCount: watchlist.length,
  });
  const verdictItems = buildLayerTwoVerdictItems({
    activeCards,
    accumulationCount,
    distributionCount,
    firedCount,
    selected,
    watchlist,
  });

  return (
    <section className="layer-section layer-two" aria-label="layer two liquidity">
      <LayerHeader
        description="ETF 거래량은 Yahoo 가격으로 확인하고, 마켓 컨텍스트는 직접 수집 가능한 FRED 원천만 표시합니다."
        eyebrow="Layer 2"
        meta="participation + market context"
        title="여력 (유동성)"
      />
      <div className="liquidity-board">
        <article className="liquidity-overview dashboard-card">
          <PanelHeader eyebrow="Fuel Mix" title="요약" meta={selected.sector_code} />
          <p className="liquidity-summary-lede">{liquidityNarrative}</p>
          <LayerVerdictList items={verdictItems} title="유동성 판단" />
          <ModuleMeter label="Selected ETF volume" module={selected.modules.participation} />
          <div className="metric-pair compact">
            <MiniMetric label="Accumulation" value={`${accumulationCount}`} />
            <MiniMetric label="Distribution" value={`${distributionCount}`} />
          </div>
          <div className="flow-metric-grid compact" aria-label="liquidity checks">
            <MiniMetric label="컨텍스트" value={`${activeCards.length}개`} />
            <MiniMetric label="경고등" value={`${firedCount}/${watchlist.length}`} />
            <MiniMetric label="최근 기준" value={latestMarketContextDate(activeCards)} />
          </div>
        </article>
        <div className="liquidity-context-tools">
          <MarketContextInsightPanel
            history={contextHistory}
            marketContext={activeCards}
            watchlist={watchlist}
          />
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

function LayerVerdictList({
  items,
  title,
}: {
  items: LayerVerdictItem[];
  title: string;
}) {
  return (
    <div className="layer-verdict-list" aria-label={title}>
      <strong>{title}</strong>
      {items.map((item) => (
        <div className={`layer-verdict-item ${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <b>{item.value}</b>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}

function DataInsightPanel({
  items,
  meta,
  title,
}: {
  items: DataInsight[];
  meta: string;
  title: string;
}) {
  return (
    <div className="data-insight-panel" aria-label={`${title}: ${meta}`}>
      <div className="data-insight-head">
        <div>
          <span>Indicator Guide</span>
          <strong>{title}</strong>
        </div>
        <small>{items.length} checks</small>
      </div>
      <div className="data-insight-grid">
        {items.map((item) => {
          const sourceItems = dataInsightSourceItems(item);
          return (
            <div className={`data-insight-item ${item.tone}`} key={item.id} title={sourceDisclosureTitle(sourceItems)}>
              <header>
                <span>{item.category}</span>
                <b>{item.judgement}</b>
              </header>
              <div className="data-insight-value">
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </div>
              <InsightMeter label={item.meterLabel} tone={item.tone} value={item.meter} />
              <p>
                <b>의미</b>
                {item.meaning}
              </p>
              <p>
                <b>해석</b>
                {item.interpretation}
              </p>
              <SourceDisclosure items={sourceItems} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightMeter({
  label,
  tone,
  value,
}: {
  label: string;
  tone: InsightTone;
  value: number | null;
}) {
  const width = value === null ? 0 : clampPercent(value);
  return (
    <div className={`insight-meter ${tone}`}>
      <i style={{ width: `${width}%` }} />
      <small>{label}</small>
    </div>
  );
}

function MarketContextInsightPanel({
  history,
  marketContext,
  watchlist,
}: {
  history: HistoryResponse["market_context"];
  marketContext: MarketContextCard[];
  watchlist: TriggerWatchlistItem[];
}) {
  const byCode = new Map(history.map((item) => [item.code, item.points.slice(-4)]));
  const fired = watchlist.filter((item) => item.status === "fired");

  return (
    <article className="market-context-insight-panel dashboard-card">
      <PanelHeader
        eyebrow="Market Context"
        title="마켓 컨텍스트"
        meta={`${marketContext.length} context · ${fired.length} risk on`}
      />
      <div className="context-insight-grid">
        {marketContext.map((card) => {
          const points = byCode.get(card.code) ?? [];
          const fallback = points.length ? points : [{ state: card.state, transition: card.transition, date: "current" }];
          const relatedRisks = watchlist.filter((item) => triggerContextCode(item) === card.code);
          return (
            <ContextInsightCard
              card={card}
              key={card.code}
              relatedRisks={relatedRisks}
              trend={fallback}
            />
          );
        })}
      </div>
      <ContextRiskSummary items={watchlist} />
    </article>
  );
}

function ContextInsightCard({
  card,
  relatedRisks,
  trend,
}: {
  card: MarketContextCard;
  relatedRisks: TriggerWatchlistItem[];
  trend: Array<{ date: string; state: string; transition: string }>;
}) {
  const firedRelated = relatedRisks.filter((item) => item.status === "fired");
  const sourceItems = marketContextSourceItems(card);

  return (
    <div className={`context-insight-card ${contextTone(card)}`} title={sourceDisclosureTitle(sourceItems)}>
      <header>
        <span>{card.code}</span>
        <div>
          <strong>{card.title}</strong>
          <small>{judgementLabel(card.state)}</small>
        </div>
        <em>{firedRelated.length ? "경고 켜짐" : "정상 확인"}</em>
      </header>
      <div className="context-insight-value">
        <strong>{contextPrimaryValue(card)}</strong>
        <span className="context-dots" aria-label={`${card.code} trend`}>
          {trend.map((point, index) => (
            <mark className={stateClass(point.state)} key={`${card.code}-${point.date}-${index}`} />
          ))}
        </span>
      </div>
      <InsightMeter label="판단 강도" tone={contextTone(card)} value={contextStateMeter(card)} />
      <p>
        <b>의미</b>
        {marketContextExplanation(card.code)}
      </p>
      <p>
        <b>해석</b>
        {contextResultExplanation(card)}
      </p>
      <div className="context-related-risk">
        <b>관련 리스크</b>
        {relatedRisks.length ? (
          relatedRisks.map((item) => (
            <span className={item.status} key={item.id} title={`${item.trigger}\n${item.meaning}`}>
              {item.label}: {statusLabel(item.status)}
            </span>
          ))
        ) : (
          <span className="quiet">연결된 경고 없음</span>
        )}
      </div>
      <SourceDisclosure items={sourceItems} />
    </div>
  );
}

function SourceDisclosure({ items }: { items: SourceDisclosureItem[] }) {
  const visible = items.filter((item) => item.value);
  return (
    <details className="source-disclosure">
      <summary>출처 정보</summary>
      <dl>
        {visible.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function ContextRiskSummary({ items }: { items: TriggerWatchlistItem[] }) {
  const visible = items.length ? items : [emptyWatchlistItem()];
  const firedCount = visible.filter((item) => item.status === "fired").length;
  return (
    <div className="context-risk-summary">
      <div>
        <span>Risk Trigger</span>
        <strong>분석 리스크별 판단</strong>
        <em>{firedCount}/{visible.length} 켜짐</em>
      </div>
      <div className="context-risk-list">
        {visible.map((item) => (
          <article className={`context-risk-item ${item.status}`} key={item.id} title={`${item.trigger}\n${item.meaning}`}>
            <header>
              <strong>{item.label}</strong>
              <b>{statusLabel(item.status)}</b>
            </header>
            <dl>
              <div>
                <dt>분석 리스크</dt>
                <dd>{item.trigger}</dd>
              </div>
              <div>
                <dt>판단</dt>
                <dd>{triggerStatusExplanation(item.status)}</dd>
              </div>
              <div>
                <dt>해석</dt>
                <dd>{item.meaning}</dd>
              </div>
            </dl>
            <small>{item.warnings[0] ? watchlistWarningLabel(item.warnings[0]) : "현재 추가 경고 메모는 없습니다."}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function triggerContextCode(item: TriggerWatchlistItem) {
  const text = `${item.id} ${item.label} ${item.trigger}`.toLowerCase();
  if (text.includes("walcl") || text.includes("policy") || text.includes("liquidity")) return "S01";
  if (text.includes("dxy") || text.includes("usdkrw") || text.includes("fx") || text.includes("dollar")) return "S02";
  if (text.includes("hy oas") || text.includes("vix") || text.includes("credit") || text.includes("spread")) return "S03";
  if (text.includes("reserve") || text.includes("wresbal") || text.includes("mmf")) return "S05";
  return null;
}

function dataInsightSourceItems(item: DataInsight): SourceDisclosureItem[] {
  return [
    {
      label: "요청 정보",
      value: `${item.category}에서 ${item.label} 판단에 필요한 지표를 요청했습니다.`,
    },
    {
      label: "요청/수집 항목",
      value: item.source,
    },
    {
      label: "받아온 결과",
      value: `${item.value} · 현재 판단 ${item.judgement}`,
    },
    {
      label: "계산/표시",
      value: `${item.meterLabel} 기준으로 화면 막대와 해석 문구를 만들었습니다.`,
    },
  ];
}

function marketContextSourceItems(card: MarketContextCard): SourceDisclosureItem[] {
  const evidence = contextEvidenceItems(card);
  const warnings = card.warnings.map(watchlistWarningLabel).join(" / ");
  return [
    {
      label: "요청 정보",
      value: `${card.title}(${card.code})의 시장 컨텍스트 판단에 필요한 ${sourceClassLabel(card)} 시계열을 요청했습니다.`,
    },
    {
      label: "요청/수집 항목",
      value: card.source,
    },
    {
      label: "받아온 결과",
      value: evidence.length ? evidence.join(" · ") : contextPrimaryValue(card),
    },
    {
      label: "최신 기준",
      value: updateLabel(card),
    },
    {
      label: "주의 메모",
      value: warnings || "추가 경고 메모는 없습니다.",
    },
  ];
}

function sourceDisclosureTitle(items: SourceDisclosureItem[]) {
  return items
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`)
    .join("\n");
}

function buildLayerOneVerdictItems({
  constructiveCount,
  healthyBreadthCount,
  layerOneFlow,
  reconciliation,
  sectors,
  topLeader,
  warnings,
  weakBreadthCount,
}: {
  constructiveCount: number;
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  reconciliation?: ContextReconciliation;
  sectors: SectorSnapshot[];
  topLeader?: SectorSnapshot;
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}): LayerVerdictItem[] {
  const breadthText =
    healthyBreadthCount > weakBreadthCount
      ? `${healthyBreadthCount}/${sectors.length}개 섹터가 내부 확산을 뒷받침합니다.`
      : `${weakBreadthCount}/${sectors.length}개 섹터가 약해 리더십 폭 확인이 필요합니다.`;
  const leaderText = topLeader
    ? `${topLeader.sector_name}(${topLeader.sector_code})가 현재 가장 앞에 있습니다.`
    : "아직 뚜렷한 선두 섹터가 없습니다.";

  return [
    {
      detail: layerOneFlow ? `${leaderText} 전환은 ${transitionKorean(layerOneFlow.transition)}입니다.` : leaderText,
      label: "흐름",
      tone: toneFromLayerOneState(layerOneFlow?.state),
      value: layerOneFlow ? stateKorean(layerOneFlow.state) : "데이터 대기",
    },
    {
      detail: breadthText,
      label: "확산",
      tone: breadthTone(healthyBreadthCount, weakBreadthCount),
      value: `${healthyBreadthCount}/${sectors.length} healthy`,
    },
    {
      detail: warnings.length
        ? `경고 섹터 ${warnings.length}개는 과열, 약한 breadth, 참여 약화 여부를 같이 봅니다.`
        : `주도·순환 축 ${constructiveCount}개가 확인되고 뚜렷한 rulebook 경고는 제한적입니다.`,
      label: "품질",
      tone: warnings.length ? "risk" : "good",
      value: `${warnings.length} warnings`,
    },
    {
      detail: reconciliation
        ? "외부 컨텍스트 상세와 관련 수집원은 Layer 2 화면에서 따로 확인합니다."
        : "외부 정합성은 데이터 수집 후 Layer 2 화면에서 판단합니다.",
      label: "정합성",
      tone: reconciliationTone(reconciliation?.state),
      value: reconciliation ? reconciliationLabel(reconciliation.state) : "대기",
    },
  ];
}

function buildLayerOneInsights({
  constructive,
  healthyBreadthCount,
  layerOneFlow,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  constructive: SectorSnapshot[];
  healthyBreadthCount: number;
  layerOneFlow?: LayerOneFlowSnapshot;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}): DataInsight[] {
  const topLeader = sectors[0];
  const leaderRs = topLeader ? numberMetric(topLeader.modules.relative_strength.evidence.rs_ratio, 100) : null;
  const tail = sectors.at(-1);
  const tailRs = tail ? numberMetric(tail.modules.relative_strength.evidence.rs_ratio, 100) : null;
  const rsGap = leaderRs === null || tailRs === null ? null : leaderRs - tailRs;
  const breadthShare = sectors.length ? (healthyBreadthCount / sectors.length) * 100 : null;
  const vix = layerOneFlow?.risk.vix_latest ?? null;

  return [
    {
      category: "가격 흐름",
      id: "market-tape",
      interpretation: marketWindInterpretation(layerOneFlow),
      judgement: layerOneFlow ? stateKorean(layerOneFlow.state) : "대기",
      label: "시장 흐름",
      meaning: "SPY 가격 흐름으로 시장 전체가 섹터 리더십을 밀어주는지 봅니다.",
      meter: decimalRangeMeter(layerOneFlow?.tape.ret_1m, -0.08, 0.08),
      meterLabel: `SPY 1M ${formatPercent(layerOneFlow?.tape.ret_1m)}`,
      source: "Yahoo · SPY",
      tone: toneFromLayerOneState(layerOneFlow?.state),
      value: `${formatPercent(layerOneFlow?.tape.ret_1m)} · 1D ${formatPercent(layerOneFlow?.tape.ret_1d)}`,
    },
    {
      category: "변동성",
      id: "risk-vol",
      interpretation:
        layerOneFlow?.risk.state === "elevated"
          ? "변동성이 올라와 가격 흐름이 좋아도 급격한 되돌림 가능성을 같이 확인합니다."
          : layerOneFlow?.risk.state === "calm"
            ? "변동성 압력은 크지 않아 현재 흐름을 방해하는 요인은 제한적입니다."
            : "VIX 또는 실현변동성 데이터가 부족해 위험 압력 해석을 보류합니다.",
      judgement: judgementLabel(layerOneFlow?.risk.state ?? "unknown"),
      label: "변동성 압력",
      meaning: "VIX와 실현변동성으로 시장 불안이 커지는지 확인합니다.",
      meter: vix === null ? null : Math.min(100, (vix / 40) * 100),
      meterLabel: vix === null ? "VIX 대기" : `${vix.toFixed(1)} VIX`,
      source: "Yahoo · VIX",
      tone: layerOneFlow?.risk.state === "elevated" ? "risk" : layerOneFlow?.risk.state === "calm" ? "good" : "pending",
      value: vix === null ? "unknown" : `${vix.toFixed(1)} VIX · RV20 ${formatPercentFromWhole(layerOneFlow?.risk.realized_vol_20)}`,
    },
    {
      category: "섹터 폭",
      id: "breadth-quality",
      interpretation: breadthInterpretation({ healthyBreadthCount, sectors, warnings, weakBreadthCount }),
      judgement: judgementLabel(layerOneFlow?.breadth_quality.state ?? "unknown"),
      label: "내부 확산",
      meaning: "상승이 일부 섹터에만 몰렸는지, 여러 섹터로 넓게 퍼지는지 봅니다.",
      meter: breadthShare,
      meterLabel: `${healthyBreadthCount}/${sectors.length} healthy`,
      source: "Sector snapshots",
      tone: breadthTone(healthyBreadthCount, weakBreadthCount),
      value: `${healthyBreadthCount} healthy · ${weakBreadthCount} weak`,
    },
    {
      category: "모멘텀 분포",
      id: "rs-distribution",
      interpretation: topLeader
        ? `${topLeader.sector_name}(${topLeader.sector_code})가 선두입니다. 격차가 커질수록 리더십은 뚜렷하지만 소수 집중 여부도 함께 봅니다.`
        : "섹터별 상대강도 분포가 충분하지 않아 선두 격차 판단을 보류합니다.",
      judgement: constructive.length >= warnings.length ? "주도 우세" : "경고 우세",
      label: "상대강도 분포",
      meaning: "섹터별 RS Ratio를 순서대로 연결해 어느 섹터에 좋은 모멘텀이 몰리는지 봅니다.",
      meter: rsGap === null ? null : wholeRangeMeter(rsGap, 0, 18),
      meterLabel: rsGap === null ? "gap 대기" : `${rsGap.toFixed(1)} gap`,
      source: "RS/RRG",
      tone: constructive.length > warnings.length ? "good" : warnings.length ? "risk" : "neutral",
      value: topLeader ? `${topLeader.sector_code} ${leaderRs?.toFixed(1) ?? "n/a"} lead` : "leader 대기",
    },
  ];
}

function buildLayerTwoVerdictItems({
  activeCards,
  accumulationCount,
  distributionCount,
  firedCount,
  selected,
  watchlist,
}: {
  activeCards: MarketContextCard[];
  accumulationCount: number;
  distributionCount: number;
  firedCount: number;
  selected: SectorSnapshot;
  watchlist: TriggerWatchlistItem[];
}): LayerVerdictItem[] {
  const supportive = activeCards.filter((card) => card.state === "supportive").length;
  const pressure = activeCards.filter((card) => card.state === "pressure").length;
  const participation = selected.modules.participation;

  return [
    {
      detail: `${selected.sector_name} ETF 거래량이 가격 흐름을 확인해주는지 봅니다.`,
      label: "선택 ETF",
      tone: participationTone(participation.state),
      value: judgementLabel(participation.state),
    },
    {
      detail: `섹터 전체에서 accumulation ${accumulationCount}개, distribution ${distributionCount}개가 확인됩니다.`,
      label: "참여도",
      tone: accumulationCount >= distributionCount ? "good" : "risk",
      value: `${accumulationCount}/${Math.max(1, accumulationCount + distributionCount)} accumulation`,
    },
    {
      detail: `공식 원천 기반 컨텍스트가 시장 흐름을 보조하거나 압박하는지 봅니다.`,
      label: "마켓 컨텍스트",
      tone: pressure > supportive ? "risk" : supportive > pressure ? "good" : "neutral",
      value: `완화 ${supportive} · 압박 ${pressure}`,
    },
    {
      detail:
        firedCount > 0
          ? "켜진 경고등은 다음 수집에서도 유지되는지 확인합니다."
          : "현재 발동된 리스크 경고등은 제한적입니다.",
      label: "리스크",
      tone: firedCount > 0 ? "risk" : watchlist.length ? "good" : "pending",
      value: `${firedCount}/${watchlist.length} fired`,
    },
  ];
}

function contextPrimaryValue(card: MarketContextCard) {
  const evidence = contextEvidenceItems(card);
  if (evidence.length) return evidence.join(" · ");
  if (card.state === "supportive") return "여력 우호";
  if (card.state === "pressure") return "압박 신호";
  if (card.state === "neutral") return "중립";
  return "수집 대기";
}

function toneFromLayerOneState(state?: LayerOneFlowSnapshot["state"]): InsightTone {
  if (state === "constructive") return "good";
  if (state === "caution") return "risk";
  if (state === "mixed") return "neutral";
  return "pending";
}

function breadthTone(healthyBreadthCount: number, weakBreadthCount: number): InsightTone {
  if (healthyBreadthCount > weakBreadthCount) return "good";
  if (weakBreadthCount > healthyBreadthCount) return "risk";
  return "neutral";
}

function reconciliationTone(state?: ContextReconciliation["state"]): InsightTone {
  if (state === "supportive" || state === "rotation_watch") return "good";
  if (state === "divergent" || state === "risk_rising") return "risk";
  return "pending";
}

function participationTone(state: string): InsightTone {
  if (state === "accumulation" || state === "confirmed") return "good";
  if (state === "distribution" || state === "diverging") return "risk";
  if (state === "unknown" || state === "pending") return "pending";
  return "neutral";
}

function contextTone(card: MarketContextCard): InsightTone {
  if (card.state === "supportive") return "good";
  if (card.state === "pressure") return "risk";
  if (card.state === "pending" || card.state === "unknown") return "pending";
  return "neutral";
}

function contextStateMeter(card: MarketContextCard) {
  if (card.state === "supportive") return 78;
  if (card.state === "pressure") return 26;
  if (card.state === "neutral") return 52;
  if (card.state === "pending" || card.state === "unknown") return 36;
  return 45;
}

function decimalRangeMeter(value: number | null | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampPercent(((value - min) / Math.max(0.0001, max - min)) * 100);
}

function wholeRangeMeter(value: number | null | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampPercent(((value - min) / Math.max(0.0001, max - min)) * 100);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
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
      source_class: live?.source_class ?? (input.availability === "hold" ? "held" : "official"),
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
  if (input.source_class === "official") return "공식";
  if (input.source_class === "manual") return "수동";
  if (input.source_class === "proxy") return "보조";
  return "보류";
}

function latestMarketContextDate(cards: MarketContextCard[]) {
  const dates = cards
    .map((card) => card.data_freshness.latest_date ?? card.data_freshness.date)
    .filter((date): date is string => typeof date === "string" && date.length > 0)
    .sort();
  return dates.at(-1) ?? "대기";
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

function watchlistWarningLabel(warning: string) {
  if (warning.includes("narrow_breadth")) return "리더 섹터 내부 확산이 약해졌는지 확인합니다.";
  if (warning.includes("narrow_leadership") || warning.includes("concentration")) return "리더십이 소수 섹터에 몰린 보조 추정입니다.";
  if (warning.includes("supplemental") || warning.includes("proxy")) return "보조 지표이므로 공식 원천처럼 해석하지 않습니다.";
  if (warning.includes("example_probe")) return "예시 수집 확인용 데이터입니다.";
  if (warning.includes("sample_fallback") || warning.includes("sample fallback")) return "샘플 데이터 기준이므로 실제 수집 후 다시 확인합니다.";
  if (warning.includes("watchlist_unavailable")) return "리스크 트리거 계산을 기다리는 중입니다.";
  return warning.replaceAll("_", " ");
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

function marketContextExplanation(code: string) {
  const dictionary: Record<string, string> = {
    S01: "연준 유동성, 정책금리, 실질금리가 시장 연료를 늘리거나 줄이는지 봅니다.",
    S02: "달러 강세와 원화 약세가 위험자산에 역풍으로 작동하는지 확인합니다.",
    S03: "VIX와 신용 스프레드가 커져 시장 불안이 섹터 리더십으로 번지는지 봅니다.",
    S05: "은행 지급준비금으로 현금성 여력을 확인합니다. 공식 MMF 총자산은 아닙니다.",
  };
  return dictionary[code] ?? "시장 외부 환경이 섹터 리더십을 밀어주는지, 방해하는지 확인합니다.";
}

function contextResultExplanation(card: MarketContextCard) {
  const stateText =
    card.state === "supportive"
      ? "현재 결과는 시장에 보탬이 되는 쪽입니다."
      : card.state === "pressure"
        ? "현재 결과는 시장에 부담이 되는 쪽입니다."
        : card.state === "neutral"
          ? "현재 결과는 뚜렷한 보탬도 부담도 아닌 중립입니다."
          : "현재 결과는 자동 해석을 보류합니다.";
  const sourceText = card.source_class === "proxy" ? " 다만 보조 지표이므로 방향 참고용으로 봅니다." : "";
  return `${stateText}${sourceText}`;
}

function triggerStatusExplanation(status: TriggerWatchlistItem["status"]) {
  if (status === "fired") return "해당 위험 조건이 켜졌으니 원인 확인이 필요합니다.";
  if (status === "unknown") return "판정할 데이터가 부족합니다.";
  if (status === "manual_check") return "자동 판정 대신 수동 확인이 필요한 항목입니다.";
  return "현재 경고등은 꺼져 있습니다.";
}

function triggerItemExplanation(id: string) {
  const dictionary: Record<string, string> = {
    concentration_proxy: "리더십이 특정 섹터에만 몰리는지 보는 집중도 경고입니다.",
    credit_volatility: "신용과 변동성이 확대되면 강한 섹터도 흔들릴 수 있습니다.",
    fx_dollar_gate: "달러 강세나 원화 약세는 위험자산에 부담으로 번질 수 있습니다.",
    leader_breadth_narrowing: "리더 섹터가 오르더라도 내부 종목 확산이 좁으면 품질을 다시 봅니다.",
    walcl_liquidity: "중앙은행 유동성이나 금리 압박이 시장 연료를 줄이는지 봅니다.",
  };
  return dictionary[id] ?? "이 항목은 현재 화면의 리스크 확인 순서를 알려주는 보조 경고입니다.";
}

function triggerCurrentExplanation(item: TriggerWatchlistItem) {
  if (item.status === "fired") return "현재 결과: 이 항목은 켜져 있으므로 다음 갱신에서도 반복되는지 봅니다.";
  if (item.status === "quiet") return "현재 결과: 경고등은 꺼져 있어 이 항목의 압박은 제한적입니다.";
  if (item.status === "manual_check") return "현재 결과: 자동 결론 대신 원천 데이터나 수동 확인이 필요합니다.";
  return "현재 결과: 데이터가 부족해 결론을 보류합니다.";
}

function stateClass(state: string) {
  if (state === "supportive") return "supportive";
  if (state === "pressure") return "pressure";
  if (state === "held" || state === "unknown") return "unknown";
  return "neutral";
}
