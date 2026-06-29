import type {
  DataRefreshStatusRow,
  InstrumentRow,
  MarketContextRow,
  RefreshStore,
  RunLogRow,
  SectorMetricRow,
  SeriesRow,
} from "./contracts";

const STATEMENT_CHUNK_SIZE = 80;
const SYMBOL_QUERY_CHUNK_SIZE = 80;

interface D1SeriesRow {
  series_id: string;
  date: string;
  field: SeriesRow["field"];
  value: number;
  source: string;
  fetched_at: string;
}

interface D1MarketContextRow {
  market: string;
  context_code: string;
  date: string;
  state: string;
  transition: string;
  availability: MarketContextRow["availability"];
  source_class: MarketContextRow["source_class"];
  title: string;
  source: string;
  meaning: string;
  evidence_json: string;
  warnings_json: string;
  data_freshness_json: string;
  computed_at: string;
}

export class D1RefreshStore implements RefreshStore {
  constructor(private readonly db: D1Database) {}

  async readStatus(provider: string): Promise<DataRefreshStatusRow | null> {
    const row = await this.db
      .prepare("SELECT * FROM data_refresh_status WHERE provider = ?")
      .bind(provider)
      .first<DataRefreshStatusRow>();
    return row ?? null;
  }

  async readStatuses(providers: string[]): Promise<DataRefreshStatusRow[]> {
    if (providers.length === 0) return [];
    const placeholders = providers.map(() => "?").join(", ");
    const rows = await this.db
      .prepare(`SELECT * FROM data_refresh_status WHERE provider IN (${placeholders})`)
      .bind(...providers)
      .all<DataRefreshStatusRow>();
    return rows.results ?? [];
  }

  async upsertStatus(row: DataRefreshStatusRow): Promise<void> {
    await this.db
      .prepare(
        `
          INSERT INTO data_refresh_status (
            provider, status, last_attempt_at, last_success_at, next_allowed_at,
            latest_price_date, symbol_count, rows_upserted, message
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(provider) DO UPDATE SET
            status = excluded.status,
            last_attempt_at = excluded.last_attempt_at,
            last_success_at = excluded.last_success_at,
            next_allowed_at = excluded.next_allowed_at,
            latest_price_date = excluded.latest_price_date,
            symbol_count = excluded.symbol_count,
            rows_upserted = excluded.rows_upserted,
            message = excluded.message
        `,
      )
      .bind(
        row.provider,
        row.status,
        row.last_attempt_at ?? null,
        row.last_success_at ?? null,
        row.next_allowed_at ?? null,
        row.latest_price_date ?? null,
        row.symbol_count,
        row.rows_upserted,
        row.message ?? null,
      )
      .run();
  }

  async upsertRunLog(row: RunLogRow): Promise<void> {
    await this.db
      .prepare(
        `
          INSERT INTO run_log (run_id, run_type, started_at, finished_at, status, message)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(run_id) DO UPDATE SET
            run_type = excluded.run_type,
            started_at = excluded.started_at,
            finished_at = excluded.finished_at,
            status = excluded.status,
            message = excluded.message
        `,
      )
      .bind(
        row.run_id,
        row.run_type,
        row.started_at,
        row.finished_at ?? null,
        row.status,
        row.message ?? null,
      )
      .run();
  }

  async upsertInstruments(rows: InstrumentRow[]): Promise<void> {
    await this.runInChunks(
      rows.map((row) =>
        this.db
          .prepare(
            `
              INSERT INTO instrument_master (
                instrument_id, symbol, name, asset_type, market, sector_code, is_active
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(instrument_id) DO UPDATE SET
                symbol = excluded.symbol,
                name = excluded.name,
                asset_type = excluded.asset_type,
                market = excluded.market,
                sector_code = excluded.sector_code,
                is_active = excluded.is_active
            `,
          )
          .bind(
            row.instrument_id,
            row.symbol,
            row.name,
            row.asset_type,
            row.market,
            row.sector_code,
            row.is_active,
          ),
      ),
    );
  }

  async upsertSeries(rows: SeriesRow[]): Promise<number> {
    await this.runInChunks(
      rows.map((row) =>
        this.db
          .prepare(
            `
              INSERT INTO series_daily (series_id, date, field, value, source, fetched_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(series_id, date, field) DO UPDATE SET
                value = excluded.value,
                source = excluded.source,
                fetched_at = excluded.fetched_at
            `,
          )
          .bind(row.series_id, row.date, row.field, row.value, row.source, row.fetched_at),
      ),
    );
    return rows.length;
  }

  async readSeries(symbols: string[], startDate: string): Promise<SeriesRow[]> {
    const uniqueSymbols = [...new Set(symbols)];
    const rows: SeriesRow[] = [];

    for (let index = 0; index < uniqueSymbols.length; index += SYMBOL_QUERY_CHUNK_SIZE) {
      const chunk = uniqueSymbols.slice(index, index + SYMBOL_QUERY_CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(", ");
      const result = await this.db
        .prepare(
          `
            SELECT series_id, date, field, value, source, fetched_at
            FROM series_daily
            WHERE date >= ?
              AND series_id IN (${placeholders})
            ORDER BY series_id, date, field
          `,
        )
        .bind(startDate, ...chunk)
        .all<D1SeriesRow>();

      for (const row of result.results ?? []) {
        rows.push(row);
      }
    }

    return rows;
  }

  async upsertSectorMetrics(rows: SectorMetricRow[]): Promise<void> {
    await this.runInChunks(
      rows.map((row) =>
        this.db
          .prepare(
            `
              INSERT INTO sector_metrics_daily (
                market, sector_code, date, benchmark, ret_1m, ret_3m, ret_6m, ret_12m,
                excess_ret_3m, rs_ratio, rs_momentum, rrg_quadrant, pct_above_20ma,
                pct_above_50ma, pct_above_200ma, breadth_state, breadth_transition,
                rvol_20, obv_slope_20, cmf_20, participation_state, participation_transition,
                catalyst_state, catalyst_transition, rule_pattern, direction, strength,
                conviction_label, narrative, risks_json, invalidation_json, source_metrics_json,
                data_freshness_json, validation_status, expose_probability, computed_at
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
              )
              ON CONFLICT(market, sector_code, date, benchmark) DO UPDATE SET
                ret_1m = excluded.ret_1m,
                ret_3m = excluded.ret_3m,
                ret_6m = excluded.ret_6m,
                ret_12m = excluded.ret_12m,
                excess_ret_3m = excluded.excess_ret_3m,
                rs_ratio = excluded.rs_ratio,
                rs_momentum = excluded.rs_momentum,
                rrg_quadrant = excluded.rrg_quadrant,
                pct_above_20ma = excluded.pct_above_20ma,
                pct_above_50ma = excluded.pct_above_50ma,
                pct_above_200ma = excluded.pct_above_200ma,
                breadth_state = excluded.breadth_state,
                breadth_transition = excluded.breadth_transition,
                rvol_20 = excluded.rvol_20,
                obv_slope_20 = excluded.obv_slope_20,
                cmf_20 = excluded.cmf_20,
                participation_state = excluded.participation_state,
                participation_transition = excluded.participation_transition,
                catalyst_state = excluded.catalyst_state,
                catalyst_transition = excluded.catalyst_transition,
                rule_pattern = excluded.rule_pattern,
                direction = excluded.direction,
                strength = excluded.strength,
                conviction_label = excluded.conviction_label,
                narrative = excluded.narrative,
                risks_json = excluded.risks_json,
                invalidation_json = excluded.invalidation_json,
                source_metrics_json = excluded.source_metrics_json,
                data_freshness_json = excluded.data_freshness_json,
                validation_status = excluded.validation_status,
                expose_probability = excluded.expose_probability,
                computed_at = excluded.computed_at
            `,
          )
          .bind(
            row.market,
            row.sector_code,
            row.date,
            row.benchmark,
            row.ret_1m,
            row.ret_3m,
            row.ret_6m,
            row.ret_12m,
            row.excess_ret_3m,
            row.rs_ratio,
            row.rs_momentum,
            row.rrg_quadrant,
            row.pct_above_20ma,
            row.pct_above_50ma,
            row.pct_above_200ma,
            row.breadth_state,
            row.breadth_transition,
            row.rvol_20,
            row.obv_slope_20,
            row.cmf_20,
            row.participation_state,
            row.participation_transition,
            row.catalyst_state,
            row.catalyst_transition,
            row.rule_pattern,
            row.direction,
            row.strength,
            row.conviction_label,
            row.narrative,
            row.risks_json,
            row.invalidation_json,
            row.source_metrics_json,
            row.data_freshness_json,
            row.validation_status,
            row.expose_probability,
            row.computed_at,
          ),
      ),
    );
  }

  async upsertMarketContext(rows: MarketContextRow[]): Promise<void> {
    await this.runInChunks(
      rows.map((row) =>
        this.db
          .prepare(
            `
              INSERT INTO market_context_daily (
                market, context_code, date, state, transition, availability, source_class,
                title, source, meaning, evidence_json, warnings_json, data_freshness_json, computed_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(market, context_code, date) DO UPDATE SET
                state = excluded.state,
                transition = excluded.transition,
                availability = excluded.availability,
                source_class = excluded.source_class,
                title = excluded.title,
                source = excluded.source,
                meaning = excluded.meaning,
                evidence_json = excluded.evidence_json,
                warnings_json = excluded.warnings_json,
                data_freshness_json = excluded.data_freshness_json,
                computed_at = excluded.computed_at
            `,
          )
          .bind(
            row.market,
            row.context_code,
            row.date,
            row.state,
            row.transition,
            row.availability,
            row.source_class,
            row.title,
            row.source,
            row.meaning,
            row.evidence_json,
            row.warnings_json,
            row.data_freshness_json,
            row.computed_at,
          ),
      ),
    );
  }

  async readLatestMarketContext(market: string): Promise<MarketContextRow[]> {
    const result = await this.db
      .prepare(
        `
          SELECT context.*
          FROM market_context_daily context
          INNER JOIN (
            SELECT context_code, MAX(date) AS latest_date
            FROM market_context_daily
            WHERE market = ?
            GROUP BY context_code
          ) latest
            ON latest.context_code = context.context_code
           AND latest.latest_date = context.date
          WHERE context.market = ?
          ORDER BY context.context_code
        `,
      )
      .bind(market, market)
      .all<D1MarketContextRow>();

    return (result.results ?? []).map((row) => ({
      market: row.market,
      context_code: row.context_code,
      date: row.date,
      state: row.state,
      transition: row.transition,
      availability: row.availability,
      source_class: row.source_class,
      title: row.title,
      source: row.source,
      meaning: row.meaning,
      evidence_json: row.evidence_json,
      warnings_json: row.warnings_json,
      data_freshness_json: row.data_freshness_json,
      computed_at: row.computed_at,
    }));
  }

  private async runInChunks(statements: D1PreparedStatement[]): Promise<void> {
    for (let index = 0; index < statements.length; index += STATEMENT_CHUNK_SIZE) {
      const chunk = statements.slice(index, index + STATEMENT_CHUNK_SIZE);
      if (chunk.length > 0) {
        await this.db.batch(chunk);
      }
    }
  }
}
