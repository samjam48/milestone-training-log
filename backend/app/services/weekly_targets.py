from datetime import UTC, datetime
from typing import Literal

from sqlmodel import Session, col, select

from app.models.activity import Activity, ActivityClass
from app.models.block import TrainingBlock, WeeklyTarget
from app.schemas.weekly_targets import (
    WeeklyTargetCreate,
    WeeklyTargetPatch,
    supported_target_units_for_activity,
)
from app.services.local_scope import LOCAL_USER_ID, next_updated_at

WeeklyTargetPairKind = Literal["activity", "class"]


class WeeklyTargetAlreadyExistsError(Exception):
    pass


class WeeklyTargetNotFoundError(Exception):
    pass


class WeeklyTargetPairAlreadyExistsError(Exception):
    def __init__(self, *, pair_kind: WeeklyTargetPairKind = "class") -> None:
        self.pair_kind = pair_kind


class TrainingBlockNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class ActivityNotFoundError(Exception):
    pass


class ActivityInactiveError(Exception):
    pass


class UnsupportedTargetUnitError(Exception):
    pass


class InvalidTargetValueError(Exception):
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

    now = datetime.now(UTC)
    if payload.activity_id is not None:
        activity = _get_local_activity(session, payload.activity_id)
        _ensure_activity_is_active(activity)
        _validate_activity_scoped_target_value(payload.target_value)
        _validate_activity_scoped_target_unit(payload.target_unit, activity)
        _ensure_block_activity_pair_is_unique(session, block_id, payload.activity_id)

        weekly_target = WeeklyTarget(
            id=payload.id,
            training_block_id=block_id,
            activity_class_id=activity.activity_class_id,
            activity_id=payload.activity_id,
            target_value=payload.target_value,
            target_unit=payload.target_unit,
            target_kind=payload.target_kind,
            created_at=now,
            updated_at=now,
        )
    else:
        assert payload.activity_class_id is not None
        _ensure_local_activity_class_exists(session, payload.activity_class_id)
        _ensure_block_class_pair_is_unique(
            session,
            block_id,
            payload.activity_class_id,
        )

        weekly_target = WeeklyTarget(
            id=payload.id,
            training_block_id=block_id,
            activity_class_id=payload.activity_class_id,
            target_value=payload.target_value,
            target_unit=payload.target_unit,
            target_kind=payload.target_kind,
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
    changed = False

    if "activity_id" in updates:
        new_activity_id = str(updates["activity_id"])
        activity = _get_local_activity(session, new_activity_id)
        _ensure_activity_is_active(activity)
        _ensure_block_activity_pair_is_unique(
            session,
            weekly_target.training_block_id,
            new_activity_id,
            exclude_target_id=weekly_target.id,
        )
        weekly_target.activity_id = new_activity_id
        weekly_target.activity_class_id = activity.activity_class_id
        changed = True
        updates.pop("activity_id", None)
        updates.pop("activity_class_id", None)

    if "activity_class_id" in updates:
        new_class_id = str(updates["activity_class_id"])
        _ensure_local_activity_class_exists(session, new_class_id)
        _ensure_block_class_pair_is_unique(
            session,
            weekly_target.training_block_id,
            new_class_id,
            exclude_target_id=weekly_target.id,
        )

    if "target_value" in updates and weekly_target.activity_id is not None:
        _validate_activity_scoped_target_value(float(updates["target_value"]))

    if "target_unit" in updates and weekly_target.activity_id is not None:
        activity = _get_local_activity(session, weekly_target.activity_id)
        _validate_activity_scoped_target_unit(str(updates["target_unit"]), activity)

    for field_name, value in updates.items():
        setattr(weekly_target, field_name, value)
        changed = True

    if changed:
        weekly_target.updated_at = next_updated_at(weekly_target.updated_at)

    session.add(weekly_target)
    session.commit()
    session.refresh(weekly_target)
    return weekly_target


def delete_weekly_target(session: Session, target_id: str) -> None:
    weekly_target = _get_weekly_target(session, target_id)
    session.delete(weekly_target)
    session.commit()


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


def _get_local_activity(session: Session, activity_id: str) -> Activity:
    statement = select(Activity).where(
        Activity.id == activity_id,
        Activity.user_id == LOCAL_USER_ID,
    )
    activity = session.exec(statement).first()
    if activity is None:
        raise ActivityNotFoundError
    return activity


def _ensure_activity_is_active(activity: Activity) -> None:
    if not activity.is_active:
        raise ActivityInactiveError


def _validate_activity_scoped_target_value(target_value: float) -> None:
    if target_value <= 0:
        raise InvalidTargetValueError


def _validate_activity_scoped_target_unit(target_unit: str, activity: Activity) -> None:
    if target_unit not in supported_target_units_for_activity(
        activity.default_volume_unit
    ):
        raise UnsupportedTargetUnitError


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
        WeeklyTarget.activity_id.is_(None),  # type: ignore[union-attr]
    )
    if exclude_target_id is not None:
        statement = statement.where(WeeklyTarget.id != exclude_target_id)

    existing_target = session.exec(statement).first()
    if existing_target is not None:
        raise WeeklyTargetPairAlreadyExistsError(pair_kind="class")


def _ensure_block_activity_pair_is_unique(
    session: Session,
    block_id: str,
    activity_id: str,
    *,
    exclude_target_id: str | None = None,
) -> None:
    statement = select(WeeklyTarget).where(
        WeeklyTarget.training_block_id == block_id,
        WeeklyTarget.activity_id == activity_id,
    )
    if exclude_target_id is not None:
        statement = statement.where(WeeklyTarget.id != exclude_target_id)

    existing_target = session.exec(statement).first()
    if existing_target is not None:
        raise WeeklyTargetPairAlreadyExistsError(pair_kind="activity")


def _get_weekly_target(session: Session, target_id: str) -> WeeklyTarget:
    weekly_target = session.get(WeeklyTarget, target_id)
    if weekly_target is None:
        raise WeeklyTargetNotFoundError
    return weekly_target
