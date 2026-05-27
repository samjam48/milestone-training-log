"""Seed the SQLite test DB with load_engine mockData-shaped fixtures."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI

from app.models.checkin import DailyCheckIn, FlareUpIncident
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
    utc_datetime,
    with_session,
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


def seed_daily_check_in(
    app_with_test_database: FastAPI,
    *,
    check_in_id: str,
    check_in_date: date,
    pain_level: int,
    readiness_level: int = 7,
    stiffness_level: int = 3,
    has_flare_up: bool = False,
    notes: str | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = utc_datetime(11)
        session.add(
            DailyCheckIn(
                id=check_in_id,
                user_id="local",
                check_in_date=check_in_date,
                pain_level=pain_level,
                readiness_level=readiness_level,
                stiffness_level=stiffness_level,
                has_flare_up=has_flare_up,
                notes=notes,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_flare_up_incident(
    app_with_test_database: FastAPI,
    *,
    incident_id: str,
    incident_date: date,
    body_part: str = "Left heel",
    severity: int = 6,
    activity_class_id: str | None = None,
    daily_check_in_id: str | None = None,
    notes: str | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = utc_datetime(12)
        session.add(
            FlareUpIncident(
                id=incident_id,
                user_id="local",
                incident_date=incident_date,
                body_part=body_part,
                severity=severity,
                activity_class_id=activity_class_id,
                daily_check_in_id=daily_check_in_id,
                notes=notes,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_delayed_tax_foot_graph(app_with_test_database: FastAPI) -> None:
    """Foot performance class, active block, and rest rule (no mock logs)."""
    foot_class = next(c for c in ACTIVITY_CLASSES if c["id"] == "cls-foot")
    seed_activity_class(
        app_with_test_database,
        class_id=foot_class["id"],
        name=foot_class["name"],
        class_type=foot_class["type"],
        default_recovery_window_days=foot_class["default_recovery_window_days"],
    )
    walk = next(a for a in ACTIVITIES if a["id"] == "act-walk")
    bike = next(a for a in ACTIVITIES if a["id"] == "act-bike")
    for activity in (walk, bike):
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
        name="Delayed-tax test block",
        start_date=date.fromisoformat(BLOCK_START),
        status="active",
    )
    rest_rule = next(r for r in RULES if r["id"] == "rule-rest-foot")
    seed_rule(
        app_with_test_database,
        rule_id=rest_rule["id"],
        training_block_id=rest_rule["training_block_id"],
        rule_type=rest_rule["rule_type"],
        threshold_value=rest_rule["threshold_value"],
        window_days=rest_rule["window_days"],
        activity_class_id=rest_rule.get("activity_class_id"),
        enabled=rest_rule["enabled"],
    )


def seed_delayed_tax_acute_scenario(app_with_test_database: FastAPI) -> None:
    """14d+ rest, single foot return, high-pain check-in (acute_attribution)."""
    seed_delayed_tax_foot_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-return",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
        volume_value=1.5,
        rpe=4,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-acute",
        check_in_date=date(2026, 5, 22),
        pain_level=8,
        has_flare_up=True,
    )


def seed_delayed_tax_stacked_flare_scenario(app_with_test_database: FastAPI) -> None:
    """Heavy foot-load week then flare check-in (symptom_contributor, no acute)."""
    seed_delayed_tax_foot_graph(app_with_test_database)
    for log_id, activity_id, logged, volume, rpe in (
        ("log-heavy-1", "act-bike", date(2026, 5, 18), 25.0, 6),
        ("log-heavy-2", "act-walk", date(2026, 5, 20), 3.0, 6),
        ("log-heavy-3", "act-bike", date(2026, 5, 21), 20.0, 5),
    ):
        seed_activity_log(
            app_with_test_database,
            log_id=log_id,
            activity_id=activity_id,
            logged_date=logged,
            volume_value=volume,
            rpe=rpe,
        )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-stack",
        check_in_date=date(2026, 5, 23),
        pain_level=7,
        has_flare_up=True,
    )
