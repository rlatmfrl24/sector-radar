# Project Kit Index

## 바로 읽을 순서

1. `PROJECT_CHARTER.md`
2. `AGENTS.md`
3. `docs/01_IMPLEMENTATION_PLAN.md`
4. `docs/02_MVP_SPEC.md`
5. `docs/03_ARCHITECTURE.md`
6. `docs/06_SECTOR_RULEBOOK.md`

## 바로 구현할 순서

1. `src/sector_radar/domain/models.py` 출력 계약 확인
2. `src/sector_radar/infrastructure/sqlite/schema.py` DB 스키마 확인
3. `src/sector_radar/data/store.py` SQLite adapter 확장
4. `src/sector_radar/application/build_relative_strength_snapshot.py` 유스케이스 확장
5. `src/sector_radar/application/refresh_data.py` Yahoo refresh/rate gate 확인
6. `src/sector_radar/api/local_server.py` 로컬 API 확인
7. `src/sector_radar/metrics/relative_strength.py` 지표 계산 확장
8. `src/sector_radar/metrics/breadth.py` breadth 완성
9. `src/sector_radar/metrics/participation.py` participation 완성
10. `src/sector_radar/rules/sector_rulebook.py` 패턴 강화
11. `frontend/src/features/radar/` React dashboard 화면과 view model 수정
12. `frontend/functions`, `frontend/migrations` Cloudflare Pages/D1 경계 연결

## 에이전트에게 줄 핵심 파일

- 전체 작업: `AGENTS.md`, `PROJECT_CHARTER.md`
- DB 작업: `skills/skill_data_engineer.md`, `docs/04_DATA_MODEL.md`
- 지표 작업: `skills/skill_quant_metrics_engineer.md`, `docs/05_METRICS_AND_STATES.md`
- 룰북 작업: `skills/skill_rulebook_engineer.md`, `docs/06_SECTOR_RULEBOOK.md`
- UI 작업: `skills/skill_dashboard_engineer.md`, `docs/08_UI_SPEC.md`
- 검증 작업: `skills/skill_validation_engineer.md`, `docs/07_VALIDATION_PLAN.md`
