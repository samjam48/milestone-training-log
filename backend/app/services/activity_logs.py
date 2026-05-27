from datetime import UTC, date, datetime
from typing import Any

from sqlmodel import Session, col, select

from app.models.activity import Activity
from app.models.log import ActivityLog
from app.schemas.activity_logs import ActivityLogCreate, ActivityLogPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at
from app.services.recovery_targets import recalculate_recovery_streaks_for_activity


class ActivityLogAlreadyExistsError(Exception):
    pass


class ActivityLogNotFoundError(Exception):
    pass


class ActivityNotFoundError(Exception):
    pass


def list_activity_logs(
    session: Session,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    activity_id: str | None = None,
    class_id: str | None = None,
) -> list[ActivityLog]:
    statement = select(ActivityLog).where(ActivityLog.user_id == LOCAL_USER_ID)
    if start_date is not None:
        statement = statement.where(ActivityLog.logged_date >= start_date)
    if end_date is not None:
        statement = statement.where(ActivityLog.logged_date <= end_date)
    if activity_id is not None:
        statement = statement.where(ActivityLog.activity_id == activity_id)
    if class_id is not None:
        statement = statement.join(Activity).where(
            Activity.id == ActivityLog.activity_id,
            Activity.user_id == LOCAL_USER_ID,
            Activity.activity_class_id == class_id,
        )
    statement = statement.order_by(
        col(ActivityLog.logged_date).desc(),
        col(ActivityLog.created_at).desc(),
        ActivityLog.id,
    )
    return list(session.exec(statement).all())


def create_activity_log(session: Session, payload: ActivityLogCreate) -> ActivityLog:
    existing_log = session.get(ActivityLog, payload.id)
    if existing_log is not None:
        raise ActivityLogAlreadyExistsError

    activity = _ensure_local_activity_exists(session, payload.activity_id)
    now = datetime.now(UTC)
    activity_log = ActivityLog(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        activity_id=payload.activity_id,
        logged_date=payload.logged_date,
        duration_minutes=payload.duration_minutes,
        volume_value=payload.volume_value,
        volume_unit=payload.volume_unit,
        rpe=payload.rpe,
        post_activity_feel=payload.post_activity_feel,
        notes=payload.notes,
        rule_violations_at_log=_copy_rule_violations(payload.rule_violations_at_log),
        created_at=now,
        updated_at=now,
    )
    session.add(activity_log)
    session.commit()
    session.refresh(activity_log)
    if activity.type == "recovery":
        recalculate_recovery_streaks_for_activity(
            session,
            activity_log.activity_id,
            anchor_date=activity_log.logged_date,
        )
    return activity_log


def update_activity_log(
    session: Session,
    log_id: str,
    payload: ActivityLogPatch,
) -> ActivityLog:
    activity_log = _get_local_activity_log(session, log_id)
    previous_activity_id = activity_log.activity_id
    previous_logged_date = activity_log.logged_date
    previous_activity = _get_local_activity(session, previous_activity_id)
    updates = payload.model_dump(exclude_unset=True)
    if "activity_id" in updates:
        _ensure_local_activity_exists(session, str(updates["activity_id"]))

    for field_name, value in updates.items():
        if field_name == "rule_violations_at_log":
            setattr(activity_log, field_name, _copy_rule_violations(value))
        else:
            setattr(activity_log, field_name, value)

    if updates:
        activity_log.updated_at = next_updated_at(activity_log.updated_at)

    session.add(activity_log)
    session.commit()
    session.refresh(activity_log)

    anchor_date = max(previous_logged_date, activity_log.logged_date)
    affected_activity_ids: set[str] = set()
    if previous_activity.type == "recovery":
        affected_activity_ids.add(previous_activity_id)
    current_activity = _get_local_activity(session, activity_log.activity_id)
    if current_activity.type == "recovery":
        affected_activity_ids.add(activity_log.activity_id)

    for activity_id in affected_activity_ids:
        recalculate_recovery_streaks_for_activity(
            session,
            activity_id,
            anchor_date=anchor_date,
        )
    return activity_log


def delete_activity_log(session: Session, log_id: str) -> None:
    activity_log = _get_local_activity_log(session, log_id)
    activity = _get_local_activity(session, activity_log.activity_id)
    logged_date = activity_log.logged_date
    activity_id = activity_log.activity_id
    session.delete(activity_log)
    session.commit()
    if activity.type == "recovery":
        recalculate_recovery_streaks_for_activity(
            session,
            activity_id,
            anchor_date=logged_date,
        )


def _copy_rule_violations(value: Any) -> list[dict[str, Any]] | None:
    if value is None:
        return None
    return [dict(item) for item in value]


def _ensure_local_activity_exists(session: Session, activity_id: str) -> Activity:
    return _get_local_activity(session, activity_id)


def _get_local_activity(session: Session, activity_id: str) -> Activity:
    statement = select(Activity).where(
        Activity.id == activity_id,
        Activity.user_id == LOCAL_USER_ID,
    )
    activity = session.exec(statement).first()
    if activity is None:
        raise ActivityNotFoundError
    return activity


def _get_local_activity_log(session: Session, log_id: str) -> ActivityLog:
    statement = select(ActivityLog).where(
        ActivityLog.id == log_id,
        ActivityLog.user_id == LOCAL_USER_ID,
    )
    activity_log = session.exec(statement).first()
    if activity_log is None:
        raise ActivityLogNotFoundError
    return activity_log


