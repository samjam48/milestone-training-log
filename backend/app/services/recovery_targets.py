from datetime import UTC, date, datetime, timedelta

from sqlmodel import Session, col, select

from app.models.activity import Activity
from app.models.block import RecoveryTarget, TrainingBlock
from app.models.log import ActivityLog
from app.schemas.recovery_targets import RecoveryTargetCreate
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class RecoveryTargetAlreadyExistsError(Exception):
    pass


class RecoveryTargetPairAlreadyExistsError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class ActivityNotFoundError(Exception):
    pass


class ActivityNotRecoveryError(Exception):
    pass


def list_recovery_targets(session: Session, block_id: str) -> list[RecoveryTarget]:
    _ensure_local_training_block_exists(session, block_id)
    statement = (
        select(RecoveryTarget)
        .where(RecoveryTarget.training_block_id == block_id)
        .order_by(col(RecoveryTarget.activity_id), RecoveryTarget.id)
    )
    return list(session.exec(statement).all())


def create_recovery_target(
    session: Session,
    block_id: str,
    payload: RecoveryTargetCreate,
) -> RecoveryTarget:
    _ensure_local_training_block_exists(session, block_id)

    existing_target = session.get(RecoveryTarget, payload.id)
    if existing_target is not None:
        raise RecoveryTargetAlreadyExistsError

    _ensure_local_recovery_activity_exists(session, payload.activity_id)
    _ensure_block_activity_pair_is_unique(session, block_id, payload.activity_id)

    now = datetime.now(UTC)
    recovery_target = RecoveryTarget(
        id=payload.id,
        training_block_id=block_id,
        activity_id=payload.activity_id,
        target_frequency=payload.target_frequency,
        frequency_unit=payload.frequency_unit,
        current_streak_days=0,
        created_at=now,
        updated_at=now,
    )
    session.add(recovery_target)
    session.commit()
    session.refresh(recovery_target)
    return recovery_target


def recalculate_recovery_streaks_for_activity(
    session: Session,
    activity_id: str,
    *,
    anchor_date: date,
) -> None:
    statement = select(RecoveryTarget).where(
        RecoveryTarget.activity_id == activity_id,
    )
    targets = list(session.exec(statement).all())
    if not targets:
        return

    recalculation_date = anchor_date
    for target in targets:
        block = session.get(TrainingBlock, target.training_block_id)
        if block is None or block.status != "active":
            continue
        new_streak = _calculate_streak(
            session,
            target,
            block,
            recalculation_date,
        )
        target.current_streak_days = new_streak
        target.updated_at = next_updated_at(target.updated_at)
        session.add(target)

    session.commit()


def _calculate_streak(
    session: Session,
    target: RecoveryTarget,
    block: TrainingBlock,
    recalculation_date: date,
) -> int:
    if target.frequency_unit == "daily":
        return _calculate_daily_streak(
            session,
            target.activity_id,
            target.target_frequency,
            block,
            recalculation_date,
        )
    return _calculate_weekly_streak(
        session,
        target.activity_id,
        target.target_frequency,
        block,
        recalculation_date,
    )


def _calculate_daily_streak(
    session: Session,
    activity_id: str,
    target_frequency: int,
    block: TrainingBlock,
    recalculation_date: date,
) -> int:
    if _log_count_for_day(
        session,
        activity_id,
        recalculation_date,
        block,
    ) < target_frequency:
        return 0

    streak = 0
    current_day = recalculation_date
    while (
        _log_count_for_day(session, activity_id, current_day, block) >= target_frequency
    ):
        streak += 1
        current_day -= timedelta(days=1)
    return streak


def _calculate_weekly_streak(
    session: Session,
    activity_id: str,
    target_frequency: int,
    block: TrainingBlock,
    recalculation_date: date,
) -> int:
    current_week_start = _iso_week_start(recalculation_date)
    if (
        _log_count_for_week(session, activity_id, current_week_start, block)
        < target_frequency
    ):
        return 0

    streak = 0
    while (
        _log_count_for_week(session, activity_id, current_week_start, block)
        >= target_frequency
    ):
        streak += 1
        current_week_start -= timedelta(days=7)
    return streak


def _log_count_for_day(
    session: Session,
    activity_id: str,
    day: date,
    block: TrainingBlock,
) -> int:
    if day < block.start_date:
        return 0
    if block.end_date is not None and day > block.end_date:
        return 0

    statement = select(ActivityLog).where(
        ActivityLog.user_id == LOCAL_USER_ID,
        ActivityLog.activity_id == activity_id,
        ActivityLog.logged_date == day,
    )
    return len(list(session.exec(statement).all()))


def _log_count_for_week(
    session: Session,
    activity_id: str,
    week_start: date,
    block: TrainingBlock,
) -> int:
    week_end = week_start + timedelta(days=6)
    effective_start = max(week_start, block.start_date)
    effective_end = week_end
    if block.end_date is not None:
        effective_end = min(week_end, block.end_date)
    if effective_start > effective_end:
        return 0

    statement = select(ActivityLog).where(
        ActivityLog.user_id == LOCAL_USER_ID,
        ActivityLog.activity_id == activity_id,
        ActivityLog.logged_date >= effective_start,
        ActivityLog.logged_date <= effective_end,
    )
    return len(list(session.exec(statement).all()))


def _iso_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _ensure_local_training_block_exists(session: Session, block_id: str) -> None:
    statement = select(TrainingBlock).where(
        TrainingBlock.id == block_id,
        TrainingBlock.user_id == LOCAL_USER_ID,
    )
    training_block = session.exec(statement).first()
    if training_block is None:
        raise TrainingBlockNotFoundError


def _ensure_local_recovery_activity_exists(session: Session, activity_id: str) -> None:
    statement = select(Activity).where(
        Activity.id == activity_id,
        Activity.user_id == LOCAL_USER_ID,
    )
    activity = session.exec(statement).first()
    if activity is None:
        raise ActivityNotFoundError
    if activity.type != "recovery":
        raise ActivityNotRecoveryError


def _ensure_block_activity_pair_is_unique(
    session: Session,
    block_id: str,
    activity_id: str,
) -> None:
    statement = select(RecoveryTarget).where(
        RecoveryTarget.training_block_id == block_id,
        RecoveryTarget.activity_id == activity_id,
    )
    existing_target = session.exec(statement).first()
    if existing_target is not None:
        raise RecoveryTargetPairAlreadyExistsError


