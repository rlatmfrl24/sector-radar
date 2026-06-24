# Sector Radar MVP Project Kit

친구가 제안한 Macro / Sector / Stock Intelligence 아이디어를 **작게 시작 가능한 구현 프로젝트**로 재구성한 문서와 에이전트 지침 모음입니다.

첫 구현 범위는 전체 투자 OS가 아니라 **Sector Radar MVP**입니다.

> 미국 주요 섹터 ETF를 기준으로 현재 리더, 차기 리더 후보, 후반부 리더, 가짜 강세 섹터를 식별하고, 그 판단의 이유·리스크·무효화 조건을 설명하는 로컬 우선 대시보드.

## 핵심 방향

이 프로젝트는 “종목 추천기”가 아닙니다. 목표는 아래 질문에 일관되게 답하는 **투자 리서치 보조 시스템**입니다.

1. 현재 어느 섹터가 시장보다 강한가?
2. 그 강세는 넓게 확산되고 있는가?
3. 실제 거래량과 자금 유입이 동반되는가?
4. 리더십은 강화 중인가, 약화 중인가?
5. 현재 판단이 틀렸다고 볼 조건은 무엇인가?

## MVP 산출물

- 섹터 ETF 상대강도 랭킹
- RRG 4사분면: Leading / Improving / Weakening / Lagging
- Breadth 상태: 상승 확산, 대형주 의존, 내부 약화
- Participation 상태: 거래량 확인, 매집, 분산, 가짜 돌파
- Sector Rulebook 패턴: Strong Leader, Emerging Leader, Late Leader, False Leadership 등
- 섹터별 narrative, risk, invalidation 자동 생성
- SQLite/D1 호환 데이터 저장 구조
- React + Vite 대시보드와 Cloudflare Pages 배포 경계

## 문서 구성

| 파일 | 내용 |
|---|---|
| `AGENTS.md` | 코딩 에이전트가 따라야 할 최상위 구현 규칙 |
| `DESIGN.md` | 프로젝트 공식 디자인 베이스와 UI token/component 규칙 |
| `PROJECT_CHARTER.md` | 프로젝트 목적, 범위, 원칙, 성공 기준 |
| `docs/01_IMPLEMENTATION_PLAN.md` | 단계별 구현 플랜 |
| `docs/02_MVP_SPEC.md` | MVP 기능 명세와 제외 범위 |
| `docs/03_ARCHITECTURE.md` | 기술 구조와 데이터 흐름 |
| `docs/04_DATA_MODEL.md` | SQLite 테이블 설계 |
| `docs/05_METRICS_AND_STATES.md` | 지표 계산식과 상태 정의 |
| `docs/06_SECTOR_RULEBOOK.md` | Rulebook 패턴과 veto 규칙 |
| `docs/07_VALIDATION_PLAN.md` | 백테스트·검증 게이트 |
| `docs/08_UI_SPEC.md` | 대시보드 화면 설계 |
| `docs/09_API_CONTRACT.md` | API / JSON 계약 |
| `docs/10_STOCK_ENGINE_EXPANSION.md` | Stock Engine 확장 로드맵 |
| `docs/11_DEVELOPMENT_WORKFLOW.md` | 개발 흐름, 테스트, Definition of Done |
| `docs/12_AGENT_PROMPTS.md` | 프로젝트 생성·구현용 프롬프트 |
| `docs/13_CLOUDFLARE_DEPLOYMENT.md` | Cloudflare Pages / D1 배포 방향 |
| `skills/` | 역할별 에이전트 스킬 셋 |
| `config/` | Universe, thresholds, catalyst 예시 설정 |
| `src/` | 최소 스타터 코드 스켈레톤 |

## 권장 기술 스택

초기 MVP는 아래 조합을 권장합니다.

```text
Python 3.11+
SQLite
pandas / numpy
PyYAML
pytest / ruff
React / Vite
Cloudflare Pages / D1
```

장기 확장 시:

```text
DuckDB 또는 Postgres
Airflow / Prefect / cron 기반 ingest
```

## 빠른 시작 명령 예시

현재 구현된 첫 slice는 로컬 CSV/fixture 가격 → SQLite 저장 → Relative Strength/RRG snapshot 생성입니다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

python -m sector_radar.data.store --init-db data/sector_radar.db
python -m sector_radar.api.local_server
python -m pytest

cd frontend
npm install
npm run dev
```

CSV 가격 입력은 `symbol,date,close`를 필수로 하며 `open,high,low,volume,source,fetched_at`를 선택적으로 지원합니다. 저장 시 OHLCV는 `series_daily`에 long-format row로 들어갑니다.

구현된 주요 코드 경로:

- `sector_radar.domain.models`: ModuleState, RulebookOutput 출력 계약
- `sector_radar.application.build_relative_strength_snapshot`: SQLite 기반 Relative Strength snapshot use case
- `sector_radar.infrastructure.sqlite.schema`: SQLite canonical DDL과 column constants
- `sector_radar.data.store`: SQLite adapter facade, upsert, lookback, freshness query
- `sector_radar.infrastructure.yahoo`: Yahoo Finance/yfinance research adapter
- `sector_radar.application.refresh_data`: 15분 rate-gated refresh orchestration
- `sector_radar.api.local_server`: local SQLite API for React dev proxy
- `sector_radar.data.config_loader`: universe/threshold YAML loader
- `sector_radar.data.price_csv`: CSV price ingestion adapter
- `sector_radar.metrics.relative_strength`: RS Ratio, RS Momentum, RRG, module state
- `sector_radar.pipeline`: backward-compatible snapshot import wrapper
- `frontend/src/features/radar`: React dashboard view model and components
- `frontend/functions`, `frontend/migrations`: Cloudflare Pages Function and D1 migration

## 구현 원칙

- 모듈 점수를 단순 평균 내지 않습니다.
- `State`보다 `Transition`을 더 중요하게 봅니다.
- 백테스트 전 확률·승률·예측값은 사용자에게 노출하지 않습니다.
- 모든 판단은 narrative, risks, invalidation을 함께 출력해야 합니다.
- 자동 매매, 개인화 투자 조언, 브로커 연동은 MVP 범위에서 제외합니다.
