export interface LayerOneFlowThresholds {
  cautionReturn1m: number;
  constructiveRange52w: number;
  elevatedVix: number;
  healthyBreadthRatio: number;
  weakeningVixChange5d: number;
}

export const DEFAULT_LAYER_ONE_FLOW_THRESHOLDS: LayerOneFlowThresholds = {
  cautionReturn1m: -0.03,
  constructiveRange52w: 55,
  elevatedVix: 25,
  healthyBreadthRatio: 0.5,
  weakeningVixChange5d: 1.5,
};

export function resolveLayerOneFlowThresholds(
  overrides: Partial<LayerOneFlowThresholds> | undefined,
): LayerOneFlowThresholds {
  if (!overrides) return DEFAULT_LAYER_ONE_FLOW_THRESHOLDS;
  return {
    ...DEFAULT_LAYER_ONE_FLOW_THRESHOLDS,
    ...finiteEntries(overrides),
  };
}

function finiteEntries(values: Partial<LayerOneFlowThresholds>): Partial<LayerOneFlowThresholds> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
  ) as Partial<LayerOneFlowThresholds>;
}
