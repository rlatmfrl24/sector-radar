import { describe, expect, it } from "vitest";

import { normalizeNextAllowedAt } from "./dataConnection";

describe("data connection schedule normalization", () => {
  it("preserves a stored future next collection time", () => {
    const next = normalizeNextAllowedAt(
      {
        provider: "yahoo_finance",
        status: "success",
        last_attempt_at: null,
        last_success_at: null,
        next_allowed_at: "2026-06-29T20:30:00+00:00",
        latest_price_date: null,
        symbol_count: 0,
        rows_upserted: 0,
        message: null,
      },
      "yahoo_finance",
      new Date("2026-06-29T01:40:00Z"),
    );

    expect(next).toBe("2026-06-29T20:30:00+00:00");
  });

  it("replaces stale provider gates with the next real collection window", () => {
    const staleRow = {
      provider: "yahoo_finance",
      status: "success",
      last_attempt_at: null,
      last_success_at: null,
      next_allowed_at: "2026-06-27T07:15:55+00:00",
      latest_price_date: null,
      symbol_count: 0,
      rows_upserted: 0,
      message: null,
    };
    const now = new Date("2026-06-29T01:40:00Z");

    expect(normalizeNextAllowedAt(staleRow, "yahoo_finance", now)).toBe("2026-06-29T20:30:00+00:00");
    expect(normalizeNextAllowedAt(staleRow, "fred", now)).toBe("2026-06-29T20:45:00+00:00");
    expect(normalizeNextAllowedAt(staleRow, "krx_openapi", new Date("2026-06-29T01:00:00Z"))).toBe(
      "2026-06-29T23:30:00+00:00",
    );
  });
});
