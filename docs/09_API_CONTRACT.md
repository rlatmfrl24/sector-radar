# 09. API / JSON Contract

## 1. 목적

초기 MVP UI는 React가 API/JSON 계약만 읽도록 구성합니다. 로컬 연구 엔진은 SQLite를 사용할 수 있고, 배포 표면은 Cloudflare Pages Function이 D1에서 같은 계약을 제공합니다.

## 2. Sector Snapshot

구현 helper:

```text
sector_radar.snapshot.build_sector_snapshot(...)
sector_radar.pipeline.build_relative_strength_snapshot_from_db(...)
```

현재 Cloudflare Scheduled Worker 경로는 RS/RRG, breadth, participation, rulebook, Layer 1 flow, Layer 2 market context를 D1에 저장합니다. 로컬 fixture나 초기 DB에서는 Breadth/Participation이 아직 충분하지 않아 `unknown` module state로 표시될 수 있습니다.

```json
{
  "as_of": "2026-06-23",
  "benchmark": "SPY",
  "sector_code": "SMH",
  "sector_name": "Semiconductors",
  "quadrant": "leading",
  "rank": {
    "rs_rank": 1,
    "momentum_rank": 2,
    "breadth_rank": 3
  },
  "modules": {
    "relative_strength": {
      "state": "strong",
      "transition": "strengthening",
      "strength": 3,
      "evidence": {
        "rs_ratio": 104.2,
        "rs_momentum": 101.8,
        "excess_ret_3m": 0.082
      },
      "warnings": []
    },
    "breadth": {
      "state": "healthy",
      "transition": "strengthening",
      "strength": 3,
      "evidence": {
        "pct_above_20ma": 0.78,
        "pct_above_50ma": 0.69,
        "pct_above_200ma": 0.61
      },
      "warnings": []
    },
    "participation": {
      "state": "confirmed",
      "transition": "stable",
      "strength": 2,
      "evidence": {
        "rvol_20": 1.17,
        "obv_slope_20": 1234567.0,
        "cmf_20": 0.08
      },
      "warnings": []
    }
  },
  "rulebook": {
    "lead_pattern": "Strong Leader",
    "direction": "strong_up",
    "strength": 4,
    "conviction_label": "high",
    "narrative": "...",
    "risks": ["Momentum 둔화", "Breadth 악화"],
    "invalidation": ["RS Momentum 2주 연속 100 하회"],
    "source_metrics": {
      "market_context": [
        {
          "code": "S02",
          "title": "달러·FX 게이트",
          "availability": "live",
          "state": "neutral",
          "transition": "stable",
          "source": "FRED: DEXKOUS, DTWEXBGS",
          "evidence": {
            "DEXKOUS_ret_21obs": -0.01,
            "DTWEXBGS_ret_21obs": 0.004
          },
          "warnings": []
        }
      ]
    },
    "data_freshness": {}
  },
  "validation": {
    "status": "unvalidated",
    "expose_probability": false
  },
  "data_freshness": {
    "latest_price_date": "2026-06-22",
    "computed_at": "2026-06-23T08:30:00+09:00"
  }
}
```

## 3. Data Connection

`GET /api/sectors`는 sector snapshot과 함께 현재 데이터 연결 상태를 반환합니다. `data_connection`은 기존 Yahoo 호환 필드로 유지하고, 신규 UI는 provider별 `data_connections`와 top-level `market_context`를 우선 사용합니다.

```json
{
  "source": "local_sqlite",
  "data_connection": {
    "provider": "yahoo_finance",
    "mode": "live",
    "status": "success",
    "refresh_interval_minutes": 15,
    "last_attempt_at": "2026-06-23T00:00:00+00:00",
    "last_success_at": "2026-06-23T00:00:00+00:00",
    "next_allowed_at": "2026-06-23T00:15:00+00:00",
    "latest_price_date": "2026-06-22",
    "symbol_count": 135,
    "rows_upserted": 54000,
    "manual_refresh_available": false,
    "message": "Yahoo Finance research refresh completed."
  }
}
```

Provider별 상태:

```json
{
  "data_connections": {
    "yahoo_finance": {
      "provider": "yahoo_finance",
      "mode": "live",
      "status": "success",
      "refresh_interval_minutes": 15,
      "latest_price_date": "2026-06-22",
      "manual_refresh_available": false
    },
    "fred": {
      "provider": "fred",
      "mode": "stale",
      "status": "never_run",
      "refresh_interval_minutes": 720,
      "manual_refresh_available": false
    },
    "krx_openapi": {
      "provider": "krx_openapi",
      "mode": "stale",
      "status": "never_run",
      "refresh_interval_minutes": 1440,
      "manual_refresh_available": false
    }
  }
}
```

Layer 2 market context는 top-level로 제공됩니다. 현재 활성 US Sector Radar 컨텍스트는 직접 수집 가능한 FRED official 원천만 표시하며, 과거 Yahoo/KRX proxy 행은 active Layer 2 응답에서 제외합니다.

```json
{
  "market_context": [
    {
      "code": "S03",
      "title": "글로벌 신용환경",
      "availability": "live",
      "source_class": "official",
      "state": "neutral",
      "transition": "stable",
      "source": "FRED: BAMLH0A0HYM2, VIXCLS",
      "meaning": "스프레드와 변동성 레짐 확인",
      "evidence": {
        "HY_OAS_latest": 3.18,
        "VIXCLS_latest": 16.4,
        "latest_date": "2026-06-22"
      },
      "warnings": [],
      "data_freshness": {
        "provider": "fred",
        "source_class": "official",
        "latest_date": "2026-06-22"
      }
    }
  ]
}
```

Benchmark 흡수 기능은 같은 `/api/sectors` 응답에 파생 필드로 제공됩니다. 이 필드들은 별도 DB migration 없이 `data_refresh_status`, `market_context_daily`, 최신 sector snapshot에서 계산됩니다.

```json
{
  "layer1_flow": {
    "as_of": "2026-06-23",
    "state": "constructive",
    "transition": "stable",
    "narrative": "시장 tape는 우호적이고 breadth가 넓게 받쳐줍니다. VIX 16.4 기준으로 변동성 상태를 함께 봅니다.",
    "tape": {
      "benchmark": "SPY",
      "latest_close": 622.14,
      "latest_date": "2026-06-23",
      "ret_1d": 0.006,
      "ret_1w": 0.014,
      "ret_1m": 0.032,
      "ret_3m": 0.071,
      "range_52w_position": 82.5,
      "realized_vol_20": 12.8
    },
    "risk": {
      "state": "calm",
      "transition": "stable",
      "vix_latest": 16.4,
      "vix_change_5d": -0.8,
      "realized_vol_20": 12.8
    },
    "breadth_quality": {
      "state": "mixed",
      "transition": "stable",
      "healthy_sectors": 4,
      "weak_sectors": 4,
      "total_sectors": 12,
      "rsp_vs_spy_1m": -0.006,
      "iwm_vs_spy_1m": -0.012,
      "qqq_vs_spy_1m": 0.018,
      "holding_coverage_fresh": 80,
      "holding_coverage_total": 120
    },
    "warnings": ["supplemental_inputs_not_official_breadth"],
    "data_freshness": {
      "provider": "yahoo_finance",
      "source_class": "proxy",
      "series": [
        { "series_id": "SPY", "latest_date": "2026-06-23" },
        { "series_id": "RSP", "latest_date": "2026-06-23" },
        { "series_id": "IWM", "latest_date": "2026-06-23" },
        { "series_id": "^VIX", "latest_date": "2026-06-23" }
      ]
    }
  },
  "source_freshness": [
    {
      "id": "context:S03",
      "label": "S03 글로벌 신용환경",
      "provider": "fred",
      "series_id": "FRED:BAMLH0A0HYM2",
      "source_class": "official",
      "frequency": "daily",
      "latest_date": "2026-06-22",
      "stale": false,
      "status": "live",
      "warning": null
    }
  ],
  "source_expansion": [
    {
      "id": "l2_treasury_dts",
      "layer": "layer2",
      "area": "Treasury liquidity",
      "label": "TGA·Daily Treasury Statement",
      "provider": "treasury_fiscaldata",
      "route": "U.S. Treasury Fiscal Data API",
      "source_kind": "official",
      "status": "candidate",
      "cadence": "daily",
      "purpose": "재무부 현금잔고와 유동성 흡수/공급 보강",
      "current_signal": "현재 S05 은행 지급준비금 해석의 다음 보강 후보입니다.",
      "next_step": "Daily Treasury Statement endpoint schema를 고정하고 D1 series_daily 매핑 추가"
    }
  ],
  "watchlist": [
    {
      "id": "credit_volatility",
      "label": "HY OAS / VIX",
      "trigger": "spread or volatility expansion",
      "meaning": "신용과 변동성이 섹터 리더십을 훼손하는지 확인합니다.",
      "status": "quiet",
      "source_class": "official",
      "evidence": {
        "state": "neutral",
        "transition": "stable",
        "latest_date": "2026-06-22"
      },
      "warnings": []
    }
  ],
  "context_reconciliation": {
    "state": "divergent",
    "transition": "weakening",
    "narrative": "섹터 리더십은 살아 있지만 FX·신용·집중도 중 일부가 압박을 보여 모듈 불일치가 있습니다.",
    "evidence": {
      "constructive_sector_count": 4,
      "pressure_contexts": "S02",
      "concentration_method": "rs_leadership_estimate"
    },
    "warnings": ["leadership_context_disagreement"]
  }
}
```

Layer 1 수집/조합 원칙:

```text
provider: Yahoo Finance chart adapter
symbols: SPY, QQQ, RSP, IWM, ^VIX
storage: series_daily long-format close rows
analysis: benchmark tape, 52-week range, realized volatility, VIX state, RSP/IWM/QQQ vs SPY 1M supplemental indicators
exposure: source_class=proxy is retained for API compatibility, UI labels it as supplemental/non-official price data, no raw OHLCV API exposure, no probability claims
```

허용 상태:

```text
source_freshness.status = live | stale | unavailable | manual_check
source_expansion.status = active | candidate | deferred
watchlist.status = quiet | fired | unknown | manual_check
context_reconciliation.state = supportive | divergent | risk_rising | rotation_watch | data_insufficient
```

로컬 Python API의 `POST /api/refresh`는 수동 갱신을 요청하지만 15분 upstream gate를 우회하지 않습니다.

```json
{
  "status": "skipped_rate_limited",
  "data_connection": {}
}
```

Cloudflare Pages public API에서는 직접 Yahoo를 호출하지 않고 `refresh_unavailable_in_pages`를 반환합니다. 배포 환경의 Yahoo 갱신은 Scheduled Worker cron이 담당합니다.

## 4. Current Dashboard Response

현재 React 앱은 `/api/sectors`, `/api/history`, `/api/validation`을 함께 읽어 `DashboardSnapshot`을 구성합니다.

`GET /api/sectors`의 top-level 필드:

```text
as_of
benchmark
sectors[]
validation
source
data_connection
data_connections
market_context
layer1_flow
concentration
source_freshness
source_expansion
watchlist
context_reconciliation
```

화면별 사용 규칙:

```text
Layer 1 흐름:
  layer1_flow
  sectors sorted by rulebook.strength desc, rs_ratio desc
  context_reconciliation
  source_freshness scoped to Layer 1 helper series

Layer 2 여력:
  market_context
  sectors participation modules
  watchlist
  source_freshness scoped to Layer 2 Yahoo/FRED/context rows

Layer 3 리더십:
  sectors sorted two ways:
    current RS leader detail = sortSectors(rulebook.strength desc, rs_ratio desc)
    momentum candidate rail = sortSectorsByMomentum(rs_momentum desc, rs_ratio desc)
  concentration
  validation
  source_freshness scoped to sector snapshot/leadership rows
```

현재 API는 별도 `summary` 객체를 제공하지 않습니다. Leading/Improving/Weakening/Lagging 그룹, warning sector, constructive count는 UI helper가 `sectors[]`에서 파생합니다.

## 5. Future API Endpoints

```text
GET /health
GET /sectors/snapshot?as_of=YYYY-MM-DD&benchmark=SPY
GET /sectors/{sector_code}?as_of=YYYY-MM-DD&benchmark=SPY
GET /sectors/rrg?as_of=YYYY-MM-DD&benchmark=SPY
GET /watchlist/events?start=YYYY-MM-DD&end=YYYY-MM-DD
GET /validation/patterns/{pattern_name}
```

Cloudflare Pages MVP endpoint:

```text
GET /api/sectors
GET /api/data/status
GET /api/history
GET /api/validation
POST /api/refresh
```

`GET /api/history` returns bounded trails for RRG and market context. It accepts `timeframe=30D|90D|180D` and still supports the older bounded `limit` parameter. If not enough data exists, it degrades to empty arrays.

`GET /api/validation` starts as:

```json
{
  "status": "unvalidated",
  "expose_probability": false,
  "scorecard": {
    "sector_rrg_ic": null,
    "pattern_hit_rate": null,
    "sample_size": 0
  },
  "limitations": [
    "Walk-forward validation and calibration are not implemented yet."
  ]
}
```

## 6. Error Contract

```json
{
  "error": {
    "code": "insufficient_data",
    "message": "SMH has only 72 daily observations; 200 required for 200MA breadth.",
    "details": {
      "sector_code": "SMH",
      "required_days": 200,
      "available_days": 72
    }
  }
}
```

## 7. Unknown State Contract

데이터 부족은 실패가 아니라 `unknown` state로 처리할 수 있습니다.

```json
{
  "state": "unknown",
  "transition": "unknown",
  "strength": 0,
  "evidence": {},
  "warnings": ["insufficient_lookback"]
}
```

Rulebook은 `unknown`이 많은 경우 high conviction을 금지합니다.
