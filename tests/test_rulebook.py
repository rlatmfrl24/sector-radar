from sector_radar.rules.sector_rulebook import ModuleState, evaluate_sector


def test_strong_leader_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "strong", "strengthening"),
        "momentum": ModuleState("momentum", "improving", "strengthening"),
        "breadth": ModuleState("breadth", "healthy", "strengthening"),
        "participation": ModuleState("participation", "confirmed", "stable"),
        "catalyst": ModuleState("catalyst", "positive", "strengthening"),
    }
    out = evaluate_sector(states, sector_name="Semiconductors")
    assert out.lead_pattern == "Strong Leader"
    assert out.direction == "strong_up"
    assert out.conviction_label == "high"
    assert out.narrative
    assert out.invalidation


def test_false_leadership_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "strong", "strengthening"),
        "momentum": ModuleState("momentum", "improving", "stable"),
        "breadth": ModuleState("breadth", "healthy", "stable"),
        "participation": ModuleState("participation", "diverging", "weakening"),
        "catalyst": ModuleState("catalyst", "neutral", "stable"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "False Leadership"
    assert "거래량 미확인" in out.risks


def test_emerging_leader_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "average", "strengthening"),
        "momentum": ModuleState("momentum", "improving", "strengthening"),
        "breadth": ModuleState("breadth", "mixed", "stable"),
        "participation": ModuleState("participation", "neutral", "stable"),
        "catalyst": ModuleState("catalyst", "positive", "strengthening"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "Emerging Leader"
    assert out.direction == "mild_up"


def test_late_leader_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "strong", "weakening"),
        "momentum": ModuleState("momentum", "decelerating", "weakening"),
        "breadth": ModuleState("breadth", "healthy", "stable"),
        "participation": ModuleState("participation", "confirmed", "stable"),
        "catalyst": ModuleState("catalyst", "neutral", "stable"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "Late Leader"
    assert "리더십 후반부" in out.risks


def test_mega_cap_dependence_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "strong", "stable"),
        "momentum": ModuleState("momentum", "flat", "stable"),
        "breadth": ModuleState("breadth", "narrow", "weakening"),
        "participation": ModuleState("participation", "confirmed", "stable"),
        "catalyst": ModuleState("catalyst", "neutral", "stable"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "Mega-cap Dependence"
    assert "소수 대형주 의존" in out.risks


def test_breakdown_pattern():
    states = {
        "relative_strength": ModuleState("relative_strength", "weak", "weakening"),
        "momentum": ModuleState("momentum", "decelerating", "weakening"),
        "breadth": ModuleState("breadth", "breakdown", "weakening"),
        "participation": ModuleState("participation", "distribution", "weakening"),
        "catalyst": ModuleState("catalyst", "negative", "weakening"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "Breakdown"
    assert out.direction == "strong_down"
    assert "Broad Breadth Collapse veto" in out.risks


def test_momentum_collapse_veto_blocks_strong_up():
    states = {
        "relative_strength": ModuleState("relative_strength", "strong", "strengthening"),
        "momentum": ModuleState("momentum", "collapsing", "strengthening"),
        "breadth": ModuleState("breadth", "healthy", "strengthening"),
        "participation": ModuleState("participation", "confirmed", "stable"),
        "catalyst": ModuleState("catalyst", "positive", "strengthening"),
    }
    out = evaluate_sector(states)
    assert out.lead_pattern == "Strong Leader"
    assert out.direction == "mild_up"
    assert "Momentum Collapse veto" in out.risks


def test_rulebook_output_includes_source_metrics_and_freshness():
    states = {
        "relative_strength": ModuleState(
            "relative_strength",
            "strong",
            "stable",
            evidence={"rs_ratio": 103.0},
        ),
        "momentum": ModuleState("momentum", "flat", "stable"),
    }
    out = evaluate_sector(states, data_freshness={"latest_price_date": "2024-01-31"})

    assert out.source_metrics["relative_strength"] == {"rs_ratio": 103.0}
    assert out.data_freshness == {"latest_price_date": "2024-01-31"}
    assert out.as_dict()["source_metrics"]["relative_strength"] == {"rs_ratio": 103.0}
