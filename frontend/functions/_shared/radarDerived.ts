export type SourceClass = "official" | "proxy" | "manual" | "held";
export type SourceProvider = "yahoo_finance" | "fred" | "krx_openapi" | "manual" | "unknown";
export type FreshnessFrequency = "intraday_gate" | "daily" | "weekly" | "manual" | "unknown";
export type FreshnessStatus = "live" | "stale" | "unavailable" | "manual_check";
export type TriggerStatus = "quiet" | "fired" | "unknown" | "manual_check";
export type SourceExpansionLayer = "layer1" | "layer2";
export type SourceExpansionKind = "official" | "price" | "supplemental" | "manual" | "held";
export type SourceExpansionStatus = "active" | "candidate" | "deferred";
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

export interface SourceExpansionItem {
  id: string;
  layer: SourceExpansionLayer;
  area: string;
  label: string;
  provider: SourceProvider | "cboe" | "sec_edgar" | "treasury_fiscaldata" | "finra";
  route: string;
  source_kind: SourceExpansionKind;
  status: SourceExpansionStatus;
  cadence: string;
  purpose: string;
  current_signal: string;
  next_step: string;
  latest_date?: string;
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
  const source_expansion = buildSourceExpansion(input);
  const watchlist = buildTriggerWatchlist(input);
  const context_reconciliation = buildContextReconciliation(input, watchlist);

  return {
    source_freshness,
    source_expansion,
    watchlist,
    context_reconciliation,
  };
}

export function buildSourceExpansion({
  dataConnection,
  dataConnections,
  marketContext,
}: RadarDerivedInput): SourceExpansionItem[] {
  const connections: DataConnectionsLike = {
    yahoo_finance: dataConnection,
    ...dataConnections,
  };
  const byCode = new Map(marketContext.map((card) => [card.code, card]));
  const yahooLatest = connections.yahoo_finance?.latest_price_date;
  const fredLatest = connections.fred?.latest_price_date;

  return [
    {
      id: "l1_market_tape",
      layer: "layer1",
      area: "Market tape",
      label: "SPY·섹터 ETF 가격",
      provider: "yahoo_finance",
      route: "Yahoo chart adapter",
      source_kind: "price",
      status: "active",
      cadence: "15분 gate / 장마감 기준",
      purpose: "SPY tape, 섹터 ETF RRG, participation 계산의 기본 가격 입력",
      current_signal: "현재 Layer 1과 Layer 3의 가격·RS 계산에 사용 중입니다.",
      next_step: "공개/상업 배포 전 licensed market-data provider로 교체 가능한 adapter 유지",
      latest_date: yahooLatest,
    },
    {
      id: "l1_risk_vol",
      layer: "layer1",
      area: "Risk / Vol",
      label: "VIX 공식 변동성",
      provider: "fred",
      route: "FRED VIXCLS / Cboe VIX history",
      source_kind: "official",
      status: contextStatus(byCode.get("S03"), "VIXCLS_latest") === "active" ? "active" : "candidate",
      cadence: "일간",
      purpose: "Yahoo ^VIX 보조 지표를 FRED/Cboe 공식 변동성으로 보강",
      current_signal: "Layer 1 risk/vol 해석과 Layer 2 신용환경 카드에 연결됩니다.",
      next_step: "FRED VIXCLS를 우선 사용하고, Cboe 직접 데이터는 fallback 후보로 분리",
      latest_date: byCode.get("S03")?.data_freshness.latest_date as string | undefined,
    },
    {
      id: "l1_breadth_helpers",
      layer: "layer1",
      area: "Breadth helpers",
      label: "RSP·IWM·QQQ 상대성과",
      provider: "yahoo_finance",
      route: "Yahoo chart adapter",
      source_kind: "supplemental",
      status: "active",
      cadence: "15분 gate / 장마감 기준",
      purpose: "동일가중, 소형주, 성장주 흐름으로 시장 폭을 보조 확인",
      current_signal: "Layer 1의 Breadth 보조지표와 최종 narrative에 사용 중입니다.",
      next_step: "ETF 구성종목 breadth가 충분히 쌓이면 보조 비중을 낮춤",
      latest_date: yahooLatest,
      warning: "가격 기반 보조 지표이며 구성종목 원천 breadth는 아닙니다.",
    },
    {
      id: "l1_holdings_breadth",
      layer: "layer1",
      area: "ETF holdings breadth",
      label: "ETF 구성종목 breadth",
      provider: "sec_edgar",
      route: "Issuer holdings / SEC N-PORT fallback",
      source_kind: "official",
      status: "candidate",
      cadence: "일간 issuer / 월간 SEC 지연",
      purpose: "대표 보유종목 coverage와 breadth 품질 개선",
      current_signal: "현재는 representative holdings shard와 가격 이력으로 점진 계산합니다.",
      next_step: "ETF issuer holdings 약관 확인 후 우선 adapter 추가, SEC는 지연 fallback으로 유지",
      warning: "SEC N-PORT는 지연 데이터라 당일 breadth에는 부적합합니다.",
    },
    {
      id: "l1_concentration",
      layer: "layer1",
      area: "Leadership concentration",
      label: "시가총액 기여도",
      provider: "sec_edgar",
      route: "ETF holdings weights / licensed constituent market cap",
      source_kind: "official",
      status: "candidate",
      cadence: "일간/주간",
      purpose: "현재 RS 기반 집중도 추정을 실제 market-cap contribution으로 교체",
      current_signal: "현재는 rs_leadership_estimate로 리더십 집중도를 보조 추정합니다.",
      next_step: "섹터 ETF holding weight와 종목 시가총액 원천을 분리해 수집",
    },
    {
      id: "l2_policy",
      layer: "layer2",
      area: "S01 central bank policy",
      label: "WALCL·정책금리·실질금리",
      provider: "fred",
      route: "FRED WALCL, DFF/SOFR, DGS2, DFII5",
      source_kind: "official",
      status: contextStatus(byCode.get("S01")),
      cadence: "일간/주간",
      purpose: "중앙은행 유동성 및 금리 압박 판단",
      current_signal: byCode.get("S01")?.meaning ?? "Layer 2 중앙은행 정책 카드에 연결됩니다.",
      next_step: "SOFR 보강 및 weekly 시리즈 갱신 지연 안내 고도화",
      latest_date: contextLatest(byCode.get("S01")) ?? fredLatest,
    },
    {
      id: "l2_fx",
      layer: "layer2",
      area: "S02 dollar / FX",
      label: "DEXKOUS·DTWEXBGS",
      provider: "fred",
      route: "FRED DEXKOUS, DTWEXBGS",
      source_kind: "official",
      status: contextStatus(byCode.get("S02")),
      cadence: "일간",
      purpose: "달러·원화·광의 달러 압박 확인",
      current_signal: byCode.get("S02")?.meaning ?? "Layer 2 달러·FX 게이트에 연결됩니다.",
      next_step: "intraday FX가 필요해지면 licensed FX provider를 별도 adapter로 추가",
      latest_date: contextLatest(byCode.get("S02")) ?? fredLatest,
    },
    {
      id: "l2_credit_vol",
      layer: "layer2",
      area: "S03 credit / volatility",
      label: "HY OAS·VIXCLS",
      provider: "fred",
      route: "FRED BAMLH0A0HYM2, VIXCLS",
      source_kind: "official",
      status: contextStatus(byCode.get("S03")),
      cadence: "일간",
      purpose: "신용 스프레드와 변동성 압박 확인",
      current_signal: byCode.get("S03")?.meaning ?? "Layer 2 글로벌 신용환경 카드에 연결됩니다.",
      next_step: "Cboe VIX 직접 원천 fallback 가능성 검토",
      latest_date: contextLatest(byCode.get("S03")) ?? fredLatest,
    },
    {
      id: "l2_reserves",
      layer: "layer2",
      area: "S05 cash / reserves",
      label: "은행 지급준비금",
      provider: "fred",
      route: "FRED WRESBAL",
      source_kind: "official",
      status: contextStatus(byCode.get("S05")),
      cadence: "주간",
      purpose: "현금성 여력과 유동성 완화/압박 확인",
      current_signal: byCode.get("S05")?.meaning ?? "Layer 2 예비금·현금 카드에 연결됩니다.",
      next_step: "Treasury Fiscal Data의 TGA/운영현금 항목으로 보강",
      latest_date: contextLatest(byCode.get("S05")) ?? fredLatest,
      warning: "WRESBAL은 MMF 총자산이 아니라 은행 지급준비금입니다.",
    },
    {
      id: "l2_treasury_dts",
      layer: "layer2",
      area: "Treasury liquidity",
      label: "TGA·Daily Treasury Statement",
      provider: "treasury_fiscaldata",
      route: "U.S. Treasury Fiscal Data API",
      source_kind: "official",
      status: "candidate",
      cadence: "일간",
      purpose: "재무부 현금잔고와 유동성 흡수/공급 보강",
      current_signal: "현재 S05 은행 지급준비금 해석의 다음 보강 후보입니다.",
      next_step: "Daily Treasury Statement endpoint schema를 고정하고 D1 series_daily 매핑 추가",
    },
    {
      id: "l2_margin_leverage",
      layer: "layer2",
      area: "Margin leverage",
      label: "FINRA margin statistics",
      provider: "finra",
      route: "FINRA margin statistics",
      source_kind: "official",
      status: "candidate",
      cadence: "월간",
      purpose: "시장 레버리지 과열과 반대매매 위험을 느린 지표로 확인",
      current_signal: "현재 active Layer 2에는 넣지 않고 리스크 트리거 후보로만 둡니다.",
      next_step: "월간 지표 특성상 경고등이 아니라 context note로 표시",
      warning: "월간 발표라 단기 리스크 트리거로 쓰면 안 됩니다.",
    },
    {
      id: "l2_krx_flow",
      layer: "layer2",
      area: "KRX reference",
      label: "KRX 수급·신용 참고",
      provider: "krx_openapi",
      route: "KRX OpenAPI",
      source_kind: "official",
      status: "deferred",
      cadence: "KST 일간",
      purpose: "KOSPI 확장 시 외국인 자금과 신용·공매도 참고",
      current_signal: "US Sector Radar의 핵심 입력에서는 제외했습니다.",
      next_step: "KOSPI 모드 또는 별도 Korea market rail에서만 활성화",
      warning: "미국 섹터 판단을 중립처럼 오염시키지 않기 위해 보류합니다.",
    },
  ];
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
  const hasKrxContext = marketContext.some((card) => providerForContext(card) === "krx_openapi");

  const providerRows: SourceFreshnessItem[] = [
    providerFreshness("provider:yahoo_finance", "Yahoo sector prices", "yahoo_finance", connections.yahoo_finance, "proxy", "intraday_gate", now),
    providerFreshness("provider:fred", "FRED macro series", "fred", connections.fred, "official", "daily", now),
    ...(hasKrxContext
      ? [providerFreshness("provider:krx_openapi", "KRX reference flow", "krx_openapi", connections.krx_openapi, "official", "daily", now)]
      : []),
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
      trigger: "HHI or top3 concentration rises",
      meaning: "리더십이 넓게 확산되는지, 특정 섹터에 몰리는지 확인합니다.",
      status: concentration.hhi === null ? "unknown" : concentration.warnings.includes("narrow_leadership_estimate") ? "fired" : "quiet",
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
  const narrowLeadership = concentration.warnings.includes("narrow_leadership_estimate");
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
      warnings: concentration.source_class === "proxy" ? ["concentration_is_supplemental_estimate"] : [],
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

function contextStatus(card: MarketContextLike | undefined, evidenceKey?: string): SourceExpansionStatus {
  if (!card) return "candidate";
  if (card.source_class === "held" || card.state === "held") return "deferred";
  if (card.source_class === "manual") return "candidate";
  if (evidenceKey && !Object.prototype.hasOwnProperty.call(card.evidence, evidenceKey)) return "candidate";
  return "active";
}

function contextLatest(card: MarketContextLike | undefined) {
  return card ? freshnessDate(card.data_freshness) ?? stringValue(card.evidence.latest_date) : undefined;
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
  if (card.source_class === "held") return "unknown";
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
  if (card.code === "S01") return "FRED:WALCL";
  if (card.code === "S02") return "FRED:DEXKOUS";
  if (card.code === "S03") return "FRED:BAMLH0A0HYM2";
  if (card.code === "S05") return "FRED:WRESBAL";
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
