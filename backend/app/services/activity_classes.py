from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models.activity import ActivityClass
from app.schemas.activity_classes import ActivityClassCreate, ActivityClassPatch

LOCAL_USER_ID = "local"


class ActivityClassAlreadyExistsError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


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


def _get_local_activity_class(session: Session, class_id: str) -> ActivityClass:
    statement = select(ActivityClass).where(
        ActivityClass.id == class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError
    return activity_class
