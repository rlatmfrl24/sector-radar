import type { DashboardDataQuality, LayerDataQualitySummary, SectorsResponse, ValidationResponse } from "../../../types";
import type { RadarLayerView } from "../model";
import { DataQualityStrip } from "./common";
import { ContextRail, FreshnessBar } from "./FreshnessBar";

export function LayerDataContextSection({
  activeView,
  data,
  dataQuality,
  validation,
}: {
  activeView: RadarLayerView;
  data: SectorsResponse;
  dataQuality?: LayerDataQualitySummary;
  validation?: ValidationResponse | null;
}) {
  const scope = dataContextScope(activeView);

  return (
    <section className="layer-data-context-section dashboard-card" aria-label={`${scope.title} 레이어 수집 데이터`}>
      <header className="layer-data-context-head">
        <div>
          <span>레이어 수집 데이터</span>
          <strong>{scope.title}</strong>
        </div>
        <small>{scope.description}</small>
      </header>

      <div className="layer-data-context-block source-block">
        <span>수집원 요약 / 상세</span>
        <FreshnessBar activeView={activeView} data={data} embedded initialExpanded />
      </div>

      <div className="layer-data-context-block rail-block">
        <span>레이어 상태</span>
        <ContextRail activeView={activeView} data={data} embedded validation={validation} />
      </div>

      <div className="layer-data-context-block quality-block">
        <span>데이터 정합성</span>
        <DataQualityStrip compact quality={dataQuality} />
      </div>
    </section>
  );
}

export function layerQualityForView(
  activeView: RadarLayerView,
  quality: DashboardDataQuality | null,
  data: SectorsResponse,
) {
  if (activeView === "layer2") return quality?.layers.layer2 ?? data.data_quality?.layers.layer2;
  if (activeView === "leadership") return quality?.layers.layer3 ?? data.data_quality?.layers.layer3;
  if (activeView === "validation") return quality?.layers.layer4;
  return quality?.layers.layer1 ?? data.data_quality?.layers.layer1;
}

export function dataContextScope(activeView: RadarLayerView) {
  if (activeView === "layer2") {
    return {
      description: "FRED 공식 컨텍스트, ETF participation, risk trigger 원천을 한 곳에 묶습니다.",
      title: "Layer 2 여력",
    };
  }
  if (activeView === "leadership") {
    return {
      description: "섹터 snapshot, RS/RRG, 리더십 reconciliation 기준을 한 곳에 묶습니다.",
      title: "Layer 3 리더십",
    };
  }
  if (activeView === "validation") {
    return {
      description: "sector history, validation API, replay coverage 기준을 한 곳에 묶습니다.",
      title: "Layer 4 검증",
    };
  }
  return {
    description: "시장 tape, breadth helper, volatility 입력과 Layer 1 판단 근거를 한 곳에 묶습니다.",
    title: "Layer 1 흐름",
  };
}
