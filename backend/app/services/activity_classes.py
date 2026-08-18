from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models.activity import Activity, ActivityClass
from app.models.block import WeeklyTarget
from app.models.goal import Goal
from app.models.log import ActivityLog
from app.schemas.activity_classes import ActivityClassCreate, ActivityClassPatch
from app.services.local_scope import LOCAL_USER_ID


class ActivityClassAlreadyExistsError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class ActivityClassDeleteBlockedError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def list_activity_classes(session: Session) -> list[ActivityClass]:
    statement = (
        select(ActivityClass)
        .where(ActivityClass.user_id == LOCAL_USER_ID)
        .order_by(ActivityClass.name, ActivityClass.id)
    )
    return list(session.exec(statement).all())


def create_activity_class(session: Session, payload: ActivityClassCreate) -> ActivityClass:
    existing_activity_class = session.get(ActivityClass, payload.id)
    if existing_activity_class is not None:
        raise ActivityClassAlreadyExistsError

    activity_class = ActivityClass(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        name=payload.name,
        description=payload.description,
        type=payload.type,
        default_recovery_window_days=payload.default_recovery_window_days,
        load_weight=payload.load_weight,
        created_at=datetime.now(UTC),
    )
    session.add(activity_class)
    session.commit()
    session.refresh(activity_class)
    return activity_class


def update_activity_class(
    session: Session,
    class_id: str,
    payload: ActivityClassPatch,
) -> ActivityClass:
    activity_class = _get_local_activity_class(session, class_id)
    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(activity_class, field_name, value)

    session.add(activity_class)
    session.commit()
    session.refresh(activity_class)
    return activity_class


def delete_activity_class(session: Session, class_id: str) -> None:
    activity_class = _get_local_activity_class(session, class_id)

    activity_ids = list(
        session.exec(
            select(Activity.id).where(
                Activity.user_id == LOCAL_USER_ID,
                Activity.activity_class_id == class_id,
            )
        ).all()
    )

    if activity_ids and _has_logs_for_activities(session, activity_ids):
        raise ActivityClassDeleteBlockedError(
            "Cannot delete activity class while activities have logs"
        )

    if _has_goals_referencing_class(session, class_id, activity_ids):
        raise ActivityClassDeleteBlockedError(
            "Cannot delete activity class while goals reference it"
        )

    if _has_weekly_targets_referencing_class(session, class_id):
        raise ActivityClassDeleteBlockedError(
            "Cannot delete activity class while weekly targets reference it"
        )

    for activity in session.exec(
        select(Activity).where(
            Activity.user_id == LOCAL_USER_ID,
            Activity.activity_class_id == class_id,
        )
    ).all():
        session.delete(activity)

    session.delete(activity_class)
    session.commit()


def _has_logs_for_activities(session: Session, activity_ids: list[str]) -> bool:
    statement = (
        select(ActivityLog.id)
        .where(
            ActivityLog.user_id == LOCAL_USER_ID,
            col(ActivityLog.activity_id).in_(activity_ids),
        )
        .limit(1)
    )
    return session.exec(statement).first() is not None


def _has_goals_referencing_class(
    session: Session,
    class_id: str,
    activity_ids: list[str],
) -> bool:
    class_statement = (
        select(Goal.id)
        .where(
            Goal.user_id == LOCAL_USER_ID,
            Goal.activity_class_id == class_id,
        )
        .limit(1)
    )
    if session.exec(class_statement).first() is not None:
        return True

    if not activity_ids:
        return False

    activity_statement = (
        select(Goal.id)
        .where(
            Goal.user_id == LOCAL_USER_ID,
            col(Goal.activity_id).in_(activity_ids),
        )
        .limit(1)
    )
    return session.exec(activity_statement).first() is not None


def _has_weekly_targets_referencing_class(session: Session, class_id: str) -> bool:
    statement = (
        select(WeeklyTarget.id).where(WeeklyTarget.activity_class_id == class_id).limit(1)
    )
    return session.exec(statement).first() is not None


def _get_local_activity_class(session: Session, class_id: str) -> ActivityClass:
    statement = select(ActivityClass).where(
        ActivityClass.id == class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError
    return activity_class
