import type { LayerDataQualitySummary, ModuleState } from "../../../types";
import type { LayerDecisionSummary } from "../reportModel";

export function LayerHeader({
  description,
  eyebrow,
  meta,
  title,
}: {
  description: string;
  eyebrow: string;
  meta: string;
  title: string;
}) {
  return (
    <div className="layer-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <small>{meta}</small>
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  inverted = false,
  meta,
  title,
}: {
  eyebrow: string;
  inverted?: boolean;
  meta: string;
  title: string;
}) {
  return (
    <div className={`panel-header ${inverted ? "inverted" : ""}`}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <small>{meta}</small>
    </div>
  );
}

export function ModuleMeter({
  compact = false,
  label,
  module,
}: {
  compact?: boolean;
  label: string;
  module: ModuleState;
}) {
  return (
    <div className={`module-meter ${compact ? "compact" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{module.state}</span>
      </div>
      <div className="meter-track">
        <i style={{ width: `${Math.min(100, Math.max(12, module.strength * 25))}%` }} />
      </div>
      <small>{module.transition}</small>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DataQualityStrip({
  compact = false,
  quality,
}: {
  compact?: boolean;
  quality?: LayerDataQualitySummary;
}) {
  if (!quality) return null;

  const visibleIssues = quality.issues.filter((issue) => issue.severity !== "info").slice(0, 2);
  const infoCount = quality.issues.length - visibleIssues.length;
  const completeness = quality.completeness === null ? "N/A" : `${Math.round(quality.completeness * 100)}%`;

  return (
    <div className={`data-quality-strip ${quality.status} ${compact ? "compact" : ""}`} aria-label="data quality summary">
      <div>
        <span>데이터 정합성</span>
        <strong>{dataQualityStatusLabel(quality.status)}</strong>
        <em>{quality.as_of ?? "기준일 대기"} · 완성도 {completeness}</em>
      </div>
      {visibleIssues.length ? (
        <ul>
          {visibleIssues.map((issue) => (
            <li key={`${issue.code}-${issue.source ?? "source"}`}>{issue.message}</li>
          ))}
          {infoCount > 0 ? <li>참고 {infoCount}개는 출처/보조 지표 메모입니다.</li> : null}
        </ul>
      ) : (
        <p>현재 레이어의 필수 입력과 기준일이 정렬되어 있습니다.</p>
      )}
    </div>
  );
}

export function ReportSentence({
  summary,
}: {
  summary?: LayerDecisionSummary;
}) {
  if (!summary) return null;
  const caveatCount = summary.caveats.length;
  const evidenceCount = summary.evidence.length;

  return (
    <div className={`report-sentence ${summary.tone}`} aria-label={`${summary.title} report sentence`}>
      <span>리포트 문장</span>
      <strong>{summary.headline}</strong>
      <em>
        근거 {evidenceCount}개 · 제한 {caveatCount}개 · {summary.readiness.detail}
      </em>
    </div>
  );
}

function dataQualityStatusLabel(status: LayerDataQualitySummary["status"]) {
  if (status === "complete") return "정상";
  if (status === "partial") return "부분";
  if (status === "stale") return "기준일 확인";
  return "차단";
}
