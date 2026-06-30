# Sector Radar Skill Set

이 디렉터리는 프로젝트 구현을 역할별로 나눈 에이전트 스킬 셋입니다. 각 스킬 파일은 특정 작업을 맡은 코딩 에이전트가 읽고 따라야 할 실행 절차, 입력, 출력, 검증 기준을 정의합니다.

권장 사용 방식:

1. 작업 범위를 정한다.
2. 해당 skill 파일을 에이전트에게 함께 제공한다.
3. `AGENTS.md`와 skill 파일이 충돌하면 `AGENTS.md`를 우선한다.
4. 작업 완료 후 Definition of Done을 확인한다.

## 스킬 목록

| Skill | 사용 시점 |
|---|---|
| `skill_project_orchestrator.md` | 전체 범위 조정, 이슈 분해, 로드맵 관리 |
| `skill_data_engineer.md` | SQLite, ingestion, freshness |
| `skill_quant_metrics_engineer.md` | RS, Momentum, Breadth, Participation 계산 |
| `skill_rulebook_engineer.md` | Sector Rulebook, pattern, veto, narrative |
| `skill_dashboard_engineer.md` | React 3-layer dashboard UI |
| `skill_validation_engineer.md` | Replay, backtest, validation gate |
| `skill_stock_engine_researcher.md` | Sector validation 이후 Stock Candidate Funnel 확장 설계 |
| `skill_documentation_writer.md` | 문서와 사용자 설명 개선 |
