# 15. Data Source Expansion Plan

이 문서는 Layer 1/2 수집 UI에서 `proxy` 표현을 줄이고, 실제 수집 루트를 다양화하기 위한 후보를 정리합니다.

현재 구현 상태:

- `/api/sectors.source_expansion`으로 Layer 1/2별 active/candidate/deferred 원천 지도를 제공합니다.
- Flow/Liquidity 본문 화면은 원천 지도를 별도 카드로 표시하지 않습니다.
- 원천 정보는 관련 지표 카드의 클릭형 `출처 정보` disclosure와 상단 수집 내역 패널로 낮춰 표시합니다. Disclosure는 사용자가 이해할 수 있도록 `요청 정보`, `요청/수집 항목`, `받아온 결과`, `최신 기준`, `주의 메모` 형태로 표시합니다.
- 이 필드는 freshness가 아니라 source roadmap입니다. 실제 데이터 최신성은 `source_freshness`를 봅니다.

## Current Terminology

화면에서는 다음 용어를 사용합니다.

| UI label | Meaning |
|---|---|
| 공식 원천 | 정부/거래소/공식 산출기관의 직접 데이터 |
| 가격 수집 | Yahoo chart adapter로 수집하는 ETF/주식 가격 데이터 |
| 비공식 가격 | Yahoo chart처럼 연구용으로 쓰는 가격 provider |
| 보조 지표 | 원자료 자체는 아니지만 시장 상태를 근사하는 지표 |
| 수동 입력 | 사람이 ledger로 입력해야 하는 항목 |
| 보류 | 현재 US Sector Radar에서 지속 운영 가능한 수집 루트가 없는 항목 |

`proxy`는 내부 타입으로 남아 있을 수 있지만, UI에서는 네트워크 프록시처럼 오해되지 않도록 위 표현을 사용합니다.

## Layer 1 Expansion

Layer 1은 “시장 tape, breadth, volatility, 정합성”을 읽는 영역입니다.

| Area | Candidate source | Use | Cadence | Priority |
|---|---|---|---|---|
| Volatility | Cboe VIX historical data or FRED `VIXCLS` | VIX freshness and risk/vol state | Daily | High |
| Equal-weight breadth | RSP price from current price provider, later licensed price provider | SPY 대비 equal-weight participation | Daily close | Current |
| Small-cap risk appetite | IWM price from current price provider, later licensed price provider | Broad risk appetite companion | Daily close | Current |
| ETF holdings breadth | ETF issuer holdings files or SEC N-PORT as delayed fallback | More complete representative holdings universe | Daily issuer / monthly delayed SEC | Medium |
| Market concentration | ETF holdings weights, issuer files, or licensed constituent market cap | HHI, top1/top3 contribution | Daily/weekly | High |

Notes:

- Cboe has official VIX historical data and FRED also carries `VIXCLS`.
- SEC EDGAR APIs are official and useful for filings/fund reports, but N-PORT style holdings are delayed and not suitable for same-day breadth.
- Daily ETF holdings from issuers should be preferred for breadth/concentration if the issuer terms allow automated collection.

## Layer 2 Expansion

Layer 2 is market context and liquidity. Active US Sector Radar should prefer direct official routes.

| Context | Current source | Expansion source | Use | Cadence | Status |
|---|---|---|---|---|---|
| S01 central bank policy | FRED `WALCL`, `DFF/SOFR`, `DGS2`, `DFII5` | FRED additional reserves/rates | Fed liquidity and rate pressure | Daily/weekly | Active |
| S02 dollar/FX gate | FRED `DEXKOUS`, `DTWEXBGS` | Licensed FX provider if intraday is needed | Dollar/KRW and broad dollar pressure | Daily | Active |
| S03 credit/volatility | FRED `BAMLH0A0HYM2`, `VIXCLS` | ICE/BofA credit series via FRED, Cboe direct VIX | Credit spread and volatility pressure | Daily | Active |
| S05 bank reserves | FRED `WRESBAL` | Treasury Fiscal Data DTS operating cash balance/TGA | Cash/liquidity drain or support | Daily/weekly | Active + expansion candidate |
| Margin leverage | none active | FINRA margin statistics | Customer margin debit/free credit balances | Monthly | Candidate, not realtime |
| KRX flow | disabled for US Sector Radar | KRX Open API for KOSPI/KOSDAQ mode | Korea-market reference, not US sector core | Daily KST | Deferred |

## Implementation Direction

1. Keep active Layer 2 limited to directly collected official data.
2. Add provider adapters behind one `MarketDataProvider` style interface.
3. Store every new source in `series_daily` long format.
4. Add a `source_registry` style config later so UI labels, cadence, source class, and warnings do not drift.
5. Do not average Layer 2 into a composite score. Preserve module disagreement.

## References

- FRED API observations: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- Cboe VIX historical data: https://www.cboe.com/en/tradable-products/vix/vix-historical-data/
- U.S. Treasury Fiscal Data API: https://fiscaldata.treasury.gov/api-documentation/
- U.S. Treasury Daily Treasury Statement: https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/
- SEC EDGAR APIs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- FINRA margin statistics: https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics
- KRX Open API: https://openapi.krx.co.kr/
