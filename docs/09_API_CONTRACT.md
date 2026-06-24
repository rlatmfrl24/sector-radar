# 09. API / JSON Contract

## 1. 목적

초기 MVP UI는 React가 API/JSON 계약만 읽도록 구성합니다. 로컬 연구 엔진은 SQLite를 사용할 수 있고, 배포 표면은 Cloudflare Pages Function이 D1에서 같은 계약을 제공합니다.

## 2. Sector Snapshot

구현 helper:

```text
sector_radar.snapshot.build_sector_snapshot(...)
sector_radar.pipeline.build_relative_strength_snapshot_from_db(...)
```

첫 구현 slice에서는 Relative Strength와 Momentum이 계산되고, Breadth/Participation은 아직 pipeline에 연결되지 않은 경우 `unknown` module state로 표시될 수 있습니다.

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
          "source": "Yahoo DXY / USDKRW proxy",
          "evidence": {
            "DX-Y.NYB_ret_1m": -0.01,
            "KRW=X_ret_1m": 0.004
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

`GET /api/sectors`는 sector snapshot과 함께 현재 데이터 연결 상태를 반환합니다.

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

로컬 Python API의 `POST /api/refresh`는 수동 갱신을 요청하지만 15분 upstream gate를 우회하지 않습니다.

```json
{
  "status": "skipped_rate_limited",
  "data_connection": {}
}
```

Cloudflare Pages public API에서는 직접 Yahoo를 호출하지 않고 `refresh_unavailable_in_pages`를 반환합니다. 배포 환경의 Yahoo 갱신은 Scheduled Worker cron이 담당합니다.

## 4. Overview Response

```json
{
  "as_of": "2026-06-23",
  "benchmark": "SPY",
  "summary": {
    "leading": ["SMH", "XLK"],
    "improving": ["XLI", "XLF"],
    "weakening": ["XLE"],
    "lagging": ["XLU", "XLP"],
    "warnings": {
      "false_leadership": ["XLY"],
      "mega_cap_dependence": ["XLK"],
      "breakdown": []
    }
  },
  "sectors": []
}
```

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
POST /api/refresh
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
