"""Service-level tests for training block creation behavior (B9.3)."""

from __future__ import annotations

from collections import Counter
from datetime import date

from fastapi import FastAPI

from app.models.block import TrainingBlock
from app.schemas.training_blocks import TrainingBlockCreate
from app.services.rules import list_rules
from app.services.training_blocks import create_training_block
from app.tests.helpers.seed import (
    seed_activity_class,
    seed_rule,
    seed_training_block,
    with_session,
)


def _rule_signature(rule: object) -> tuple[object, ...]:
    return (
        getattr(rule, "activity_class_id"),
        getattr(rule, "rule_type"),
        getattr(rule, "threshold_value"),
        getattr(rule, "window_days"),
        getattr(rule, "enabled"),
    )


def test_create_training_block_active_copies_rules_and_archives_previous_active_block(
    app_with_test_database: FastAPI,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-old-active",
        name="Old Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-load",
        training_block_id="blk-old-active",
        activity_class_id="cls-foot",
        rule_type="weekly_load_cap",
        threshold_value=120.0,
        window_days=7,
        enabled=True,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-rest",
        training_block_id="blk-old-active",
        activity_class_id=None,
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
        enabled=False,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-gap",
        training_block_id="blk-old-active",
        activity_class_id="cls-foot",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
        enabled=True,
    )

    for session in with_session(app_with_test_database):
        source_rules = list_rules(session, "blk-old-active")
        created = create_training_block(
            session,
            TrainingBlockCreate(
                id="blk-new-active",
                name="New Active",
                start_date=date(2026, 5, 1),
                status="active",
            ),
        )

        copied_rules = list_rules(session, "blk-new-active")
        old_rule_ids_after = {rule.id for rule in list_rules(session, "blk-old-active")}
        old_block = session.get(TrainingBlock, "blk-old-active")

    assert created.status == "active"
    assert old_block is not None
    assert old_block.status == "completed"
    assert old_block.end_date == date.today()

    assert len(copied_rules) == 3
    assert {rule.training_block_id for rule in copied_rules} == {"blk-new-active"}
    assert {rule.id for rule in copied_rules}.isdisjoint({rule.id for rule in source_rules})
    assert Counter(_rule_signature(rule) for rule in copied_rules) == Counter(
        _rule_signature(rule) for rule in source_rules
    )
    source_created_at = max(source.created_at for source in source_rules)
    source_updated_at = max(source.updated_at for source in source_rules)
    assert all(rule.created_at > source_created_at for rule in copied_rules)
    assert all(rule.updated_at > source_updated_at for rule in copied_rules)
    assert old_rule_ids_after == {
        "rule-old-load",
        "rule-old-rest",
        "rule-old-gap",
    }


def test_create_training_block_active_preserves_existing_end_date_while_copying_rules(
    app_with_test_database: FastAPI,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-preserve",
        name="Foot Load",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-old-preserve",
        name="Old Active Preserve",
        start_date=date(2026, 4, 7),
        end_date=date(2026, 5, 31),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-preserve",
        training_block_id="blk-old-preserve",
        activity_class_id="cls-foot-preserve",
        rule_type="weekly_load_cap",
        threshold_value=150.0,
        window_days=7,
        enabled=True,
    )

    for session in with_session(app_with_test_database):
        source_rules = list_rules(session, "blk-old-preserve")
        create_training_block(
            session,
            TrainingBlockCreate(
                id="blk-new-preserve",
                name="New Active Preserve",
                start_date=date(2026, 6, 1),
                status="active",
            ),
        )

        copied_rules = list_rules(session, "blk-new-preserve")
        old_block = session.get(TrainingBlock, "blk-old-preserve")

    assert old_block is not None
    assert old_block.status == "completed"
    assert old_block.end_date == date(2026, 5, 31)
    assert len(copied_rules) == len(source_rules)
    assert Counter(_rule_signature(rule) for rule in copied_rules) == Counter(
        _rule_signature(rule) for rule in source_rules
    )


def test_create_training_block_active_creates_zero_rules_when_no_previous_active_block(
    app_with_test_database: FastAPI,
) -> None:
    for session in with_session(app_with_test_database):
        created = create_training_block(
            session,
            TrainingBlockCreate(
                id="blk-first-active",
                name="First Active",
                start_date=date(2026, 6, 1),
                status="active",
            ),
        )

        created_rules = list_rules(session, "blk-first-active")

    assert created.status == "active"
    assert created_rules == []

