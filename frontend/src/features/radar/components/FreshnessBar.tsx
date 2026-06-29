import { useMemo, useState } from "react";
import { Activity, ChevronDown, Database, Info, ListFilter, ShieldCheck } from "lucide-react";

import type {
  DataConnection,
  DataConnections,
  SectorsResponse,
  SourceFreshnessItem,
  SourceFreshnessProvider,
} from "../../../types";

export function FreshnessBar({ data }: { data: SectorsResponse }) {
  const [expanded, setExpanded] = useState(false);
  const connections = data.data_connections ?? { yahoo_finance: data.data_connection };
  const entries = Object.entries(connections);
  const freshness = data.source_freshness ?? [];
  const activeFreshness = freshness.filter(isActiveFreshness);
  const staleCount = activeFreshness.length
    ? activeFreshness.filter((item) => item.status !== "live").length
    : entries.filter(([, connection]) => connection.mode !== "live").length;
  const providerGroups = useMemo(() => groupFreshness(activeFreshness), [activeFreshness]);

  return (
    <section className={`freshness-bar ${expanded ? "expanded" : ""}`} aria-label="provider freshness">
      <div className="freshness-summary">
        <div className="freshness-head">
          <Database size={14} />
          <strong>{staleCount === 0 ? "수집원 정상" : `확인 필요한 수집원 ${staleCount}개`}</strong>
        </div>
        <div className="provider-strip">
          {entries.map(([key, connection]) => {
            const provider = key as SourceFreshnessProvider;

            return (
              <article
                aria-label={providerTooltip(provider, connection)}
                className={`provider-chip ${providerTone(connection)} has-tooltip`}
                data-tooltip={providerTooltip(provider, connection)}
                key={key}
                tabIndex={0}
              >
                <span>{providerLabel(key)}</span>
                <strong>{connection.latest_price_date ?? "준비 중"}</strong>
                <small>{statusLabel(connection.status)}</small>
                <em>{nextCollectionLabel(provider, connection)}</em>
              </article>
            );
          })}
        </div>
        <button
          aria-expanded={expanded}
          className="freshness-toggle"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <ListFilter size={14} />
          <span>수집 내역</span>
          <ChevronDown aria-hidden="true" className={expanded ? "open" : ""} size={14} />
        </button>
      </div>
      {expanded ? <SourceFreshnessPanel connections={connections} groups={providerGroups} /> : null}
    </section>
  );
}

export function ContextRail({ data }: { data: SectorsResponse }) {
  const activeContext = (data.market_context ?? []).filter((card) => card.source_class !== "held" && card.source_class !== "manual");
  const officialCount = activeContext.filter((card) => card.source_class === "official").length;
  const concentration = data.concentration;
  const reconciliation = data.context_reconciliation;

  return (
    <section className="context-rail" aria-label="analysis flow">
      <div>
        <Activity size={14} />
        <span>Market Context</span>
        <strong>{officialCount}/{activeContext.length} official</strong>
      </div>
      <i />
      <div>
        <Database size={14} />
        <span>Sector Leadership</span>
        <strong>{concentration?.top1 ?? data.sectors[0]?.sector_code ?? "N/A"} lead</strong>
      </div>
      <i />
      <div>
        <Activity size={14} />
        <span>Reconciliation</span>
        <strong>{reconciliation ? reconciliationLabel(reconciliation.state) : "pending"}</strong>
      </div>
      <i />
      <div>
        <ShieldCheck size={14} />
        <span>Validation</span>
        <strong>{data.validation.expose_probability ? "prob on" : "prob off"}</strong>
      </div>
      <small>
        {reconciliation?.narrative ??
          (concentration?.effective_sector_count
            ? `effective sectors ${concentration.effective_sector_count.toFixed(1)} · proxy concentration`
            : "concentration pending")}
      </small>
    </section>
  );
}

function SourceFreshnessPanel({
  connections,
  groups,
}: {
  connections: DataConnections;
  groups: Array<[SourceFreshnessItem["provider"], SourceFreshnessItem[]]>;
}) {
  return (
    <div className="source-freshness-panel">
      {groups.map(([provider, items]) => {
        const connection = connectionForProvider(connections, provider);
        const latestDate = connection?.latest_price_date ?? latestDateFromItems(items) ?? "not ready";

        return (
          <section className="source-freshness-group" key={provider}>
            <header>
              <div>
                <strong>{providerLabel(provider)}</strong>
                <span>
                  수집 항목 {items.length}개 · {cadenceLabel(provider, connection)}
                </span>
              </div>
              <small>{providerRuntimeLabel(connection)}</small>
            </header>
            <div className="source-group-schedule" aria-label={`${providerLabel(provider)} update schedule`}>
              <ScheduleMetric
                label="데이터 기준일"
                tooltip={scheduleTooltip("data_date", provider, connection, latestDate)}
                value={latestDate}
              />
              <ScheduleMetric
                label="수집 완료"
                tooltip={scheduleTooltip("success_at", provider, connection, latestDate)}
                value={formatKstShort(connection?.last_success_at)}
              />
              <ScheduleMetric
                label="마지막 시도"
                tooltip={scheduleTooltip("attempt_at", provider, connection, latestDate)}
                value={formatKstShort(connection?.last_attempt_at)}
              />
              <ScheduleMetric
                label="다음 수집"
                tooltip={scheduleTooltip("next_at", provider, connection, latestDate)}
                value={nextCollectionLabel(provider, connection)}
              />
            </div>
            <div className="source-freshness-rows">
              {items.map((item) => (
                <SourceFreshnessRow
                  connection={connection}
                  item={item}
                  key={item.id}
                  provider={provider}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SourceFreshnessRow({
  connection,
  item,
  provider,
}: {
  connection?: DataConnection;
  item: SourceFreshnessItem;
  provider: SourceFreshnessProvider;
}) {
  const warning = warningLabel(item.warning);
  const sourceLabel = `${sourceClassLabel(item.source_class)} · ${sourceSeriesSummary(item)}`;
  const latestLabel = formatDateShort(item.latest_date);
  const frequencyLabelText = frequencyShortLabel(item.frequency);
  const nextLabel = nextCollectionShortLabel(provider, connection);

  return (
    <article
      aria-label={sourceTooltip(item, provider, connection)}
      className={`source-row ${item.status}`}
      title={sourceTooltip(item, provider, connection)}
    >
      <div className="source-row-title">
        <strong>{item.label}</strong>
        <span title={`${sourceClassLabel(item.source_class)} · ${sourceSeriesLabel(item)}`}>{sourceLabel}</span>
      </div>
      <dl className="source-row-details">
        <div title={`데이터 기준일: ${item.latest_date ?? "준비 중"}`}>
          <dt>기준</dt>
          <dd>{latestLabel}</dd>
        </div>
        <div title={`수집 주기: ${frequencyLabel(item.frequency)}`}>
          <dt>주기</dt>
          <dd>{frequencyLabelText}</dd>
        </div>
        <div title={`다음 수집: ${nextCollectionLabel(provider, connection)}`}>
          <dt>다음</dt>
          <dd>{nextLabel}</dd>
        </div>
      </dl>
      <div className="source-row-actions">
        <strong className="source-row-state">{sourceStatusLabel(item.status)}</strong>
        {warning ? (
          <span
            aria-label={`메모: ${warning}`}
            className="source-row-note has-tooltip"
            data-tooltip={warning}
            role="note"
            tabIndex={0}
          >
            <Info aria-hidden="true" size={12} />
            <span>메모</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function ScheduleMetric({ label, tooltip, value }: { label: string; tooltip: string; value: string }) {
  return (
    <span
      aria-label={`${label}: ${value}. ${tooltip}`}
      className="source-schedule-metric has-tooltip"
      data-tooltip={tooltip}
      role="note"
      tabIndex={0}
    >
      <b>{label}</b>
      <strong>{value}</strong>
    </span>
  );
}

function groupFreshness(items: SourceFreshnessItem[]) {
  const groups = new Map<SourceFreshnessItem["provider"], SourceFreshnessItem[]>();
  for (const item of items) {
    const group = groups.get(item.provider) ?? [];
    group.push(item);
    groups.set(item.provider, group);
  }
  return [...groups.entries()];
}

function isActiveFreshness(item: SourceFreshnessItem) {
  return item.source_class !== "held" && item.source_class !== "manual";
}

function providerLabel(provider: string) {
  if (provider === "yahoo_finance") return "Yahoo";
  if (provider === "fred") return "FRED";
  if (provider === "krx_openapi") return "KRX";
  return provider.replaceAll("_", " ");
}

function statusLabel(status: string) {
  if (status === "skipped_rate_limited") return "대기";
  if (status === "never_run") return "미수집";
  if (status === "refreshing") return "수집 중";
  if (status === "failed") return "실패";
  if (status === "success") return "정상";
  return status;
}

function sourceStatusLabel(status: SourceFreshnessItem["status"]) {
  if (status === "live") return "최신";
  if (status === "stale") return "지연";
  if (status === "unavailable") return "사용 불가";
  if (status === "manual_check") return "수동 확인";
  return status;
}

function frequencyLabel(frequency: SourceFreshnessItem["frequency"]) {
  if (frequency === "intraday_gate") return "15분 호출 제한";
  if (frequency === "daily") return "매일";
  if (frequency === "weekly") return "매주";
  if (frequency === "manual") return "수동";
  return "주기 미정";
}

function frequencyShortLabel(frequency: SourceFreshnessItem["frequency"]) {
  if (frequency === "intraday_gate") return "15분";
  if (frequency === "daily") return "매일";
  if (frequency === "weekly") return "매주";
  if (frequency === "manual") return "수동";
  return "미정";
}

function connectionForProvider(connections: DataConnections, provider: SourceFreshnessProvider) {
  return connections[provider];
}

function latestDateFromItems(items: SourceFreshnessItem[]) {
  return items
    .map((item) => item.latest_date)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function providerTone(connection: DataConnection) {
  if (connection.status === "refreshing") return "refreshing";
  if (connection.mode === "live" && connection.status === "success") return "live";
  return "stale";
}

function providerRuntimeLabel(connection?: DataConnection) {
  if (!connection) return "미연결";
  if (connection.status === "refreshing") return "수집 중";
  if (connection.status === "failed") return "실패";
  if (connection.status === "skipped_rate_limited") return "대기 중";
  if (!connection.last_success_at) return "성공 이력 없음";
  return "정상";
}

function nextCollectionLabel(provider: SourceFreshnessProvider, connection?: DataConnection) {
  if (!connection) return "미연결";
  if (connection.status === "refreshing") return "지금 수집 중";
  if (!connection.next_allowed_at) return `대기 중 · ${providerWindowLabel(provider)}`;

  const nextAt = new Date(connection.next_allowed_at).getTime();
  if (!Number.isFinite(nextAt)) return connection.next_allowed_at;
  if (nextAt <= Date.now()) return `지금 수집 가능 · ${providerWindowLabel(provider)}`;
  return `${formatKstShort(connection.next_allowed_at)} 이후`;
}

function nextCollectionShortLabel(provider: SourceFreshnessProvider, connection?: DataConnection) {
  if (!connection) return "미연결";
  if (connection.status === "refreshing") return "수집 중";
  if (!connection.next_allowed_at) return "대기";

  const nextAt = new Date(connection.next_allowed_at).getTime();
  if (!Number.isFinite(nextAt)) return connection.next_allowed_at;
  if (nextAt <= Date.now()) return "지금 가능";
  return formatKstMini(connection.next_allowed_at, provider === "krx_openapi");
}

function cadenceLabel(provider: SourceFreshnessProvider, connection?: DataConnection) {
  if (provider === "yahoo_finance") return `${connection?.refresh_interval_minutes ?? 15}분 제한 / 가격 수집`;
  if (provider === "fred") return "일간 / FRED 지표 수집";
  if (provider === "krx_openapi") return "일간 / KST 오전 수집";
  if (provider === "manual") return "수동 확인";
  return "제공처 일정";
}

function providerWindowLabel(provider: SourceFreshnessProvider) {
  if (provider === "yahoo_finance") return "가격 수집";
  if (provider === "fred") return "일간 지표 수집";
  if (provider === "krx_openapi") return "KST 오전 수집";
  if (provider === "manual") return "수동 확인";
  return "제공처 수집";
}

function providerTooltip(provider: SourceFreshnessProvider, connection: DataConnection) {
  return [
    `${providerLabel(provider)} 데이터 연결 상태입니다.`,
    `데이터 기준일: ${connection.latest_price_date ?? "준비 중"}`,
    `수집 완료: ${formatKstShort(connection.last_success_at)}`,
    `마지막 시도: ${formatKstShort(connection.last_attempt_at)}`,
    `다음 수집: ${nextCollectionLabel(provider, connection)}`,
    "데이터 기준일은 원천 데이터가 가리키는 시장/관측 날짜이고, 수집 완료는 시스템이 저장에 성공한 시각입니다.",
    connection.message ? `메시지: ${connection.message}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function sourceTooltip(item: SourceFreshnessItem, provider: SourceFreshnessProvider, connection?: DataConnection) {
  return [
    item.label,
    `제공처: ${providerLabel(provider)}`,
    `수집 대상: ${sourceSeriesLabel(item)}`,
    `데이터 기준일: ${item.latest_date ?? "준비 중"}`,
    `수집 주기: ${frequencyLabel(item.frequency)}`,
    `다음 수집: ${nextCollectionLabel(provider, connection)}`,
    warningLabel(item.warning) ? `메모: ${warningLabel(item.warning)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function scheduleTooltip(
  metric: "data_date" | "success_at" | "attempt_at" | "next_at",
  provider: SourceFreshnessProvider,
  connection: DataConnection | undefined,
  latestDate: string,
) {
  const providerName = providerLabel(provider);
  if (metric === "data_date") {
    return `${providerName}에서 현재 화면 판단에 사용 중인 원천 데이터의 기준일입니다. 시장 휴장, 발표 지연, 일간 지표 때문에 수집 완료 시각보다 과거일 수 있습니다. 현재 기준일: ${latestDate}.`;
  }
  if (metric === "success_at") {
    return `${providerName} 수집기가 데이터를 받아 DB 저장과 화면용 스냅샷 계산을 성공적으로 마친 시각입니다. 수집 완료 직후 화면은 이 스냅샷을 다시 읽어 반영합니다. 현재 값: ${formatKstShort(connection?.last_success_at)}.`;
  }
  if (metric === "attempt_at") {
    return `${providerName} 수집기가 마지막으로 실행을 시도한 시각입니다. 실패 또는 rate gate로 인해 수집 완료 시각과 다를 수 있습니다. 현재 값: ${formatKstShort(connection?.last_attempt_at)}.`;
  }
  return `${providerName} 수집기가 다음으로 실행 가능하거나 예정된 시각입니다. Yahoo는 최소 호출 간격, FRED/KRX는 일간 발표/운영 시간을 기준으로 표시합니다. 현재 값: ${nextCollectionLabel(provider, connection)}.`;
}

function formatKstShort(value?: string) {
  if (!value) return "준비 중";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute} KST`;
}

function formatDateShort(value?: string) {
  if (!value) return "준비 중";
  const parts = value.split("-");
  if (parts.length === 3 && parts[1] && parts[2]) return `${parts[1]}-${parts[2]}`;
  return value;
}

function formatKstMini(value: string, includeDay = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: includeDay ? "2-digit" : undefined,
    day: includeDay ? "2-digit" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  if (includeDay) return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  return `${parts.hour}:${parts.minute}`;
}

function sourceClassLabel(sourceClass: SourceFreshnessItem["source_class"]) {
  if (sourceClass === "official") return "공식 원천";
  if (sourceClass === "proxy") return "프록시";
  if (sourceClass === "manual") return "수동 입력";
  if (sourceClass === "held") return "보류";
  return sourceClass;
}

function sourceSeriesLabel(item: SourceFreshnessItem) {
  return item.series_id ?? sourceClassLabel(item.source_class);
}

function sourceSeriesSummary(item: SourceFreshnessItem) {
  const series = item.series_id;
  if (!series) return sourceClassLabel(item.source_class);
  const parts = series.split(",").map((value) => value.trim()).filter(Boolean);
  if (parts.length > 1) return `${parts.length}개 시리즈`;
  if (series.includes(":")) return series.split(":").at(-1) ?? series;
  return series;
}

function warningLabel(warning?: string) {
  if (!warning || warning === "ok") return "";
  if (warning === "example_probe" || warning === "example_probe_data_not_for_decision") {
    return "예시 데이터 확인용입니다. 실제 판단에는 운영 수집 데이터가 필요합니다.";
  }
  if (warning.includes("official_source_not_connected")) {
    return "공식 원천이 아직 연결되지 않아 프록시 데이터로만 확인 중입니다.";
  }
  if (warning.includes("US Sector Radar")) {
    return "US 섹터 레이더에서는 참고 카드로만 사용합니다.";
  }
  if (warning.includes("KRX")) {
    return "KRX 원천 필드 가용성을 계속 점검 중입니다.";
  }
  if (warning.includes("WRESBAL")) {
    return "WRESBAL은 현금 여력의 보조 지표로만 해석합니다.";
  }
  return warning.replaceAll("_", " ");
}

function reconciliationLabel(state: NonNullable<SectorsResponse["context_reconciliation"]>["state"]) {
  if (state === "supportive") return "supportive";
  if (state === "divergent") return "divergent";
  if (state === "risk_rising") return "risk rising";
  if (state === "rotation_watch") return "rotation watch";
  return "data insufficient";
}
