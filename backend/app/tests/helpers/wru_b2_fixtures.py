"""WRU.B2 — fixtures and assertions for always-resolve weekly rules tests."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI

from app.models.block import TrainingBlock
from app.services.training_blocks import calendar_week_bounds, calendar_week_label
from app.tests.helpers.seed import seed_training_block, with_session
from app.tests.helpers.weekly_focus_fixtures import (
    require_weekly_focus_service,
    seed_legacy_active_block,
    seed_weekly_focus_block,
)

WRU_B2_AS_OF = date(2026, 6, 7)
WRU_B2_WEEK_START = date(2026, 6, 1)
WRU_B2_WEEK_END = date(2026, 6, 7)
WRU_B2_NEXT_MONDAY = date(2026, 6, 8)
WRU_B2_NEXT_WEEK_START = date(2026, 6, 8)
WRU_B2_NEXT_WEEK_END = date(2026, 6, 14)


def require_training_blocks_service() -> Any:
    return require_weekly_focus_service()


def expected_calendar_week_name(week_start: date, week_end: date) -> str:
    return calendar_week_label(week_start, week_end)


def assert_auto_created_weekly_block(
    block: TrainingBlock,
    *,
    as_of: date,
    week_number: int = 1,
) -> None:
    week_start, week_end = calendar_week_bounds(as_of)
    assert block.period_kind == "weekly_focus"
    assert block.status == "active"
    assert block.start_date == week_start
    assert block.end_date == week_end
    assert block.week_number == week_number
    assert block.focus_series_id is not None
    assert block.name == expected_calendar_week_name(week_start, week_end)


def assert_weekly_focus_api_payload(
    payload: dict[str, Any],
    *,
    as_of: date,
    week_number: int = 1,
) -> None:
    week_start, week_end = calendar_week_bounds(as_of)
    assert payload["period_kind"] == "weekly_focus"
    assert payload["status"] == "active"
    assert payload["start_date"] == week_start.isoformat()
    assert payload["end_date"] == week_end.isoformat()
    assert payload["week_number"] == week_number
    assert payload["focus_series_id"] is not None
    assert payload["name"] == expected_calendar_week_name(week_start, week_end)


def seed_legacy_completed_month_block(
    app_with_test_database: FastAPI,
    *,
    block_id: str = "blk-legacy-completed",
    name: str = "June Rehab Phase",
    start_date: date = date(2026, 5, 1),
    end_date: date = date(2026, 5, 31),
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id=block_id,
        name=name,
        start_date=start_date,
        end_date=end_date,
        status="completed",
    )
    for session in with_session(app_with_test_database):
        block = session.get(TrainingBlock, block_id)
        assert block is not None
        block.period_kind = "legacy"
        session.add(block)
        session.commit()


def seed_week_one_with_rules_and_targets(
    app_with_test_database: FastAPI,
    *,
    block_id: str = "blk-wru-b2-week-1",
) -> None:
    from app.tests.helpers.seed import (
        seed_activity,
        seed_activity_class,
        seed_rule,
        seed_weekly_target,
    )

    seed_activity_class(
        app_with_test_database,
        class_id="cls-wru-b2",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-wru-b2-walk",
        activity_class_id="cls-wru-b2",
        name="Morning Walk",
        default_volume_unit="km",
    )
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=block_id,
        focus_series_id="fs-wru-b2",
        focus_title="WRU B2 focus",
        week_number=1,
        start_date=WRU_B2_WEEK_START,
        end_date=WRU_B2_WEEK_END,
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-wru-b2-enabled",
        training_block_id=block_id,
        activity_class_id="cls-wru-b2",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
        enabled=True,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-wru-b2-disabled",
        training_block_id=block_id,
        activity_class_id="cls-wru-b2",
        rule_type="frequency_limit",
        threshold_value=2.0,
        window_days=7,
        enabled=False,
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wru-b2-walk",
        training_block_id=block_id,
        activity_class_id="cls-wru-b2",
        activity_id="act-wru-b2-walk",
        target_value=3.0,
        target_unit="sessions",
    )


__all__ = [
    "WRU_B2_AS_OF",
    "WRU_B2_NEXT_MONDAY",
    "WRU_B2_NEXT_WEEK_END",
    "WRU_B2_NEXT_WEEK_START",
    "WRU_B2_WEEK_END",
    "WRU_B2_WEEK_START",
    "assert_auto_created_weekly_block",
    "assert_weekly_focus_api_payload",
    "require_training_blocks_service",
    "seed_legacy_completed_month_block",
    "seed_legacy_active_block",
    "seed_week_one_with_rules_and_targets",
]
