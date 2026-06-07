"""Service-level tests for dashboard composition (B5.1)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from sqlmodel import Session

from app.models.goal import Goal
from app.schemas.dashboard import DashboardRead
from app.schemas.load import ActivityClassStatusRead
from app.schemas.load_engine import LoadRiskSummary, Suggestion
from app.services.daily_check_ins import list_daily_check_ins
from app.services.dashboard import get_dashboard
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.goals import list_goals
from app.services.load_engine import (
    compute_class_statuses,
    compute_clean_streak,
    compute_load_risk_summary,
    compute_load_series,
    compute_suggestion_buckets,
    detect_delayed_tax,
    format_iso_date,
)
from app.services.load_queries import (
    activity_class_dict,
    activity_dict,
    check_in_dict,
    incident_dict,
    log_dict,
    rule_dict,
    weekly_target_dict,
)
from app.services.recovery_targets import list_recovery_targets
from app.services.rules import list_rules
from app.services.training_blocks import get_active_training_block
from app.services.weekly_targets import list_weekly_targets
from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    BLOCK_START,
    INCIDENTS,
    LOGS,
    RULES,
    WEEKLY_TARGETS,
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


# ---------------------------------------------------------------------------
# S25.B7 — suggestion_buckets, goal_rows, load_risk_summary in get_dashboard
# ---------------------------------------------------------------------------


def _bucket_ids(rows: list[object], bucket: str) -> set[str]:
    return {row.id for row in rows if row.bucket == bucket}  # type: ignore[attr-defined]


def _goal_dicts(goals: list[Goal]) -> list[dict[str, object]]:
    return [
        {
            "id": goal.id,
            "activity_id": goal.activity_id,
            "status": goal.status,
            "target_date": format_iso_date(goal.target_date),
            "progress_value": goal.progress_value,
            "progress_target": goal.progress_target,
            "progress_unit": goal.progress_unit,
        }
        for goal in goals
    ]


def _expected_suggestion_buckets(session: Session, *, as_of: date) -> list[Suggestion]:
    from app.services.activities import list_activities
    from app.services.activity_classes import list_activity_classes
    from app.services.activity_logs import list_activity_logs

    as_of_str = format_iso_date(as_of)
    activity_classes = [activity_class_dict(cls) for cls in list_activity_classes(session)]
    activities = [activity_dict(activity) for activity in list_activities(session)]
    logs = [
        log_dict(log)
        for log in list_activity_logs(session, end_date=as_of)
    ]
    active_block = get_active_training_block(session)
    rules = [rule_dict(rule) for rule in list_rules(session, active_block.id)]
    recovery_targets = [
        {
            "id": target.id,
            "training_block_id": target.training_block_id,
            "activity_id": target.activity_id,
            "target_frequency": target.target_frequency,
            "frequency_unit": target.frequency_unit,
            "current_streak_days": target.current_streak_days,
        }
        for target in list_recovery_targets(session, active_block.id)
    ]
    weekly_targets = list_weekly_targets(session, active_block.id)
    goals = _goal_dicts(list_goals(session))

    return compute_suggestion_buckets(
        as_of_str,
        activity_classes,
        activities,
        logs,
        rules,
        recovery_targets,
        goals,
        [weekly_target_dict(target) for target in weekly_targets],
    )


def _expected_load_risk_summary(session: Session, *, as_of: date) -> LoadRiskSummary:
    from app.services.activities import list_activities
    from app.services.activity_classes import list_activity_classes
    from app.services.activity_logs import list_activity_logs

    as_of_str = format_iso_date(as_of)
    activity_classes = [activity_class_dict(cls) for cls in list_activity_classes(session)]
    activities = [activity_dict(activity) for activity in list_activities(session)]
    logs = [
        log_dict(log)
        for log in list_activity_logs(session, end_date=as_of)
    ]
    active_block = get_active_training_block(session)
    rules = [rule_dict(rule) for rule in list_rules(session, active_block.id)]
    check_ins = list_daily_check_ins(session, end_date=as_of)
    incidents = [
        incident
        for incident in list_flare_up_incidents(session)
        if incident.incident_date <= as_of
    ]
    delayed_tax_hits = detect_delayed_tax(
        logs,
        activities,
        activity_classes,
        rules,
        [check_in_dict(check_in) for check_in in check_ins],
        [incident_dict(incident) for incident in incidents],
        as_of_str,
    )
    return compute_load_risk_summary(
        as_of_str,
        activity_classes,
        activities,
        logs,
        rules,
        delayed_tax_hits,
    )


def test_get_dashboard_suggestion_buckets_match_engine(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """suggestion_buckets mirrors compute_suggestion_buckets for the same session data."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)
    expected = _expected_suggestion_buckets(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.suggestion_buckets) == len(expected)
    actual_by_id = {row.id: row for row in dashboard.suggestion_buckets}
    for row in expected:
        actual = actual_by_id[row["id"]]
        assert actual.bucket == row["bucket"]
        assert actual.scope == row["scope"]
        assert actual.activity_class_id == row["activity_class_id"]
        assert actual.description == row.get("description")


def test_get_dashboard_suggestion_buckets_rows_include_bucket_scope_description(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """Each suggestion_buckets row exposes bucket, scope, activity_class_id, description."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.suggestion_buckets
    for row in dashboard.suggestion_buckets:
        assert row.bucket in {"do", "rest", "done"}
        assert row.scope in {"activity", "class"}
        assert row.activity_class_id is not None
        assert hasattr(row, "description")


def test_get_dashboard_load_risk_summary_matches_engine(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """load_risk_summary mirrors compute_load_risk_summary for the same session data."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)
    expected = _expected_load_risk_summary(session, as_of=FROZEN_AS_OF)

    assert dashboard.load_risk_summary is not None
    summary = dashboard.load_risk_summary
    assert len(summary.week_days) == len(expected["week_days"])
    assert summary.week_days[-1].date.isoformat() == expected["week_days"][-1]["date"]

    expected_foot = next(
        bar for bar in expected["class_bars"] if bar["activity_class_id"] == "cls-foot"
    )
    actual_foot = next(
        bar for bar in summary.class_bars if bar.activity_class_id == "cls-foot"
    )
    assert actual_foot.actual == pytest.approx(expected_foot["actual"])
    assert actual_foot.limit == pytest.approx(expected_foot["limit"])


def test_get_dashboard_load_risk_summary_null_without_active_block(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """No active block → load_risk_summary is null."""
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

    assert dashboard.load_risk_summary is None
    assert dashboard.suggestion_buckets == []


def test_get_dashboard_goal_rows_empty_when_no_goals(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """goal_rows is an empty list when the user has no goals."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert dashboard.goal_rows == []


def test_get_dashboard_goal_rows_includes_all_statuses(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """goal_rows includes active, achieved, paused, and missed goals."""
    seed_goal(
        app_with_test_database,
        goal_id="row-active",
        title="Run 5k",
        target_date=date(2026, 6, 15),
        timeframe="monthly",
        progress_value=2.0,
        progress_target=5.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="row-achieved",
        title="First 5k",
        target_date=date(2026, 5, 1),
        timeframe="monthly",
        progress_value=5.0,
        progress_target=5.0,
        progress_unit="km",
        status="achieved",
    )
    seed_goal(
        app_with_test_database,
        goal_id="row-paused",
        title="Cycle 100k",
        target_date=date(2026, 8, 1),
        timeframe="monthly",
        status="paused",
    )
    seed_goal(
        app_with_test_database,
        goal_id="row-missed",
        title="Missed target",
        target_date=date(2026, 4, 1),
        timeframe="monthly",
        status="missed",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.goal_rows) == 4
    row_ids = {row.goal_id for row in dashboard.goal_rows}
    assert row_ids == {"row-active", "row-achieved", "row-paused", "row-missed"}


def test_get_dashboard_goal_rows_numeric_fill_ratio_and_qualitative_flag(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """Numeric goals get fill_ratio 0..1; qualitative goals get null fill_ratio."""
    seed_goal(
        app_with_test_database,
        goal_id="row-numeric",
        title="Walk 10km",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        progress_value=3.0,
        progress_target=10.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="row-qualitative",
        title="Feel stronger",
        target_date=date(2026, 7, 1),
        timeframe="monthly",
        status="active",
    )

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    numeric = next(row for row in dashboard.goal_rows if row.goal_id == "row-numeric")
    assert numeric.fill_ratio == pytest.approx(0.3)
    assert numeric.is_qualitative is False

    qualitative = next(row for row in dashboard.goal_rows if row.goal_id == "row-qualitative")
    assert qualitative.fill_ratio is None
    assert qualitative.is_qualitative is True


def test_get_dashboard_weekly_progress_unchanged_by_b7_extension(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """weekly_progress is still populated and unchanged by the B7 extension."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.weekly_progress) == len(WEEKLY_TARGETS)
    assert dashboard.weekly_progress[0].weekly_target_id == WEEKLY_TARGETS[0]["id"]


def test_get_dashboard_omits_legacy_suggestions_field(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """S25.F6 removes legacy suggestions; clients use suggestion_buckets only."""
    seed_dashboard_mock_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert not hasattr(dashboard, "suggestions")
    assert dashboard.suggestion_buckets
