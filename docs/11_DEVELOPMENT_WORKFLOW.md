# 11. Development Workflow

## 1. 브랜치 전략

작은 단위의 브랜치를 권장합니다.

```text
feat/sqlite-store
feat/relative-strength
feat/sector-rulebook
feat/react-overview
feat/replay-validation
```

## 2. 커밋 규칙

```text
feat: add sqlite store upsert helpers
fix: handle zero volume in cmf calculation
test: add false leadership rulebook fixture
docs: update metric threshold spec
refactor: separate rulebook pattern matching
```

## 3. 테스트 전략

### Unit tests

- 수식 함수
- state classifier
- rulebook pattern matching
- config loader
- DB upsert

### Integration tests

- small fixture CSV → metric computation → rulebook output

### Snapshot tests

- API JSON contract가 깨지지 않는지 확인

## 4. 로컬 명령

```bash
pytest
ruff check .
ruff format .
mypy src
```

## 5. Definition of Done

모든 구현 작업은 아래를 만족해야 합니다.

```text
[ ] 테스트 추가 또는 업데이트
[ ] threshold/config 하드코딩 없음
[ ] unknown/missing data 처리
[ ] docs 업데이트
[ ] AGENTS.md 원칙 위반 없음
[ ] 투자 조언성 문구 없음
[ ] 검증 전 확률 노출 없음
```

## 6. 코드 스타일

- Python 3.11+
- 타입 힌트 사용
- 순수 계산 함수는 side-effect 없이 작성
- DB 함수는 입출력 경계를 명확히 분리
- 네트워크 호출은 provider adapter에만 위치
- UI에서 계산하지 않음

## 7. 설정 관리

```text
config/universe.us_sectors.yaml
config/thresholds.example.yaml
config/catalysts.manual.example.yaml
```

설정값을 바꾸면 관련 테스트도 업데이트합니다.

## 8. 문서 업데이트 규칙

새 모듈 추가 시 반드시 업데이트:

```text
docs/03_ARCHITECTURE.md
docs/05_METRICS_AND_STATES.md
docs/09_API_CONTRACT.md
```

Rulebook 패턴 추가 시:

```text
docs/06_SECTOR_RULEBOOK.md
tests/test_rulebook.py
```

## 9. PR 설명 템플릿

```markdown
## Summary
무엇을 구현했는가?

## Scope
포함 / 제외 범위

## Tests
실행한 테스트

## Screenshots
UI 변경 시 첨부

## Risk
데이터 품질, 수식, threshold 관련 주의사항

## Validation Status
unvalidated / fixture-tested / historical-tested
```
