export type SourceClass = "official" | "proxy" | "manual" | "held";
export type SourceProvider = "yahoo_finance" | "fred" | "krx_openapi" | "manual" | "unknown";
export type FreshnessFrequency = "intraday_gate" | "daily" | "weekly" | "manual" | "unknown";
export type FreshnessStatus = "live" | "stale" | "unavailable" | "manual_check";
export type TriggerStatus = "quiet" | "fired" | "unknown" | "manual_check";
export type ReconciliationState =
  | "supportive"
  | "divergent"
  | "risk_rising"
  | "rotation_watch"
  | "data_insufficient";
export type ReconciliationTransition = "strengthening" | "weakening" | "stable" | "unknown";

export interface DataConnectionLike {
  provider: string;
  mode: string;
  status: string;
  refresh_interval_minutes: number;
  last_success_at?: string;
  latest_price_date?: string;
  message?: string;
}

export type DataConnectionsLike = Record<string, DataConnectionLike>;

export interface MarketContextLike {
  code: string;
  title: string;
  availability: string;
  source_class: SourceClass;
  state: string;
  transition: string;
  source: string;
  meaning: string;
  evidence: Record<string, number | string | null>;
  warnings: string[];
  data_freshness: Record<string, number | string | null>;
}

export interface SectorLike {
  sector_code: string;
  sector_name: string;
  quadrant: string;
  modules: {
    breadth: {
      state: string;
      transition: string;
      warnings: string[];
    };
    participation: {
      state: string;
      transition: string;
      warnings: string[];
    };
    relative_strength: {
      evidence: Record<string, number | string | null>;
    };
  };
  rulebook: {
    lead_pattern: string;
    strength: number;
    warnings?: string[];
  };
}

export interface ConcentrationLike {
  method: string;
  source_class: string;
  hhi: number | null;
  effective_sector_count: number | null;
  top1: string | null;
  top1_contribution: number | null;
  top3_contribution: number | null;
  warnings: string[];
}

export interface SourceFreshnessItem {
  id: string;
  label: string;
  provider: SourceProvider;
  series_id?: string;
  source_class: SourceClass;
  frequency: FreshnessFrequency;
  latest_date?: string;
  stale: boolean;
  status: FreshnessStatus;
  warning?: string;
}

export interface TriggerWatchlistItem {
  id: string;
  label: string;
  trigger: string;
  meaning: string;
  status: TriggerStatus;
  source_class: SourceClass;
  evidence: Record<string, string | number | null>;
  warnings: string[];
}

export interface ContextReconciliation {
  state: ReconciliationState;
  transition: ReconciliationTransition;
  narrative: string;
  evidence: Record<string, string | number | null>;
  warnings: string[];
}

export interface RadarDerivedInput {
  asOf: string | null;
  concentration: ConcentrationLike;
  dataConnection: DataConnectionLike;
  dataConnections: DataConnectionsLike;
  marketContext: MarketContextLike[];
  now?: Date;
  sectors: SectorLike[];
}

export function buildRadarDerived(input: RadarDerivedInput) {
  const source_freshness = buildSourceFreshness(input);
  const watchlist = buildTriggerWatchlist(input);
  const context_reconciliation = buildContextReconciliation(input, watchlist);

  return {
    source_freshness,
    watchlist,
    context_reconciliation,
  };
}

export function buildSourceFreshness({
  asOf,
  dataConnection,
  dataConnections,
  marketContext,
  now = new Date(),
}: RadarDerivedInput): SourceFreshnessItem[] {
  const connections: DataConnectionsLike = {
    yahoo_finance: dataConnection,
    ...dataConnections,
  };

  const providerRows: SourceFreshnessItem[] = [
    providerFreshness("provider:yahoo_finance", "Yahoo sector prices", "yahoo_finance", connections.yahoo_finance, "proxy", "intraday_gate", now),
    providerFreshness("provider:fred", "FRED macro series", "fred", connections.fred, "official", "daily", now),
    providerFreshness("provider:krx_openapi", "KRX reference flow", "krx_openapi", connections.krx_openapi, "official", "daily", now),
  ];

  const contextRows = marketContext.map((card) => {
    const provider = providerForContext(card);
    const frequency = frequencyForContext(card, provider);
    const manual = card.source_class === "manual" || card.source_class === "held";
    const latest = manual
      ? freshnessDate(card.data_freshness)
      : freshnessDate(card.data_freshness) ?? stringValue(card.evidence.latest_date);
    const status = manual
      ? "manual_check"
      : statusFromFreshness({
          connection: connections[provider],
          frequency,
          latestDate: latest,
          now,
          sourceClass: card.source_class,
        });

    return {
      id: `context:${card.code}`,
      label: `${card.code} ${card.title}`,
      provider,
      series_id: seriesIdForContext(card),
      source_class: card.source_class,
      frequency,
      latest_date: latest,
      stale: status !== "live",
      status,
      warning: card.warnings[0] ?? warningForStatus(status, card.source_class),
    } satisfies SourceFreshnessItem;
  });

  const asOfRow: SourceFreshnessItem = {
    id: "snapshot:sector_metrics",
    label: "Sector snapshots",
    provider: "yahoo_finance",
    source_class: "proxy",
    frequency: "daily",
    latest_date: asOf ?? undefined,
    stale: !asOf || isStale(asOf, "daily", now),
    status: asOf && !isStale(asOf, "daily", now) ? "live" : asOf ? "stale" : "unavailable",
    warning: asOf ? undefined : "sector_snapshot_unavailable",
  };

  return [asOfRow, ...providerRows, ...contextRows];
}

export function buildTriggerWatchlist({
  concentration,
  marketContext,
  sectors,
}: RadarDerivedInput): TriggerWatchlistItem[] {
  const byCode = new Map(marketContext.map((card) => [card.code, card]));
  const narrowLeaders = sectors.filter(
    (sector) =>
      ["leading", "weakening"].includes(sector.quadrant) &&
      ["narrow", "breakdown"].includes(sector.modules.breadth.state),
  );

  return [
    contextTrigger({
      card: byCode.get("S01"),
      id: "walcl_liquidity",
      label: "WALCL / policy liquidity",
      trigger: "weekly contraction or policy pressure",
      meaning: "유동성 지지가 약해지는지 확인합니다.",
    }),
    contextTrigger({
      card: byCode.get("S02"),
      id: "fx_dollar_gate",
      label: "DXY / USDKRW",
      trigger: "dollar or FX pressure",
      meaning: "달러 강세와 원화 약세가 위험자산 압박으로 번지는지 봅니다.",
    }),
    contextTrigger({
      card: byCode.get("S03"),
      id: "credit_volatility",
      label: "HY OAS / VIX",
      trigger: "spread or volatility expansion",
      meaning: "신용과 변동성이 섹터 리더십을 훼손하는지 확인합니다.",
    }),
    {
      id: "leader_breadth_narrowing",
      label: "Leader breadth",
      trigger: "leaders rise while breadth narrows",
      meaning: "리더 섹터가 소수 종목에 의존하는지 확인합니다.",
      status: narrowLeaders.length ? "fired" : sectors.length ? "quiet" : "unknown",
      source_class: "proxy",
      evidence: {
        sectors: narrowLeaders.map((sector) => sector.sector_code).join(", ") || null,
        count: narrowLeaders.length,
      },
      warnings: narrowLeaders.length ? ["narrow_breadth_in_leading_sectors"] : [],
    },
    {
      id: "concentration_proxy",
      label: "Leadership concentration",
      trigger: "HHI or top3 concentration proxy rises",
      meaning: "리더십이 넓게 확산되는지, 특정 섹터에 몰리는지 확인합니다.",
      status: concentration.hhi === null ? "unknown" : concentration.warnings.includes("narrow_leadership_proxy") ? "fired" : "quiet",
      source_class: (concentration.source_class === "official" ? "official" : "proxy") as SourceClass,
      evidence: {
        hhi: concentration.hhi,
        effective_sector_count: concentration.effective_sector_count,
        top1: concentration.top1,
        top3_contribution: concentration.top3_contribution,
      },
      warnings: concentration.warnings,
    },
  ];
}

export function buildContextReconciliation(
  { concentration, marketContext, sectors }: RadarDerivedInput,
  watchlist: TriggerWatchlistItem[],
): ContextReconciliation {
  const activeContext = marketContext.filter((card) => !["held", "manual"].includes(card.source_class));
  const pressureCards = marketContext.filter((card) => isPressureContext(card));
  const supportiveCards = marketContext.filter((card) => card.state === "supportive");
  const firedRiskTriggers = watchlist.filter(
    (item) => item.status === "fired" && ["fx_dollar_gate", "credit_volatility", "leader_breadth_narrowing", "concentration_proxy"].includes(item.id),
  );
  const constructiveCount = sectors.filter((sector) => ["leading", "improving"].includes(sector.quadrant)).length;
  const laggingCount = sectors.filter((sector) => sector.quadrant === "lagging").length;
  const strongLeader = sectors.some(
    (sector) =>
      sector.quadrant === "leading" &&
      (sector.rulebook.strength >= 3 || Number(sector.modules.relative_strength.evidence.rs_ratio) >= 102),
  );
  const leadershipConstructive =
    sectors.length > 0 && (constructiveCount >= Math.ceil(sectors.length / 2) || strongLeader);
  const weakLeadership = sectors.length > 0 && laggingCount >= Math.ceil(sectors.length / 2) && !strongLeader;
  const narrowLeadership = concentration.warnings.includes("narrow_leadership_proxy");
  const riskContext = pressureCards.length > 0 || firedRiskTriggers.length > 0 || narrowLeadership;

  if (activeContext.length < 3) {
    return {
      state: "data_insufficient",
      transition: "unknown",
      narrative: "Layer 2 원자료가 충분하지 않아 섹터 리더십과 시장 맥락의 정합성을 보류합니다.",
      evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
      warnings: ["insufficient_market_context"],
    };
  }

  if (leadershipConstructive && riskContext) {
    return {
      state: "divergent",
      transition: "weakening",
      narrative: "섹터 리더십은 살아 있지만 FX·신용·집중도 중 일부가 압박을 보여 모듈 불일치가 있습니다.",
      evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
      warnings: ["leadership_context_disagreement", ...firedRiskTriggers.map((item) => item.id)],
    };
  }

  if (weakLeadership && riskContext) {
    return {
      state: "risk_rising",
      transition: "weakening",
      narrative: "섹터 주도력이 약한 상태에서 Layer 2 압박 신호가 겹쳐 리스크 상승 구간으로 해석합니다.",
      evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
      warnings: ["weak_leadership_with_pressure_context"],
    };
  }

  if (!leadershipConstructive && supportiveCards.length >= 2 && pressureCards.length === 0) {
    return {
      state: "rotation_watch",
      transition: "strengthening",
      narrative: "시장 맥락은 일부 완화적이지만 섹터 리더십은 아직 충분히 회전하지 않았습니다.",
      evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
      warnings: ["context_supportive_leadership_pending"],
    };
  }

  if (leadershipConstructive && !riskContext) {
    return {
      state: "supportive",
      transition: supportiveCards.length >= pressureCards.length ? "strengthening" : "stable",
      narrative: "섹터 리더십과 Layer 2 맥락이 크게 충돌하지 않아 현재 흐름은 리서치 관점에서 정합적입니다.",
      evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
      warnings: concentration.source_class === "proxy" ? ["concentration_is_proxy"] : [],
    };
  }

  return {
    state: "divergent",
    transition: pressureCards.length ? "weakening" : "stable",
    narrative: "명확한 리더십 확산이나 위험 압박 중 어느 쪽도 압도적이지 않아 모듈별 확인이 필요합니다.",
    evidence: baseReconciliationEvidence(constructiveCount, pressureCards, supportiveCards, concentration),
    warnings: ["mixed_module_alignment"],
  };
}

function providerFreshness(
  id: string,
  label: string,
  provider: SourceProvider,
  connection: DataConnectionLike | undefined,
  sourceClass: SourceClass,
  frequency: FreshnessFrequency,
  now: Date,
): SourceFreshnessItem {
  const latest = connection?.latest_price_date;
  const status = statusFromFreshness({
    connection,
    frequency,
    latestDate: latest,
    now,
    sourceClass,
  });

  return {
    id,
    label,
    provider,
    source_class: sourceClass,
    frequency,
    latest_date: latest,
    stale: status !== "live",
    status,
    warning: connection?.message ?? warningForStatus(status, sourceClass),
  };
}

function contextTrigger({
  card,
  id,
  label,
  meaning,
  trigger,
}: {
  card?: MarketContextLike;
  id: string;
  label: string;
  meaning: string;
  trigger: string;
}): TriggerWatchlistItem {
  if (!card) {
    return {
      id,
      label,
      trigger,
      meaning,
      status: "unknown",
      source_class: "held",
      evidence: {},
      warnings: ["context_card_unavailable"],
    };
  }

  return {
    id,
    label,
    trigger,
    meaning,
    status: qualitativeTriggerStatus(card),
    source_class: card.source_class,
    evidence: {
      state: card.state,
      transition: card.transition,
      latest_date: freshnessDate(card.data_freshness) ?? null,
    },
    warnings: card.warnings,
  };
}

function qualitativeTriggerStatus(card: MarketContextLike): TriggerStatus {
  if (card.source_class === "manual" || card.source_class === "held" || card.state === "held") return "manual_check";
  if (card.state === "unknown" || card.transition === "unknown") return "unknown";
  return isPressureContext(card) ? "fired" : "quiet";
}

function isPressureContext(card: MarketContextLike) {
  if (card.state === "pressure" || card.state === "risk" || card.state === "tightening") return true;
  return card.source_class === "official" && card.transition === "weakening" && card.state !== "supportive";
}

function baseReconciliationEvidence(
  constructiveCount: number,
  pressureCards: MarketContextLike[],
  supportiveCards: MarketContextLike[],
  concentration: ConcentrationLike,
) {
  return {
    constructive_sector_count: constructiveCount,
    pressure_contexts: pressureCards.map((card) => card.code).join(", ") || null,
    supportive_contexts: supportiveCards.map((card) => card.code).join(", ") || null,
    concentration_method: concentration.method,
    concentration_hhi: concentration.hhi,
    top1: concentration.top1,
  };
}

function statusFromFreshness({
  connection,
  frequency,
  latestDate,
  now,
  sourceClass,
}: {
  connection?: DataConnectionLike;
  frequency: FreshnessFrequency;
  latestDate?: string;
  now: Date;
  sourceClass: SourceClass;
}): FreshnessStatus {
  if (sourceClass === "manual" || sourceClass === "held" || frequency === "manual") return "manual_check";
  if (!latestDate) return connection?.status === "never_run" ? "unavailable" : "stale";
  if (connection?.status === "failed" && !connection.last_success_at) return "unavailable";
  if (isStale(latestDate, frequency, now)) return "stale";
  return connection?.mode === "live" || connection?.status === "success" ? "live" : "stale";
}

function isStale(latestDate: string, frequency: FreshnessFrequency, now: Date) {
  const threshold = freshnessThresholdDays(frequency);
  if (threshold === null) return false;
  const latest = parseDateOnly(latestDate);
  if (!latest) return true;
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((current - latest) / 86_400_000);
  return diffDays > threshold;
}

function freshnessThresholdDays(frequency: FreshnessFrequency) {
  if (frequency === "intraday_gate") return 3;
  if (frequency === "daily") return 3;
  if (frequency === "weekly") return 10;
  if (frequency === "manual") return null;
  return 7;
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function providerForContext(card: MarketContextLike): SourceProvider {
  if (card.source_class === "manual") return "manual";
  if (card.source_class === "held") return card.code === "S04" || card.code === "S06" ? "krx_openapi" : "unknown";
  if (card.source_class === "proxy") return "yahoo_finance";
  if (card.source.toLowerCase().includes("krx")) return "krx_openapi";
  if (card.source.toLowerCase().includes("fred")) return "fred";
  return "unknown";
}

function frequencyForContext(card: MarketContextLike, provider: SourceProvider): FreshnessFrequency {
  if (card.source_class === "manual" || card.source_class === "held") return "manual";
  if (provider === "yahoo_finance") return "intraday_gate";
  if (card.code === "S01" || card.code === "S05") return "weekly";
  if (provider === "fred" || provider === "krx_openapi") return "daily";
  return "unknown";
}

function seriesIdForContext(card: MarketContextLike) {
  if (card.source_class === "proxy") {
    if (card.code === "S02") return "DX-Y.NYB,KRW=X";
    if (card.code === "S03") return "^VIX,HYG,JNK,LQD,TLT";
    if (card.code === "S05") return "BIL,SGOV,SHV";
    if (card.code === "S06") return "TQQQ,SQQQ,SPXL,SPXS";
  }
  if (card.code === "S01") return "FRED:WALCL";
  if (card.code === "S02") return "FRED:DEXKOUS";
  if (card.code === "S03") return "FRED:BAMLH0A0HYM2";
  if (card.code === "S04") return "KRX:FOREIGN_NET_BUY";
  if (card.code === "S05") return "FRED:WRESBAL";
  if (card.code === "S06") return "KRX:CREDIT_BALANCE";
  return undefined;
}

function freshnessDate(value: Record<string, number | string | null>) {
  if (Object.prototype.hasOwnProperty.call(value, "latest_date")) {
    return stringValue(value.latest_date);
  }
  return stringValue(value.date);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function warningForStatus(status: FreshnessStatus, sourceClass: SourceClass) {
  if (status === "live") return undefined;
  if (status === "manual_check") return `${sourceClass}_source_requires_manual_check`;
  if (status === "unavailable") return "source_unavailable";
  return "source_stale";
}
