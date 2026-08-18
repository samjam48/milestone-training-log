"""Load API query orchestration — loads local data and delegates to load_engine."""

from __future__ import annotations

from datetime import date

from sqlmodel import Session

from app.models.activity import Activity, ActivityClass
from app.models.block import Rule, WeeklyTarget
from app.models.checkin import DailyCheckIn, FlareUpIncident
from app.models.log import ActivityLog
from app.schemas.load import (
    ActivityClassStatusRead,
    CheckViolationsResponse,
    DelayedTaxHitRead,
    DelayedTaxResponse,
    LoadSummaryRead,
    RuleViolationRead,
    SuggestionRead,
    WeeklyProgressRead,
)
from app.schemas.load_engine import (
    ActivityClassDict,
    ActivityDict,
    CheckInDict,
    IncidentDict,
    LogDict,
    RuleDict,
    WeeklyTargetDict,
)
from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.activity_logs import list_activity_logs
from app.services.daily_check_ins import list_daily_check_ins
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.load_engine import (
    check_violations,
    compute_class_statuses,
    compute_suggestions,
    compute_weekly_progress,
    detect_delayed_tax,
    format_iso_date,
)
from app.services.rules import list_rules
from app.services.training_blocks import TrainingBlockNotFoundError, get_active_training_block
from app.services.weekly_targets import list_weekly_targets


def _server_local_today() -> date:
    return date.today()


def resolve_as_of(as_of: date | None) -> date:
    return as_of if as_of is not None else _server_local_today()


def get_load_summary(session: Session, *, as_of: date | None = None) -> LoadSummaryRead:
    resolved = resolve_as_of(as_of)
    as_of_str = format_iso_date(resolved)

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    logs = list_activity_logs(session, end_date=resolved)

    class_dicts = [activity_class_dict(cls) for cls in activity_classes]
    activity_dicts = [activity_dict(activity) for activity in activities]
    log_dicts = [log_dict(log) for log in logs]

    rules: list[Rule] = []
    weekly_targets: list[WeeklyTarget] = []
    block_start: str | None = None

    try:
        active_block = get_active_training_block(session, as_of=resolved)
        block_start = format_iso_date(active_block.start_date)
        rules = list_rules(session, active_block.id)
        weekly_targets = list_weekly_targets(session, active_block.id)
    except TrainingBlockNotFoundError:
        pass

    rule_dicts = [rule_dict(rule) for rule in rules]
    target_dicts = [weekly_target_dict(target) for target in weekly_targets]

    class_statuses = compute_class_statuses(
        as_of_str,
        class_dicts,
        activity_dicts,
        log_dicts,
        rule_dicts,
    )
    suggestions = compute_suggestions(class_statuses, activity_dicts, class_dicts)
    weekly_progress = (
        compute_weekly_progress(
            target_dicts,
            class_dicts,
            activity_dicts,
            log_dicts,
            block_start,
            as_of_str,
        )
        if block_start is not None
        else []
    )

    return LoadSummaryRead(
        as_of=resolved,
        class_statuses=[
            ActivityClassStatusRead.model_validate(status) for status in class_statuses
        ],
        suggestions=[SuggestionRead.model_validate(suggestion) for suggestion in suggestions],
        weekly_progress=[
            WeeklyProgressRead.model_validate(progress) for progress in weekly_progress
        ],
    )


def check_load_violations(
    session: Session,
    *,
    activity_id: str,
    volume_value: float,
    rpe: int,
    as_of: date | None = None,
    duration_minutes: int | None = None,
    volume_unit: str | None = None,
) -> CheckViolationsResponse:
    resolved = resolve_as_of(as_of)
    as_of_str = format_iso_date(resolved)

    try:
        active_block = get_active_training_block(session, as_of=resolved)
        rules = list_rules(session, active_block.id)
    except TrainingBlockNotFoundError:
        return CheckViolationsResponse(violations=[])

    activities = list_activities(session)
    logs = list_activity_logs(session, end_date=resolved)

    activity_dicts = [activity_dict(activity) for activity in activities]
    log_dicts = [log_dict(log) for log in logs]
    rule_dicts = [rule_dict(rule) for rule in rules]

    violations = check_violations(
        activity_id,
        volume_value,
        rpe,
        activity_dicts,
        log_dicts,
        rule_dicts,
        as_of_str,
        duration_minutes=duration_minutes,
        volume_unit=volume_unit,
    )

    return CheckViolationsResponse(
        violations=[RuleViolationRead.model_validate(violation) for violation in violations]
    )


def get_delayed_tax(
    session: Session,
    *,
    as_of: date | None = None,
    risk_window_days: int = 7,
    baseline_days: int = 14,
    pain_threshold: int = 3,
) -> DelayedTaxResponse:
    resolved = resolve_as_of(as_of)
    as_of_str = format_iso_date(resolved)

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    logs = list_activity_logs(session, end_date=resolved)
    check_ins = list_daily_check_ins(session, end_date=resolved)
    incidents = [
        incident
        for incident in list_flare_up_incidents(session)
        if incident.incident_date <= resolved
    ]

    class_dicts = [activity_class_dict(cls) for cls in activity_classes]
    activity_dicts = [activity_dict(activity) for activity in activities]
    log_dicts = [log_dict(log) for log in logs]
    check_in_dicts = [check_in_dict(check_in) for check_in in check_ins]
    incident_dicts = [incident_dict(incident) for incident in incidents]

    rules: list[Rule] = []
    try:
        active_block = get_active_training_block(session, as_of=resolved)
        rules = list_rules(session, active_block.id)
    except TrainingBlockNotFoundError:
        pass

    rule_dicts = [rule_dict(rule) for rule in rules]

    hits = detect_delayed_tax(
        log_dicts,
        activity_dicts,
        class_dicts,
        rule_dicts,
        check_in_dicts,
        incident_dicts,
        as_of_str,
        risk_window_days=risk_window_days,
        baseline_days=baseline_days,
        pain_threshold=pain_threshold,
    )

    return DelayedTaxResponse(
        as_of=resolved,
        risk_window_days=risk_window_days,
        baseline_days=baseline_days,
        pain_threshold=pain_threshold,
        hits=[DelayedTaxHitRead.model_validate(hit) for hit in hits],
    )


def activity_class_dict(activity_class: ActivityClass) -> ActivityClassDict:
    return {
        "id": activity_class.id,
        "name": activity_class.name,
        "type": activity_class.type,
        "default_recovery_window_days": activity_class.default_recovery_window_days,
        "load_weight": activity_class.load_weight,
    }


def activity_dict(activity: Activity) -> ActivityDict:
    return {
        "id": activity.id,
        "activity_class_id": activity.activity_class_id,
        "name": activity.name,
        "type": activity.type,
        "default_volume_unit": activity.default_volume_unit,
        "is_active": activity.is_active,
    }


def log_dict(log: ActivityLog) -> LogDict:
    return {
        "id": log.id,
        "activity_id": log.activity_id,
        "logged_date": format_iso_date(log.logged_date),
        "duration_minutes": log.duration_minutes,
        "volume_value": log.volume_value,
        "volume_unit": log.volume_unit,
        "rpe": log.rpe,
        "post_activity_feel": log.post_activity_feel,
        "rule_violations_at_log": log.rule_violations_at_log,
    }


def rule_dict(rule: Rule) -> RuleDict:
    payload: RuleDict = {
        "id": rule.id,
        "training_block_id": rule.training_block_id,
        "activity_class_id": rule.activity_class_id,
        "rule_type": rule.rule_type,
        "threshold_value": rule.threshold_value,
        "window_days": rule.window_days,
        "enabled": rule.enabled,
    }
    if rule.activity_id is not None:
        payload["activity_id"] = rule.activity_id
    if rule.limit_unit is not None:
        payload["limit_unit"] = rule.limit_unit
    return payload


def weekly_target_dict(target: WeeklyTarget) -> WeeklyTargetDict:
    payload: WeeklyTargetDict = {
        "id": target.id,
        "training_block_id": target.training_block_id,
        "activity_class_id": target.activity_class_id,
        "target_value": target.target_value,
        "target_unit": target.target_unit,
    }
    if target.activity_id is not None:
        payload["activity_id"] = target.activity_id
    return payload


def check_in_dict(check_in: DailyCheckIn) -> CheckInDict:
    return {
        "id": check_in.id,
        "check_in_date": format_iso_date(check_in.check_in_date),
        "pain_level": check_in.pain_level,
        "has_flare_up": check_in.has_flare_up,
    }


def incident_dict(incident: FlareUpIncident) -> IncidentDict:
    return {
        "id": incident.id,
        "incident_date": format_iso_date(incident.incident_date),
        "activity_class_id": incident.activity_class_id,
        "severity": incident.severity,
    }


def resolve_graph_class_id(
    rules: list[RuleDict],
    activity_classes: list[ActivityClassDict],
) -> str | None:
    enabled_caps = sorted(
        (
            rule
            for rule in rules
            if rule.get("enabled", True)
            and rule["rule_type"] == "weekly_load_cap"
            and rule.get("activity_class_id")
        ),
        key=lambda rule: rule["activity_class_id"],
    )
    if enabled_caps:
        class_id = enabled_caps[0]["activity_class_id"]
        return str(class_id) if class_id is not None else None

    performance_class_ids = sorted(
        cls["id"] for cls in activity_classes if cls.get("type") == "performance"
    )
    if performance_class_ids:
        return str(performance_class_ids[0])
    return None
