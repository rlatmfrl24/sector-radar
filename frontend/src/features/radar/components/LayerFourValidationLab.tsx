import { Database, ListChecks, RotateCcw, ShieldCheck } from "lucide-react";

import type { HistoryResponse, HistoryTimeframe, SectorsResponse, ValidationResponse } from "../../../types";
import { LayerHeader, PanelHeader } from "./common";

const TIMEFRAMES: HistoryTimeframe[] = ["30D", "90D", "180D"];

interface ReplayWindow {
  availableDays: number;
  effectiveDays: number;
  limited: boolean;
  requestedDays: number;
  status: string;
  timeframe: HistoryTimeframe;
}

interface PatternReadiness {
  count: number;
  pattern: string;
  status: string;
  nextStep: string;
}

type PatternDiagnostic = NonNullable<ValidationResponse["pattern_diagnostics"]>[number];

interface ValidationProgressStep {
  detail: string;
  label: string;
  status: "complete" | "pending" | "blocked";
  title: string;
}

export function LayerFourValidationLab({
  data,
  history,
  historyTimeframe,
  onHistoryTimeframeChange,
  validation,
}: {
  data: SectorsResponse;
  history: HistoryResponse | null;
  historyTimeframe: HistoryTimeframe;
  onHistoryTimeframeChange: (timeframe: HistoryTimeframe) => void;
  validation: ValidationResponse | null;
}) {
  const coverage = validationCoverage(validation);
  const replayWindows = validationReplayWindows(validation, coverage.sector_history_days, history, historyTimeframe);
  const activeReplay = replayWindows.find((window) => window.timeframe === historyTimeframe) ?? replayWindows[1];
  const patternDiagnostics = validation?.pattern_diagnostics ?? [];
  const patterns = patternDiagnostics.length ? [] : patternReadiness(data, validation, coverage.sector_history_days);
  const gateStatus = validationStatusLabel(validation?.status);
  const probabilityGate = validation?.expose_probability ? "표본 확률 표시" : "표본 확률 대기";
  const replayCopy = validationReplayCopy(validation, coverage.sector_history_days);
  const contextCoverage = `${coverage.market_context_points} rows / ${coverage.market_context_days} days`;
  const limitations = validation?.limitations ?? [];
  const hasLimitations = limitations.length > 0;
  const completedPatternCount = patternDiagnostics.filter((diagnostic) => diagnostic.status === "ready").length;
  const overviewSteps = validationProgressSteps({
    coverage,
    patternDiagnostics,
    replayWindows,
    validation,
  });
  const validationSummary = validationSummaryCopy({
    completedPatternCount,
    patternCount: patternDiagnostics.length,
    validation,
  });

  return (
    <section className="layer-section layer-four" aria-label="layer four validation lab">
      <LayerHeader
        description={validationSummary}
        eyebrow="Layer 4"
        meta={`${coverage.sector_snapshots} sector samples`}
        title="검증 Lab"
      />

      <section className="validation-overview-card dashboard-card" aria-label="validation progress overview">
        <div className="validation-overview-copy">
          <span>현재 진행 상황</span>
          <strong>{gateStatus}</strong>
          <p>
            이력 검증, Replay 범위, 패턴 진단, 표본 관측치를 한 흐름으로 확인합니다. Replay 기간은
            Replay 상태 안에서 함께 비교합니다.
          </p>
        </div>
        <div className="validation-overview-grid">
          <OverviewStepCard
            icon="database"
            step={overviewSteps[0]}
            value={`${coverage.sector_history_days}일 / ${coverage.sector_snapshots} samples`}
          />
          <ReplayOverviewCard
            activeReplay={activeReplay}
            historyTimeframe={historyTimeframe}
            onHistoryTimeframeChange={onHistoryTimeframeChange}
            replayCopy={replayCopy}
            replayWindows={replayWindows}
            step={overviewSteps[1]}
          />
          <OverviewStepCard
            icon="shield"
            step={overviewSteps[2]}
            value={`${completedPatternCount}/${patternDiagnostics.length || 0} patterns`}
          />
          <OverviewStepCard
            icon="checks"
            step={overviewSteps[3]}
            value={validation?.expose_probability ? `${probabilityGate} · ${contextCoverage}` : "forward label 확인"}
          />
        </div>
      </section>

      <section className="validation-workspace" aria-label="validation workspace">
        <article className="pattern-readiness-card pattern-analysis-card dashboard-card">
          <PanelHeader
            eyebrow={patternDiagnostics.length ? "Pattern Diagnostics" : "Pattern Readiness"}
            meta={patternDiagnostics.length ? `${completedPatternCount}/${patternDiagnostics.length} complete` : `${patterns.length} patterns`}
            title={patternDiagnostics.length ? "패턴별 이력 진단 결과" : "현재 패턴 검증 준비도"}
          />
          {patternDiagnostics.length ? (
            <PatternDiagnosticsChart diagnostics={patternDiagnostics} />
          ) : (
            <PatternReadinessTable patterns={patterns} />
          )}
        </article>

        {hasLimitations ? (
          <article className="validation-limit-card dashboard-card">
            <PanelHeader
              eyebrow="Data Limits"
              meta={probabilityGate}
              title="데이터 제한"
            />
            <ul>
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>
    </section>
  );
}

function OverviewStepCard({
  icon,
  step,
  value,
}: {
  icon: "checks" | "database" | "shield";
  step: ValidationProgressStep;
  value: string;
}) {
  const Icon = icon === "database" ? Database : icon === "checks" ? ListChecks : ShieldCheck;

  return (
    <article className={`validation-overview-step ${step.status}`}>
      <div>
        <Icon aria-hidden="true" size={15} />
        <span>{step.label}</span>
      </div>
      <strong>{step.title}</strong>
      <small>{step.detail}</small>
      <em>{value}</em>
    </article>
  );
}

function ReplayOverviewCard({
  activeReplay,
  historyTimeframe,
  onHistoryTimeframeChange,
  replayCopy,
  replayWindows,
  step,
}: {
  activeReplay: ReplayWindow;
  historyTimeframe: HistoryTimeframe;
  onHistoryTimeframeChange: (timeframe: HistoryTimeframe) => void;
  replayCopy: string;
  replayWindows: ReplayWindow[];
  step: ValidationProgressStep;
}) {
  return (
    <article className={`validation-overview-step replay ${step.status}`}>
      <div>
        <RotateCcw aria-hidden="true" size={15} />
        <span>{step.label}</span>
      </div>
      <strong>{activeReplay.status}</strong>
      <small>
        {activeReplay.effectiveDays}/{activeReplay.requestedDays} days · {step.title}
      </small>
      <div className="validation-timeframe-selector compact" aria-label="validation replay timeframe">
        {TIMEFRAMES.map((timeframe) => (
          <button
            aria-pressed={historyTimeframe === timeframe}
            className={historyTimeframe === timeframe ? "active" : ""}
            key={timeframe}
            onClick={() => onHistoryTimeframeChange(timeframe)}
            type="button"
          >
            {timeframe}
          </button>
        ))}
      </div>
      <div className="replay-window-strip" aria-label="replay window coverage">
        {replayWindows.map((window) => (
          <span className={window.limited ? "limited" : ""} key={window.timeframe}>
            <b>{window.timeframe}</b>
            <em>{window.status} · {window.effectiveDays}/{window.requestedDays}</em>
          </span>
        ))}
      </div>
      <p>{replayCopy}</p>
    </article>
  );
}

function PatternDiagnosticsChart({ diagnostics }: { diagnostics: PatternDiagnostic[] }) {
  return (
    <div className="pattern-diagnostics-chart" role="figure" aria-label="pattern diagnostics chart">
      <div className="pattern-analysis-header" aria-hidden="true">
        <span>Pattern</span>
        <span>20D 관측</span>
        <span>20D 이후</span>
        <span>60D 이후</span>
        <span>20D 하락</span>
        <span>신뢰도</span>
      </div>
      {diagnostics.map((diagnostic) => (
        <PatternDiagnosticChartRow diagnostic={diagnostic} key={diagnostic.pattern} />
      ))}
    </div>
  );
}

function PatternDiagnosticChartRow({ diagnostic }: { diagnostic: PatternDiagnostic }) {
  const probability = diagnostic.observed_probability_20d ?? 0;
  const reliability = diagnostic.reliability_score ?? 0;
  const return20 = diagnostic.fwd_rel_20d_median ?? 0;
  const return60 = diagnostic.fwd_rel_60d_median ?? 0;
  const drawdown20 = diagnostic.max_drawdown_20d_median ?? 0;
  const return20Width = Math.min(100, (Math.abs(return20) / 5) * 100);
  const return60Width = Math.min(100, (Math.abs(return60) / 5) * 100);
  const drawdownWidth = Math.min(100, (Math.abs(drawdown20) / 8) * 100);

  return (
    <article className="pattern-chart-row" aria-label={patternChartAriaLabel(diagnostic)}>
      <header>
        <div>
          <strong>{diagnostic.pattern}</strong>
          <span>
            표본 {diagnostic.evaluated_20d}/{diagnostic.sample_size}
          </span>
        </div>
      </header>
      <div className="pattern-chart-cells">
        <MetricBar
          className="probability"
          label="20D 관측"
          value={formatObservedProbability(diagnostic.observed_probability_20d)}
          width={Math.min(100, Math.max(0, probability))}
        />
        <SignedMetricBar
          className="return20"
          label="20D 이후"
          value={formatSignedMetric(diagnostic.fwd_rel_20d_median)}
          width={return20Width}
          signedValue={return20}
        />
        <SignedMetricBar
          className="return60"
          label="60D 이후"
          value={formatSignedMetric(diagnostic.fwd_rel_60d_median)}
          width={return60Width}
          signedValue={return60}
        />
        <SignedMetricBar
          className="drawdown"
          label="20D 하락"
          value={formatSignedMetric(diagnostic.max_drawdown_20d_median)}
          width={drawdownWidth}
          signedValue={drawdown20}
        />
        <MetricBar
          className="reliability"
          label="신뢰도"
          value={formatReliability(diagnostic.reliability_score, diagnostic.reliability_label)}
          width={Math.min(100, Math.max(0, reliability))}
        />
      </div>
      <p>
        양수 라벨 {diagnostic.positive_20d_count ?? 0}/{diagnostic.evaluated_20d} · 20D 후 Leading {diagnostic.leading_after_20d_count}
      </p>
    </article>
  );
}

function MetricBar({
  className,
  label,
  value,
  width,
}: {
  className: string;
  label: string;
  value: string;
  width: number;
}) {
  return (
    <div className={`pattern-metric-bar ${className}`}>
      <span>{label}</span>
      <i>
        <b style={{ width: `${width}%` }} />
      </i>
      <strong>{value}</strong>
    </div>
  );
}

function SignedMetricBar({
  className,
  label,
  signedValue,
  value,
  width,
}: {
  className: string;
  label: string;
  signedValue: number;
  value: string;
  width: number;
}) {
  return (
    <div className={`pattern-metric-bar signed ${className} ${signedValue < 0 ? "negative" : "positive"}`}>
      <span>{label}</span>
      <i>
        <b style={{ width: `${width}%` }} />
      </i>
      <strong>{value}</strong>
    </div>
  );
}

function validationProgressSteps({
  coverage,
  patternDiagnostics,
  replayWindows,
  validation,
}: {
  coverage: ReturnType<typeof validationCoverage>;
  patternDiagnostics: PatternDiagnostic[];
  replayWindows: ReplayWindow[];
  validation: ValidationResponse | null;
}): ValidationProgressStep[] {
  const replayReady = replayWindows.filter((window) => !window.limited).length;
  const completedPatterns = patternDiagnostics.filter((diagnostic) => diagnostic.status === "ready").length;
  const hasHistory = coverage.sector_history_days >= 60;
  const diagnosticsReady = validation?.status === "historical_ready" && completedPatterns > 0;

  return [
    {
      detail: `${coverage.sector_history_days} history days / ${coverage.sector_snapshots} samples`,
      label: "데이터",
      status: hasHistory ? "complete" : coverage.sector_history_days > 0 ? "pending" : "blocked",
      title: hasHistory ? "수집 충분" : "수집 필요",
    },
    {
      detail: `${replayReady}/${replayWindows.length} windows ready`,
      label: "Replay",
      status: replayReady === replayWindows.length ? "complete" : replayReady > 0 ? "pending" : "blocked",
      title: replayReady === replayWindows.length ? "30/90/180D 가능" : "일부 기간 제한",
    },
    {
      detail: `${completedPatterns}/${patternDiagnostics.length || 0} patterns complete`,
      label: "진단",
      status: diagnosticsReady ? "complete" : completedPatterns > 0 ? "pending" : "blocked",
      title: diagnosticsReady ? "패턴 진단 완료" : "진단 대기",
    },
    {
      detail: validation?.expose_probability ? "누적 표본 신뢰도와 함께 표시" : "forward label 연결 후 표시",
      label: "관측치",
      status: validation?.expose_probability ? "complete" : "pending",
      title: validation?.expose_probability ? "표본 확률 표시" : "표본 확률 대기",
    },
  ];
}

function validationSummaryCopy({
  completedPatternCount,
  patternCount,
  validation,
}: {
  completedPatternCount: number;
  patternCount: number;
  validation: ValidationResponse | null;
}) {
  if (!validation) return "Validation API 응답이 없어 검증 진행 상태를 확인할 수 없습니다.";
  if (validation.status === "historical_ready") {
    if (validation.expose_probability) {
      return `이력 검증은 진행 완료 상태입니다. ${completedPatternCount}/${patternCount}개 패턴 진단과 표본 기반 관측 확률, 신뢰도를 함께 표시합니다.`;
    }
    return `이력 검증은 진행 완료 상태입니다. ${completedPatternCount}/${patternCount}개 패턴 진단을 표시하고, 확률 보정만 별도 단계로 남겨둡니다.`;
  }
  if (validation.status === "insufficient_history") {
    return "이력 표본이 부족해 패턴 진단을 완료하지 못했습니다. 데이터 축적 상태를 먼저 확인합니다.";
  }
  return "검증 입력을 확인하는 중입니다. 현재 판단은 규칙 기반 상태로만 유지합니다.";
}

function PatternReadinessTable({ patterns }: { patterns: PatternReadiness[] }) {
  return (
    <div className="pattern-readiness-table" role="table" aria-label="pattern readiness table">
      <div role="row">
        <span role="columnheader">Pattern</span>
        <span role="columnheader">Sectors</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Next</span>
      </div>
      {patterns.map((pattern) => (
        <div role="row" key={pattern.pattern}>
          <strong role="cell">{pattern.pattern}</strong>
          <span role="cell">{pattern.count}</span>
          <span role="cell">{pattern.status}</span>
          <small role="cell">{pattern.nextStep}</small>
        </div>
      ))}
    </div>
  );
}

function validationCoverage(validation: ValidationResponse | null) {
  return (
    validation?.coverage ?? {
      market_context_days: 0,
      market_context_points: 0,
      sector_history_days: 0,
      sector_snapshots: 0,
    }
  );
}

function buildReplayWindows(
  historyDays: number,
  history: HistoryResponse | null,
  activeTimeframe: HistoryTimeframe,
): ReplayWindow[] {
  return TIMEFRAMES.map((timeframe) => {
    const requestedDays = timeframeDays(timeframe);
    const activeCoverage = history?.timeframe === timeframe || (!history?.timeframe && activeTimeframe === timeframe)
      ? history?.coverage
      : undefined;
    const availableDays = activeCoverage?.available_sector_days ?? historyDays;
    const effectiveDays = activeCoverage?.effective_days ?? Math.min(requestedDays, availableDays);
    const limited = activeCoverage?.limited_by_data ?? effectiveDays < requestedDays;

    return {
      availableDays,
      effectiveDays,
      limited,
      requestedDays,
      status: replayWindowStatus(availableDays, effectiveDays, requestedDays),
      timeframe,
    };
  });
}

function validationReplayWindows(
  validation: ValidationResponse | null,
  historyDays: number,
  history: HistoryResponse | null,
  activeTimeframe: HistoryTimeframe,
) {
  if (validation?.replay_windows?.length) {
    return validation.replay_windows.map((window) => ({
      availableDays: window.available_sector_days,
      effectiveDays: window.effective_days,
      limited: window.limited_by_data,
      requestedDays: window.requested_days,
      status: replayStatusLabel(window.status),
      timeframe: window.timeframe,
    }));
  }
  return buildReplayWindows(historyDays, history, activeTimeframe);
}

function patternReadiness(
  data: SectorsResponse,
  validation: ValidationResponse | null,
  historyDays: number,
): PatternReadiness[] {
  const counts = new Map<string, number>();
  for (const sector of data.sectors) {
    const pattern = sector.rulebook.lead_pattern || "Unknown";
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pattern, count]) => ({
      count,
      pattern,
      status: validation?.status === "unvalidated" ? "검증 전" : replayReadinessLabel(historyDays),
      nextStep: patternNextStep(historyDays),
    }));
}

function patternNextStep(historyDays: number) {
  if (historyDays === 0) return "sector history 적재";
  if (historyDays < 60) return "60거래일 이상 축적";
  return "forward label 추가 축적";
}

function validationReplayCopy(validation: ValidationResponse | null, historyDays: number) {
  if (!validation) return "Validation API 응답이 없어 검증 전 상태로 유지합니다.";
  if (historyDays === 0) return "아직 replay에 사용할 sector history가 없어 현재 판단은 규칙 기반 상태로만 표시합니다.";
  if (historyDays < 60) return "히스토리 표본이 짧아 replay 결과를 분리 표시하기 전까지 검증 전 상태를 유지합니다.";
  if (validation.status === "historical_ready") {
    if (validation.expose_probability) {
      return "이력 기반 20D/60D 패턴 진단을 표시 중입니다. 표본 관측 확률은 현재 누적치 기준의 신뢰도와 함께 해석합니다.";
    }
    return "이력 기반 20D/60D 패턴 진단을 표시 중입니다. 확률 변환은 별도 calibration 단계에서 다룹니다.";
  }
  return "Replay에 필요한 이력은 있으나 forward label 연결을 확인하는 중입니다.";
}

function replayReadinessLabel(historyDays: number) {
  if (historyDays === 0) return "데이터 없음";
  if (historyDays < 60) return "표본 부족";
  return "Replay 가능";
}

function replayWindowStatus(availableDays: number, effectiveDays: number, requestedDays: number) {
  if (availableDays === 0) return "데이터 없음";
  if (availableDays < 60) return "표본 부족";
  if (effectiveDays < requestedDays) return "제한 표시";
  return "Replay 가능";
}

function validationStatusLabel(status?: string) {
  if (!status || status === "unvalidated") return "검증 전";
  if (status === "insufficient_history") return "표본 부족";
  if (status === "historical_ready") return "이력 진단 완료";
  return status;
}

function replayStatusLabel(status: string) {
  if (status === "ready") return "Replay 가능";
  if (status === "limited") return "제한 표시";
  if (status === "collecting") return "표본 부족";
  return status;
}

function formatSignedMetric(value: number | null) {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatObservedProbability(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatReliability(score: number | undefined, label: string | undefined) {
  if (score === undefined || label === undefined) return "N/A";
  return `${reliabilityLabel(label)} ${score}/100`;
}

function patternChartAriaLabel(diagnostic: PatternDiagnostic) {
  return [
    diagnostic.pattern,
    `표본 ${diagnostic.evaluated_20d}/${diagnostic.sample_size}`,
    `20D 관측 ${formatObservedProbability(diagnostic.observed_probability_20d)}`,
    `20D 이후 ${formatSignedMetric(diagnostic.fwd_rel_20d_median)}`,
    `60D 이후 ${formatSignedMetric(diagnostic.fwd_rel_60d_median)}`,
    `20D 하락 ${formatSignedMetric(diagnostic.max_drawdown_20d_median)}`,
    `신뢰도 ${formatReliability(diagnostic.reliability_score, diagnostic.reliability_label)}`,
  ].join(", ");
}

function reliabilityLabel(label: string) {
  if (label === "high") return "높음";
  if (label === "medium") return "중간";
  if (label === "low") return "낮음";
  return label;
}

function timeframeDays(timeframe: HistoryTimeframe) {
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
}
