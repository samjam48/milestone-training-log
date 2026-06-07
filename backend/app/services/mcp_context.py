"""MCP context aggregate — structured summary for future AI integration (B10.3)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlmodel import Session

from app.schemas.mcp import (
    McpActiveBlockRead,
    McpClassStatusRead,
    McpContextRead,
    McpRecentLogRead,
    McpTodayCheckInRead,
)
from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.activity_logs import list_activity_logs
from app.services.daily_check_ins import list_daily_check_ins
from app.services.load_engine import compute_class_statuses, format_iso_date, log_load
from app.services.load_queries import (
    activity_class_dict,
    activity_dict,
    log_dict,
    resolve_as_of,
    rule_dict,
)
from app.services.rules import list_rules
from app.services.training_blocks import TrainingBlockNotFoundError, get_active_training_block


def get_mcp_context(session: Session, *, as_of: date | None = None) -> McpContextRead:
    resolved = resolve_as_of(as_of)
    as_of_str = format_iso_date(resolved)
    log_window_start = resolved - timedelta(days=6)

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    all_logs = list_activity_logs(session, end_date=resolved)
    check_ins = list_daily_check_ins(session, end_date=resolved)

    activity_by_id = {activity.id: activity for activity in activities}
    window_logs = [
        log for log in all_logs if log_window_start <= log.logged_date <= resolved
    ]

    recent_logs = [
        McpRecentLogRead(
            activity_name=(
                activity_by_id[log.activity_id].name
                if log.activity_id in activity_by_id
                else "Unknown"
            ),
            load_score=log_load(log_dict(log)),
            logged_date=log.logged_date,
        )
        for log in window_logs
    ]

    today_check_in_row = next(
        (check_in for check_in in check_ins if check_in.check_in_date == resolved),
        None,
    )
    today_check_in = (
        McpTodayCheckInRead(
            pain=today_check_in_row.pain_level,
            readiness=today_check_in_row.readiness_level,
            stiffness=today_check_in_row.stiffness_level,
            has_flare_up=today_check_in_row.has_flare_up,
        )
        if today_check_in_row is not None
        else None
    )

    active_block: McpActiveBlockRead | None = None
    class_statuses: list[McpClassStatusRead] = []

    try:
        block = get_active_training_block(session, as_of=resolved)
        active_block = McpActiveBlockRead.model_validate(block)
        rules = list_rules(session, block.id)
        rule_dicts = [rule_dict(rule) for rule in rules]
        class_dicts = [activity_class_dict(cls) for cls in activity_classes]
        activity_dicts = [activity_dict(activity) for activity in activities]
        log_dicts = [log_dict(log) for log in all_logs]

        class_statuses = [
            McpClassStatusRead(
                activity_class_id=status["activity_class_id"],
                state=status["state"],
                reason=status["reason"],
            )
            for status in compute_class_statuses(
                as_of_str,
                class_dicts,
                activity_dicts,
                log_dicts,
                rule_dicts,
            )
        ]
    except TrainingBlockNotFoundError:
        pass

    return McpContextRead(
        active_block=active_block,
        recent_logs=recent_logs,
        today_check_in=today_check_in,
        class_statuses=class_statuses,
    )
