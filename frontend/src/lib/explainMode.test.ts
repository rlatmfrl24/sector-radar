import { describe, expect, it } from "vitest";

import { EXPLAIN_MODE_STORAGE_KEY, readExplainModePreference, writeExplainModePreference } from "./explainMode";

function memoryStorage(seed?: string) {
  const values = new Map<string, string>();
  if (seed !== undefined) values.set(EXPLAIN_MODE_STORAGE_KEY, seed);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("explain mode preference", () => {
  it("reads only the explicit on value as enabled", () => {
    expect(readExplainModePreference(memoryStorage("on"))).toBe(true);
    expect(readExplainModePreference(memoryStorage("off"))).toBe(false);
    expect(readExplainModePreference(memoryStorage())).toBe(false);
  });

  it("persists on and off states without requiring browser storage in tests", () => {
    const storage = memoryStorage();

    writeExplainModePreference(true, storage);
    expect(storage.values.get(EXPLAIN_MODE_STORAGE_KEY)).toBe("on");

    writeExplainModePreference(false, storage);
    expect(storage.values.get(EXPLAIN_MODE_STORAGE_KEY)).toBe("off");
  });
});
