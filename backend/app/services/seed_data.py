from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime

from sqlmodel import Session, SQLModel

from app.models.activity import Activity, ActivityClass
from app.models.block import Rule, TrainingBlock, WeeklyTarget
from app.models.checkin import DailyCheckIn, FlareUpIncident
from app.models.goal import Goal
from app.models.log import ActivityLog

LOCAL_USER_ID = "local"
CREATED_AT = datetime.fromisoformat("2026-04-07T06:00:00+00:00")


def _date(value: str) -> date:
    return date.fromisoformat(value)


def _upsert_all(session: Session, rows: Sequence[SQLModel]) -> None:
    for row in rows:
        session.merge(row)


def _activity_classes() -> list[ActivityClass]:
    return [
        ActivityClass(
            id="cls-foot",
            user_id=LOCAL_USER_ID,
            name="High-Intensity Foot Load",
            description="",
            type="performance",
            default_recovery_window_days=3,
            created_at=CREATED_AT,
        ),
        ActivityClass(
            id="cls-recovery",
            user_id=LOCAL_USER_ID,
            name="Low-Impact Recovery",
            description="",
            type="recovery",
            default_recovery_window_days=1,
            created_at=CREATED_AT,
        ),
        ActivityClass(
            id="cls-upper",
            user_id=LOCAL_USER_ID,
            name="Upper Body Strength",
            description="",
            type="performance",
            default_recovery_window_days=2,
            created_at=CREATED_AT,
        ),
    ]


def _activities() -> list[Activity]:
    return [
        Activity(
            id="act-walk",
            user_id=LOCAL_USER_ID,
            activity_class_id="cls-foot",
            name="Morning Walk",
            type="performance",
            default_volume_unit="km",
            is_active=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Activity(
            id="act-bike",
            user_id=LOCAL_USER_ID,
            activity_class_id="cls-foot",
            name="Stationary Bike",
            type="performance",
            default_volume_unit="minutes",
            is_active=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Activity(
            id="act-stretch",
            user_id=LOCAL_USER_ID,
            activity_class_id="cls-recovery",
            name="Light Stretching",
            type="recovery",
            default_volume_unit="minutes",
            is_active=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Activity(
            id="act-pool",
            user_id=LOCAL_USER_ID,
            activity_class_id="cls-recovery",
            name="Pool Walking",
            type="recovery",
            default_volume_unit="minutes",
            is_active=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Activity(
            id="act-bands",
            user_id=LOCAL_USER_ID,
            activity_class_id="cls-upper",
            name="Resistance Bands",
            type="performance",
            default_volume_unit="sets",
            is_active=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
    ]


def _goals() -> list[Goal]:
    return [
        Goal(
            id="goal-return-to-run",
            user_id=LOCAL_USER_ID,
            title="Complete full return-to-run protocol",
            description=(
                "Progress through all walk/run intervals in the rehab plan"
                " without flare-ups."
            ),
            target_date=_date("2026-06-30"),
            timeframe="monthly",
            activity_class_id="cls-foot",
            progress_value=None,
            progress_target=None,
            progress_unit=None,
            status="active",
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Goal(
            id="goal-low-impact-weekly",
            user_id=LOCAL_USER_ID,
            title="Achieve 3× weekly Low-Impact sessions",
            description=(
                "Maintain at least 3 low-impact recovery sessions per week"
                " for a full quarter."
            ),
            target_date=_date("2026-09-30"),
            timeframe="quarterly",
            activity_class_id="cls-recovery",
            progress_value=None,
            progress_target=None,
            progress_unit=None,
            status="active",
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
    ]


def _training_blocks() -> list[TrainingBlock]:
    return [
        TrainingBlock(
            id="blk-1",
            user_id=LOCAL_USER_ID,
            name="Return to Walking — Phase 2",
            start_date=_date("2026-04-07"),
            end_date=_date("2026-05-31"),
            status="active",
            related_goal_id=None,
            notes=None,
            is_review_milestone_hit=False,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        )
    ]


def _rules() -> list[Rule]:
    return [
        Rule(
            id="rule-rest-foot",
            training_block_id="blk-1",
            activity_class_id="cls-foot",
            rule_type="rest_between_class",
            threshold_value=3,
            window_days=3,
            enabled=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Rule(
            id="rule-cap-foot",
            training_block_id="blk-1",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
            window_days=7,
            enabled=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Rule(
            id="rule-freq-foot",
            training_block_id="blk-1",
            activity_class_id="cls-foot",
            rule_type="frequency_limit",
            threshold_value=3,
            window_days=7,
            enabled=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        Rule(
            id="rule-rest-upper",
            training_block_id="blk-1",
            activity_class_id="cls-upper",
            rule_type="rest_between_class",
            threshold_value=2,
            window_days=2,
            enabled=True,
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
    ]


def _weekly_targets() -> list[WeeklyTarget]:
    return [
        WeeklyTarget(
            id="wt-foot",
            training_block_id="blk-1",
            activity_class_id="cls-foot",
            target_value=8,
            target_unit="km",
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
        WeeklyTarget(
            id="wt-recovery",
            training_block_id="blk-1",
            activity_class_id="cls-recovery",
            target_value=4,
            target_unit="sessions",
            created_at=CREATED_AT,
            updated_at=CREATED_AT,
        ),
    ]


def _violation(
    rule_id: str,
    rule_type: str,
    message: str,
    severity: str,
) -> dict[str, str]:
    return {
        "rule_id": rule_id,
        "rule_type": rule_type,
        "message": message,
        "severity": severity,
    }


def _activity_log(
    row_id: str,
    activity_id: str,
    logged_date: str,
    duration_minutes: int,
    volume_value: float,
    volume_unit: str,
    rpe: int,
    post_activity_feel: str,
    rule_violations_at_log: list[dict[str, str]] | None = None,
) -> ActivityLog:
    return ActivityLog(
        id=row_id,
        user_id=LOCAL_USER_ID,
        activity_id=activity_id,
        logged_date=_date(logged_date),
        duration_minutes=duration_minutes,
        volume_value=volume_value,
        volume_unit=volume_unit,
        rpe=rpe,
        post_activity_feel=post_activity_feel,
        notes=None,
        rule_violations_at_log=rule_violations_at_log,
        created_at=CREATED_AT,
        updated_at=CREATED_AT,
    )


def _activity_logs() -> list[ActivityLog]:
    return [
        _activity_log("log-01", "act-walk", "2026-04-08", 20, 1.5, "km", 3, "fine"),
        _activity_log("log-02", "act-bands", "2026-04-10", 30, 3, "sets", 3, "fine"),
        _activity_log("log-03", "act-stretch", "2026-04-12", 15, 15, "minutes", 1, "fine"),
        _activity_log("log-04", "act-walk", "2026-04-14", 25, 2.0, "km", 4, "fine"),
        _activity_log("log-05", "act-stretch", "2026-04-16", 20, 20, "minutes", 1, "fine"),
        _activity_log(
            "log-06", "act-walk", "2026-04-17", 25, 2.5, "km", 5, "mild_discomfort",
            [_violation("rule-rest-foot", "rest_between_class",
                        "Only 3 days since last foot-load session"
                        " — rest window not complete", "caution")],
        ),
        _activity_log("log-07", "act-pool", "2026-04-19", 20, 20, "minutes", 2, "fine"),
        _activity_log("log-08", "act-walk", "2026-04-21", 30, 3.0, "km", 5, "fine"),
        _activity_log("log-09", "act-pool", "2026-04-22", 30, 30, "minutes", 2, "fine"),
        _activity_log(
            "log-10", "act-bike", "2026-04-24", 20, 20, "minutes", 5, "bad",
            [_violation("rule-rest-foot", "rest_between_class",
                        "Breaks 3-day rest rule for foot load"
                        " — only 3 days since morning walk", "caution")],
        ),
        _activity_log("log-11", "act-stretch", "2026-04-28", 15, 15, "minutes", 1, "fine"),
        _activity_log("log-12", "act-pool", "2026-04-30", 20, 20, "minutes", 2, "fine"),
        _activity_log("log-13", "act-stretch", "2026-05-02", 15, 15, "minutes", 1, "fine"),
        _activity_log("log-14", "act-walk", "2026-05-05", 20, 1.5, "km", 3, "fine"),
        _activity_log("log-15", "act-pool", "2026-05-07", 25, 25, "minutes", 2, "fine"),
        _activity_log("log-16", "act-walk", "2026-05-09", 25, 2.0, "km", 4, "fine"),
        _activity_log("log-17", "act-bands", "2026-05-11", 30, 3, "sets", 3, "fine"),
        _activity_log("log-18", "act-pool", "2026-05-12", 30, 30, "minutes", 2, "fine"),
        _activity_log("log-19", "act-walk", "2026-05-13", 30, 2.5, "km", 5, "fine"),
        _activity_log("log-20", "act-pool", "2026-05-14", 30, 30, "minutes", 2, "fine"),
        _activity_log(
            "log-21", "act-bike", "2026-05-15", 20, 20, "minutes", 5, "mild_discomfort",
            [_violation("rule-rest-foot", "rest_between_class",
                        "Breaks 3-day rest rule for foot load"
                        " — 2 days since last walk", "caution")],
        ),
        _activity_log(
            "log-22", "act-walk", "2026-05-16", 30, 3.0, "km", 7, "bad",
            [_violation("rule-rest-foot", "rest_between_class",
                        "Breaks 3-day rest rule for foot load"
                        " — 1 day since last session", "danger")],
        ),
        _activity_log("log-23", "act-stretch", "2026-05-19", 15, 15, "minutes", 1, "fine"),
        _activity_log("log-24", "act-pool", "2026-05-21", 20, 20, "minutes", 2, "fine"),
        _activity_log("log-25", "act-walk", "2026-05-22", 20, 1.5, "km", 3, "fine"),
        _activity_log("log-26", "act-bands", "2026-05-24", 30, 3, "sets", 2, "fine"),
    ]


def _daily_check_ins() -> list[DailyCheckIn]:
    return [
        DailyCheckIn(id="ci-1", user_id=LOCAL_USER_ID, check_in_date=_date("2026-04-24"),
                     pain_level=7, readiness_level=2, stiffness_level=8, has_flare_up=True,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
        DailyCheckIn(id="ci-2", user_id=LOCAL_USER_ID, check_in_date=_date("2026-04-28"),
                     pain_level=4, readiness_level=4, stiffness_level=5, has_flare_up=False,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
        DailyCheckIn(id="ci-3", user_id=LOCAL_USER_ID, check_in_date=_date("2026-05-05"),
                     pain_level=2, readiness_level=7, stiffness_level=3, has_flare_up=False,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
        DailyCheckIn(id="ci-4", user_id=LOCAL_USER_ID, check_in_date=_date("2026-05-16"),
                     pain_level=8, readiness_level=1, stiffness_level=9, has_flare_up=True,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
        DailyCheckIn(id="ci-5", user_id=LOCAL_USER_ID, check_in_date=_date("2026-05-22"),
                     pain_level=2, readiness_level=7, stiffness_level=3, has_flare_up=False,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
        DailyCheckIn(id="ci-6", user_id=LOCAL_USER_ID, check_in_date=_date("2026-05-24"),
                     pain_level=1, readiness_level=8, stiffness_level=2, has_flare_up=False,
                     notes=None, created_at=CREATED_AT, updated_at=CREATED_AT),
    ]


def _flare_up_incidents() -> list[FlareUpIncident]:
    return [
        FlareUpIncident(id="inc-1", user_id=LOCAL_USER_ID, incident_date=_date("2026-04-24"),
                        body_part="Left heel", severity=6, activity_class_id="cls-foot",
                        daily_check_in_id="ci-1", notes=None,
                        created_at=CREATED_AT, updated_at=CREATED_AT),
        FlareUpIncident(id="inc-2", user_id=LOCAL_USER_ID, incident_date=_date("2026-05-16"),
                        body_part="Left heel", severity=8, activity_class_id="cls-foot",
                        daily_check_in_id="ci-4", notes=None,
                        created_at=CREATED_AT, updated_at=CREATED_AT),
    ]


_TRUNCATION_ORDER = [
    "activity_logs",
    "flare_up_incidents",
    "daily_check_ins",
    "goals",
    "rules",
    "weekly_targets",
    "recovery_targets",
    "training_blocks",
    "activities",
    "activity_classes",
]


def run_seed(session: Session) -> None:
    """Truncate all user-data tables then re-insert seed rows.

    Safe to call multiple times — truncate-before-insert makes it idempotent.
    """
    from sqlalchemy import text

    for table in _TRUNCATION_ORDER:
        session.exec(text(f"DELETE FROM {table}"))  # type: ignore[call-overload]
    session.commit()

    for rows in (
        _activity_classes(),
        _activities(),
        _goals(),
        _training_blocks(),
        _rules(),
        _weekly_targets(),
        _activity_logs(),
        _daily_check_ins(),
        _flare_up_incidents(),
    ):
        _upsert_all(session, rows)
    session.commit()
