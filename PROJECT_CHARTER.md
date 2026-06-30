# Project Charter — Sector Radar MVP

## 1. 배경

원본 아이디어는 Macro Engine, Sector Engine, Stock Engine을 연결해 시장 환경 → 섹터 흐름 → 종목 후보 → 전략 판단으로 이어지는 투자 리서치 시스템을 지향합니다. 하지만 전체 시스템을 한 번에 구현하면 데이터, 검증, UI, 룰북, 종목 펀더멘털까지 범위가 지나치게 커집니다.

따라서 첫 프로젝트는 **Sector Radar MVP**로 축소합니다.

## 2. 목표

미국 주요 섹터 ETF와 대표 구성종목을 기반으로 다음을 판단합니다.

```text
현재 리더 섹터는 어디인가?
차기 리더 후보는 어디인가?
강세가 섹터 전체로 확산되고 있는가?
거래량과 자금 흐름이 강세를 확인하는가?
강세가 후반부이거나 가짜일 가능성은 없는가?
이 판단이 틀렸다고 볼 조건은 무엇인가?
```

## 3. 제품 정의

Sector Radar는 다음 성격의 제품입니다.

| 성격 | 설명 |
|---|---|
| Research Dashboard | 투자자가 시장 내부 흐름을 관찰하는 도구 |
| Decision Support | 매수/매도 명령이 아니라 의사결정 보조 |
| Explainable Engine | 숫자보다 해석, 리스크, 무효화 조건을 함께 제시 |
| Local-first + Deployable | 로컬 SQLite 연구 엔진과 Cloudflare Pages/D1 대시보드를 함께 유지 |
| Modular System | Macro·Stock·Strategy로 확장 가능 |

현재 대시보드는 네 화면으로 구성됩니다.

```text
Layer 1 흐름: 시장 tape, breadth quality, volatility pressure, 현재 RS 리더
Layer 2 여력: ETF participation, FRED market context, risk trigger
Layer 3 리더십: 현재 RS 리더 상세, 모멘텀 선두 후보, RRG/path/treemap
Layer 4 검증: 검증 게이트, replay 준비도, pattern readiness
```

현재 RS 리더와 모멘텀 선두가 다를 수 있으며, 이 불일치는 오류가 아니라 리더십 전환 관찰 신호입니다.

## 4. 핵심 원칙

### 4.1 단일 합산 점수 금지

`RS 80 + Breadth 60 + Participation 70 = 평균 70` 같은 방식은 금지합니다. 모듈 간 충돌이 가장 중요한 정보이기 때문입니다.

### 4.2 상태보다 전환을 우선

`Leader`라는 현재 상태보다 `Leader + Weakening`, `Average + Improving` 같은 전환 신호가 더 중요합니다.

### 4.3 확률 표현 범위 제한

백테스트와 calibration이 되기 전에는 `승률 72%`, `상승 확률 68%`처럼 현재 판단을 예측 확률로 보이게 하는 문구를 사용자에게 노출하지 않습니다.
다만 Layer 4 검증 화면에서는 D1 이력 진단에서 파생한 `표본 관측 확률`, positive forward-label count, 신뢰도 점수를 함께 표시할 수 있습니다. 이 값은 보정 완료 확률이나 투자 판단이 아니라 누적 표본의 진단치입니다.

### 4.4 모든 판단에는 무효화 조건이 필요

각 섹터 판단은 반드시 다음을 포함합니다.

```text
왜 그렇게 판단했는가?
무엇을 조심해야 하는가?
어떤 조건이면 이 판단이 틀렸다고 볼 것인가?
```

### 4.5 투자 조언이 아니라 리서치 보조

이 프로젝트는 자동 매매나 개인화된 투자 권유를 제공하지 않습니다.

## 5. MVP 범위

### 포함

- 미국 주요 섹터 ETF universe
- SPY 또는 QQQ 벤치마크
- 상대강도, 모멘텀, breadth, participation
- RRG 4사분면
- Rulebook 패턴 매칭
- SQLite 저장
- React 대시보드
- 수동 catalyst ledger

### 제외

- 자동 매매
- 브로커 API 연동
- 옵션·공매도·다크풀 정밀 데이터
- 뉴스 NLP 자동화
- 개별 종목 펀더멘털 정밀 분석
- KOSPI 전체 섹터 breadth
- 보정 전 확률 예측 또는 투자 권유

## 6. 성공 기준

MVP는 다음 조건을 만족하면 완료로 봅니다.

1. 매일 섹터 ETF 가격을 저장하고 재사용할 수 있다.
2. 각 섹터가 Leading / Improving / Weakening / Lagging 중 하나로 분류된다.
3. 최소 10개 섹터에 대해 Breadth와 Participation 상태가 계산된다.
4. Rulebook이 최소 6개 이상의 패턴을 인식한다.
5. 각 섹터별 narrative, risks, invalidation이 출력된다.
6. 테스트가 synthetic fixture와 실제 샘플 데이터에서 모두 통과한다.
7. 대시보드에서 “현재 RS 리더 / 모멘텀 선두 후보 / 경고 섹터”를 1분 안에 이해할 수 있다.

## 7. 장기 방향

```text
Sector Radar MVP
    ↓
Sector Replay & Validation
    ↓
Stock Candidate Funnel
    ↓
Macro Regime Overlay
    ↓
Strategy Rulebook
```
