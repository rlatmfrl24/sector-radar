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
  const probabilityGate = validation?.expose_probability ? "확률 표시" : "확률 숨김";
  const sampleStatus = replayReadinessLabel(coverage.sector_history_days);
  const replayCopy = validationReplayCopy(validation, coverage.sector_history_days);
  const contextCoverage = `${coverage.market_context_points} rows / ${coverage.market_context_days} days`;
  const scheduleLabel = validation?.schedule?.last_run_at
    ? `last audit ${shortDate(validation.schedule.last_run_at)}`
    : "scheduled audit pending";
  const limitations = validation?.limitations ?? [];
  const hasLimitations = limitations.length > 0;
  const completedPatternCount = patternDiagnostics.filter((diagnostic) => diagnostic.status === "ready").length;
  const progressSteps = validationProgressSteps({
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

      <section className="validation-progress-card dashboard-card" aria-label="validation progress">
        <div className="validation-progress-copy">
          <span>현재 진행 상황</span>
          <strong>{gateStatus}</strong>
          <p>
            데이터 수집, replay, 패턴 진단은 별도로 완료 상태를 표시합니다. 확률 보정은 다음 단계라서
            현재 진단 진행 상태를 막지 않습니다.
          </p>
        </div>
        <div className="validation-progress-steps">
          {progressSteps.map((step, index) => (
            <article className={`validation-progress-step ${step.status}`} key={step.label}>
              <span>{index + 1}</span>
              <div>
                <small>{step.label}</small>
                <strong>{step.title}</strong>
                <em>{step.detail}</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="validation-gate-strip" aria-label="validation gate summary">
        <GateCard
          icon="shield"
          label="이력 검증"
          title={gateStatus}
          value={scheduleLabel}
        />
        <GateCard
          icon="checks"
          label="확률 게이트"
          title={probabilityGate}
          value="calibration 전까지 분리"
        />
        <GateCard
          icon="replay"
          label="Replay 상태"
          title={sampleStatus}
          value={`${coverage.sector_history_days} history days`}
        />
        <GateCard
          icon="database"
          label="데이터 범위"
          title={contextCoverage}
          value="market context"
        />
      </section>

      <section className="validation-workspace" aria-label="validation workspace">
        <article className="validation-replay-card dashboard-card">
          <PanelHeader
            eyebrow="Replay Preview"
            meta={activeReplay.status}
            title="Replay 가능 범위"
          />
          <div className="validation-timeframe-selector" aria-label="validation replay timeframe">
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
          <div className="replay-window-grid">
            {replayWindows.map((window) => (
              <div className={window.limited ? "limited" : ""} key={window.timeframe}>
                <span>{window.timeframe}</span>
                <strong>{window.status}</strong>
                <small>
                  {window.effectiveDays}/{window.requestedDays} days
                </small>
              </div>
            ))}
          </div>
          <p>{replayCopy}</p>
        </article>

        <article className="pattern-readiness-card dashboard-card">
          <PanelHeader
            eyebrow={patternDiagnostics.length ? "Pattern Diagnostics" : "Pattern Readiness"}
            meta={patternDiagnostics.length ? `${completedPatternCount}/${patternDiagnostics.length} complete` : `${patterns.length} patterns`}
            title={patternDiagnostics.length ? "패턴별 이력 진단 결과" : "현재 패턴 검증 준비도"}
          />
          {patternDiagnostics.length ? (
            <PatternDiagnosticsTable diagnostics={patternDiagnostics} />
          ) : (
            <PatternReadinessTable patterns={patterns} />
          )}
        </article>

        <article className="validation-limit-card dashboard-card">
          <PanelHeader
            eyebrow={hasLimitations ? "Data Limits" : "Audit Status"}
            meta={hasLimitations ? probabilityGate : (validation?.schedule?.last_run_status ?? "audit pending")}
            title={hasLimitations ? "데이터 제한" : "정기 진단 갱신"}
          />
          {hasLimitations ? (
            <ul>
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : (
            <ul>
              <li>이력 진단 지표가 현재 데이터 기준으로 표시됩니다.</li>
              <li>확률 지표는 calibration 단계 전까지 표시하지 않습니다.</li>
              <li>scheduled ingest 이후 Layer 4 audit이 자동 갱신됩니다.</li>
            </ul>
          )}
          <div className="validation-next-steps">
            <strong>정기 확인</strong>
            <span>{validation?.schedule?.api ?? "/api/validation/status"}</span>
            <span>{validation?.schedule?.run_type ?? "layer4_validation_audit"}</span>
            <span>{validation?.schedule?.last_run_status ?? "audit pending"}</span>
          </div>
        </article>
      </section>
    </section>
  );
}

function PatternDiagnosticsTable({ diagnostics }: { diagnostics: PatternDiagnostic[] }) {
  return (
    <div className="pattern-diagnostics-table" role="table" aria-label="pattern diagnostics table">
      <div role="row">
        <span role="columnheader">Pattern</span>
        <span role="columnheader">검증 표본</span>
        <span role="columnheader">20D 이후</span>
        <span role="columnheader">60D 이후</span>
        <span role="columnheader">20D 하락</span>
        <span role="columnheader">진행</span>
      </div>
      {diagnostics.map((diagnostic) => (
        <div role="row" key={diagnostic.pattern}>
          <strong role="cell">{diagnostic.pattern}</strong>
          <span role="cell">
            {diagnostic.evaluated_20d}/{diagnostic.sample_size}
          </span>
          <span role="cell">{formatSignedMetric(diagnostic.fwd_rel_20d_median)}</span>
          <span role="cell">{formatSignedMetric(diagnostic.fwd_rel_60d_median)}</span>
          <span role="cell">{formatSignedMetric(diagnostic.max_drawdown_20d_median)}</span>
          <small role="cell">
            {diagnosticStatusLabel(diagnostic.status)}
          </small>
        </div>
      ))}
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
      detail: "확률 문구는 별도 보정 후 표시",
      label: "보정",
      status: validation?.expose_probability ? "complete" : "pending",
      title: validation?.expose_probability ? "확률 표시 가능" : "확률 보정 대기",
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

function GateCard({
  icon,
  label,
  title,
  value,
}: {
  icon: "checks" | "database" | "replay" | "shield";
  label: string;
  title: string;
  value: string;
}) {
  const Icon = icon === "database" ? Database : icon === "replay" ? RotateCcw : icon === "checks" ? ListChecks : ShieldCheck;

  return (
    <article className="validation-gate-card dashboard-card">
      <div>
        <Icon aria-hidden="true" size={16} />
        <span>{label}</span>
      </div>
      <strong>{title}</strong>
      <small>{value}</small>
    </article>
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
  return "정기 audit 갱신";
}

function validationReplayCopy(validation: ValidationResponse | null, historyDays: number) {
  if (!validation) return "Validation API 응답이 없어 검증 전 상태로 유지합니다.";
  if (historyDays === 0) return "아직 replay에 사용할 sector history가 없어 현재 판단은 규칙 기반 상태로만 표시합니다.";
  if (historyDays < 60) return "히스토리 표본이 짧아 replay 결과를 분리 표시하기 전까지 검증 전 상태를 유지합니다.";
  if (validation.status === "historical_ready") {
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

function diagnosticStatusLabel(status: string) {
  if (status === "ready") return "진단 완료";
  if (status === "thin_sample") return "표본 얇음";
  if (status === "collecting") return "수집 중";
  return status;
}

function formatSignedMetric(value: number | null) {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function shortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function timeframeDays(timeframe: HistoryTimeframe) {
  if (timeframe === "30D") return 30;
  if (timeframe === "180D") return 180;
  return 90;
}
