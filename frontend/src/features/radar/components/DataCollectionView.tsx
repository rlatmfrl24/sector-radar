import type { DashboardDataQuality, SectorsResponse, ValidationResponse } from "../../../types";
import type { RadarLayerView } from "../model";
import { LayerHeader, PanelHeader } from "./common";
import { LayerDataContextSection, dataContextScope, layerQualityForView } from "./LayerDataContextSection";

export function DataCollectionView({
  activeView,
  data,
  quality,
  validation,
}: {
  activeView: RadarLayerView;
  data: SectorsResponse;
  quality: DashboardDataQuality | null;
  validation?: ValidationResponse | null;
}) {
  const activeSummary = buildCollectionSummary(activeView, quality, data);
  const activeQuality = layerQualityForView(activeView, quality, data);

  return (
    <section className="data-collection-view" aria-label="data collection status">
      <LayerHeader
        description="현재 레이어의 결과 판단과 분리해 수집 상태, 원천 상세, 데이터 정합성을 확인합니다."
        eyebrow="Data"
        meta={activeSummary.title}
        title={`${activeSummary.title} 수집`}
      />

      <div className="collection-detail-grid">
        <CollectionAnalysisPanel summary={activeSummary} />
        <LayerDataContextSection
          activeView={activeView}
          data={data}
          dataQuality={activeQuality}
          validation={validation}
        />
      </div>
    </section>
  );
}

function CollectionAnalysisPanel({ summary }: { summary: CollectionSummary }) {
  return (
    <aside className="collection-analysis-panel dashboard-card" aria-label={`${summary.title} collection analysis`}>
      <PanelHeader eyebrow="Collection Analysis" title="수집 상황 분석" meta={summary.title} />
      <dl>
        <div>
          <dt>상태</dt>
          <dd>{summary.statusLabel}</dd>
        </div>
        <div>
          <dt>완성도</dt>
          <dd>{summary.completeness}</dd>
        </div>
        <div>
          <dt>기준일</dt>
          <dd>{summary.asOf}</dd>
        </div>
        <div>
          <dt>확인 이슈</dt>
          <dd>{summary.issueCount}개</dd>
        </div>
      </dl>
      <div className="collection-analysis-copy">
        <strong>분석 기준</strong>
        <p>{summary.description}</p>
      </div>
      <div className="collection-analysis-copy">
        <strong>우선 확인</strong>
        {summary.issues.length ? (
          <ul>
            {summary.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p>현재 레이어의 수집 상태에서 우선 확인할 차단 이슈는 없습니다.</p>
        )}
      </div>
    </aside>
  );
}

interface CollectionSummary {
  asOf: string;
  completeness: string;
  description: string;
  detail: string;
  issueCount: number;
  issues: string[];
  scope: RadarLayerView;
  statusLabel: string;
  title: string;
}

function buildCollectionSummary(
  scope: RadarLayerView,
  quality: DashboardDataQuality | null,
  data: SectorsResponse,
): CollectionSummary {
  const layerQuality = layerQualityForView(scope, quality, data);
  const layerScope = dataContextScope(scope);
  const completeness =
    layerQuality?.completeness === null || layerQuality?.completeness === undefined
      ? "N/A"
      : `${Math.round(layerQuality.completeness * 100)}%`;
  const issues = (layerQuality?.issues ?? [])
    .filter((issue) => issue.severity !== "info")
    .map((issue) => issue.message);
  return {
    asOf: layerQuality?.as_of ?? "기준일 대기",
    completeness,
    description: layerScope.description,
    detail: `${layerQuality?.as_of ?? "as_of 대기"} · 이슈 ${issues.length}개`,
    issueCount: issues.length,
    issues,
    scope,
    statusLabel: dataQualityStatusLabel(layerQuality?.status),
    title: layerScope.title,
  };
}

function dataQualityStatusLabel(status?: string) {
  if (status === "complete") return "정상";
  if (status === "partial") return "부분";
  if (status === "stale") return "기준일 확인";
  if (status === "blocked") return "차단";
  return "대기";
}
