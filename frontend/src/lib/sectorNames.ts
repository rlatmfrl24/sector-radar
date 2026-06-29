const SECTOR_NAMES: Record<string, string> = {
  SMH: "Semiconductors",
  XLB: "Materials",
  XLC: "Communication Services",
  XLE: "Energy",
  XLF: "Financials",
  XLI: "Industrials",
  XLK: "Technology",
  XLP: "Consumer Staples",
  XLRE: "Real Estate",
  XLU: "Utilities",
  XLV: "Health Care",
  XLY: "Consumer Discretionary",
};

export function sectorDisplayName(sectorCode: string) {
  const normalized = sectorCode.trim().toUpperCase();
  return SECTOR_NAMES[normalized] ?? sectorCode;
}

export function normalizeSectorName(sectorCode: string, sectorName?: string | null) {
  const normalizedCode = sectorCode.trim().toUpperCase();
  const normalizedName = sectorName?.trim();
  if (!normalizedName || normalizedName.toUpperCase() === normalizedCode) {
    return sectorDisplayName(sectorCode);
  }
  return normalizedName;
}
