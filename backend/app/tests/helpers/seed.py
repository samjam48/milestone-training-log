from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any

from fastapi import FastAPI
from sqlmodel import Session

from app.database import get_session
from app.models.activity import Activity, ActivityClass
from app.models.block import RecoveryTarget, Rule, TrainingBlock, WeeklyTarget
from app.models.goal import Goal
from app.models.log import ActivityLog


def utc_datetime(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 5, 27, hour, minute, tzinfo=UTC)


def with_session(app_with_test_database: FastAPI) -> Iterator[Session]:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    try:
        yield session
    finally:
        session.close()
        try:
            next(session_iterator)
        except StopIteration:
            pass


def seed_activity_class(
    app_with_test_database: FastAPI,
    *,
    class_id: str,
    name: str,
    description: str = "Seeded class",
    class_type: str = "performance",
    default_recovery_window_days: int = 3,
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        session.add(
            ActivityClass(
                id=class_id,
                user_id="local",
                name=name,
                description=description,
                type=class_type,
                default_recovery_window_days=default_recovery_window_days,
                created_at=created_at or utc_datetime(8),
            )
        )
        session.commit()


def seed_activity(
    app_with_test_database: FastAPI,
    *,
    activity_id: str,
    activity_class_id: str,
    name: str,
    activity_type: str = "performance",
    default_volume_unit: str = "minutes",
    is_active: bool = True,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        session.add(
            Activity(
                id=activity_id,
                user_id="local",
                activity_class_id=activity_class_id,
                name=name,
                type=activity_type,
                default_volume_unit=default_volume_unit,
                is_active=is_active,
                created_at=created_at or utc_datetime(9),
                updated_at=updated_at or utc_datetime(9),
            )
        )
        session.commit()


def seed_activity_log(
    app_with_test_database: FastAPI,
    *,
    log_id: str,
    activity_id: str,
    logged_date: date,
    duration_minutes: int = 30,
    volume_value: float = 3.0,
    volume_unit: str | None = "km",
    rpe: int | None = 5,
    post_activity_feel: str | None = "steady",
    notes: str | None = "Seeded log",
    rule_violations_at_log: list[dict[str, Any]] | None = None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        session.add(
            ActivityLog(
                id=log_id,
                user_id="local",
                activity_id=activity_id,
                logged_date=logged_date,
                duration_minutes=duration_minutes,
                volume_value=volume_value,
                volume_unit=volume_unit,
                rpe=rpe,
                post_activity_feel=post_activity_feel,
                notes=notes,
                rule_violations_at_log=rule_violations_at_log,
                created_at=created_at or utc_datetime(10),
                updated_at=updated_at or utc_datetime(10),
            )
        )
        session.commit()


def seed_goal(
    app_with_test_database: FastAPI,
    *,
    goal_id: str = "goal-1",
    title: str = "Walk 20km",
    description: str = "Seeded goal",
    target_date: date = date(2026, 6, 30),
    timeframe: str = "monthly",
    activity_class_id: str | None = None,
    activity_id: str | None = None,
    auto_track_progress: bool = False,
    progress_value: float | None = None,
    progress_target: float | None = None,
    progress_unit: str | None = None,
    status: str = "active",
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = created_at or utc_datetime(7)
        session.add(
            Goal(
                id=goal_id,
                user_id="local",
                title=title,
                description=description,
                target_date=target_date,
                timeframe=timeframe,
                activity_class_id=activity_class_id,
                activity_id=activity_id,
                auto_track_progress=auto_track_progress,
                progress_value=progress_value,
                progress_target=progress_target,
                progress_unit=progress_unit,
                status=status,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_training_block(
    app_with_test_database: FastAPI,
    *,
    block_id: str,
    name: str,
    start_date: date,
    status: str = "active",
    end_date: date | None = None,
    related_goal_id: str | None = None,
    notes: str | None = None,
    is_review_milestone_hit: bool = False,
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = created_at or utc_datetime(8)
        session.add(
            TrainingBlock(
                id=block_id,
                user_id="local",
                name=name,
                start_date=start_date,
                end_date=end_date,
                status=status,
                related_goal_id=related_goal_id,
                notes=notes,
                is_review_milestone_hit=is_review_milestone_hit,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_rule(
    app_with_test_database: FastAPI,
    *,
    rule_id: str,
    training_block_id: str,
    rule_type: str,
    threshold_value: float,
    window_days: int,
    activity_class_id: str | None = None,
    activity_id: str | None = None,
    limit_unit: str | None = None,
    enabled: bool = True,
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = created_at or utc_datetime(9)
        session.add(
            Rule(
                id=rule_id,
                training_block_id=training_block_id,
                activity_class_id=activity_class_id,
                activity_id=activity_id,
                limit_unit=limit_unit,
                rule_type=rule_type,
                threshold_value=threshold_value,
                window_days=window_days,
                enabled=enabled,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_weekly_target(
    app_with_test_database: FastAPI,
    *,
    target_id: str,
    training_block_id: str,
    activity_class_id: str,
    target_value: float,
    target_unit: str,
    activity_id: str | None = None,
    target_kind: str = "minimum",
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = created_at or utc_datetime(9)
        session.add(
            WeeklyTarget(
                id=target_id,
                training_block_id=training_block_id,
                activity_class_id=activity_class_id,
                activity_id=activity_id,
                target_value=target_value,
                target_unit=target_unit,
                target_kind=target_kind,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()


def seed_recovery_target(
    app_with_test_database: FastAPI,
    *,
    target_id: str,
    training_block_id: str,
    activity_id: str,
    target_frequency: int,
    frequency_unit: str,
    current_streak_days: int = 0,
    created_at: datetime | None = None,
) -> None:
    for session in with_session(app_with_test_database):
        now = created_at or utc_datetime(9)
        session.add(
            RecoveryTarget(
                id=target_id,
                training_block_id=training_block_id,
                activity_id=activity_id,
                target_frequency=target_frequency,
                frequency_unit=frequency_unit,
                current_streak_days=current_streak_days,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
