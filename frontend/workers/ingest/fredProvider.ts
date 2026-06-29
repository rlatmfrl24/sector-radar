import type { ProviderFailure, ProviderSeriesResult, SeriesRow } from "./contracts";
import { FRED_SERIES_IDS } from "./marketContext";

interface FredObservation {
  date?: string;
  value?: string;
}

interface FredResponse {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
}

const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";
const BODY_PREVIEW_LIMIT = 240;

export interface FredProviderOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class FredProvider {
  readonly name = "fred";

  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: FredProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
  }

  async fetchSeries(seriesIds: readonly string[], observationStart: string, fetchedAt: string): Promise<ProviderSeriesResult> {
    if (!this.apiKey) {
      return {
        rows: [],
        failures: seriesIds.map((seriesId) => ({
          symbol: `FRED:${seriesId}`,
          message: "FRED_API_KEY is not configured.",
        })),
      };
    }

    const rows: SeriesRow[] = [];
    const failures: ProviderFailure[] = [];

    for (const seriesId of seriesIds) {
      const result = await this.fetchOne(seriesId, observationStart, fetchedAt);
      rows.push(...result.rows);
      failures.push(...result.failures);
    }

    return { rows, failures };
  }

  async fetchDefaultSeries(observationStart: string, fetchedAt: string): Promise<ProviderSeriesResult> {
    return this.fetchSeries(FRED_SERIES_IDS, observationStart, fetchedAt);
  }

  private async fetchOne(seriesId: string, observationStart: string, fetchedAt: string): Promise<ProviderSeriesResult> {
    const url = new URL(FRED_OBSERVATIONS_URL);
    url.searchParams.set("series_id", seriesId);
    url.searchParams.set("api_key", this.apiKey!);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("observation_start", observationStart);
    url.searchParams.set("sort_order", "asc");

    try {
      const response = await this.fetcher(url.toString(), {
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
        },
      });

      if (!response.ok) {
        return failure(seriesId, `FRED returned HTTP ${response.status}`, {
          body_preview: await readBodyPreview(response),
          status: response.status,
        });
      }

      const payload = (await response.json()) as FredResponse;
      if (payload.error_code) {
        return failure(seriesId, payload.error_message ?? `FRED error ${payload.error_code}`);
      }

      const rows = (payload.observations ?? [])
        .map((observation) => toSeriesRow(seriesId, observation, fetchedAt))
        .filter((row): row is SeriesRow => row !== null);

      if (rows.length === 0) {
        return failure(seriesId, "FRED response had no usable observations.");
      }

      return { rows, failures: [] };
    } catch (error) {
      return failure(seriesId, error instanceof Error ? error.message : "FRED request failed.");
    }
  }
}

function toSeriesRow(seriesId: string, observation: FredObservation, fetchedAt: string): SeriesRow | null {
  const value = Number(observation.value);
  if (!observation.date || !Number.isFinite(value)) return null;
  return {
    series_id: `FRED:${seriesId}`.toUpperCase(),
    date: observation.date,
    field: "value",
    value,
    source: "fred",
    fetched_at: fetchedAt,
  };
}

async function readBodyPreview(response: Response): Promise<string | undefined> {
  const text = await response.text();
  return text.slice(0, BODY_PREVIEW_LIMIT).replace(/\s+/g, " ").trim() || undefined;
}

function failure(
  seriesId: string,
  message: string,
  details: Omit<ProviderFailure, "message" | "symbol"> = {},
): ProviderSeriesResult {
  return { rows: [], failures: [{ symbol: `FRED:${seriesId}`, message, ...details }] };
}
