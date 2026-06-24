import type { SectorSnapshot } from "../../../types";
import {
  codes,
  formatSigned,
  groupByQuadrant,
  type LiquidityAvailability,
  liquidityInputs,
  numberMetric,
  toSparklinePoints,
} from "../model";
import { LayerHeader, MiniMetric, ModuleMeter, PanelHeader } from "./common";

export function FlowLiquidityView({
  grouped,
  healthyBreadthCount,
  sectors,
  selected,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  return (
    <div className="flow-liquidity-view">
      <LayerOneFlow
        grouped={grouped}
        healthyBreadthCount={healthyBreadthCount}
        sectors={sectors}
        warnings={warnings}
        weakBreadthCount={weakBreadthCount}
      />
      <LayerTwoLiquidity sectors={sectors} selected={selected} />
    </div>
  );
}

function LayerOneFlow({
  grouped,
  healthyBreadthCount,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  const constructiveCount = grouped.leading.length + grouped.improving.length;
  const direction =
    constructiveCount >= Math.ceil(sectors.length / 2)
      ? "Constructive"
      : warnings.length > sectors.length / 2
        ? "Caution"
        : "Mixed";
  const topLeader = sectors[0];

  return (
    <section className="layer-section layer-one" aria-label="layer one flow">
      <LayerHeader
        description="지금 섹터 흐름이 어디로 기울고 있는지 먼저 확인합니다."
        eyebrow="Layer 1"
        meta="flow / breadth / warnings"
        title="흐름"
      />
      <div className="flow-board">
        <article className="flow-brief">
          <span className="flow-path">흐름 › 여력 › 주도 › 정합성</span>
          <h2>{direction}</h2>
          <p>
            리더 {grouped.leading.length}개, 순환 후보 {grouped.improving.length}개, 경고{" "}
            {warnings.length}개로 요약됩니다. 평균 점수 대신 모듈 간 불일치를 그대로 봅니다.
          </p>
          <div className="flow-badges" aria-label="flow notes">
            <span>{topLeader ? `${topLeader.sector_code} lead` : "no leader"}</span>
            <span>{healthyBreadthCount} healthy breadth</span>
            <span>{weakBreadthCount} weak breadth</span>
          </div>
        </article>
        <SummaryStrip
          grouped={grouped}
          healthyBreadthCount={healthyBreadthCount}
          sectors={sectors}
          warnings={warnings}
          weakBreadthCount={weakBreadthCount}
        />
        <FlowSparkline sectors={sectors} />
      </div>
    </section>
  );
}

function SummaryStrip({
  grouped,
  healthyBreadthCount,
  sectors,
  warnings,
  weakBreadthCount,
}: {
  grouped: ReturnType<typeof groupByQuadrant>;
  healthyBreadthCount: number;
  sectors: SectorSnapshot[];
  warnings: SectorSnapshot[];
  weakBreadthCount: number;
}) {
  return (
    <section className="summary-strip" aria-label="dashboard summary">
      <SummaryCell label="Leading" value={grouped.leading.length} detail={codes(grouped.leading) || "none"} />
      <SummaryCell
        label="Improving"
        value={grouped.improving.length}
        detail={codes(grouped.improving) || "none"}
      />
      <SummaryCell
        label="Breadth"
        value={`${healthyBreadthCount}/${sectors.length}`}
        detail={`${weakBreadthCount} weak or breakdown`}
      />
      <SummaryCell label="Warnings" value={warnings.length} detail={codes(warnings) || "none"} tone="risk" />
      <SummaryCell label="Coverage" value={sectors.length} detail="sector snapshots" />
    </section>
  );
}

function SummaryCell({
  detail,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  label: string;
  tone?: "default" | "risk";
  value: number | string;
}) {
  return (
    <article className={`summary-cell ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function FlowSparkline({ sectors }: { sectors: SectorSnapshot[] }) {
  const values = sectors.map((sector) => numberMetric(sector.modules.relative_strength.evidence.rs_ratio, 100));
  const points = toSparklinePoints(values, 440, 88);

  return (
    <article className="flow-trend" aria-label="relative strength distribution">
      <div>
        <span>RS Distribution</span>
        <strong>{formatSigned(values[0] - 100)} leader gap</strong>
      </div>
      <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox="0 0 440 88">
        <polyline points={points} />
      </svg>
      <small>섹터별 RS Ratio를 강도순으로 연결한 현재 단면입니다.</small>
    </article>
  );
}

function LayerTwoLiquidity({
  sectors,
  selected,
}: {
  sectors: SectorSnapshot[];
  selected: SectorSnapshot;
}) {
  const accumulationCount = sectors.filter((sector) => sector.modules.participation.state === "accumulation").length;
  const distributionCount = sectors.filter((sector) => sector.modules.participation.state === "distribution").length;
  const marketContext = marketContextCards(selected);

  return (
    <section className="layer-section layer-two" aria-label="layer two liquidity">
      <LayerHeader
        description="ETF 거래량은 live로 확인하고, 매크로 입력은 Yahoo live/proxy/hold를 분리해서 봅니다."
        eyebrow="Layer 2"
        meta="participation + yahoo proxies"
        title="여력 (유동성)"
      />
      <div className="liquidity-board">
        <article className="liquidity-live dashboard-card">
          <PanelHeader eyebrow="Live Fuel" title="ETF Participation" meta={selected.sector_code} />
          <ModuleMeter label="Selected ETF volume" module={selected.modules.participation} />
          <div className="metric-pair">
            <MiniMetric label="Accumulation" value={`${accumulationCount}`} />
            <MiniMetric label="Distribution" value={`${distributionCount}`} />
          </div>
          <p>
            이 신호는 Yahoo OHLCV로 갱신 가능한 거래량 참여도입니다. 다른 유동성 입력은 원자료와 proxy를 분리해 해석합니다.
          </p>
        </article>
        <div className="liquidity-grid">
          {marketContext.map((input) => (
            <LiquidityCard input={input} key={input.code} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface MarketContextCard {
  availability: LiquidityAvailability;
  code: string;
  evidence: Record<string, number | string | null>;
  meaning: string;
  source: string;
  state: string;
  title: string;
  transition: string;
  warnings: string[];
}

function LiquidityCard({ input }: { input: MarketContextCard }) {
  const evidence = Object.entries(input.evidence).slice(0, 2);
  return (
    <article className={`liquidity-card ${input.availability}`}>
      <div>
        <span>{input.code}</span>
        <small>{availabilityLabel(input.availability)}</small>
      </div>
      <h3>{input.title}</h3>
      <p>{input.meaning}</p>
      <dl className="liquidity-evidence">
        <div>
          <dt>state</dt>
          <dd>{input.state}</dd>
        </div>
        <div>
          <dt>transition</dt>
          <dd>{input.transition}</dd>
        </div>
        {evidence.map(([label, value]) => (
          <div key={label}>
            <dt>{label.replaceAll("_", " ")}</dt>
            <dd>{formatEvidence(value)}</dd>
          </div>
        ))}
      </dl>
      <strong>{input.warnings[0] ?? input.source}</strong>
    </article>
  );
}

function marketContextCards(selected: SectorSnapshot): MarketContextCard[] {
  const context = selected.rulebook.source_metrics.market_context;
  const byCode = new Map<string, MarketContextCard>();

  if (Array.isArray(context)) {
    for (const item of context) {
      if (!isMarketContextCard(item)) continue;
      byCode.set(item.code, item);
    }
  }

  return liquidityInputs.map((input) => {
    const live = byCode.get(input.code);
    return {
      availability: live?.availability ?? input.availability,
      code: input.code,
      evidence: live?.evidence ?? {},
      meaning: live?.meaning ?? input.meaning,
      source: live?.source ?? input.source,
      state: live?.state ?? (input.availability === "hold" ? "held" : "pending"),
      title: input.title,
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

function availabilityLabel(value: LiquidityAvailability) {
  if (value === "live") return "Yahoo live";
  if (value === "proxy") return "Yahoo proxy";
  return "hold";
}

function formatEvidence(value: number | string | null) {
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  return value ?? "N/A";
}
