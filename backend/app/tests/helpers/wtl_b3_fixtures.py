"""Shared WTL.B3 fixtures for This Week weekly progress tests."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI

from app.services.training_blocks import calendar_week_bounds
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_weekly_target,
)
from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block

SUNDAY_AS_OF = "2026-06-07"
MONDAY_AS_OF = "2026-06-08"
PRIOR_SUNDAY = "2026-05-31"
CURRENT_WEEK_MONDAY = "2026-06-01"
CURRENT_WEEK_END = "2026-06-07"
NEXT_WEEK_MONDAY = "2026-06-08"
NEXT_WEEK_END = "2026-06-14"

WTL_B3_BLOCK_ID = "blk-wtl-b3"
WTL_B3_CLASS_ID = "cls-wtl-b3"
WTL_B3_WALK_ID = "act-wtl-walk"
WTL_B3_BIKE_ID = "act-wtl-bike"
WTL_B3_STRETCH_ID = "act-wtl-stretch"

WTL_B3_ACTIVITIES: list[dict[str, Any]] = [
    {
        "id": WTL_B3_WALK_ID,
        "activity_class_id": WTL_B3_CLASS_ID,
        "name": "Morning Walk",
        "type": "performance",
        "default_volume_unit": "km",
        "is_active": True,
    },
    {
        "id": WTL_B3_BIKE_ID,
        "activity_class_id": WTL_B3_CLASS_ID,
        "name": "Stationary Bike",
        "type": "performance",
        "default_volume_unit": "minutes",
        "is_active": True,
    },
    {
        "id": WTL_B3_STRETCH_ID,
        "activity_class_id": WTL_B3_CLASS_ID,
        "name": "Light Stretching",
        "type": "recovery",
        "default_volume_unit": "minutes",
        "is_active": False,
    },
]

WTL_B3_CLASSES: list[dict[str, Any]] = [
    {
        "id": WTL_B3_CLASS_ID,
        "name": "WTL Foot Load",
        "type": "performance",
        "default_recovery_window_days": 3,
    },
]


def _seed_wtl_b3_base_graph(app_with_test_database: FastAPI) -> None:
    week_start, week_end = calendar_week_bounds(date.fromisoformat(SUNDAY_AS_OF))
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=WTL_B3_BLOCK_ID,
        focus_series_id="fs-wtl-b3",
        focus_title=None,
        week_number=1,
        start_date=week_start,
        end_date=week_end,
        status="active",
    )
    for cls in WTL_B3_CLASSES:
        seed_activity_class(
            app_with_test_database,
            class_id=cls["id"],
            name=cls["name"],
            class_type=cls["type"],
            default_recovery_window_days=cls["default_recovery_window_days"],
        )
    for activity in WTL_B3_ACTIVITIES:
        seed_activity(
            app_with_test_database,
            activity_id=activity["id"],
            activity_class_id=activity["activity_class_id"],
            name=activity["name"],
            activity_type=activity["type"],
            default_volume_unit=activity["default_volume_unit"],
            is_active=activity["is_active"],
        )


def seed_wtl_b3_dashboard_graph(app_with_test_database: FastAPI) -> None:
    """Block from April; weekly targets and logs for Monday-Sunday boundary tests."""
    _seed_wtl_b3_base_graph(app_with_test_database)

    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-class",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        target_value=4.0,
        target_unit="sessions",
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-walk",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        activity_id=WTL_B3_WALK_ID,
        target_value=8.0,
        target_unit="km",
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-bike-minutes",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        activity_id=WTL_B3_BIKE_ID,
        target_value=60.0,
        target_unit="minutes",
    )

    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-prior-sunday",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date.fromisoformat(PRIOR_SUNDAY),
        duration_minutes=20,
        volume_value=2.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-monday",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date.fromisoformat(CURRENT_WEEK_MONDAY),
        duration_minutes=25,
        volume_value=3.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-wednesday-bike",
        activity_id=WTL_B3_BIKE_ID,
        logged_date=date(2026, 6, 3),
        duration_minutes=25,
        volume_value=25.0,
        volume_unit="minutes",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-saturday-walk",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date(2026, 6, 6),
        duration_minutes=30,
        volume_value=1.5,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-next-monday",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date.fromisoformat(NEXT_WEEK_MONDAY),
        duration_minutes=20,
        volume_value=4.0,
        volume_unit="km",
    )
