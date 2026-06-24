---
name: sector-radar-repo-bootstrap
description: Use this skill to create the initial repository structure, Python package, config files, test setup, and starter documentation.
---

# Skill: Repository Bootstrap

## 목적

Sector Radar MVP를 구현할 수 있는 기본 저장소 구조를 만듭니다.

## 생성할 구조

```text
config/
docs/
skills/
src/sector_radar/
  data/
  metrics/
  rules/
  validation/
app/
tests/
```

## 필수 파일

```text
README.md
AGENTS.md
PROJECT_CHARTER.md
pyproject.toml
.gitignore
config/universe.us_sectors.yaml
config/thresholds.example.yaml
```

## 절차

1. Python 패키지 구조 생성
2. dev dependencies 설정
3. pytest 기본 테스트 추가
4. ruff / mypy 설정
5. config 예시 추가
6. docs index 확인

## 완료 기준

```bash
pip install -e ".[dev]"
pytest
ruff check .
```

이 세 명령이 통과해야 합니다.

## 주의사항

- 네트워크 provider를 바로 구현하지 않습니다.
- 빈 app이라도 실행 가능한 placeholder를 둡니다.
- data DB 파일은 gitignore에 포함합니다.
