from datetime import UTC, date, datetime
from uuid import uuid4

from sqlmodel import Session, col, select

from app.models.block import Rule, TrainingBlock
from app.models.goal import Goal
from app.schemas.training_blocks import TrainingBlockCreate, TrainingBlockPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at
from app.services.rules import list_rules


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
    copied_from_rules: list[Rule] = []
    if payload.status == "active":
        outgoing_active_blocks = _get_other_active_blocks(session, exclude_block_id=payload.id)
        if outgoing_active_blocks:
            copied_from_rules = _copy_rules_to_block(
                session,
                source_block_id=outgoing_active_blocks[0].id,
                target_block_id=payload.id,
            )
        _complete_active_blocks(session, outgoing_active_blocks, set_missing_end_date=True)
    session.commit()
    session.refresh(training_block)
    for source_rule in copied_from_rules:
        session.refresh(source_rule)
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
        _complete_active_blocks(
            session,
            _get_other_active_blocks(session, exclude_block_id=block_id),
            set_missing_end_date=False,
        )

    session.add(training_block)
    session.commit()
    session.refresh(training_block)
    return training_block


def _get_other_active_blocks(session: Session, *, exclude_block_id: str) -> list[TrainingBlock]:
    statement = select(TrainingBlock).where(
        TrainingBlock.user_id == LOCAL_USER_ID,
        TrainingBlock.status == "active",
        TrainingBlock.id != exclude_block_id,
    )
    return list(session.exec(statement).all())


def _complete_active_blocks(
    session: Session,
    training_blocks: list[TrainingBlock],
    *,
    set_missing_end_date: bool,
) -> None:
    for training_block in training_blocks:
        training_block.status = "completed"
        if set_missing_end_date and training_block.end_date is None:
            training_block.end_date = date.today()
        training_block.updated_at = next_updated_at(training_block.updated_at)
        session.add(training_block)


def _copy_rules_to_block(
    session: Session,
    *,
    source_block_id: str,
    target_block_id: str,
) -> list[Rule]:
    now = datetime.now(UTC)
    source_rules = list_rules(session, source_block_id)
    for source_rule in source_rules:
        rule = Rule(
            id=f"rule-{uuid4()}",
            training_block_id=target_block_id,
            activity_class_id=source_rule.activity_class_id,
            rule_type=source_rule.rule_type,
            threshold_value=source_rule.threshold_value,
            window_days=source_rule.window_days,
            enabled=source_rule.enabled,
            created_at=now,
            updated_at=now,
        )
        session.add(rule)
    return source_rules


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
