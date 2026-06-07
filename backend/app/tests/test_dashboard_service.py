"""Service-level tests for dashboard composition (B5.1)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any

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
from app.services.training_blocks import calendar_week_bounds, get_active_training_block
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
    seed_rule,
    seed_training_block,
    seed_weekly_target,
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


GRAPH_WINDOW_DAYS = 30


def _graph_window_start(as_of: date) -> date:
    return as_of - timedelta(days=GRAPH_WINDOW_DAYS - 1)


def _expected_load_series_length() -> int:
    return GRAPH_WINDOW_DAYS


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
    assert dashboard.week_load_threshold is None


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

    window_point = next(
        point for point in dashboard.load_series if point.date == date(2026, 5, 5)
    )
    assert window_point.daily_load > 0


def test_get_dashboard_load_series_spans_last_thirty_days_through_as_of_inclusive(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    graph_start = _graph_window_start(FROZEN_AS_OF)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)

    assert len(dashboard.load_series) == _expected_load_series_length()
    assert dashboard.load_series[0].date == graph_start
    assert dashboard.load_series[-1].date == FROZEN_AS_OF
    assert dashboard.load_series[0].date != BLOCK_START_DATE

    expected_series = compute_load_series(
        "cls-foot",
        ACTIVITIES,
        LOGS,
        format_iso_date(graph_start),
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


def test_get_dashboard_without_active_block_auto_creates_weekly_focus(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.services.training_blocks import calendar_week_bounds

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

    week_start, week_end = calendar_week_bounds(FROZEN_AS_OF)
    assert dashboard.block is not None
    assert dashboard.block.period_kind == "weekly_focus"
    assert dashboard.block.start_date == week_start
    assert dashboard.block.end_date == week_end
    assert dashboard.recovery_streaks == []
    assert dashboard.weekly_progress == []
    assert all(status.state == "safe" for status in dashboard.class_statuses)


def test_get_dashboard_previous_blocks_excludes_active_block_and_orders_by_end_date_desc(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block

    current_week_start, current_week_end = calendar_week_bounds(FROZEN_AS_OF)
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-current",
        focus_series_id="fs-prev-blocks",
        focus_title=None,
        week_number=1,
        start_date=current_week_start,
        end_date=current_week_end,
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

    week_start, week_end = calendar_week_bounds(FROZEN_AS_OF)
    assert dashboard.block is not None
    assert dashboard.block.period_kind == "weekly_focus"
    assert dashboard.block.start_date == week_start
    assert dashboard.block.end_date == week_end
    assert dashboard.activity_classes == []
    assert dashboard.activities == []
    assert dashboard.logs == []
    assert dashboard.incidents == []
    assert dashboard.has_checked_in_today is False
    assert dashboard.recovery_streaks == []
    assert dashboard.weekly_progress == []
    assert dashboard.clean_streak == 0
    assert dashboard.week_load_threshold is None


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
    active_block = get_active_training_block(session, as_of=as_of)
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
    active_block = get_active_training_block(session, as_of=as_of)
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
        row for row in expected["rule_limit_rows"] if row["rule_id"] == "rule-cap-foot"
    )
    actual_foot = next(
        row for row in summary.rule_limit_rows if row.rule_id == "rule-cap-foot"
    )
    assert actual_foot.actual == pytest.approx(expected_foot["actual"])
    assert actual_foot.limit == pytest.approx(expected_foot["limit"])


def test_get_dashboard_load_risk_summary_empty_when_no_rules_on_auto_created_block(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """Auto-created weekly block with no rules → empty load-risk derivations."""
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

    assert dashboard.block is not None
    assert dashboard.load_risk_summary is not None
    assert dashboard.load_risk_summary.rule_limit_rows == []
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


# ---------------------------------------------------------------------------
# WTL.B3 — dashboard weekly_progress as This Week
# ---------------------------------------------------------------------------


def _weekly_progress_row(
    dashboard: DashboardRead,
    *,
    weekly_target_id: str,
) -> Any:
    return next(
        row for row in dashboard.weekly_progress if row.weekly_target_id == weekly_target_id
    )


def test_get_dashboard_weekly_progress_sunday_as_of_uses_this_week_window(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import (
        CURRENT_WEEK_END,
        CURRENT_WEEK_MONDAY,
        SUNDAY_AS_OF,
        seed_wtl_b3_dashboard_graph,
    )

    seed_wtl_b3_dashboard_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    class_row = _weekly_progress_row(dashboard, weekly_target_id="wt-wtl-class")
    walk_row = _weekly_progress_row(dashboard, weekly_target_id="wt-wtl-walk")

    assert class_row.value == pytest.approx(3)
    assert walk_row.value == pytest.approx(4.5)
    assert class_row.period_start == date.fromisoformat(CURRENT_WEEK_MONDAY)
    assert class_row.period_end == date.fromisoformat(CURRENT_WEEK_END)


def test_get_dashboard_weekly_progress_monday_as_of_starts_new_week(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import (
        MONDAY_AS_OF,
        NEXT_WEEK_END,
        NEXT_WEEK_MONDAY,
        WTL_B3_WALK_ID,
        seed_wtl_b3_dashboard_graph,
    )

    seed_wtl_b3_dashboard_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(MONDAY_AS_OF))

    walk_row = next(
        row for row in dashboard.weekly_progress if row.activity_id == WTL_B3_WALK_ID
    )

    assert walk_row.value == pytest.approx(4.0)
    assert walk_row.period_start == date.fromisoformat(NEXT_WEEK_MONDAY)
    assert walk_row.period_end == date.fromisoformat(NEXT_WEEK_END)


def test_get_dashboard_weekly_progress_minutes_target_uses_duration_minutes(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import (
        SUNDAY_AS_OF,
        WTL_B3_BIKE_ID,
        seed_wtl_b3_dashboard_graph,
    )

    seed_wtl_b3_dashboard_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-bike-duration-only",
        activity_id=WTL_B3_BIKE_ID,
        logged_date=date(2026, 6, 5),
        duration_minutes=20,
        volume_value=999.0,
        volume_unit="km",
    )

    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    bike_row = _weekly_progress_row(dashboard, weekly_target_id="wt-wtl-bike-minutes")

    assert bike_row.value == pytest.approx(45.0)
    assert bike_row.unit == "minutes"


def test_get_dashboard_weekly_progress_activity_scoped_ignores_other_class_logs(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import (
        SUNDAY_AS_OF,
        WTL_B3_BIKE_ID,
        WTL_B3_BLOCK_ID,
        WTL_B3_CLASS_ID,
        WTL_B3_WALK_ID,
        _seed_wtl_b3_base_graph,
    )

    _seed_wtl_b3_base_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-walk-sessions",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        activity_id=WTL_B3_WALK_ID,
        target_value=3.0,
        target_unit="sessions",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-walk-a",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date(2026, 6, 2),
        duration_minutes=20,
        volume_value=1.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-bike-a",
        activity_id=WTL_B3_BIKE_ID,
        logged_date=date(2026, 6, 3),
        duration_minutes=20,
        volume_value=20.0,
        volume_unit="minutes",
    )

    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))
    walk_sessions = _weekly_progress_row(dashboard, weekly_target_id="wt-wtl-walk-sessions")

    assert walk_sessions.value == pytest.approx(1)


def test_get_dashboard_weekly_progress_excludes_logs_before_monday(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import (
        WTL_B3_BLOCK_ID,
        WTL_B3_CLASS_ID,
        WTL_B3_WALK_ID,
        _seed_wtl_b3_base_graph,
    )

    _seed_wtl_b3_base_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-wtl-only-prior",
        training_block_id=WTL_B3_BLOCK_ID,
        activity_class_id=WTL_B3_CLASS_ID,
        target_value=2.0,
        target_unit="sessions",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-prior-only",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date(2026, 5, 31),
        duration_minutes=20,
        volume_value=1.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-monday-only",
        activity_id=WTL_B3_WALK_ID,
        logged_date=date(2026, 6, 1),
        duration_minutes=20,
        volume_value=1.0,
        volume_unit="km",
    )

    dashboard = get_dashboard(session, as_of=date(2026, 6, 3))
    prior_only = _weekly_progress_row(dashboard, weekly_target_id="wt-wtl-only-prior")

    assert prior_only.value == pytest.approx(1)


def test_get_dashboard_weekly_progress_empty_when_no_targets(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF, _seed_wtl_b3_base_graph

    _seed_wtl_b3_base_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    assert dashboard.weekly_progress == []


# ---------------------------------------------------------------------------
# WTL.B4 — suggestion_buckets driven by weekly target completion
# ---------------------------------------------------------------------------


def _suggestion_row(
    dashboard: DashboardRead,
    *,
    row_id: str,
    bucket: str,
) -> Any:
    return next(
        row for row in dashboard.suggestion_buckets if row.id == row_id and row.bucket == bucket
    )


def test_get_dashboard_suggestion_buckets_incomplete_weekly_target_in_do_with_reason(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF, seed_wtl_b3_dashboard_graph

    seed_wtl_b3_dashboard_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    walk_do = _suggestion_row(dashboard, row_id="act-wtl-walk", bucket="do")
    assert "km left this week" in walk_do.reason


def test_get_dashboard_suggestion_buckets_completed_weekly_target_absent_from_do(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF
    from app.tests.helpers.wtl_b4_fixtures import seed_wtl_b4_completed_walk_target_graph

    seed_wtl_b4_completed_walk_target_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    do_ids = _bucket_ids(dashboard.suggestion_buckets, "do")
    assert "act-wtl-walk" not in do_ids


def test_get_dashboard_suggestion_buckets_rest_overrides_weekly_target(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF
    from app.tests.helpers.wtl_b4_fixtures import seed_wtl_b4_rest_overrides_target_graph

    seed_wtl_b4_rest_overrides_target_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    do_ids = _bucket_ids(dashboard.suggestion_buckets, "do")
    rest_ids = _bucket_ids(dashboard.suggestion_buckets, "rest")
    assert "act-wtl-walk" not in do_ids
    assert "act-wtl-walk" in rest_ids


def test_get_dashboard_suggestion_buckets_logged_today_in_done_not_do(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.seed import seed_activity_log
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF, seed_wtl_b3_dashboard_graph

    seed_wtl_b3_dashboard_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-wtl-b4-sunday-walk",
        activity_id="act-wtl-walk",
        logged_date=date.fromisoformat(SUNDAY_AS_OF),
        duration_minutes=20,
        volume_value=1.0,
        volume_unit="km",
    )

    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    assert "act-wtl-walk" in _bucket_ids(dashboard.suggestion_buckets, "done")
    assert "act-wtl-walk" not in _bucket_ids(dashboard.suggestion_buckets, "do")


def test_get_dashboard_suggestion_buckets_recovery_daily_target_alone_not_in_do(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF
    from app.tests.helpers.wtl_b4_fixtures import (
        WTL_B4_STRETCH_ID,
        seed_wtl_b4_recovery_daily_only_graph,
    )

    seed_wtl_b4_recovery_daily_only_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    do_ids = _bucket_ids(dashboard.suggestion_buckets, "do")
    assert WTL_B4_STRETCH_ID not in do_ids


def test_get_dashboard_suggestion_buckets_monday_new_week_returns_incomplete_target_to_do(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b4_fixtures import (
        WTL_B4_TUESDAY_AS_OF,
        seed_wtl_b4_monday_new_week_graph,
    )

    seed_wtl_b4_monday_new_week_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(WTL_B4_TUESDAY_AS_OF))

    walk_do = _suggestion_row(dashboard, row_id="act-wtl-walk", bucket="do")
    assert "km left this week" in walk_do.reason


def test_get_dashboard_suggestion_buckets_no_weekly_target_activity_not_in_do(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b3_fixtures import SUNDAY_AS_OF
    from app.tests.helpers.wtl_b4_fixtures import seed_wtl_b4_bike_only_weekly_target_graph

    seed_wtl_b4_bike_only_weekly_target_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(SUNDAY_AS_OF))

    do_ids = _bucket_ids(dashboard.suggestion_buckets, "do")
    assert "act-wtl-walk" not in do_ids
    assert "act-wtl-bike" in do_ids


# ---------------------------------------------------------------------------
# WTL.B5 — load-tax load_series and nullable graph threshold
# ---------------------------------------------------------------------------


WTL_B5_GRAPH_WINDOW_DAYS = 30


def _wtl_b5_graph_start(as_of: date) -> date:
    return as_of - timedelta(days=WTL_B5_GRAPH_WINDOW_DAYS - 1)


def test_get_dashboard_load_series_spans_last_thirty_days_not_block_start(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b5_fixtures import WTL_B5_AS_OF, seed_wtl_b5_dashboard_graph

    seed_wtl_b5_dashboard_graph(app_with_test_database)
    as_of = date.fromisoformat(WTL_B5_AS_OF)
    expected_start = _wtl_b5_graph_start(as_of)

    dashboard = get_dashboard(session, as_of=as_of)

    assert len(dashboard.load_series) == WTL_B5_GRAPH_WINDOW_DAYS
    assert dashboard.load_series[0].date == expected_start
    assert dashboard.load_series[-1].date == as_of
    assert dashboard.load_series[0].date != BLOCK_START_DATE


def test_get_dashboard_load_series_matches_load_tax_engine_series(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.services.activities import list_activities
    from app.services.activity_classes import list_activity_classes
    from app.services.activity_logs import list_activity_logs
    from app.tests.helpers.wtl_b5_fixtures import (
        WTL_B5_AS_OF,
        WTL_B5_BLOCK_ID,
        WTL_B5_CLASS_ID,
        seed_wtl_b5_dashboard_graph,
    )

    seed_wtl_b5_dashboard_graph(app_with_test_database)
    as_of = date.fromisoformat(WTL_B5_AS_OF)
    graph_start = _wtl_b5_graph_start(as_of)

    active_block = get_active_training_block(session, as_of=as_of)
    assert active_block.id == WTL_B5_BLOCK_ID

    activity_classes = [activity_class_dict(cls) for cls in list_activity_classes(session)]
    activities = [activity_dict(activity) for activity in list_activities(session)]
    logs = [log_dict(log) for log in list_activity_logs(session, end_date=as_of)]
    rules = [rule_dict(rule) for rule in list_rules(session, active_block.id)]

    expected = compute_load_series(
        WTL_B5_CLASS_ID,
        activities,
        logs,
        format_iso_date(graph_start),
        WTL_B5_AS_OF,
        activity_classes=activity_classes,
        rules=rules,
    )

    dashboard = get_dashboard(session, as_of=as_of)

    assert len(dashboard.load_series) == len(expected)
    for actual, engine_point in zip(dashboard.load_series, expected, strict=True):
        assert actual.date.isoformat() == engine_point["date"]
        assert actual.load == pytest.approx(engine_point["load"])
        assert actual.daily_load == pytest.approx(engine_point["daily_load"])


def test_get_dashboard_load_series_daily_load_is_load_tax_not_raw_volume_rpe(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b5_fixtures import WTL_B5_AS_OF, seed_wtl_b5_dashboard_graph

    seed_wtl_b5_dashboard_graph(app_with_test_database)
    dashboard = get_dashboard(session, as_of=date.fromisoformat(WTL_B5_AS_OF))

    as_of_point = next(
        point for point in dashboard.load_series if point.date.isoformat() == WTL_B5_AS_OF
    )
    assert as_of_point.daily_load == pytest.approx(1.5)
    assert as_of_point.daily_load != pytest.approx(10.0)


def test_get_dashboard_week_load_threshold_null_without_explicit_load_tax_cap(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b5_fixtures import WTL_B5_AS_OF, seed_wtl_b5_dashboard_graph

    seed_wtl_b5_dashboard_graph(
        app_with_test_database,
        include_weekly_load_cap=True,
        weekly_load_cap_threshold=120.0,
    )
    dashboard = get_dashboard(session, as_of=date.fromisoformat(WTL_B5_AS_OF))

    assert dashboard.week_load_threshold is None


def test_get_dashboard_week_load_threshold_null_when_no_cap_rules(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b5_fixtures import WTL_B5_AS_OF, seed_wtl_b5_dashboard_graph

    seed_wtl_b5_dashboard_graph(
        app_with_test_database,
        include_weekly_load_cap=False,
    )
    dashboard = get_dashboard(session, as_of=date.fromisoformat(WTL_B5_AS_OF))

    assert dashboard.week_load_threshold is None


# ---------------------------------------------------------------------------
# WTL.B6 — load_risk_summary rule-limit rows contract
# ---------------------------------------------------------------------------


def test_get_dashboard_load_risk_summary_rule_limit_rows_match_engine(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    """Dashboard load_risk_summary mirrors WTL.B6 rule_limit_rows from the engine."""
    from app.tests.helpers.wtl_b6_fixtures import seed_wtl_b6_dashboard_graph

    seed_wtl_b6_dashboard_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)
    expected = _expected_load_risk_summary(session, as_of=FROZEN_AS_OF)

    assert dashboard.load_risk_summary is not None
    summary = dashboard.load_risk_summary
    assert len(summary.week_days) == 7
    assert summary.week_days[-1].date == FROZEN_AS_OF

    for day in summary.week_days:
        assert day.state in {"safe", "caution", "danger"}

    assert hasattr(summary, "rule_limit_rows")
    expected_rows = expected["rule_limit_rows"]
    actual_rows = summary.rule_limit_rows
    assert len(actual_rows) == len(expected_rows)

    for actual, exp in zip(actual_rows, expected_rows, strict=True):
        assert actual.rule_id == exp["rule_id"]
        assert actual.scope == exp["scope"]
        assert actual.actual == pytest.approx(exp["actual"])
        assert actual.limit == pytest.approx(exp["limit"])
        assert actual.state == exp["state"]


def test_get_dashboard_load_risk_summary_foot_load_separate_class_and_activity_rows(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wtl_b6_fixtures import seed_wtl_b6_dashboard_graph

    seed_wtl_b6_dashboard_graph(app_with_test_database)

    dashboard = get_dashboard(session, as_of=FROZEN_AS_OF)
    assert dashboard.load_risk_summary is not None

    rows = dashboard.load_risk_summary.rule_limit_rows
    class_freq = next(row for row in rows if row.rule_id == "rule-freq-foot")
    walk_weekly = next(row for row in rows if row.rule_id == "rule-vol-walk-weekly")
    bike_daily = next(row for row in rows if row.rule_id == "rule-vol-bike-daily")

    assert class_freq.scope == "class"
    assert class_freq.unit == "sessions"
    assert walk_weekly.scope == "activity"
    assert walk_weekly.activity_id == "act-walk"
    assert walk_weekly.unit == "km"
    assert bike_daily.scope == "activity"
    assert bike_daily.activity_id == "act-bike"
    assert bike_daily.unit == "minutes"

    assert not any(
        row.scope == "class" and row.rule_type == "weekly_volume_cap"
        for row in rows
    )


def test_dashboard_ensure_active_weekly_focus_monday_boundary(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import (
        MONDAY_AS_OF,
        SUNDAY_AS_OF,
        WEEK_ONE_END,
        WEEK_ONE_START,
        WEEK_TWO_END,
        WEEK_TWO_START,
        seed_weekly_focus_block,
    )

    seed_activity_class(
        app_with_test_database,
        class_id="cls-dash-wf",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-dash-wf",
        activity_class_id="cls-dash-wf",
        name="Morning Walk",
        default_volume_unit="km",
    )
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-dash-week-1",
        focus_series_id="fs-dash",
        focus_title="Dashboard focus",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-dash-week-1",
        training_block_id="blk-dash-week-1",
        activity_class_id="cls-dash-wf",
        rule_type="weekly_load_cap",
        threshold_value=80.0,
        window_days=7,
        enabled=True,
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-dash-week-1",
        training_block_id="blk-dash-week-1",
        activity_class_id="cls-dash-wf",
        activity_id="act-dash-wf",
        target_value=2.0,
        target_unit="sessions",
    )

    sunday_dashboard = get_dashboard(session, as_of=SUNDAY_AS_OF)
    assert sunday_dashboard.block is not None
    assert sunday_dashboard.block.id == "blk-dash-week-1"
    assert sunday_dashboard.block.week_number == 1

    monday_dashboard = get_dashboard(session, as_of=MONDAY_AS_OF)
    assert monday_dashboard.block is not None
    assert monday_dashboard.block.id != "blk-dash-week-1"
    assert monday_dashboard.block.week_number == 2
    assert monday_dashboard.block.start_date == WEEK_TWO_START
    assert monday_dashboard.block.end_date == WEEK_TWO_END
    assert monday_dashboard.block.focus_title == "Dashboard focus"
    assert len(monday_dashboard.weekly_progress) == 1
    progress = monday_dashboard.weekly_progress[0]
    assert progress.activity_id == "act-dash-wf"
    assert progress.target == 2.0
    assert progress.period_start == WEEK_TWO_START
    assert progress.period_end == WEEK_TWO_END


def test_dashboard_auto_creates_active_week_when_no_focus_exists(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import SUNDAY_AS_OF, WEEK_ONE_END, WEEK_ONE_START

    seed_activity_class(
        app_with_test_database,
        class_id="cls-no-focus",
        name="Foot Load",
    )

    dashboard = get_dashboard(session, as_of=SUNDAY_AS_OF)

    assert dashboard.block is not None
    assert dashboard.block.period_kind == "weekly_focus"
    assert dashboard.block.start_date == WEEK_ONE_START
    assert dashboard.block.end_date == WEEK_ONE_END
    assert dashboard.weekly_progress == []
    assert dashboard.recovery_streaks == []
