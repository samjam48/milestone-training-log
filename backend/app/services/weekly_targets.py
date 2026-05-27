from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, select

from app.models.activity import ActivityClass
from app.models.block import TrainingBlock, WeeklyTarget
from app.schemas.weekly_targets import WeeklyTargetCreate, WeeklyTargetPatch
from app.services.activity_classes import LOCAL_USER_ID


class WeeklyTargetAlreadyExistsError(Exception):
    pass


class WeeklyTargetNotFoundError(Exception):
    pass


class WeeklyTargetPairAlreadyExistsError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


def list_weekly_targets(session: Session, block_id: str) -> list[WeeklyTarget]:
    _ensure_local_training_block_exists(session, block_id)
    statement = (
        select(WeeklyTarget)
        .where(WeeklyTarget.training_block_id == block_id)
        .order_by(col(WeeklyTarget.activity_class_id), WeeklyTarget.id)
    )
    return list(session.exec(statement).all())


def create_weekly_target(
    session: Session,
    block_id: str,
    payload: WeeklyTargetCreate,
) -> WeeklyTarget:
    _ensure_local_training_block_exists(session, block_id)

    existing_target = session.get(WeeklyTarget, payload.id)
    if existing_target is not None:
        raise WeeklyTargetAlreadyExistsError

    _ensure_local_activity_class_exists(session, payload.activity_class_id)
    _ensure_block_class_pair_is_unique(
        session,
        block_id,
        payload.activity_class_id,
    )

    now = datetime.now(UTC)
    weekly_target = WeeklyTarget(
        id=payload.id,
        training_block_id=block_id,
        activity_class_id=payload.activity_class_id,
        target_value=payload.target_value,
        target_unit=payload.target_unit,
        created_at=now,
        updated_at=now,
    )
    session.add(weekly_target)
    session.commit()
    session.refresh(weekly_target)
    return weekly_target


def update_weekly_target(
    session: Session,
    target_id: str,
    payload: WeeklyTargetPatch,
) -> WeeklyTarget:
    weekly_target = _get_weekly_target(session, target_id)
    updates = payload.model_dump(exclude_unset=True)

    if "activity_class_id" in updates:
        new_class_id = str(updates["activity_class_id"])
        _ensure_local_activity_class_exists(session, new_class_id)
        _ensure_block_class_pair_is_unique(
            session,
            weekly_target.training_block_id,
            new_class_id,
            exclude_target_id=weekly_target.id,
        )

    for field_name, value in updates.items():
        setattr(weekly_target, field_name, value)

    if updates:
        weekly_target.updated_at = _next_updated_at(weekly_target.updated_at)

    session.add(weekly_target)
    session.commit()
    session.refresh(weekly_target)
    return weekly_target


def _ensure_local_training_block_exists(session: Session, block_id: str) -> None:
    statement = select(TrainingBlock).where(
        TrainingBlock.id == block_id,
        TrainingBlock.user_id == LOCAL_USER_ID,
    )
    training_block = session.exec(statement).first()
    if training_block is None:
        raise TrainingBlockNotFoundError


def _ensure_local_activity_class_exists(session: Session, class_id: str) -> None:
    statement = select(ActivityClass).where(
        ActivityClass.id == class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError


def _ensure_block_class_pair_is_unique(
    session: Session,
    block_id: str,
    activity_class_id: str,
    *,
    exclude_target_id: str | None = None,
) -> None:
    statement = select(WeeklyTarget).where(
        WeeklyTarget.training_block_id == block_id,
        WeeklyTarget.activity_class_id == activity_class_id,
    )
    if exclude_target_id is not None:
        statement = statement.where(WeeklyTarget.id != exclude_target_id)

    existing_target = session.exec(statement).first()
    if existing_target is not None:
        raise WeeklyTargetPairAlreadyExistsError


def _get_weekly_target(session: Session, target_id: str) -> WeeklyTarget:
    weekly_target = session.get(WeeklyTarget, target_id)
    if weekly_target is None:
        raise WeeklyTargetNotFoundError
    return weekly_target


def _next_updated_at(previous_updated_at: datetime) -> datetime:
    previous = previous_updated_at
    if previous.tzinfo is None:
        previous = previous.replace(tzinfo=UTC)

    now = datetime.now(UTC)
    if now <= previous:
        return previous + timedelta(microseconds=1)
    return now
