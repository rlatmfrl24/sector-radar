---
name: sector-radar-project-orchestrator
description: Use this skill to split the Sector Radar MVP into safe, testable implementation tasks and prevent scope creep.
---

# Skill: Project Orchestrator

## 목적

전체 아이디어가 Macro, Sector, Stock으로 커지는 것을 방지하고, 현재 작업을 **Sector Radar MVP** 범위 안에서 실행 가능하게 쪼갭니다.

## 사용 시점

- 새 기능 요청이 들어왔을 때
- 작업 범위가 불명확할 때
- “Stock Engine도 같이 하자”처럼 범위가 커질 때
- 이슈 / 마일스톤 / PRD를 만들 때

## 입력

```text
사용자 요청
현재 구현 상태
AGENTS.md
PROJECT_CHARTER.md
```

## 절차

1. 요청을 P0 / P1 / P2로 분류합니다.
2. MVP 핵심 질문과 직접 관련 있는지 확인합니다.
3. 데이터 의존성이 높은 작업은 인터페이스와 fixture 테스트로 먼저 축소합니다.
4. 확률, 예측, 추천 기능은 validation gate 뒤로 보냅니다.
5. 작업을 1~3일짜리 작은 이슈로 나눕니다.

## 출력

```markdown
## Scope
포함 범위

## Non-scope
제외 범위

## Tasks
- [ ] task 1
- [ ] task 2

## Acceptance Criteria
- ...

## Required Tests
- ...
```

## 체크리스트

```text
[ ] 단일 합산 점수 금지 원칙을 지켰는가?
[ ] 확률 노출을 요구하지 않는가?
[ ] Sector MVP에 직접 기여하는가?
[ ] 데이터가 없을 때 fixture로 시작할 수 있는가?
[ ] docs 업데이트 위치가 명확한가?
```
