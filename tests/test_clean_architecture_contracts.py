from sector_radar.application import build_relative_strength_snapshot_from_db as app_builder
from sector_radar.data import store
from sector_radar.domain.models import ModuleState, RulebookOutput
from sector_radar.infrastructure.sqlite.schema import DDL_STATEMENTS
from sector_radar.pipeline import build_relative_strength_snapshot_from_db as pipeline_builder
from sector_radar.rules.sector_rulebook import ModuleState as RulebookModuleState


def test_pipeline_remains_a_compatibility_wrapper():
    assert pipeline_builder is app_builder


def test_rulebook_uses_domain_module_state_contract():
    assert RulebookModuleState is ModuleState

    state = ModuleState("relative_strength", "strong", "strengthening", strength=3)
    assert state.as_dict() == {
        "state": "strong",
        "transition": "strengthening",
        "strength": 3,
        "evidence": {},
        "warnings": [],
    }


def test_rulebook_output_contract_preserves_required_fields():
    output = RulebookOutput(
        lead_pattern="Strong Leader",
        direction="strong_up",
        strength=4,
        conviction_label="high",
        narrative="research narrative",
        risks=["risk"],
        invalidation=["invalidation"],
    )

    assert output.as_dict()["lead_pattern"] == "Strong Leader"
    assert output.as_dict()["risks"] == ["risk"]
    assert output.as_dict()["data_freshness"] == {}


def test_sqlite_store_uses_canonical_schema_constants():
    assert store.DDL_STATEMENTS is DDL_STATEMENTS
    assert any(
        "CREATE TABLE IF NOT EXISTS series_daily" in statement
        for statement in DDL_STATEMENTS
    )
