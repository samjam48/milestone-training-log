"""Shared WTL.B4 fixtures for weekly-target-driven suggestion bucket tests."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI

from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_recovery_target,
    seed_rule,
    seed_training_block,
    seed_weekly_target,
)
from app.tests.helpers.wtl_b3_fixtures import (
    CURRENT_WEEK_MONDAY,
    MONDAY_AS_OF,
    WTL_B3_BIKE_ID,
    WTL_B3_BLOCK_ID,
    WTL_B3_CLASS_ID,
    WTL_B3_WALK_ID,
    seed_wtl_b3_dashboard_graph,
)

WTL_B4_SATURDAY_AS_OF = "2026-06-06"
WTL_B4_TUESDAY_AS_OF = "2026-06-09"

WTL_B4_RECOVERY_CLASS_ID = "cls-wtl-b4-recovery"
WTL_B4_STRETCH_ID = "act-wtl-b4-stretch"


def seed_wtl_b4_completed_walk_target_graph(app_with_test_database: FastAPI) -> None:
    """Saturday as_of: walk activity-scoped target fully met at 8 km for the current week."""
    seed_wtl_b3_dashboard_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-complete-walk",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date(2026, 6, 5),
        duration_minutes=35,
        volume_value=3.5,
        volume_unit="km",
    )


def seed_wtl_b4_rest_overrides_target_graph(app_with_test_database: FastAPI) -> None:
    """Sunday as_of: walk has incomplete weekly target but class rest rule applies."""
    seed_wtl_b3_dashboard_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-wtl-b4-rest-foot",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        rule_type="rest_between_class",
        threshold_value=3,
        window_days=3,
    )


def seed_wtl_b4_recovery_daily_only_graph(app_with_test_database: FastAPI) -> None:
    """Recovery activity with daily recovery target and no weekly target."""
    seed_training_block(
        app_with_test_database,
        block_id=WTL_B3_BLOCK_ID,
        name="WTL B4 Block",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_activity_class(
        app_with_test_database,
        class_id=WTL_B4_RECOVERY_CLASS_ID,
        name="WTL Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    seed_activity(
        app_with_test_database,
        activity_id=WTL_B4_STRETCH_ID,
        activity_class_id=WTL_B4_RECOVERY_CLASS_ID,
        name="Light Stretching",
        activity_type="recovery",
        default_volume_unit="minutes",
        is_active=True,
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-wtl-b4-stretch",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_id=WTL_B4_STRETCH_ID,
        target_frequency=3,
        frequency_unit="daily",
    )


def seed_wtl_b4_monday_new_week_graph(app_with_test_database: FastAPI) -> None:
    """Tuesday as_of: prior week complete; new week has one Monday walk log."""
    seed_wtl_b4_completed_walk_target_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-b4-monday-walk",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date.fromisoformat(MONDAY_AS_OF),
        duration_minutes=20,
        volume_value=2.0,
        volume_unit="km",
    )


def seed_wtl_b4_bike_only_weekly_target_graph(app_with_test_database: FastAPI) -> None:
    """Only bike has a weekly target; walk has none."""
    seed_training_block(
        app_with_test_database,
        block_id=WTL_B3_BLOCK_ID,
        name="WTL B4 Bike Only",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_activity_class(
        app_with_test_database,
        class_id=WTL_B3_CLASS_ID,
        name="WTL Foot Load",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_activity(
        app_with_test_database,
        activity_id=WTL_B3_WALK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
        is_active=True,
    )
    seed_activity(
        app_with_test_database,
        activity_id=WTL_B3_BIKE_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        name="Stationary Bike",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-bike-only",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        activity_id=WTL_B3_BIKE_ID,
        target_value=60.0,
        target_unit="minutes",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-b4-bike-partial",
        activity_id=WTL_B3_BIKE_ID,
        logged_date=date.fromisoformat(CURRENT_WEEK_MONDAY),
        duration_minutes=25,
        volume_value=25.0,
        volume_unit="minutes",
    )
