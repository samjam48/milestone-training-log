"""Service-level tests for goal auto-progress (S25.B3)."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI
from sqlmodel import Session

from app.models.goal import Goal
from app.models.log import ActivityLog
from app.services import goals as goals_service
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    with_session,
)


def _recompute_auto_tracked_goals(session: Session, *, activity_ids: set[str]) -> None:
    recompute = getattr(goals_service, "recompute_auto_tracked_goals", None)
    assert recompute is not None, "recompute_auto_tracked_goals not implemented"
    recompute(session, activity_ids=activity_ids)


def _reload_goal(session: Session, goal_id: str) -> Goal:
    goal = session.get(Goal, goal_id)
    assert goal is not None
    return goal


def _seed_walk_auto_track_goal(
    app_with_test_database: FastAPI,
    *,
    goal_id: str = "goal-auto-walk",
    progress_target: float = 10.0,
    progress_unit: str = "km",
    status: str = "active",
    progress_value: float | None = None,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot",
        name="Walk",
        default_volume_unit="km",
    )
    seed_goal(
        app_with_test_database,
        goal_id=goal_id,
        title="Walk target",
        description="Auto-tracked walking goal",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="cls-foot",
        activity_id="act-walk",
        auto_track_progress=True,
        progress_target=progress_target,
        progress_unit=progress_unit,
        progress_value=progress_value,
        status=status,
    )


def test_recompute_auto_tracked_goals_sums_matching_logs_in_goal_period(
    app_with_test_database: FastAPI,
) -> None:
    """Monthly window ending target_date counts in-period logs for linked activity."""
    _seed_walk_auto_track_goal(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-in-period-a",
        activity_id="act-walk",
        logged_date=date(2026, 6, 10),
        volume_value=5.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-in-period-b",
        activity_id="act-walk",
        logged_date=date(2026, 6, 20),
        volume_value=3.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-before-period",
        activity_id="act-walk",
        logged_date=date(2026, 5, 31),
        volume_value=99.0,
        volume_unit="km",
    )

    for session in with_session(app_with_test_database):
        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        goal = _reload_goal(session, "goal-auto-walk")

    assert goal.progress_value == 8.0
    assert goal.status == "active"


def test_recompute_auto_tracked_goals_ignores_logs_with_mismatched_volume_unit(
    app_with_test_database: FastAPI,
) -> None:
    _seed_walk_auto_track_goal(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-km",
        activity_id="act-walk",
        logged_date=date(2026, 6, 12),
        volume_value=4.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-minutes",
        activity_id="act-walk",
        logged_date=date(2026, 6, 13),
        volume_value=45.0,
        volume_unit="minutes",
    )

    for session in with_session(app_with_test_database):
        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        goal = _reload_goal(session, "goal-auto-walk")

    assert goal.progress_value == 4.0


def test_recompute_auto_tracked_goals_leaves_qualitative_goal_untouched(
    app_with_test_database: FastAPI,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot",
        name="Walk",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-qualitative",
        title="Feel confident on stairs",
        description="Qualitative rehab milestone",
        target_date=date(2026, 7, 15),
        timeframe="monthly",
        status="active",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 6, 15),
        volume_value=12.0,
        volume_unit="km",
    )

    for session in with_session(app_with_test_database):
        before = _reload_goal(session, "goal-qualitative")
        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        after = _reload_goal(session, "goal-qualitative")

    assert before.progress_value is None
    assert before.status == "active"
    assert after.progress_value is None
    assert after.status == "active"
    assert after.updated_at == before.updated_at


def test_recompute_auto_tracked_goals_sets_achieved_when_progress_meets_target(
    app_with_test_database: FastAPI,
) -> None:
    _seed_walk_auto_track_goal(app_with_test_database, progress_target=10.0)
    seed_activity_log(
        app_with_test_database,
        log_id="log-a",
        activity_id="act-walk",
        logged_date=date(2026, 6, 5),
        volume_value=6.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-b",
        activity_id="act-walk",
        logged_date=date(2026, 6, 18),
        volume_value=4.5,
        volume_unit="km",
    )

    for session in with_session(app_with_test_database):
        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        goal = _reload_goal(session, "goal-auto-walk")

    assert goal.progress_value == 10.5
    assert goal.status == "achieved"


def test_recompute_auto_tracked_goals_does_not_revert_achieved_when_sum_drops(
    app_with_test_database: FastAPI,
) -> None:
    """Deleting logs below target must not auto-revert achieved status (manual reset only)."""
    _seed_walk_auto_track_goal(
        app_with_test_database,
        progress_target=10.0,
        status="achieved",
        progress_value=12.0,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-keep",
        activity_id="act-walk",
        logged_date=date(2026, 6, 8),
        volume_value=4.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-remove",
        activity_id="act-walk",
        logged_date=date(2026, 6, 15),
        volume_value=8.0,
        volume_unit="km",
    )

    for session in with_session(app_with_test_database):
        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        goal_after_first = _reload_goal(session, "goal-auto-walk")
        assert goal_after_first.progress_value == 12.0
        assert goal_after_first.status == "achieved"

        log_to_remove = session.get(ActivityLog, "log-remove")
        assert log_to_remove is not None
        session.delete(log_to_remove)
        session.commit()

        _recompute_auto_tracked_goals(session, activity_ids={"act-walk"})
        goal_after_delete = _reload_goal(session, "goal-auto-walk")

    assert goal_after_delete.progress_value == 4.0
    assert goal_after_delete.status == "achieved"
