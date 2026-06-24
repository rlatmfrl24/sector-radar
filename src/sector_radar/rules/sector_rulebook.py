from __future__ import annotations

from typing import Any

from sector_radar.domain.models import ModuleState, RulebookOutput


def evaluate_sector(
    states: dict[str, ModuleState],
    sector_name: str = "해당 섹터",
    data_freshness: dict[str, Any] | None = None,
) -> RulebookOutput:
    rs = states.get("relative_strength", ModuleState("relative_strength", "unknown"))
    mom = states.get("momentum", ModuleState("momentum", "unknown"))
    breadth = states.get("breadth", ModuleState("breadth", "unknown"))
    part = states.get("participation", ModuleState("participation", "unknown"))
    catalyst = states.get("catalyst", ModuleState("catalyst", "neutral"))
    rotation = states.get("rotation", ModuleState("rotation", "unknown"))

    unknown_count = sum(s.state == "unknown" for s in [rs, mom, breadth, part, catalyst, rotation])

    pattern = "Neutral"
    direction = "neutral"
    strength = 2
    conviction = "medium"
    risks = ["Momentum 둔화", "Breadth 악화", "Participation 약화"]
    invalidation = ["RS Momentum 100 하회", "50MA 위 종목 비율 하락", "CMF 0 하회"]

    if (
        rs.state == "strong"
        and mom.transition == "strengthening"
        and breadth.state in {"healthy", "broad_strength"}
        and part.state in {"confirmed", "accumulation"}
        and catalyst.state in {"positive", "neutral"}
    ):
        pattern = "Strong Leader"
        direction = "strong_up"
        strength = 4
        conviction = "high"
    elif (
        rs.state in {"weak", "average"}
        and mom.transition == "strengthening"
        and catalyst.state == "positive"
    ):
        pattern = "Emerging Leader"
        direction = "mild_up"
        strength = 3
        conviction = "medium"
        risks = ["RS 개선 실패", "Catalyst 약화", "Breadth 확산 실패"]
    elif rs.state == "strong" and mom.transition == "weakening":
        pattern = "Late Leader"
        direction = "mild_up"
        strength = 2
        conviction = "medium"
        risks = ["리더십 후반부", "고점 추격 위험", "Breadth 약화"]
    elif rs.state == "strong" and breadth.state in {"narrow", "breakdown"}:
        pattern = "Mega-cap Dependence"
        direction = "neutral"
        strength = 2
        conviction = "medium"
        risks = ["소수 대형주 의존", "내부 확산 부족", "Breadth 붕괴"]
    elif rs.state == "strong" and part.state in {"diverging", "distribution"}:
        pattern = "False Leadership"
        direction = "neutral"
        strength = 2
        conviction = "medium"
        risks = ["거래량 미확인", "자금 흐름 약화", "False breakout 가능성"]
    elif breadth.transition == "strengthening" and part.state in {"confirmed", "accumulation"}:
        pattern = "Healthy Expansion"
        direction = "mild_up"
        strength = 3
        conviction = "medium"
    elif rotation.transition == "strengthening" and mom.transition == "strengthening":
        pattern = "Early Rotation"
        direction = "mild_up"
        strength = 3
        conviction = "medium"
    elif catalyst.state == "positive" and rs.state == "strong":
        pattern = "Structural Winner"
        direction = "mild_up"
        strength = 3
        conviction = "medium"
    elif breadth.transition == "strengthening" and part.state in {"diverging", "neutral"}:
        pattern = "Weak Expansion"
        direction = "neutral"
        strength = 2
        conviction = "low"
    elif (
        rs.state == "weak"
        and mom.transition in {"weakening", "collapsing"}
        and part.state == "distribution"
    ):
        pattern = "Breakdown"
        direction = "strong_down"
        strength = 0
        conviction = "high"
        risks = ["상대강도 붕괴", "모멘텀 약화", "분산 가능성"]
        invalidation = ["RS Ratio 회복", "Participation confirmed 전환"]

    # Veto rules
    if (mom.transition == "collapsing" or mom.state == "collapsing") and direction == "strong_up":
        direction = "mild_up"
        strength = min(strength, 3)
        risks.append("Momentum Collapse veto")
    if part.state == "distribution" and conviction == "high" and pattern != "Breakdown":
        conviction = "medium"
        risks.append("Participation Breakdown veto")
    if catalyst.state == "negative":
        strength = max(0, strength - 1)
        risks.append("Catalyst Reversal veto")
    if breadth.state == "breakdown":
        risks.append("Broad Breadth Collapse veto")
    if unknown_count >= 2 and conviction == "high":
        conviction = "medium"
        risks.append("Data Insufficient veto")

    narrative = _build_narrative(sector_name, pattern, rs, mom, breadth, part, catalyst)

    return RulebookOutput(
        lead_pattern=pattern,
        direction=direction,
        strength=strength,
        conviction_label=conviction,
        narrative=narrative,
        risks=list(dict.fromkeys(risks)),
        invalidation=list(dict.fromkeys(invalidation)),
        source_metrics={module: state.evidence for module, state in states.items()},
        data_freshness=data_freshness or {},
    )


def _build_narrative(
    sector_name: str,
    pattern: str,
    rs: ModuleState,
    mom: ModuleState,
    breadth: ModuleState,
    part: ModuleState,
    catalyst: ModuleState,
) -> str:
    return (
        f"{sector_name}는 현재 {pattern} 패턴으로 분류된다. "
        f"상대강도는 {rs.state}, 모멘텀 전환은 {mom.transition}, "
        f"breadth는 {breadth.state}, participation은 {part.state} 상태다. "
        f"Catalyst 상태는 {catalyst.state}이며, 이 판단은 지표 정렬에 기반한 "
        "리서치 해석이지 검증된 확률 예측이 아니다."
    )
