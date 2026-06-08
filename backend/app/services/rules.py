from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models.activity import Activity, ActivityClass
from app.models.block import Rule, TrainingBlock
from app.schemas.rules import RuleCreate, RulePatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class RuleAlreadyExistsError(Exception):
    pass


class RuleNotFoundError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class RuleValidationError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


_VOLUME_CAP_RULE_TYPES = frozenset({"weekly_volume_cap", "daily_volume_cap"})


def list_rules(session: Session, block_id: str) -> list[Rule]:
    _ensure_local_training_block_exists(session, block_id)
    statement = (
        select(Rule)
        .where(Rule.training_block_id == block_id)
        .order_by(col(Rule.enabled).desc(), col(Rule.rule_type), Rule.id)
    )
    return list(session.exec(statement).all())


def create_rule(session: Session, block_id: str, payload: RuleCreate) -> Rule:
    _ensure_local_training_block_exists(session, block_id)

    existing_rule = session.get(Rule, payload.id)
    if existing_rule is not None:
        raise RuleAlreadyExistsError

    _validate_create_payload(session, payload)

    if payload.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.activity_class_id)

    now = datetime.now(UTC)
    rule = Rule(
        id=payload.id,
        training_block_id=block_id,
        activity_class_id=payload.activity_class_id,
        activity_id=payload.activity_id,
        rule_type=payload.rule_type,
        threshold_value=payload.threshold_value,
        window_days=payload.window_days,
        limit_unit=payload.limit_unit,
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

    _validate_update_payload(session, rule, updates)

    if "activity_class_id" in updates and updates["activity_class_id"] is not None:
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))

    for field_name, value in updates.items():
        setattr(rule, field_name, value)

    if updates:
        rule.updated_at = next_updated_at(rule.updated_at)

    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def delete_rule(session: Session, rule_id: str) -> None:
    rule = _get_rule(session, rule_id)
    session.delete(rule)
    session.commit()


def _validate_create_payload(session: Session, payload: RuleCreate) -> None:
    if payload.activity_class_id is None:
        raise RuleValidationError("activity_class_id is required")

    if payload.rule_type == "weekly_activity_count":
        raise RuleValidationError("weekly_activity_count rules are deprecated")

    if payload.rule_type == "weekly_load_cap":
        raise RuleValidationError("weekly_load_cap rules are deprecated")

    if payload.rule_type in _VOLUME_CAP_RULE_TYPES:
        if payload.activity_id is None:
            raise RuleValidationError(
                "Volume caps require activity_id (exercise-scoped only)",
            )
        if not payload.limit_unit:
            raise RuleValidationError("limit_unit is required for volume-cap rules")

    if payload.activity_id is not None:
        _validate_activity_belongs_to_class(
            session,
            payload.activity_id,
            payload.activity_class_id,
        )


def _validate_update_payload(
    session: Session,
    rule: Rule,
    updates: dict[str, object],
) -> None:
    if rule.rule_type == "weekly_activity_count" and updates.get("enabled") is True:
        raise RuleValidationError("Cannot enable deprecated weekly_activity_count rule")

    if updates.get("rule_type") == "weekly_activity_count":
        raise RuleValidationError("weekly_activity_count rules are deprecated")

    if "activity_class_id" in updates and updates["activity_class_id"] is None:
        if rule.rule_type != "weekly_activity_count":
            raise RuleValidationError("activity_class_id is required")

    effective_class_id = (
        updates["activity_class_id"]
        if "activity_class_id" in updates
        else rule.activity_class_id
    )
    effective_activity_id = (
        updates["activity_id"] if "activity_id" in updates else rule.activity_id
    )

    if effective_activity_id is not None:
        if effective_class_id is None:
            raise RuleValidationError("activity_class_id is required")
        _validate_activity_belongs_to_class(
            session,
            str(effective_activity_id),
            str(effective_class_id),
        )


def _validate_activity_belongs_to_class(
    session: Session,
    activity_id: str,
    activity_class_id: str,
) -> None:
    statement = select(Activity).where(
        Activity.id == activity_id,
        Activity.user_id == LOCAL_USER_ID,
    )
    activity = session.exec(statement).first()
    if activity is None or activity.activity_class_id != activity_class_id:
        raise RuleValidationError("Activity does not belong to activity class")


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
