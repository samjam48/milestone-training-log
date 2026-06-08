"""Dashboard aggregate composer — loads local data and delegates to load_engine."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from sqlmodel import Session

from app.models.activity import Activity
from app.models.block import RecoveryTarget, Rule
from app.models.goal import Goal
from app.schemas.activities import ActivityRead
from app.schemas.activity_classes import ActivityClassRead
from app.schemas.activity_logs import ActivityLogRead
from app.schemas.dashboard import (
    DashboardRead,
    GoalDashboardRowRead,
    RecoveryStreakRead,
    daily_safety_score_from_dict,
    load_point_from_dict,
    load_risk_summary_from_dict,
)
from app.schemas.flare_up_incidents import FlareUpIncidentRead
from app.schemas.goals import GoalRead
from app.schemas.load import (
    ActivityClassStatusRead,
    SuggestionRead,
    WeeklyProgressRead,
)
from app.schemas.load_engine import RuleDict, Suggestion
from app.schemas.training_blocks import TrainingBlockRead
from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.activity_logs import list_activity_logs
from app.services.daily_check_ins import list_daily_check_ins
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.goals import list_goals
from app.services.load_engine import (
    compute_class_statuses,
    compute_clean_streak,
    compute_daily_safety_scores,
    compute_load_risk_summary,
    compute_load_series,
    compute_suggestion_buckets,
    compute_weekly_progress,
    detect_delayed_tax,
    format_iso_date,
    this_week_bounds,
)
from app.services.load_queries import (
    activity_class_dict,
    activity_dict,
    check_in_dict,
    incident_dict,
    log_dict,
    resolve_as_of,
    resolve_graph_class_id,
    rule_dict,
    weekly_target_dict,
)
from app.services.recovery_targets import list_recovery_targets
from app.services.rules import list_rules
from app.services.training_blocks import (
    TrainingBlockNotFoundError,
    get_active_training_block,
    list_training_blocks,
)
from app.services.weekly_targets import list_weekly_targets
from app.settings import settings


def get_dashboard(session: Session, *, as_of: date | None = None) -> DashboardRead:
    resolved = resolve_as_of(as_of)
    as_of_str = format_iso_date(resolved)
    log_window_start = resolved - timedelta(days=29)

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    all_logs = list_activity_logs(session, end_date=resolved)
    check_ins = list_daily_check_ins(session, end_date=resolved)
    incidents = [
        incident
        for incident in list_flare_up_incidents(session)
        if incident.incident_date <= resolved
    ]

    class_dicts = [activity_class_dict(cls) for cls in activity_classes]
    activity_dicts = [activity_dict(activity) for activity in activities]
    log_dicts = [log_dict(log) for log in all_logs]
    check_in_dicts = [check_in_dict(check_in) for check_in in check_ins]
    incident_dicts = [incident_dict(incident) for incident in incidents]

    response_logs = [
        log for log in all_logs if log_window_start <= log.logged_date <= resolved
    ]

    rules: list[Rule] = []
    weekly_targets = []
    recovery_targets = []
    block_read: TrainingBlockRead | None = None
    block_start: str | None = None

    try:
        active_block = get_active_training_block(session, as_of=resolved)
        block_read = TrainingBlockRead.model_validate(active_block)
        block_start = format_iso_date(active_block.start_date)
        rules = list_rules(session, active_block.id)
        weekly_targets = list_weekly_targets(session, active_block.id)
        recovery_targets = list_recovery_targets(session, active_block.id)
    except TrainingBlockNotFoundError:
        pass

    rule_dicts = [rule_dict(rule) for rule in rules]
    target_dicts = [weekly_target_dict(target) for target in weekly_targets]
    dashboard_goals = list_goals(session)

    class_statuses = compute_class_statuses(
        as_of_str,
        class_dicts,
        activity_dicts,
        log_dicts,
        rule_dicts,
    )
    suggestion_buckets: list[Suggestion] = []
    load_risk_summary = None
    if block_start is not None:
        goal_dicts = _goal_dicts(dashboard_goals)
        recovery_target_dicts = [
            {
                "id": target.id,
                "training_block_id": target.training_block_id,
                "activity_id": target.activity_id,
                "target_frequency": target.target_frequency,
                "frequency_unit": target.frequency_unit,
                "current_streak_days": target.current_streak_days,
            }
            for target in recovery_targets
        ]
        suggestion_buckets = compute_suggestion_buckets(
            as_of_str,
            class_dicts,
            activity_dicts,
            log_dicts,
            rule_dicts,
            recovery_target_dicts,
            goal_dicts,
            target_dicts,
        )
        delayed_tax_hits = detect_delayed_tax(
            log_dicts,
            activity_dicts,
            class_dicts,
            rule_dicts,
            check_in_dicts,
            incident_dicts,
            as_of_str,
        )
        load_risk_summary = load_risk_summary_from_dict(
            compute_load_risk_summary(
                as_of_str,
                class_dicts,
                activity_dicts,
                log_dicts,
                rule_dicts,
                delayed_tax_hits,
            )
        )

    weekly_progress = (
        compute_weekly_progress(
            target_dicts,
            class_dicts,
            activity_dicts,
            log_dicts,
            this_week_bounds(as_of_str)[0],
            as_of_str,
        )
        if block_start is not None
        else []
    )

    daily_scores = (
        compute_daily_safety_scores(
            block_start,
            as_of_str,
            log_dicts,
            check_in_dicts,
            incident_dicts,
        )
        if block_start is not None
        else []
    )

    graph_class_id = resolve_graph_class_id(rule_dicts, class_dicts)
    graph_start = (
        format_iso_date(resolved - timedelta(days=29))
        if block_start is not None
        else None
    )
    load_series = (
        compute_load_series(
            graph_class_id,
            activity_dicts,
            log_dicts,
            graph_start,
            as_of_str,
            activity_classes=class_dicts,
            rules=rule_dicts,
        )
        if block_start is not None and graph_class_id is not None and graph_start is not None
        else []
    )

    week_load_threshold = _week_load_threshold(graph_class_id, rule_dicts)
    clean_streak = compute_clean_streak(log_dicts)
    recovery_streaks = _build_recovery_streaks(recovery_targets, activities)
    flare_up_dates = sorted({format_iso_date(incident.incident_date) for incident in incidents})
    goal_rows = _build_goal_rows(dashboard_goals)
    previous_blocks = _build_previous_blocks(session)
    has_checked_in_today = any(
        check_in.check_in_date == resolved for check_in in check_ins
    )

    return DashboardRead(
        as_of=resolved,
        user_name=settings.DEFAULT_USER_NAME,
        block=block_read,
        previous_blocks=previous_blocks,
        activity_classes=[
            ActivityClassRead.model_validate(cls) for cls in activity_classes
        ],
        activities=[ActivityRead.model_validate(activity) for activity in activities],
        logs=[ActivityLogRead.model_validate(log) for log in response_logs],
        incidents=[FlareUpIncidentRead.model_validate(incident) for incident in incidents],
        has_checked_in_today=has_checked_in_today,
        class_statuses=[
            ActivityClassStatusRead.model_validate(status) for status in class_statuses
        ],
        suggestion_buckets=[
            SuggestionRead.model_validate(suggestion) for suggestion in suggestion_buckets
        ],
        goal_rows=goal_rows,
        load_risk_summary=load_risk_summary,
        weekly_progress=[
            WeeklyProgressRead.model_validate(progress) for progress in weekly_progress
        ],
        daily_scores=[daily_safety_score_from_dict(dict(score)) for score in daily_scores],
        load_series=[load_point_from_dict(dict(point)) for point in load_series],
        graph_class_id=graph_class_id if block_start is not None else None,
        flare_up_dates=flare_up_dates,
        week_load_threshold=week_load_threshold,
        clean_streak=clean_streak,
        recovery_streaks=recovery_streaks,
        goals=[GoalRead.model_validate(g) for g in dashboard_goals],
    )


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


def _build_goal_rows(goals: list[Goal]) -> list[GoalDashboardRowRead]:
    rows: list[GoalDashboardRowRead] = []
    for goal in goals:
        is_qualitative = goal.progress_target is None
        fill_ratio: float | None = None
        if not is_qualitative and goal.progress_target and goal.progress_target > 0:
            progress_value = goal.progress_value or 0.0
            fill_ratio = progress_value / goal.progress_target
        rows.append(
            GoalDashboardRowRead(
                goal_id=goal.id,
                title=goal.title,
                status=goal.status,
                activity_id=goal.activity_id,
                progress_value=goal.progress_value,
                progress_target=goal.progress_target,
                progress_unit=goal.progress_unit,
                fill_ratio=fill_ratio,
                is_qualitative=is_qualitative,
            )
        )
    return rows


def _build_previous_blocks(session: Session) -> list[TrainingBlockRead]:
    blocks = [
        block
        for block in list_training_blocks(session)
        if block.status != "active" and block.period_kind == "weekly_focus"
    ]
    blocks.sort(
        key=lambda block: (
            block.end_date is None,
            -(block.end_date or date.min).toordinal(),
            -block.start_date.toordinal(),
            block.id,
        )
    )
    return [TrainingBlockRead.model_validate(block) for block in blocks]


def _week_load_threshold(graph_class_id: str | None, rules: list[RuleDict]) -> int | None:
    del graph_class_id, rules
    return None


def _build_recovery_streaks(
    recovery_targets: list[RecoveryTarget],
    activities: list[Activity],
) -> list[RecoveryStreakRead]:
    activity_by_id = {activity.id: activity for activity in activities}
    streaks: list[RecoveryStreakRead] = []

    for target in recovery_targets:
        activity = activity_by_id.get(target.activity_id)
        if activity is None:
            continue
        unit = target.frequency_unit
        if unit == "daily":
            frequency_unit: Literal["daily", "weekly"] = "daily"
        elif unit == "weekly":
            frequency_unit = "weekly"
        else:
            continue
        streaks.append(
            RecoveryStreakRead(
                recovery_target_id=target.id,
                activity_id=target.activity_id,
                activity_name=activity.name,
                activity_class_id=activity.activity_class_id,
                target_frequency=target.target_frequency,
                frequency_unit=frequency_unit,
                current_streak_days=target.current_streak_days,
            )
        )

    streaks.sort(key=lambda streak: (streak.activity_name, streak.recovery_target_id))
    return streaks
