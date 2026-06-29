export const EXPLAIN_MODE_STORAGE_KEY = "sector-radar:explain-mode";

interface ExplainModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readExplainModePreference(storage = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(EXPLAIN_MODE_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeExplainModePreference(enabled: boolean, storage = browserStorage()) {
  if (!storage) return;
  try {
    storage.setItem(EXPLAIN_MODE_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private browsing or locked storage should not break the dashboard.
  }
}

function browserStorage(): ExplainModeStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
