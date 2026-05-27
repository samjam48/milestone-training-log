"""Seed the SQLite test DB with load_engine mockData-shaped fixtures."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI

from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    BLOCK_START,
    LOGS,
    RULES,
    WEEKLY_TARGETS,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_rule,
    seed_training_block,
    seed_weekly_target,
)


def seed_load_mock_graph(app_with_test_database: FastAPI) -> None:
    """Active block blk-1, mock classes/activities/logs/rules/targets."""
    for cls in ACTIVITY_CLASSES:
        seed_activity_class(
            app_with_test_database,
            class_id=cls["id"],
            name=cls["name"],
            description=f"{cls['name']} (mock)",
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

    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Mock Training Block",
        start_date=date.fromisoformat(BLOCK_START),
        status="active",
    )

    for rule in RULES:
        seed_rule(
            app_with_test_database,
            rule_id=rule["id"],
            training_block_id=rule["training_block_id"],
            rule_type=rule["rule_type"],
            threshold_value=rule["threshold_value"],
            window_days=rule["window_days"],
            activity_class_id=rule.get("activity_class_id"),
            enabled=rule["enabled"],
        )

    for target in WEEKLY_TARGETS:
        seed_weekly_target(
            app_with_test_database,
            target_id=target["id"],
            training_block_id=target["training_block_id"],
            activity_class_id=target["activity_class_id"],
            target_value=target["target_value"],
            target_unit=target["target_unit"],
        )

    for log in LOGS:
        seed_activity_log(
            app_with_test_database,
            log_id=log["id"],
            activity_id=log["activity_id"],
            logged_date=date.fromisoformat(log["logged_date"]),
            duration_minutes=log["duration_minutes"],
            volume_value=log["volume_value"],
            volume_unit=log.get("volume_unit"),
            rpe=log.get("rpe"),
            post_activity_feel=log.get("post_activity_feel"),
            rule_violations_at_log=log.get("rule_violations_at_log"),
        )
