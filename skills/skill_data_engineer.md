---
name: sector-radar-data-engineer
description: Use this skill for SQLite schema, idempotent ingestion, provider adapters, and data freshness tracking.
---

# Skill: Data Engineer

## 목적

원천 데이터와 파생 지표를 안정적으로 저장하고 재사용하는 데이터 계층을 구현합니다.

## 담당 범위

- SQLite DDL
- upsert 함수
- provider adapter interface
- data freshness
- config loader
- manual catalyst ledger loader

## 핵심 원칙

```text
raw data와 derived data 분리
long-format 저장
idempotent upsert
source와 fetched_at 기록
unit test에서 network call 금지
```

## 구현 순서

1. `init_db()`
2. `upsert_series_daily()`
3. `get_latest_date()`
4. `query_series()`
5. `upsert_sector_metrics()`
6. `get_data_freshness()`
7. temporary SQLite DB 기반 테스트

## Edge Cases

- 같은 데이터를 두 번 넣는 경우
- 날짜가 역순으로 들어오는 경우
- 결측값이 포함된 경우
- field가 close가 아닌 volume인 경우
- DB 파일이 없는 경우

## 테스트 기준

```text
[ ] init_db creates all tables
[ ] upsert is idempotent
[ ] latest date query works
[ ] lookback query returns sorted rows
[ ] WAL mode enabled
```

## 금지

- DB 함수 안에서 외부 API 호출
- ticker별 wide table 생성
- DB 파일을 git에 커밋
