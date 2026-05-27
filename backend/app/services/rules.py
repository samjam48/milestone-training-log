from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, select

from app.models.activity import ActivityClass
from app.models.block import Rule, TrainingBlock
from app.schemas.rules import RuleCreate, RulePatch
from app.services.activity_classes import LOCAL_USER_ID


class RuleAlreadyExistsError(Exception):
    pass


class RuleNotFoundError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


def list_rules(session: Session, block_id: str) -> list[Rule]:
    _ensure_local_training_block_exists(session, block_id)
    statement = (
        select(Rule)
        .where(Rule.training_block_id == block_id)
        .order_by(col(Rule.rule_type), Rule.id)
    )
    return list(session.exec(statement).all())


def create_rule(session: Session, block_id: str, payload: RuleCreate) -> Rule:
    _ensure_local_training_block_exists(session, block_id)

    existing_rule = session.get(Rule, payload.id)
    if existing_rule is not None:
        raise RuleAlreadyExistsError

    if payload.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.activity_class_id)

    now = datetime.now(UTC)
    rule = Rule(
        id=payload.id,
        training_block_id=block_id,
        activity_class_id=payload.activity_class_id,
        rule_type=payload.rule_type,
        threshold_value=payload.threshold_value,
        window_days=payload.window_days,
        enabled=payload.enabled,
        created_at=now,
        updated_at=now,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def update_rule(session: Session, rule_id: str, payload: RulePatch) -> Rule:
    rule = _get_rule(session, rule_id)
    updates = payload.model_dump(exclude_unset=True)

    if "activity_class_id" in updates and updates["activity_class_id"] is not None:
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))

    for field_name, value in updates.items():
        setattr(rule, field_name, value)

    if updates:
        rule.updated_at = _next_updated_at(rule.updated_at)

    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def delete_rule(session: Session, rule_id: str) -> None:
    rule = _get_rule(session, rule_id)
    session.delete(rule)
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


def _get_rule(session: Session, rule_id: str) -> Rule:
    rule = session.get(Rule, rule_id)
    if rule is None:
        raise RuleNotFoundError
    return rule


def _next_updated_at(previous_updated_at: datetime) -> datetime:
    previous = previous_updated_at
    if previous.tzinfo is None:
        previous = previous.replace(tzinfo=UTC)

    now = datetime.now(UTC)
    if now <= previous:
        return previous + timedelta(microseconds=1)
    return now
