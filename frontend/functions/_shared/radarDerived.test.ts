import { describe, expect, it } from "vitest";

import {
  buildContextReconciliation,
  buildRadarDerived,
  buildSourceFreshness,
  buildTriggerWatchlist,
  type ConcentrationLike,
  type DataConnectionLike,
  type MarketContextLike,
  type RadarDerivedInput,
  type SectorLike,
} from "./radarDerived";

const now = new Date("2026-06-25T00:00:00Z");

describe("radar derived API fields", () => {
  it("marks FRED daily rows stale after the daily freshness window", () => {
    const input = baseInput({
      marketContext: [
        context({
          code: "S03",
          data_freshness: { latest_date: "2026-06-18" },
          source: "FRED: BAMLH0A0HYM2, VIXCLS",
          source_class: "official",
        }),
      ],
    });

    const freshness = buildSourceFreshness(input);
    expect(freshness.find((item) => item.id === "context:S03")).toMatchObject({
      provider: "fred",
      status: "stale",
      stale: true,
    });
  });

  it("does not mark daily FRED rows stale just because a weekend passed", () => {
    const input = baseInput({
      marketContext: [
        context({
          code: "S03",
          data_freshness: { latest_date: "2026-06-22" },
          source: "FRED: BAMLH0A0HYM2, VIXCLS",
          source_class: "official",
        }),
      ],
      now: new Date("2026-06-25T00:00:00Z"),
    });

    const freshness = buildSourceFreshness(input);
    expect(freshness.find((item) => item.id === "context:S03")).toMatchObject({
      provider: "fred",
      status: "live",
      stale: false,
    });
  });

  it("keeps a fresh provider row live while a new collection is still running", () => {
    const input = baseInput({
      dataConnection: {
        ...connection("yahoo_finance", "2026-06-24"),
        status: "refreshing",
        last_success_at: "2026-06-24T20:30:00+00:00",
      },
      now: new Date("2026-06-25T00:00:00Z"),
    });

    const freshness = buildSourceFreshness(input);
    expect(freshness.find((item) => item.id === "provider:yahoo_finance")).toMatchObject({
      status: "live",
      stale: false,
    });
  });

  it("does not surface KRX provider rows when no active context uses KRX", () => {
    const derived = buildRadarDerived(baseInput());

    expect(derived.source_freshness.find((item) => item.id === "provider:krx_openapi")).toBeUndefined();
    expect(derived.source_freshness.find((item) => item.id === "context:S04")).toBeUndefined();
    expect(derived.watchlist.find((item) => item.id === "krx_foreign_flow")).toBeUndefined();
  });

  it("does not treat a neutral weakening supplemental input as a risk pressure context", () => {
    const input = baseInput({
      marketContext: [
        context({ code: "S01", state: "neutral", transition: "stable", source_class: "official" }),
        context({ code: "S02", state: "neutral", transition: "stable", source_class: "official" }),
        context({ code: "S03", state: "neutral", transition: "stable", source_class: "official" }),
        context({
          code: "S05",
          state: "neutral",
          transition: "weakening",
          source_class: "proxy",
          warnings: ["proxy_only"],
        }),
      ],
      sectors: [
        sector({ code: "SMH", quadrant: "leading", breadthState: "healthy", rsRatio: 106 }),
        sector({ code: "XLI", quadrant: "improving", breadthState: "healthy", rsRatio: 99 }),
        sector({ code: "XLE", quadrant: "lagging", breadthState: "mixed", rsRatio: 94 }),
      ],
    });

    const reconciliation = buildContextReconciliation(input, buildTriggerWatchlist(input));

    expect(reconciliation.evidence.pressure_contexts).toBeNull();
    expect(reconciliation.warnings).not.toContain("S05");
    expect(reconciliation.state).toBe("supportive");
  });

  it("labels official context freshness with direct FRED series ids", () => {
    const input = baseInput({
      marketContext: [
        context({
          code: "S02",
          source_class: "official",
          source: "FRED: DEXKOUS, DTWEXBGS",
          data_freshness: { latest_date: "2026-06-24" },
        }),
        context({
          code: "S05",
          source_class: "official",
          source: "FRED: WRESBAL",
          data_freshness: { latest_date: "2026-06-24" },
        }),
      ],
    });

    const freshness = buildSourceFreshness(input);

    expect(freshness.find((item) => item.id === "context:S02")).toMatchObject({
      provider: "fred",
      series_id: "FRED:DEXKOUS",
      source_class: "official",
    });
    expect(freshness.find((item) => item.id === "context:S05")).toMatchObject({
      provider: "fred",
      series_id: "FRED:WRESBAL",
      source_class: "official",
    });
  });

  it("publishes Layer 1 and Layer 2 source expansion roadmap", () => {
    const derived = buildRadarDerived(baseInput());

    expect(derived.source_expansion.find((item) => item.id === "l1_market_tape")).toMatchObject({
      layer: "layer1",
      status: "active",
      source_kind: "price",
    });
    expect(derived.source_expansion.find((item) => item.id === "l2_policy")).toMatchObject({
      layer: "layer2",
      provider: "fred",
      status: "active",
      source_kind: "official",
    });
    expect(derived.source_expansion.find((item) => item.id === "l2_treasury_dts")).toMatchObject({
      layer: "layer2",
      provider: "treasury_fiscaldata",
      status: "candidate",
    });
    expect(derived.source_expansion.find((item) => item.id === "l2_krx_flow")).toMatchObject({
      status: "deferred",
    });
  });

  it("fires credit and FX pressure triggers", () => {
    const input = baseInput({
      marketContext: [
        context({ code: "S02", state: "pressure", transition: "weakening", source_class: "official" }),
        context({ code: "S03", state: "pressure", transition: "weakening", source_class: "official" }),
      ],
    });

    const watchlist = buildTriggerWatchlist(input);
    expect(watchlist.find((item) => item.id === "fx_dollar_gate")?.status).toBe("fired");
    expect(watchlist.find((item) => item.id === "credit_volatility")?.status).toBe("fired");
  });

  it("fires breadth narrowing when a leading sector has weak breadth", () => {
    const input = baseInput({
      sectors: [
        sector({ code: "SMH", quadrant: "leading", breadthState: "narrow", rsRatio: 106 }),
        sector({ code: "XLK", quadrant: "lagging", breadthState: "healthy", rsRatio: 97 }),
      ],
    });

    const watchlist = buildTriggerWatchlist(input);
    expect(watchlist.find((item) => item.id === "leader_breadth_narrowing")).toMatchObject({
      status: "fired",
      evidence: { count: 1, sectors: "SMH" },
    });
  });

  it("classifies constructive leadership plus pressure context as divergent", () => {
    const input = baseInput({
      marketContext: [
        context({ code: "S01", state: "neutral", source_class: "official" }),
        context({ code: "S02", state: "pressure", transition: "weakening", source_class: "official" }),
        context({ code: "S03", state: "neutral", source_class: "official" }),
      ],
      sectors: [
        sector({ code: "SMH", quadrant: "leading", breadthState: "healthy", rsRatio: 106 }),
        sector({ code: "XLI", quadrant: "improving", breadthState: "healthy", rsRatio: 99 }),
        sector({ code: "XLE", quadrant: "lagging", breadthState: "breakdown", rsRatio: 94 }),
      ],
    });

    const reconciliation = buildContextReconciliation(input, buildTriggerWatchlist(input));
    expect(reconciliation.state).toBe("divergent");
    expect(reconciliation.transition).toBe("weakening");
  });

  it("classifies supportive context with weak leadership as rotation watch", () => {
    const input = baseInput({
      marketContext: [
        context({ code: "S01", state: "supportive", source_class: "official" }),
        context({ code: "S02", state: "supportive", source_class: "official" }),
        context({ code: "S03", state: "neutral", source_class: "official" }),
      ],
      sectors: [
        sector({ code: "XLU", quadrant: "lagging", breadthState: "breakdown", rsRatio: 94 }),
        sector({ code: "XLE", quadrant: "lagging", breadthState: "breakdown", rsRatio: 95 }),
        sector({ code: "XLP", quadrant: "weakening", breadthState: "mixed", rsRatio: 101 }),
      ],
    });

    const reconciliation = buildContextReconciliation(input, buildTriggerWatchlist(input));
    expect(reconciliation.state).toBe("rotation_watch");
    expect(reconciliation.transition).toBe("strengthening");
  });
});

function baseInput(overrides: Partial<RadarDerivedInput> = {}): RadarDerivedInput {
  return {
    asOf: "2026-06-24",
    concentration: concentration(),
    dataConnection: connection("yahoo_finance", "2026-06-24"),
    dataConnections: {
      yahoo_finance: connection("yahoo_finance", "2026-06-24"),
      fred: connection("fred", "2026-06-24", 720),
      krx_openapi: connection("krx_openapi", "2026-06-24", 1440),
    },
    marketContext: [
      context({ code: "S01", state: "neutral", source_class: "official" }),
      context({ code: "S02", state: "neutral", source_class: "official" }),
      context({ code: "S03", state: "neutral", source_class: "official" }),
    ],
    now,
    sectors: [
      sector({ code: "SMH", quadrant: "leading", breadthState: "healthy", rsRatio: 106 }),
      sector({ code: "XLI", quadrant: "improving", breadthState: "healthy", rsRatio: 99 }),
      sector({ code: "XLE", quadrant: "lagging", breadthState: "breakdown", rsRatio: 94 }),
    ],
    ...overrides,
  };
}

function connection(provider: string, latest_price_date: string, refresh_interval_minutes = 15): DataConnectionLike {
  return {
    provider,
    mode: "live",
    status: "success",
    refresh_interval_minutes,
    latest_price_date,
    last_success_at: `${latest_price_date}T22:00:00Z`,
  };
}

function context(overrides: Partial<MarketContextLike> = {}): MarketContextLike {
  return {
    availability: "live",
    code: "S01",
    data_freshness: { latest_date: "2026-06-24" },
    evidence: { latest_date: "2026-06-24" },
    meaning: "test context",
    source: "FRED: test",
    source_class: "official",
    state: "neutral",
    title: "Test context",
    transition: "stable",
    warnings: [],
    ...overrides,
  };
}

function sector({
  breadthState,
  code,
  quadrant,
  rsRatio,
}: {
  breadthState: string;
  code: string;
  quadrant: string;
  rsRatio: number;
}): SectorLike {
  return {
    sector_code: code,
    sector_name: code,
    quadrant,
    modules: {
      breadth: { state: breadthState, transition: "stable", warnings: [] },
      participation: { state: "confirmed", transition: "stable", warnings: [] },
      relative_strength: { evidence: { rs_ratio: rsRatio } },
    },
    rulebook: {
      lead_pattern: quadrant === "leading" ? "Strong Leader" : "Neutral",
      strength: quadrant === "leading" ? 4 : 2,
    },
  };
}

function concentration(overrides: Partial<ConcentrationLike> = {}): ConcentrationLike {
  return {
    effective_sector_count: 3,
    hhi: 0.33,
    method: "rs_leadership_estimate",
    source_class: "proxy",
    top1: "SMH",
    top1_contribution: 0.45,
    top3_contribution: 0.72,
    warnings: ["market_cap_contribution_not_available"],
    ...overrides,
  };
}
