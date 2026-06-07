"""Shared WTL.B6 fixtures for load-risk rule-limit summary contract tests."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI

from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    BLOCK_START,
    LOGS,
    USER_ID,
    CREATED_AT,
)
from app.services.training_blocks import calendar_week_bounds
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_rule,
)
from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block

# Strip tiers documented in WTL.B6 tests — implementation must match.
LOAD_RISK_STRIP_CAUTION_AT = 2.5
LOAD_RISK_STRIP_DANGER_AT = 5.0

WTL_B6_BLOCK_ID = "blk-wtl-b6"
WTL_B6_CLASS_ID = "cls-foot"
WTL_B6_WALK_ID = "act-walk"
WTL_B6_BIKE_ID = "act-bike"

# Rules mirror frontend mockData.ts — exercise caps are not class-wide.
WTL_B6_RULES: list[dict[str, Any]] = [
    {
        "id": "rule-rest-foot",
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "rule_type": "rest_between_class",
        "threshold_value": 3,
        "window_days": 3,
        "enabled": True,
        "created_at": CREATED_AT,
    },
    {
        "id": "rule-consec-foot",
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "rule_type": "consecutive_day_limit",
        "threshold_value": 2,
        "window_days": 7,
        "enabled": True,
        "created_at": CREATED_AT,
    },
    {
        "id": "rule-vol-walk-weekly",
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "activity_id": WTL_B6_WALK_ID,
        "rule_type": "weekly_volume_cap",
        "threshold_value": 8,
        "window_days": 7,
        "limit_unit": "km",
        "enabled": True,
        "created_at": CREATED_AT,
    },
    {
        "id": "rule-vol-bike-daily",
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "activity_id": WTL_B6_BIKE_ID,
        "rule_type": "daily_volume_cap",
        "threshold_value": 45,
        "window_days": 1,
        "limit_unit": "minutes",
        "enabled": True,
        "created_at": CREATED_AT,
    },
    {
        "id": "rule-freq-foot",
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "rule_type": "frequency_limit",
        "threshold_value": 3,
        "window_days": 7,
        "enabled": True,
        "created_at": CREATED_AT,
    },
]


def wtl_b6_log(
    *,
    log_id: str,
    activity_id: str,
    logged_date: str,
    volume_value: float = 1.0,
    rpe: int = 3,
    volume_unit: str = "km",
    duration_minutes: int | None = None,
) -> dict[str, Any]:
    log: dict[str, Any] = {
        "id": log_id,
        "user_id": USER_ID,
        "activity_id": activity_id,
        "logged_date": logged_date,
        "volume_value": volume_value,
        "rpe": rpe,
        "volume_unit": volume_unit,
    }
    if duration_minutes is not None:
        log["duration_minutes"] = duration_minutes
    return log


def wtl_b6_rule(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "training_block_id": WTL_B6_BLOCK_ID,
        "activity_class_id": WTL_B6_CLASS_ID,
        "window_days": 7,
        "enabled": True,
        "created_at": CREATED_AT,
    }
    base.update(overrides)
    return base


def seed_wtl_b6_dashboard_graph(app_with_test_database: FastAPI) -> None:
    """High-Intensity Foot Load graph with owner-style rule limits (mockData.ts)."""
    for cls in ACTIVITY_CLASSES:
        seed_activity_class(
            app_with_test_database,
            class_id=cls["id"],
            name=cls["name"],
            class_type=cls["type"],
            default_recovery_window_days=cls["default_recovery_window_days"],
        )

    for activity in ACTIVITIES:
        seed_activity(
            app_with_test_database,
            activity_id=activity["id"],
            activity_class_id=activity["activity_class_id"],
            name=activity["name"],
            activity_type=activity["type"],
            default_volume_unit=activity["default_volume_unit"],
            is_active=activity["is_active"],
        )

    week_start, week_end = calendar_week_bounds(date.fromisoformat(AS_OF))
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=WTL_B6_BLOCK_ID,
        focus_series_id="fs-wtl-b6",
        focus_title=None,
        week_number=1,
        start_date=week_start,
        end_date=week_end,
        status="active",
    )

    for rule in WTL_B6_RULES:
        seed_rule(
            app_with_test_database,
            rule_id=rule["id"],
            training_block_id=rule["training_block_id"],
            rule_type=rule["rule_type"],
            threshold_value=rule["threshold_value"],
            window_days=rule["window_days"],
            activity_class_id=rule.get("activity_class_id"),
            activity_id=rule.get("activity_id"),
            limit_unit=rule.get("limit_unit"),
            enabled=rule["enabled"],
        )

    for log in LOGS:
        seed_activity_log(
            app_with_test_database,
            log_id=log["id"],
            activity_id=log["activity_id"],
            logged_date=date.fromisoformat(log["logged_date"]),
            duration_minutes=log.get("duration_minutes"),
            volume_value=log["volume_value"],
            volume_unit=log.get("volume_unit"),
            rpe=log.get("rpe"),
            post_activity_feel=log.get("post_activity_feel"),
            rule_violations_at_log=log.get("rule_violations_at_log"),
        )
