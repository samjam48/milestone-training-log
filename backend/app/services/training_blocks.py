from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models.block import TrainingBlock
from app.models.goal import Goal
from app.schemas.training_blocks import TrainingBlockCreate, TrainingBlockPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class TrainingBlockAlreadyExistsError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class GoalNotFoundError(Exception):
    pass


def list_training_blocks(session: Session) -> list[TrainingBlock]:
    statement = (
        select(TrainingBlock)
        .where(TrainingBlock.user_id == LOCAL_USER_ID)
        .order_by(
            col(TrainingBlock.start_date).desc(),
            TrainingBlock.id,
        )
    )
    return list(session.exec(statement).all())


def get_active_training_block(session: Session) -> TrainingBlock:
    statement = select(TrainingBlock).where(
        TrainingBlock.user_id == LOCAL_USER_ID,
        TrainingBlock.status == "active",
    )
    training_block = session.exec(statement).first()
    if training_block is None:
        raise TrainingBlockNotFoundError
    return training_block


def create_training_block(session: Session, payload: TrainingBlockCreate) -> TrainingBlock:
    existing_block = session.get(TrainingBlock, payload.id)
    if existing_block is not None:
        raise TrainingBlockAlreadyExistsError

    if payload.related_goal_id is not None:
        _ensure_local_goal_exists(session, payload.related_goal_id)

    now = datetime.now(UTC)
    training_block = TrainingBlock(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        related_goal_id=payload.related_goal_id,
        notes=payload.notes,
        is_review_milestone_hit=False,
        created_at=now,
        updated_at=now,
    )
    session.add(training_block)
    if payload.status == "active":
        _complete_other_active_blocks(session, exclude_block_id=payload.id)
    session.commit()
    session.refresh(training_block)
    return training_block


def update_training_block(
    session: Session,
    block_id: str,
    payload: TrainingBlockPatch,
) -> TrainingBlock:
    training_block = _get_local_training_block(session, block_id)
    updates = payload.model_dump(exclude_unset=True)

    if "related_goal_id" in updates and updates["related_goal_id"] is not None:
        _ensure_local_goal_exists(session, str(updates["related_goal_id"]))

    for field_name, value in updates.items():
        setattr(training_block, field_name, value)

    if updates:
        training_block.updated_at = next_updated_at(training_block.updated_at)

    if updates.get("status") == "active":
        _complete_other_active_blocks(session, exclude_block_id=block_id)

    session.add(training_block)
    session.commit()
    session.refresh(training_block)
    return training_block


def _complete_other_active_blocks(session: Session, *, exclude_block_id: str) -> None:
    statement = select(TrainingBlock).where(
        TrainingBlock.user_id == LOCAL_USER_ID,
        TrainingBlock.status == "active",
        TrainingBlock.id != exclude_block_id,
    )
    for other_block in session.exec(statement).all():
        other_block.status = "completed"
        other_block.updated_at = next_updated_at(other_block.updated_at)
        session.add(other_block)


def _ensure_local_goal_exists(session: Session, goal_id: str) -> None:
    statement = select(Goal).where(
        Goal.id == goal_id,
        Goal.user_id == LOCAL_USER_ID,
    )
    goal = session.exec(statement).first()
    if goal is None:
        raise GoalNotFoundError


def _get_local_training_block(session: Session, block_id: str) -> TrainingBlock:
    statement = select(TrainingBlock).where(
        TrainingBlock.id == block_id,
        TrainingBlock.user_id == LOCAL_USER_ID,
    )
    training_block = session.exec(statement).first()
    if training_block is None:
        raise TrainingBlockNotFoundError
    return training_block
