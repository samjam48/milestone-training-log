"""Shared WTL.B5 fixtures for load-tax scoring and dashboard load-series tests."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI

from app.services.training_blocks import calendar_week_bounds
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_rule,
)
from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block

WTL_B5_AS_OF = "2026-06-07"
WTL_B5_BLOCK_ID = "blk-wtl-b5"
WTL_B5_BLOCK_START = "2026-04-07"
WTL_B5_CLASS_ID = "cls-wtl-b5-foot"
WTL_B5_RECOVERY_CLASS_ID = "cls-wtl-b5-recovery"
WTL_B5_WALK_ID = "act-wtl-b5-walk"
WTL_B5_STRETCH_ID = "act-wtl-b5-stretch"
WTL_B5_CREATED_AT = "2026-04-07T06:00:00Z"

WTL_B5_ACTIVITY_CLASSES: list[dict[str, Any]] = [
    {
        "id": WTL_B5_CLASS_ID,
        "name": "WTL B5 Foot Load",
        "type": "performance",
        "default_recovery_window_days": 3,
    },
    {
        "id": WTL_B5_RECOVERY_CLASS_ID,
        "name": "WTL B5 Recovery",
        "type": "recovery",
        "default_recovery_window_days": 1,
    },
]

WTL_B5_ACTIVITIES: list[dict[str, Any]] = [
    {
        "id": WTL_B5_WALK_ID,
        "activity_class_id": WTL_B5_CLASS_ID,
        "name": "Morning Walk",
        "type": "performance",
        "default_volume_unit": "km",
        "is_active": True,
    },
    {
        "id": WTL_B5_STRETCH_ID,
        "activity_class_id": WTL_B5_RECOVERY_CLASS_ID,
        "name": "Light Stretching",
        "type": "recovery",
        "default_volume_unit": "minutes",
        "is_active": True,
    },
]


def wtl_b5_log(
    *,
    log_id: str,
    activity_id: str,
    logged_date: str,
    volume_value: float = 1.0,
    rpe: int = 5,
    volume_unit: str = "km",
    duration_minutes: int | None = None,
) -> dict[str, Any]:
    log: dict[str, Any] = {
        "id": log_id,
        "activity_id": activity_id,
        "logged_date": logged_date,
        "volume_value": volume_value,
        "rpe": rpe,
        "volume_unit": volume_unit,
    }
    if duration_minutes is not None:
        log["duration_minutes"] = duration_minutes
    return log


def wtl_b5_rule(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "training_block_id": WTL_B5_BLOCK_ID,
        "activity_class_id": WTL_B5_CLASS_ID,
        "window_days": 7,
        "enabled": True,
        "created_at": WTL_B5_CREATED_AT,
    }
    base.update(overrides)
    return base


def seed_wtl_b5_dashboard_graph(
    app_with_test_database: FastAPI,
    *,
    include_weekly_load_cap: bool = True,
    weekly_load_cap_threshold: float = 120.0,
) -> None:
    """Minimal active block with performance + recovery activities for load-tax graph tests."""
    week_start, week_end = calendar_week_bounds(date.fromisoformat(WTL_B5_AS_OF))
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=WTL_B5_BLOCK_ID,
        focus_series_id="fs-wtl-b5",
        focus_title=None,
        week_number=1,
        start_date=week_start,
        end_date=week_end,
        status="active",
    )
    seed_activity_class(
        app_with_test_database,
        class_id=WTL_B5_CLASS_ID,
        name="WTL B5 Foot Load",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_activity_class(
        app_with_test_database,
        class_id=WTL_B5_RECOVERY_CLASS_ID,
        name="WTL B5 Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    seed_activity(
        app_with_test_database,
        activity_id=WTL_B5_WALK_ID,
        activity_class_id=WTL_B5_CLASS_ID,
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
    )
    seed_activity(
        app_with_test_database,
        activity_id=WTL_B5_STRETCH_ID,
        activity_class_id=WTL_B5_RECOVERY_CLASS_ID,
        name="Light Stretching",
        activity_type="recovery",
        default_volume_unit="minutes",
    )
    if include_weekly_load_cap:
        seed_rule(
            app_with_test_database,
            rule_id="rule-wtl-b5-cap",
            training_block_id=WTL_B5_BLOCK_ID,
            activity_class_id=WTL_B5_CLASS_ID,
            rule_type="weekly_load_cap",
            threshold_value=weekly_load_cap_threshold,
            window_days=7,
        )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-b5-walk",
        activity_id=WTL_B5_WALK_ID,
        logged_date=date.fromisoformat(WTL_B5_AS_OF),
        duration_minutes=30,
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )
