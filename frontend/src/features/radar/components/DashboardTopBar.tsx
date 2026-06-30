import { BookOpen, Info, RefreshCw } from "lucide-react";

import type { SectorsResponse } from "../../../types";
import type { RadarView } from "../model";

type StatusTone = "default" | "guard" | "risk";

interface HeaderStatusItem {
  label: string;
  tone?: StatusTone;
  tooltip: string;
  value: string;
}

export function DashboardTopBar({
  activeView,
  data,
  explainMode,
  isRefreshing,
  onExplainModeChange,
  onRefresh,
  onViewChange,
}: {
  activeView: RadarView;
  data: SectorsResponse;
  explainMode: boolean;
  isRefreshing: boolean;
  onExplainModeChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onViewChange: (view: RadarView) => void;
}) {
  const connection = data.data_connection;
  const refreshDisabled =
    isRefreshing || !connection.manual_refresh_available || data.source === "sample";
  const statusItems = buildStatusItems(data);
  const refreshTooltip = refreshDisabled
    ? `수동 갱신을 사용할 수 없습니다. 현재 모드: ${modeLabel(connection.mode)}, 상태: ${statusLabel(connection.status)}.`
    : `Yahoo Finance 데이터 수동 갱신을 요청합니다. 서버의 ${connection.refresh_interval_minutes}분 갱신 제한은 우회하지 않습니다. 다음 갱신 가능 시각: ${formatFullDateTime(connection.next_allowed_at)}.`;

  return (
    <header className="dashboard-topbar">
      <div className="topbar-brand">
        <img alt="" aria-hidden="true" className="topbar-logo" src="/sector-radar-logo.svg" />
        <div>
          <strong>Sector Radar</strong>
          <span>Sector-first MVP dashboard</span>
        </div>
      </div>
      <ViewSwitch activeView={activeView} onViewChange={onViewChange} />
      <div className="topbar-status" aria-label="data status">
        {statusItems.map((item) => (
          <StatusPill
            key={item.label}
            label={item.label}
            tone={item.tone}
            tooltip={item.tooltip}
            value={item.value}
          />
        ))}
        {activeView === "layer1" ? (
          <ExplainModeToggle enabled={explainMode} onChange={onExplainModeChange} />
        ) : null}
        <button
          aria-label={refreshTooltip}
          className="refresh-button has-tooltip"
          data-tooltip={refreshTooltip}
          disabled={refreshDisabled}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={isRefreshing ? "spinning" : ""} size={14} />
          <span>{isRefreshing ? "갱신 중" : refreshDisabled ? "대기" : "수동 갱신"}</span>
        </button>
      </div>
    </header>
  );
}

function ExplainModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const tooltip = enabled
    ? "전문 대시보드 화면으로 돌아갑니다."
    : "Layer 1 흐름을 초보자용 쉬운 해설 화면으로 전환합니다.";
  return (
    <button
      aria-label={`${enabled ? "쉬운 화면 켜짐" : "쉬운 화면 꺼짐"}. ${tooltip}`}
      aria-pressed={enabled}
      className={`explain-toggle ${enabled ? "active" : ""} has-tooltip`}
      data-tooltip={tooltip}
      onClick={() => onChange(!enabled)}
      type="button"
    >
      <BookOpen aria-hidden="true" size={14} />
      <span>{enabled ? "전문 화면" : "쉬운 화면"}</span>
    </button>
  );
}

function ViewSwitch({
  activeView,
  onViewChange,
}: {
  activeView: RadarView;
  onViewChange: (view: RadarView) => void;
}) {
  const views: Array<{ detail: string; id: RadarView; label: string }> = [
    { detail: "Layer 1", id: "layer1", label: "흐름" },
    { detail: "Layer 2", id: "layer2", label: "여력" },
    { detail: "Layer 3", id: "leadership", label: "리더십" },
  ];

  return (
    <nav className="view-switch" aria-label="radar screens">
      {views.map((view) => (
        <button
          aria-current={activeView === view.id ? "page" : undefined}
          className={activeView === view.id ? "active" : ""}
          key={view.id}
          onClick={() => onViewChange(view.id)}
          type="button"
        >
          <strong>{view.label}</strong>
          <span>{view.detail}</span>
        </button>
      ))}
    </nav>
  );
}

function StatusPill({
  label,
  tone = "default",
  tooltip,
  value,
}: {
  label: string;
  tone?: StatusTone;
  tooltip: string;
  value: string;
}) {
  return (
    <div
      aria-label={`${label}: ${value}. ${tooltip}`}
      className={`status-pill ${tone} has-tooltip`}
      data-tooltip={tooltip}
      role="note"
      tabIndex={0}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <Info aria-hidden="true" className="status-pill-icon" size={12} />
    </div>
  );
}

function formatShortTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: getLocalTimeZone(),
  });
}

function formatFullDateTime(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: getLocalTimeZone(),
    year: "numeric",
  });
}

function statusTone(status: string): StatusTone {
  if (status === "failed") return "risk";
  if (status === "skipped_rate_limited" || status === "refreshing") return "guard";
  return "default";
}

function buildStatusItems(data: SectorsResponse): HeaderStatusItem[] {
  const connection = data.data_connection;
  const provider = providerLabel(connection.provider);
  const mode = modeLabel(connection.mode);
  const status = statusLabel(connection.status);
  const latestPriceDate = connection.latest_price_date ?? "N/A";
  const connectionValue = connection.status === "success" ? `${provider} · ${mode}` : `${provider} · ${status}`;
  const latestUpdateTime = formatShortTime(connection.last_success_at) ?? "never";
  const timeZone = timeZoneInfo(connection.last_success_at ?? connection.last_attempt_at);
  const timeValue = `${timeZone.compact} ${latestUpdateTime}`;
  const symbolText = connection.symbol_count ? ` 대상 심볼 ${connection.symbol_count}개.` : "";
  const rowsText = connection.rows_upserted ? ` 최근 저장 행 ${connection.rows_upserted}개.` : "";

  return [
    {
      label: "Benchmark",
      tooltip: `상대강도와 RRG 계산 기준 ETF입니다. 각 섹터 ETF는 ${data.benchmark} 대비로 비교됩니다.`,
      value: data.benchmark,
    },
    {
      label: "Time",
      tooltip: `타임존: ${timeZone.full}. 최신 업데이트: ${formatFullDateTime(connection.last_success_at)}. 마지막 시도: ${formatFullDateTime(connection.last_attempt_at)}. 다음 갱신 가능: ${formatFullDateTime(connection.next_allowed_at)}. 스냅샷 기준일: ${data.as_of ?? "N/A"}. 원천 가격 최신일: ${latestPriceDate}. 최소 갱신 간격은 ${connection.refresh_interval_minutes}분입니다.`,
      value: timeValue,
    },
    {
      label: "Connection",
      tone: connection.mode === "sample" || connection.status === "failed" ? "risk" : statusTone(connection.status),
      tooltip: `Provider: ${provider}. Mode: ${mode}. Refresh status: ${status}. Read surface: ${sourceLabel(data.source)}.${symbolText}${rowsText}${connection.message ? ` Message: ${connection.message}` : ""}`,
      value: connectionValue,
    },
    {
      label: "검증",
      tone: "guard",
      tooltip: `현재 검증 상태: ${validationStatusLabel(data.validation.status)}. 확률 노출: ${data.validation.expose_probability ? "켜짐" : "숨김"}. Walk-forward 검증 전에는 승률, 상승 확률, 기대수익률을 판단 문구에 쓰지 않습니다.`,
      value: data.validation.expose_probability ? "확률 표시" : "검증 전",
    },
  ];
}

function providerLabel(provider: string) {
  if (provider === "yahoo_finance") return "Yahoo";
  if (provider === "none") return "None";
  return provider.replaceAll("_", " ");
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function timeZoneInfo(value?: string) {
  const date = value ? new Date(value) : new Date();
  const referenceDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const timeZone = getLocalTimeZone();
  const offset = timeZoneOffset(referenceDate);
  const compact = timeZone === "Asia/Seoul" ? "KST" : offset;
  return {
    compact,
    full: `${timeZone} (${offset})`,
  };
}

function timeZoneOffset(date: Date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60).toString().padStart(2, "0");
  const remainingMinutes = (absoluteMinutes % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${remainingMinutes}`;
}

function modeLabel(mode: string) {
  if (mode === "read_only") return "read only";
  return mode;
}

function sourceLabel(source: SectorsResponse["source"]) {
  if (source === "local_sqlite") return "Local SQLite";
  if (source === "d1") return "Cloudflare D1";
  return "Sample fallback";
}

function statusLabel(status: string) {
  if (status === "skipped_rate_limited") return "rate gated";
  if (status === "never_run") return "never run";
  return status;
}

function validationStatusLabel(status: string) {
  if (status === "unvalidated") return "검증 전";
  return status;
}
