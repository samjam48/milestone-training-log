"""Service-level tests for dashboard composition (B5.1)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from sqlmodel import Session

from app.schemas.dashboard import DashboardRead
from app.schemas.load import ActivityClassStatusRead
from app.services.dashboard import get_dashboard
from app.services.load_engine import (
    compute_class_statuses,
    compute_clean_streak,
    compute_load_series,
)
from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    BLOCK_START,
    INCIDENTS,
    LOGS,
    RULES,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    seed_recovery_target,
    seed_training_block,
    with_session,
)

FROZEN_AS_OF = date.fromisoformat(AS_OF)
BLOCK_START_DATE = date.fromisoformat(BLOCK_START)
LOG_RESPONSE_WINDOW_START = FROZEN_AS_OF - timedelta(days=29)


@pytest.fixture
def session(app_with_test_database: FastAPI) -> Iterator[Session]:
    for db_session in with_session(app_with_test_database):
        yield db_session


def _foot_status(dashboard: DashboardRead) -> ActivityClassStatusRead:
    return next(
        status
        for status in dashboard.class_statuses
        if status.activity_class_id == "cls-foot"
    )


def _expected_foot_state() -> str:
    statuses = compute_class_statuses(
        AS_OF,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        LOGS,
        RULES,
    )
    foot = next(status for status in statuses if status["activity_class_id"] == "cls-foot")
    return foot["state"]


def _expected_clean_streak() -> int:
    return compute_clean_streak(LOGS)


def _expected_load_series_length() -> int:
    return (FROZEN_AS_OF - BLOCK_START_DATE).days + 1


def _expected_incident_dates() -> list[str]:
    return sorted({incident["incident_date"] for incident in INCIDENTS})


def _expected_logs_in_response_window() -> list[dict[str, object]]:
    return [
        log
        for log in LOGS
        if LOG_RESPONSE_WINDOW_START
        <= date.fromisoformat(log["logged_date"])
        <= FROZEN_AS_OF
    ]


def test_get_dashboard_cls_foot_status_matches_compute_class_statuses(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    foot = _foot_status(dashboard)
    assert foot.state == _expected_foot_state()
    assert foot.state == "caution"
    assert dashboard.user_name == "Sam"
    assert dashboard.week_load_threshold == 120


def test_get_dashboard_has_checked_in_today_false_without_as_of_check_in(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.has_checked_in_today is False


def test_get_dashboard_flare_up_dates_include_seed_incidents(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.flare_up_dates == _expected_incident_dates()


def test_get_dashboard_clean_streak_matches_compute_clean_streak(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.clean_streak == _expected_clean_streak()


def test_get_dashboard_logs_limited_to_30_day_window_but_engine_uses_full_history(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)
    expected_window_logs = _expected_logs_in_response_window()

    assert len(dashboard.logs) == len(expected_window_logs)
    for log in dashboard.logs:
        assert LOG_RESPONSE_WINDOW_START <= log.logged_date <= FROZEN_AS_OF

    assert _foot_status(dashboard).state == _expected_foot_state()

    early_block_point = next(
        point for point in dashboard.load_series if point.date == date(2026, 4, 8)
    )
    assert early_block_point.daily_load > 0


def test_get_dashboard_load_series_spans_block_start_through_as_of_inclusive(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.load_series) == _expected_load_series_length()
    assert dashboard.load_series[0].date == BLOCK_START_DATE
    assert dashboard.load_series[-1].date == FROZEN_AS_OF

    expected_series = compute_load_series(
        "cls-foot",
        ACTIVITIES,
        LOGS,
        BLOCK_START,
        AS_OF,
    )
    assert len(dashboard.load_series) == len(expected_series)


def test_get_dashboard_recovery_streaks_populated_from_active_block_targets(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-stretch",
        training_block_id="blk-1",
        activity_id="act-stretch",
        target_frequency=3,
        frequency_unit="daily",
        current_streak_days=5,
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.recovery_streaks
    stretch = next(
        streak for streak in dashboard.recovery_streaks if streak.recovery_target_id == "rt-stretch"
    )
    assert stretch.activity_name == "Light Stretching"
    assert stretch.activity_class_id == "cls-recovery"
    assert stretch.target_frequency == 3
    assert stretch.frequency_unit == "daily"
    assert stretch.current_streak_days == 5


def test_get_dashboard_without_active_block_returns_neutral_empty_payload(
    app_with_test_database: FastAPI,
    session: Session,
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

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.block is None
    assert dashboard.recovery_streaks == []
    assert dashboard.weekly_progress == []
    assert dashboard.daily_scores == []
    assert dashboard.load_series == []
    assert all(status.state == "safe" for status in dashboard.class_statuses)


def test_get_dashboard_previous_blocks_excludes_active_block_and_orders_by_end_date_desc(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-current",
        name="Current block",
        start_date=date(2026, 5, 20),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-recent",
        name="Recent block",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 5, 10),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-older",
        name="Older block",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 20),
        status="archived",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-open-ended",
        name="Open-ended block",
        start_date=date(2026, 5, 1),
        status="completed",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert [block.id for block in dashboard.previous_blocks] == [
        "blk-recent",
        "blk-older",
        "blk-open-ended",
    ]
    assert all(block.status != "active" for block in dashboard.previous_blocks)


def test_get_dashboard_previous_blocks_still_populates_when_no_active_block_exists(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-completed",
        name="Completed block",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 5, 10),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-archived",
        name="Archived block",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 20),
        status="archived",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert [block.id for block in dashboard.previous_blocks] == [
        "blk-completed",
        "blk-archived",
    ]
    assert all(block.status != "active" for block in dashboard.previous_blocks)


def test_get_dashboard_empty_database_returns_neutral_payload(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.block is None
    assert dashboard.activity_classes == []
    assert dashboard.activities == []
    assert dashboard.logs == []
    assert dashboard.incidents == []
    assert dashboard.has_checked_in_today is False
    assert dashboard.recovery_streaks == []
    assert dashboard.weekly_progress == []
    assert dashboard.daily_scores == []
    assert dashboard.load_series == []
    assert dashboard.clean_streak == 0
    assert dashboard.week_load_threshold == 0


def test_get_dashboard_excludes_records_after_as_of(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    baseline = get_dashboard(session, as_of=FROZEN_AS_OF)

    seed_activity_log(
        app_with_test_database,
        log_id="log-future",
        activity_id="act-walk",
        logged_date=date(2026, 5, 26),
        volume_value=99.0,
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert all(log.id != "log-future" for log in dashboard.logs)
    assert dashboard.clean_streak == baseline.clean_streak
    assert _foot_status(dashboard).state == _foot_status(baseline).state


# ---------------------------------------------------------------------------
# B8.1 — goals field on dashboard
# ---------------------------------------------------------------------------


def test_get_dashboard_goals_includes_all_statuses_for_goals_tab(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """goals list includes active, achieved, and paused (Goals tab sections)."""
    seed_goal(
        app_with_test_database,
        goal_id="goal-active-1",
        title="Run 5k",
        target_date=date(2026, 6, 15),
        timeframe="monthly",
        progress_target=5.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-active-2",
        title="Swim 10k",
        target_date=date(2026, 7, 1),
        timeframe="monthly",
        progress_target=10.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-achieved",
        title="First 5k",
        target_date=date(2026, 5, 1),
        timeframe="monthly",
        status="achieved",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-paused",
        title="Cycle 100k",
        target_date=date(2026, 8, 1),
        timeframe="monthly",
        status="paused",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.goals) == 4
    goal_ids = {g.id for g in dashboard.goals}
    assert goal_ids == {
        "goal-active-1",
        "goal-active-2",
        "goal-achieved",
        "goal-paused",
    }


def test_get_dashboard_goals_fields_round_trip_correctly(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """A known active goal's progress_target and status survive the service round-trip."""
    seed_goal(
        app_with_test_database,
        goal_id="goal-rt",
        title="Marathon prep",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        progress_target=42.2,
        progress_unit="km",
        status="active",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    matched = next(g for g in dashboard.goals if g.id == "goal-rt")
    assert matched.progress_target == 42.2
    assert matched.status == "active"


def test_get_dashboard_goals_includes_paused_when_no_active_goals(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """paused-only goals still appear on dashboard for Goals tab archived section."""
    seed_goal(
        app_with_test_database,
        goal_id="goal-paused-only",
        title="Paused goal",
        target_date=date(2026, 9, 1),
        timeframe="monthly",
        status="paused",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.goals) == 1
    assert dashboard.goals[0].id == "goal-paused-only"
    assert dashboard.goals[0].status == "paused"


def test_get_dashboard_goals_empty_when_no_goals_exist(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """goals is an empty list when the user has no goals."""
    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.goals == []


def test_get_dashboard_skips_recovery_streak_when_activity_missing(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-missing-activity",
        training_block_id="blk-1",
        activity_id="act-does-not-exist",
        target_frequency=1,
        frequency_unit="daily",
        current_streak_days=2,
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-stretch",
        training_block_id="blk-1",
        activity_id="act-stretch",
        target_frequency=3,
        frequency_unit="daily",
        current_streak_days=5,
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.recovery_streaks) == 1
    assert dashboard.recovery_streaks[0].recovery_target_id == "rt-stretch"
