from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models.activity import Activity, ActivityClass
from app.schemas.activities import ActivityCreate, ActivityPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class ActivityAlreadyExistsError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class ActivityNotFoundError(Exception):
    pass


def list_activities(
    session: Session,
    *,
    class_id: str | None = None,
    is_active: bool | None = None,
) -> list[Activity]:
    statement = select(Activity).where(Activity.user_id == LOCAL_USER_ID)
    if class_id is not None:
        statement = statement.where(Activity.activity_class_id == class_id)
    if is_active is not None:
        statement = statement.where(Activity.is_active == is_active)
    statement = statement.order_by(Activity.name, Activity.id)
    return list(session.exec(statement).all())


def create_activity(session: Session, payload: ActivityCreate) -> Activity:
    existing_activity = session.get(Activity, payload.id)
    if existing_activity is not None:
        raise ActivityAlreadyExistsError

    _ensure_local_activity_class_exists(session, payload.activity_class_id)
    now = datetime.now(UTC)
    activity = Activity(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        activity_class_id=payload.activity_class_id,
        name=payload.name,
        type=payload.type,
        default_volume_unit=payload.default_volume_unit,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


def update_activity(
    session: Session,
    activity_id: str,
    payload: ActivityPatch,
) -> Activity:
    activity = _get_local_activity(session, activity_id)
    updates = payload.model_dump(exclude_unset=True)
    if "activity_class_id" in updates:
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))

    for field_name, value in updates.items():
        setattr(activity, field_name, value)

    if updates:
        activity.updated_at = next_updated_at(activity.updated_at)

    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


def _ensure_local_activity_class_exists(session: Session, class_id: str) -> None:
    statement = select(ActivityClass).where(
        ActivityClass.id == class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError


def _get_local_activity(session: Session, activity_id: str) -> Activity:
    statement = select(Activity).where(
        Activity.id == activity_id,
        Activity.user_id == LOCAL_USER_ID,
    )
    activity = session.exec(statement).first()
    if activity is None:
        raise ActivityNotFoundError
    return activity
