"""Review milestone auto-detection (B10.1) — pure evaluator + post-log latch."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from typing import Any

from sqlmodel import Session

from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.daily_check_ins import list_daily_check_ins
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.local_scope import next_updated_at
from app.services.training_blocks import TrainingBlockNotFoundError, get_active_training_block
from app.services.weekly_targets import list_weekly_targets


def _server_local_today() -> date:
    return date.today()


def _coerce_date(value: date | str) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _day_has_rule_violations(logs: Sequence[Mapping[str, Any]]) -> bool:
    return any(log.get("rule_violations_at_log") for log in logs)


def evaluate_review_milestone(
    *,
    as_of: date | str,
    weekly_progress: Sequence[Mapping[str, Any]],
    daily_check_ins: Sequence[Mapping[str, Any]],
    flare_up_incidents: Sequence[Mapping[str, Any]],
    activity_logs: Sequence[Mapping[str, Any]],
) -> bool:
    """Return True when a weekly target is met and the last two calendar days are clean."""
    as_of_date = _coerce_date(as_of)
    if not any(
        float(item.get("value", 0)) >= float(item.get("target", 0))
        for item in weekly_progress
    ):
        return False

    day_before = as_of_date - timedelta(days=1)
    required_days = (day_before, as_of_date)

    logs_by_date: dict[date, list[Mapping[str, Any]]] = {}
    for log in activity_logs:
        log_date = _coerce_date(log["logged_date"])
        logs_by_date.setdefault(log_date, []).append(log)

    check_ins_by_date = {
        _coerce_date(check_in["check_in_date"]): check_in for check_in in daily_check_ins
    }
    incident_dates = {
        _coerce_date(incident["incident_date"]) for incident in flare_up_incidents
    }

    for day in required_days:
        if day in incident_dates:
            return False
        check_in = check_ins_by_date.get(day)
        if check_in is not None and check_in.get("has_flare_up"):
            return False
        day_logs = logs_by_date.get(day, [])
        if not day_logs or _day_has_rule_violations(day_logs):
            return False

    return True


def maybe_update_review_milestone_after_log(session: Session) -> None:
    from app.services.activity_logs import list_activity_logs
    from app.services.load_engine import compute_weekly_progress, format_iso_date
    from app.services.load_queries import (
        activity_class_dict,
        activity_dict,
        check_in_dict,
        incident_dict,
        log_dict,
        weekly_target_dict,
    )

    try:
        active_block = get_active_training_block(session)
    except TrainingBlockNotFoundError:
        return

    if active_block.is_review_milestone_hit:
        return

    as_of = _server_local_today()
    as_of_str = format_iso_date(as_of)

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    logs = list_activity_logs(session, end_date=as_of)
    check_ins = list_daily_check_ins(session, end_date=as_of)
    incidents = [
        incident
        for incident in list_flare_up_incidents(session)
        if incident.incident_date <= as_of
    ]
    weekly_targets = list_weekly_targets(session, active_block.id)

    class_dicts = [activity_class_dict(cls) for cls in activity_classes]
    activity_dicts = [activity_dict(activity) for activity in activities]
    log_dicts = [log_dict(log) for log in logs]
    check_in_dicts = [check_in_dict(check_in) for check_in in check_ins]
    incident_dicts = [incident_dict(incident) for incident in incidents]
    target_dicts = [weekly_target_dict(target) for target in weekly_targets]
    block_start = format_iso_date(active_block.start_date)

    weekly_progress = compute_weekly_progress(
        target_dicts,
        class_dicts,
        activity_dicts,
        log_dicts,
        block_start,
        as_of_str,
    )

    if not evaluate_review_milestone(
        as_of=as_of,
        weekly_progress=weekly_progress,
        daily_check_ins=check_in_dicts,
        flare_up_incidents=incident_dicts,
        activity_logs=log_dicts,
    ):
        return

    active_block.is_review_milestone_hit = True
    active_block.updated_at = next_updated_at(active_block.updated_at)
    session.add(active_block)
    session.commit()

