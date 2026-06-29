import { describe, expect, it, vi } from "vitest";

import type { SeriesRow } from "../contracts";
import { FredProvider } from "../fredProvider";
import { parseKrxOutBlockRows } from "../krxProvider";
import { buildMarketContextFromSeriesRows, marketContextCardsToRows } from "../marketContext";

describe("market context adapters and engine", () => {
  it("prefers official FRED evidence over Yahoo proxy evidence", () => {
    const rows: SeriesRow[] = [
      ...datedScalarSeries("FRED:WALCL", "2026-06-20", [100, 102, 104, 106, 108]),
      ...datedScalarSeries("FRED:DFF", "2026-06-20", [5, 5, 5, 5, 5]),
      ...priceSeries("^IRX", [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121]),
    ];

    const cards = buildMarketContextFromSeriesRows(rows, "2026-06-24T00:00:00+00:00");
    const policy = cards.find((card) => card.code === "S01");

    expect(policy?.source_class).toBe("official");
    expect(policy?.source).toContain("FRED");
    expect(policy?.evidence.WALCL_latest).toBe(108);
  });

  it("serializes market context cards into idempotent D1 rows", () => {
    const cards = buildMarketContextFromSeriesRows(
      scalarSeries("FRED:DEXKOUS", Array.from({ length: 25 }, (_, index) => 1300 + index)),
      "2026-06-24T00:00:00+00:00",
    );

    const rows = marketContextCardsToRows(cards, "US", "2026-06-24T00:00:00+00:00");

    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.context_code === "S02")?.source_class).toBe("official");
    expect(rows.find((row) => row.context_code === "S02")?.evidence_json).toContain("DEXKOUS_latest");
  });

  it("falls back to fresh Yahoo proxy when official FX evidence is stale", () => {
    const rows: SeriesRow[] = [
      ...datedScalarSeries("FRED:DEXKOUS", "2026-05-08", Array.from({ length: 30 }, (_, index) => 1400 + index)),
      ...datedScalarSeries("FRED:DTWEXBGS", "2026-05-08", Array.from({ length: 30 }, (_, index) => 118 + index * 0.01)),
      ...datedPriceSeries("DX-Y.NYB", "2026-05-31", Array.from({ length: 25 }, (_, index) => 100 + index * 0.12)),
      ...datedPriceSeries("KRW=X", "2026-05-31", Array.from({ length: 25 }, (_, index) => 1500 + index * 2)),
    ];

    const cards = buildMarketContextFromSeriesRows(rows, "2026-06-25T00:00:00+00:00");
    const fx = cards.find((card) => card.code === "S02");

    expect(fx).toMatchObject({
      source_class: "proxy",
      availability: "live",
      state: "pressure",
    });
    expect(fx?.data_freshness.latest_date).toBe("2026-06-24");
    expect(fx?.evidence.official_latest_date).toBe("2026-06-06");
    expect(fx?.warnings).toContain("official_source_stale_using_yahoo_proxy");
  });

  it("maps FRED observations into long-format value series rows", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        observations: [
          { date: "2026-06-22", value: "." },
          { date: "2026-06-23", value: "5.25" },
        ],
      }),
    );
    const provider = new FredProvider({ apiKey: "test", fetcher });

    const result = await provider.fetchSeries(["DFF"], "2026-06-01", "2026-06-24T00:00:00+00:00");

    expect(result.failures).toEqual([]);
    expect(result.rows).toEqual([
      {
        series_id: "FRED:DFF",
        date: "2026-06-23",
        field: "value",
        value: 5.25,
        source: "fred",
        fetched_at: "2026-06-24T00:00:00+00:00",
      },
    ]);
  });

  it("parses defensive KRX OutBlock rows into known context series", () => {
    const rows = parseKrxOutBlockRows(
      [
        {
          BAS_DD: "20260624",
          FRGN_NTBY_TRDVAL: "1,200",
          INST_NTBY_TRDVAL: "-300",
          SRTN_TRDVAL: "450",
        },
      ],
      "2026-06-23",
      "2026-06-24T00:00:00+00:00",
    );

    expect(rows.map((row) => row.series_id)).toEqual([
      "KRX:FOREIGN_NET_BUY",
      "KRX:INSTITUTION_NET_BUY",
      "KRX:SHORT_SELLING_VALUE",
    ]);
    expect(rows[0]?.date).toBe("2026-06-24");
    expect(rows[0]?.value).toBe(1200);
  });
});

function scalarSeries(seriesId: string, values: number[]): SeriesRow[] {
  return datedScalarSeries(seriesId, "2026-06-01", values);
}

function datedScalarSeries(seriesId: string, startDate: string, values: number[]): SeriesRow[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  return values.map((value, index) => ({
    series_id: seriesId,
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    field: "value",
    value,
    source: "fixture",
    fetched_at: "2026-06-24T00:00:00+00:00",
  }));
}

function priceSeries(seriesId: string, closes: number[]): SeriesRow[] {
  return datedPriceSeries(seriesId, "2026-06-01", closes);
}

function datedPriceSeries(seriesId: string, startDate: string, closes: number[]): SeriesRow[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  return closes.map((value, index) => ({
    series_id: seriesId,
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    field: "close",
    value,
    source: "fixture",
    fetched_at: "2026-06-24T00:00:00+00:00",
  }));
}
