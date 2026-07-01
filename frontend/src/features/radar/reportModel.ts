import type {
  DashboardDataQuality,
  HistoryResponse,
  LayerDataQualitySummary,
  MarketContextCard,
  SectorsResponse,
  SectorSnapshot,
  TriggerWatchlistItem,
  ValidationResponse,
} from "../../types";
import { hasHealthyBreadth, isWarningSector, isWeakBreadth, numberMetric, sortSectors, sortSectorsByMomentum } from "./model";

export type ReportTone = "constructive" | "neutral" | "caution" | "blocked";
export type ResearchLayerId = "layer1" | "layer2" | "layer3" | "layer4";

export interface ReportReadiness {
  blockers: string[];
  completeness: number | null;
  detail: string;
  label: string;
  status: LayerDataQualitySummary["status"] | "unknown";
}

export interface ReportStackItem {
  detail: string;
  impact: "supportive" | "neutral" | "pressure" | "pending";
  label: string;
  value: string;
}

export interface ReportBucket {
  detail: string;
  label: string;
  sectors: string[];
}

export interface LayerDecisionSummary {
  buckets?: ReportBucket[];
  caveats: string[];
  evidence: string[];
  headline: string;
  layer: ResearchLayerId;
  readiness: ReportReadiness;
  reportUse: string;
  stack?: ReportStackItem[];
  title: string;
  tone: ReportTone;
}

export interface ValidationReportGuardrail {
  allowedCopy: string;
  appliesTo: string[];
  observedProbabilityLabel: string | null;
  pattern: string;
  reliabilityLabel: string;
  requiredCaveat: string;
  status: "ready" | "thin_sample" | "collecting" | "missing";
}

export interface LayerDataContextViewModel {
  activeLayer: ResearchLayerId;
  dataQuality: ReportReadiness;
  reportSummary: LayerDecisionSummary;
  sourceScopeLabel: string;
}

export interface ResearchBriefViewModel {
  asOf: string | null;
  data_quality_appendix: ReportReadiness[];
  executive_summary: string;
  generatedAt: string | null;
  layer1_market_context: LayerDecisionSummary;
  layer2_macro_context: LayerDecisionSummary;
  layer3_rotation_thesis: LayerDecisionSummary;
  layer4_validation_caveats: LayerDecisionSummary;
  markdown: string;
  validation_guardrails: ValidationReportGuardrail[];
}

interface BuildResearchBriefInput {
  data: SectorsResponse;
  history: HistoryResponse | null;
  quality: DashboardDataQuality | null;
  validation: ValidationResponse | null;
}

export function buildResearchBrief({
  data,
  history,
  quality,
  validation,
}: BuildResearchBriefInput): ResearchBriefViewModel {
  const rankedSectors = sortSectors(data.sectors);
  const momentumSectors = sortSectorsByMomentum(data.sectors);
  const warningSectors = data.sectors.filter(isWarningSector);
  const layer1 = buildLayerOneReport(data, quality?.layers.layer1 ?? data.data_quality?.layers.layer1, rankedSectors, warningSectors);
  const layer2 = buildLayerTwoReport(data, quality?.layers.layer2 ?? data.data_quality?.layers.layer2, rankedSectors);
  const layer3 = buildLayerThreeReport(data, quality?.layers.layer3 ?? data.data_quality?.layers.layer3, rankedSectors, momentumSectors, warningSectors);
  const guardrails = buildValidationGuardrails({
    currentLeader: rankedSectors[0],
    momentumLeader: momentumSectors[0],
    validation,
    warnings: warningSectors,
  });
  const layer4 = buildLayerFourReport(validation, history, quality?.layers.layer4, guardrails);
  const appendices = [
    layer1.readiness,
    layer2.readiness,
    layer3.readiness,
    layer4.readiness,
  ];
  const executiveSummary = [
    layer1.headline,
    layer2.headline,
    layer3.headline,
    layer4.headline,
  ].join(" ");

  const brief: Omit<ResearchBriefViewModel, "markdown"> = {
    asOf: data.as_of,
    data_quality_appendix: appendices,
    executive_summary: executiveSummary,
    generatedAt: quality?.generated_at ?? data.data_quality?.generated_at ?? null,
    layer1_market_context: layer1,
    layer2_macro_context: layer2,
    layer3_rotation_thesis: layer3,
    layer4_validation_caveats: layer4,
    validation_guardrails: guardrails,
  };

  return {
    ...brief,
    markdown: buildBriefMarkdown(brief),
  };
}

function buildLayerOneReport(
  data: SectorsResponse,
  quality: LayerDataQualitySummary | undefined,
  rankedSectors: SectorSnapshot[],
  warningSectors: SectorSnapshot[],
): LayerDecisionSummary {
  const flow = data.layer1_flow;
  const leader = rankedSectors[0];
  const healthy = data.sectors.filter(hasHealthyBreadth).length;
  const weak = data.sectors.filter(isWeakBreadth).length;
  const total = Math.max(1, data.sectors.length);
  const state = flow ? layerOneStateLabel(flow.state) : "데이터 대기";
  const tone = layerOneTone(flow?.state, warningSectors.length, data.sectors.length);
  const reconciliation = data.context_reconciliation;
  const caveats = compactList([
    ...qualityIssueCopy(quality),
    ...warningCopy(flow?.warnings ?? []),
    ...(data.source === "sample" ? ["샘플 또는 QA 데이터는 실제 수집 후 다시 확인합니다."] : []),
  ]);

  return {
    caveats,
    evidence: compactList([
      flow ? `SPY 1M ${formatPercent(flow.tape.ret_1m)} · 1D ${formatPercent(flow.tape.ret_1d)}` : "시장 tape 수집 대기",
      `Breadth ${healthy}/${total} healthy · ${weak}/${total} weak`,
      flow ? `변동성 ${flow.risk.state} · VIX ${formatMaybeNumber(flow.risk.vix_latest)}` : "변동성 입력 대기",
      reconciliation ? `외부 정합성 ${contextStateLabel(reconciliation.state)} · ${reconciliation.transition}` : "Layer 2 정합성 대기",
    ]),
    headline: `시장 흐름은 ${state}이며 현재 RS 리더는 ${leader?.sector_code ?? "N/A"}입니다.`,
    layer: "layer1",
    readiness: readinessFromQuality("Layer 1 판단 근거", quality),
    reportUse: "데일리 브리프의 시장 상태, 리스크 온/오프, 섹터 신호 신뢰도 문단에 사용합니다.",
    title: "Layer 1 흐름",
    tone,
  };
}

function buildLayerTwoReport(
  data: SectorsResponse,
  quality: LayerDataQualitySummary | undefined,
  rankedSectors: SectorSnapshot[],
): LayerDecisionSummary {
  const selected = rankedSectors[0];
  const contexts = (data.market_context ?? []).filter((card) => card.source_class !== "held" && card.source_class !== "manual");
  const watchlist = data.watchlist ?? [];
  const supportive = contexts.filter((card) => card.state === "supportive").length;
  const pressure = contexts.filter((card) => card.state === "pressure").length;
  const neutral = contexts.length - supportive - pressure;
  const fired = watchlist.filter((item) => item.status === "fired");
  const accumulation = data.sectors.filter((sector) => sector.modules.participation.state === "accumulation").length;
  const distribution = data.sectors.filter((sector) => sector.modules.participation.state === "distribution").length;
  const tone = pressure > supportive || fired.length > 0 ? "caution" : supportive > pressure ? "constructive" : "neutral";
  const stack = contexts.map(contextStackItem);

  return {
    caveats: compactList([
      ...qualityIssueCopy(quality),
      ...fired.map((item) => `${item.label}: ${triggerStatusLabel(item)} 상태가 다음 갱신에서도 이어지는지 확인합니다.`),
    ]),
    evidence: compactList([
      `컨텍스트 완화 ${supportive} · 압박 ${pressure} · 중립/대기 ${Math.max(0, neutral)}`,
      `섹터 participation accumulation ${accumulation} · distribution ${distribution}`,
      selected ? `${selected.sector_code} participation ${selected.modules.participation.state} · ${selected.modules.participation.transition}` : "선택 섹터 대기",
      `리스크 트리거 ${fired.length}/${watchlist.length}`,
    ]),
    headline: `마켓 컨텍스트는 완화 ${supportive}개, 압박 ${pressure}개이며 리스크 트리거는 ${fired.length}/${watchlist.length}개입니다.`,
    layer: "layer2",
    readiness: readinessFromQuality("Layer 2 공식 컨텍스트", quality),
    reportUse: "시장 여건이 섹터 리더십을 지지하는지 또는 압박하는지 설명하는 문단에 사용합니다.",
    stack,
    title: "Layer 2 여력",
    tone,
  };
}

function buildLayerThreeReport(
  data: SectorsResponse,
  quality: LayerDataQualitySummary | undefined,
  rankedSectors: SectorSnapshot[],
  momentumSectors: SectorSnapshot[],
  warningSectors: SectorSnapshot[],
): LayerDecisionSummary {
  const currentLeader = rankedSectors[0];
  const momentumLeader = momentumSectors[0];
  const sameLeader = currentLeader && momentumLeader && currentLeader.sector_code === momentumLeader.sector_code;
  const reconciliation = data.leadership_reconciliation;
  const transitionWatch = reconciliation?.status === "transition_watch" || !sameLeader;
  const tone: ReportTone = transitionWatch ? "caution" : "constructive";
  const momentumCandidates = momentumSectors
    .filter((sector) => numberMetric(sector.modules.relative_strength.evidence.rs_momentum, 100) >= 100)
    .slice(0, 4);
  const lateOrFalse = warningSectors.slice(0, 4);
  const dataGaps = data.sectors
    .filter((sector) => Object.values(sector.modules).some((module) => module?.state === "unknown"))
    .slice(0, 4);

  return {
    buckets: [
      {
        detail: "현재 상대강도와 rulebook strength 기준 상단 섹터입니다.",
        label: "현재 리더",
        sectors: rankedSectors.slice(0, 3).map(sectorCodeWithPattern),
      },
      {
        detail: "RS Momentum 기준으로 회전 후보를 관찰합니다.",
        label: "모멘텀 후보",
        sectors: momentumCandidates.map(sectorCodeWithPattern),
      },
      {
        detail: "Late Leader, False Leadership, Breakdown 등 주의 패턴입니다.",
        label: "주의 리더",
        sectors: lateOrFalse.map(sectorCodeWithPattern),
      },
      {
        detail: "필수 모듈 state가 unknown인 섹터입니다.",
        label: "데이터 부족",
        sectors: dataGaps.map(sectorCodeWithPattern),
      },
    ],
    caveats: compactList([
      ...qualityIssueCopy(quality),
      ...(transitionWatch ? ["현재 RS 리더와 모멘텀 선두를 같은 신호로 합치지 않습니다."] : []),
      ...(reconciliation?.warnings ?? []).map((warning) => warning.replaceAll("_", " ")),
    ]),
    evidence: compactList([
      `현재 RS 리더 ${currentLeader?.sector_code ?? "N/A"} · ${currentLeader?.rulebook.lead_pattern ?? "pattern 대기"}`,
      `모멘텀 선두 ${momentumLeader?.sector_code ?? "N/A"} · ${momentumLeader?.rulebook.lead_pattern ?? "pattern 대기"}`,
      reconciliation?.narrative ?? (sameLeader ? "현재 리더와 모멘텀 선두가 일치합니다." : "리더십 전환 관찰 구간입니다."),
      `주의 패턴 ${warningSectors.length}개`,
    ]),
    headline: sameLeader
      ? `리더십은 ${currentLeader?.sector_code ?? "N/A"}로 일치합니다.`
      : `리더십은 ${currentLeader?.sector_code ?? "N/A"}와 ${momentumLeader?.sector_code ?? "N/A"}로 분리된 신호입니다.`,
    layer: "layer3",
    readiness: readinessFromQuality("Layer 3 리더십 패널", quality),
    reportUse: "섹터 로테이션 thesis, 현재 리더와 후발 후보, 약화 조건 문단에 사용합니다.",
    title: "Layer 3 리더십",
    tone,
  };
}

function buildLayerFourReport(
  validation: ValidationResponse | null,
  history: HistoryResponse | null,
  quality: LayerDataQualitySummary | undefined,
  guardrails: ValidationReportGuardrail[],
): LayerDecisionSummary {
  const diagnostics = validation?.pattern_diagnostics ?? [];
  const ready = diagnostics.filter((diagnostic) => diagnostic.status === "ready").length;
  const thin = diagnostics.filter((diagnostic) => diagnostic.status === "thin_sample").length;
  const historyDays = validation?.coverage.sector_history_days ?? history?.coverage?.complete_sector_days ?? history?.coverage?.available_sector_days ?? 0;
  const tone: ReportTone = validation?.status === "historical_ready" && ready > 0 ? "constructive" : historyDays >= 60 ? "neutral" : "caution";
  const limitations = validation?.limitations ?? [];

  return {
    caveats: compactList([
      ...qualityIssueCopy(quality),
      ...limitations,
      ...guardrails.map((guardrail) => `${guardrail.pattern}: ${guardrail.requiredCaveat}`),
    ]),
    evidence: compactList([
      `이력 ${historyDays}일 · snapshot ${validation?.coverage.sector_snapshots ?? 0}개`,
      `패턴 진단 ready ${ready}/${diagnostics.length} · thin ${thin}`,
      `forward label 20D ${validation?.coverage.evaluated_forward_labels_20d ?? 0} · 60D ${validation?.coverage.evaluated_forward_labels_60d ?? 0}`,
      validation?.expose_probability ? "Layer 4에서만 표본 관측 확률과 신뢰도를 병기합니다." : "관측치 표시는 forward label 확인 후 유지합니다.",
    ]),
    headline:
      validation?.status === "historical_ready"
        ? `Layer 4는 ${ready}/${diagnostics.length}개 패턴 이력 진단을 리포트 caveat로 사용할 수 있습니다.`
        : "Layer 4는 검증 caveat를 먼저 표시하고 이력 진단 완료 전까지 판단을 제한합니다.",
    layer: "layer4",
    readiness: readinessFromQuality("Layer 4 검증 입력", quality),
    reportUse: "현재 rulebook 판단을 얼마나 강하게 서술할 수 있는지 정하는 검증 주석과 제한 문구에 사용합니다.",
    stack: guardrails.map((guardrail) => ({
      detail: guardrail.requiredCaveat,
      impact: guardrail.status === "ready" ? "supportive" : guardrail.status === "thin_sample" ? "pressure" : "pending",
      label: guardrail.pattern,
      value: guardrail.allowedCopy,
    })),
    title: "Layer 4 검증",
    tone,
  };
}

function buildValidationGuardrails({
  currentLeader,
  momentumLeader,
  validation,
  warnings,
}: {
  currentLeader?: SectorSnapshot;
  momentumLeader?: SectorSnapshot;
  validation: ValidationResponse | null;
  warnings: SectorSnapshot[];
}): ValidationReportGuardrail[] {
  const patternMap = new Map<string, { appliesTo: Set<string>; pattern: string }>();
  for (const sector of [currentLeader, momentumLeader, ...warnings.slice(0, 3)]) {
    if (!sector?.rulebook.lead_pattern) continue;
    const key = sector.rulebook.lead_pattern;
    const existing = patternMap.get(key) ?? { appliesTo: new Set<string>(), pattern: key };
    existing.appliesTo.add(sector.sector_code);
    patternMap.set(key, existing);
  }

  const diagnostics = new Map((validation?.pattern_diagnostics ?? []).map((diagnostic) => [diagnostic.pattern, diagnostic]));

  return [...patternMap.values()].map(({ appliesTo, pattern }) => {
    const diagnostic = diagnostics.get(pattern);
    if (!diagnostic) {
      return {
        allowedCopy: "검증 전 caveat만 사용",
        appliesTo: [...appliesTo],
        observedProbabilityLabel: null,
        pattern,
        reliabilityLabel: "대기",
        requiredCaveat: "해당 패턴의 이력 진단이 없어 현재 rulebook 해석으로만 표시합니다.",
        status: "missing",
      };
    }

    const canExpose = validation?.expose_probability && diagnostic.status === "ready";
    return {
      allowedCopy: canExpose ? "표본 관측치와 신뢰도 병기 가능" : diagnostic.status === "ready" ? "이력 진단 완료, 관측치 표시는 대기" : "표본 부족 caveat 필수",
      appliesTo: [...appliesTo],
      observedProbabilityLabel: canExpose ? formatObservedProbability(diagnostic.observed_probability_20d) : null,
      pattern,
      reliabilityLabel: reliabilityLabel(diagnostic.reliability_label),
      requiredCaveat:
        diagnostic.status === "ready"
          ? "표본 관측 확률은 보정 완료 확률이 아니라 누적 표본 진단치입니다."
          : "표본이 얇아 숫자보다 데이터 축적 상태를 먼저 표시합니다.",
      status: diagnostic.status,
    };
  });
}

function contextStackItem(card: MarketContextCard): ReportStackItem {
  const impact = contextImpact(card.state);
  return {
    detail: `${card.meaning} · ${card.source_class === "official" ? "공식 원천" : "보조 원천"}`,
    impact,
    label: card.title,
    value: `${contextStateLabel(card.state)} · ${transitionLabel(card.transition)}`,
  };
}

function readinessFromQuality(label: string, quality?: LayerDataQualitySummary): ReportReadiness {
  if (!quality) {
    return {
      blockers: ["품질 메타데이터 대기"],
      completeness: null,
      detail: "레이어별 데이터 품질 메타데이터가 아직 연결되지 않았습니다.",
      label,
      status: "unknown",
    };
  }
  const blockers = quality.issues
    .filter((issue) => issue.severity === "blocking")
    .map((issue) => issue.message);
  const completeness = quality.completeness === null ? "N/A" : `${Math.round(quality.completeness * 100)}%`;
  return {
    blockers,
    completeness: quality.completeness,
    detail: `${dataQualityStatusLabel(quality.status)} · 완성도 ${completeness}${quality.as_of ? ` · 기준일 ${quality.as_of}` : ""}`,
    label,
    status: quality.status,
  };
}

function buildBriefMarkdown(brief: Omit<ResearchBriefViewModel, "markdown">) {
  const sections = [
    brief.layer1_market_context,
    brief.layer2_macro_context,
    brief.layer3_rotation_thesis,
    brief.layer4_validation_caveats,
  ];
  const lines = [
    "# Sector Radar Research Brief",
    "",
    `- 기준일: ${brief.asOf ?? "N/A"}`,
    `- 생성: ${brief.generatedAt ?? "N/A"}`,
    "- 성격: 섹터 리서치 보조 자료",
    "",
    "## Executive Summary",
    brief.executive_summary,
    "",
    ...sections.flatMap(sectionMarkdown),
    "## Data Quality Appendix",
    ...brief.data_quality_appendix.map((item) => `- ${item.label}: ${item.detail}`),
  ];
  return lines.join("\n");
}

function sectionMarkdown(section: LayerDecisionSummary) {
  return [
    `## ${section.title}`,
    section.headline,
    "",
    "### Evidence",
    ...section.evidence.map((item) => `- ${item}`),
    "",
    "### Caveats",
    ...(section.caveats.length ? section.caveats.map((item) => `- ${item}`) : ["- 현재 추가 제한 문구는 없습니다."]),
    "",
  ];
}

function layerOneTone(state: string | undefined, warningCount: number, sectorCount: number): ReportTone {
  if (state === "constructive") return warningCount > sectorCount / 3 ? "neutral" : "constructive";
  if (state === "caution") return "caution";
  if (state === "data_insufficient") return "blocked";
  return "neutral";
}

function contextImpact(state: string): ReportStackItem["impact"] {
  if (state === "supportive") return "supportive";
  if (state === "pressure") return "pressure";
  if (state === "pending" || state === "unknown" || state === "held") return "pending";
  return "neutral";
}

function qualityIssueCopy(quality?: LayerDataQualitySummary) {
  return (quality?.issues ?? [])
    .filter((issue) => issue.severity !== "info")
    .slice(0, 3)
    .map((issue) => issue.message);
}

function warningCopy(warnings: string[]) {
  return warnings
    .filter((warning) => warning.includes("sample") || warning.includes("proxy") || warning.includes("supplemental"))
    .map((warning) => warning.replaceAll("_", " "));
}

function compactList(items: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function sectorCodeWithPattern(sector: SectorSnapshot) {
  return `${sector.sector_code} (${sector.rulebook.lead_pattern})`;
}

function dataQualityStatusLabel(status: LayerDataQualitySummary["status"]) {
  if (status === "complete") return "정상";
  if (status === "partial") return "부분";
  if (status === "stale") return "기준일 확인";
  return "차단";
}

function layerOneStateLabel(state: string) {
  if (state === "constructive") return "구성적 흐름";
  if (state === "caution") return "주의 흐름";
  if (state === "mixed") return "혼조 흐름";
  return "데이터 부족";
}

function contextStateLabel(state: string) {
  if (state === "supportive") return "완화";
  if (state === "pressure") return "압박";
  if (state === "neutral") return "중립";
  if (state === "divergent") return "불일치";
  if (state === "risk_rising") return "리스크 상승";
  if (state === "rotation_watch") return "회전 감시";
  if (state === "data_insufficient") return "데이터 부족";
  if (state === "pending" || state === "unknown") return "대기";
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

function triggerStatusLabel(item: TriggerWatchlistItem) {
  if (item.status === "fired") return "켜짐";
  if (item.status === "manual_check") return "수동 확인";
  if (item.status === "unknown") return "대기";
  return "꺼짐";
}

function reliabilityLabel(label: string | undefined) {
  if (label === "high") return "높음";
  if (label === "medium") return "중간";
  if (label === "low") return "낮음";
  return "대기";
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatMaybeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toFixed(1);
}

function formatObservedProbability(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}% 표본 관측`;
}
