from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from sqlmodel import Session, col, select

from app.models.block import Rule, TrainingBlock, WeeklyTarget
from app.models.goal import Goal
from app.schemas.training_blocks import TrainingBlockCreate, TrainingBlockPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at
from app.services.rules import list_rules
from app.services.weekly_targets import list_weekly_targets

PERIOD_KIND_WEEKLY_FOCUS = "weekly_focus"
DEFAULT_FOCUS_TITLE = "My focus"


def _server_local_today() -> date:
    return date.today()


class TrainingBlockAlreadyExistsError(Exception):
    pass


class TrainingBlockNotFoundError(Exception):
    pass


class GoalNotFoundError(Exception):
    pass


def calendar_week_bounds(as_of: date) -> tuple[date, date]:
    monday = as_of - timedelta(days=as_of.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def calendar_week_label(week_start: date, week_end: date) -> str:
    if week_start.year == week_end.year:
        if week_start.month == week_end.month:
            return (
                f"{week_start.strftime('%b')} {week_start.day} – "
                f"{week_end.day}, {week_end.year}"
            )
        return (
            f"{week_start.strftime('%b')} {week_start.day} – "
            f"{week_end.strftime('%b')} {week_end.day}, {week_end.year}"
        )
    return (
        f"{week_start.strftime('%b')} {week_start.day}, {week_start.year} – "
        f"{week_end.strftime('%b')} {week_end.day}, {week_end.year}"
    )


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


def get_active_training_block(
    session: Session,
    *,
    as_of: date | None = None,
    create_if_missing: bool = True,
) -> TrainingBlock:
    resolved_as_of = as_of if as_of is not None else _server_local_today()
    if create_if_missing:
        return ensure_active_weekly_focus(session, resolved_as_of)
    week_start, _week_end = calendar_week_bounds(resolved_as_of)
    block = _find_active_weekly_focus_for_week(session, week_start)
    if block is None:
        raise TrainingBlockNotFoundError
    return block


def ensure_active_weekly_focus(
    session: Session,
    as_of: date,
) -> TrainingBlock:
    week_start, week_end = calendar_week_bounds(as_of)
    previous_expire_on_commit = session.expire_on_commit
    session.expire_on_commit = False

    try:
        while True:
            active_for_week = _find_active_weekly_focus_for_week(session, week_start)
            if active_for_week is not None:
                return active_for_week

            source = _find_rollover_source(session, week_start)
            if source is not None:
                next_week_start, next_week_end = _next_week_bounds(source)
                new_block = rollover_weekly_focus(
                    session,
                    source,
                    next_week_start,
                    next_week_end,
                )
                session.commit()
                session.refresh(new_block)
                if new_block.start_date == week_start:
                    return new_block
                continue

            misaligned_source = _complete_misaligned_active_weekly_focus(
                session,
                week_start,
            )
            if misaligned_source is not None:
                new_block = _create_week_from_completed_source(
                    session,
                    misaligned_source,
                    week_start,
                    week_end,
                )
                session.commit()
                session.refresh(new_block)
                return new_block

            return _create_initial_weekly_focus(session, week_start, week_end)
    finally:
        session.expire_on_commit = previous_expire_on_commit


def _weekly_focus_covers_week(
    block: TrainingBlock,
    week_start: date,
) -> bool:
    week_end = week_start + timedelta(days=6)
    block_end = block.end_date if block.end_date is not None else week_end
    return block.start_date <= week_start and block_end >= week_end


def _complete_misaligned_active_weekly_focus(
    session: Session,
    week_start: date,
) -> TrainingBlock | None:
    statement = select(TrainingBlock).where(
        TrainingBlock.user_id == LOCAL_USER_ID,
        TrainingBlock.period_kind == PERIOD_KIND_WEEKLY_FOCUS,
        TrainingBlock.status == "active",
        TrainingBlock.start_date != week_start,
    )
    misaligned = session.exec(statement).first()
    if misaligned is None:
        return None
    if _weekly_focus_covers_week(misaligned, week_start):
        return None

    misaligned.status = "completed"
    if misaligned.end_date is None or misaligned.end_date >= week_start:
        misaligned.end_date = week_start - timedelta(days=1)
    misaligned.updated_at = next_updated_at(misaligned.updated_at)
    session.add(misaligned)
    session.flush()
    return misaligned


def _create_week_from_completed_source(
    session: Session,
    source: TrainingBlock,
    week_start: date,
    week_end: date,
) -> TrainingBlock:
    now = datetime.now(UTC)
    focus_title = source.focus_title or DEFAULT_FOCUS_TITLE
    week_number = (source.week_number or 0) + 1
    new_block = TrainingBlock(
        id=f"blk-{uuid4()}",
        user_id=LOCAL_USER_ID,
        name=calendar_week_label(week_start, week_end),
        start_date=week_start,
        end_date=week_end,
        status="active",
        period_kind=PERIOD_KIND_WEEKLY_FOCUS,
        focus_series_id=source.focus_series_id or f"fs-{uuid4()}",
        focus_title=focus_title,
        week_number=week_number,
        related_goal_id=source.related_goal_id,
        notes=source.notes,
        is_review_milestone_hit=False,
        created_at=now,
        updated_at=now,
    )
    session.add(new_block)
    _copy_enabled_rules_to_block(
        session,
        source_block_id=source.id,
        target_block_id=new_block.id,
    )
    _copy_weekly_targets_to_block(
        session,
        source_block_id=source.id,
        target_block_id=new_block.id,
    )
    session.flush()
    return new_block


def _create_initial_weekly_focus(
    session: Session,
    week_start: date,
    week_end: date,
) -> TrainingBlock:
    now = datetime.now(UTC)
    new_block = TrainingBlock(
        id=f"blk-{uuid4()}",
        user_id=LOCAL_USER_ID,
        name=calendar_week_label(week_start, week_end),
        start_date=week_start,
        end_date=week_end,
        status="active",
        period_kind=PERIOD_KIND_WEEKLY_FOCUS,
        focus_series_id=f"fs-{uuid4()}",
        focus_title=None,
        week_number=1,
        related_goal_id=None,
        notes=None,
        is_review_milestone_hit=False,
        created_at=now,
        updated_at=now,
    )
    session.add(new_block)
    session.commit()
    session.refresh(new_block)
    return new_block


def rollover_weekly_focus(
    session: Session,
    source: TrainingBlock,
    week_start: date,
    week_end: date,
) -> TrainingBlock:
    now = datetime.now(UTC)
    focus_title = source.focus_title or DEFAULT_FOCUS_TITLE
    week_number = (source.week_number or 0) + 1
    new_block = TrainingBlock(
        id=f"blk-{uuid4()}",
        user_id=LOCAL_USER_ID,
        name=calendar_week_label(week_start, week_end),
        start_date=week_start,
        end_date=week_end,
        status="active",
        period_kind=PERIOD_KIND_WEEKLY_FOCUS,
        focus_series_id=source.focus_series_id,
        focus_title=focus_title,
        week_number=week_number,
        related_goal_id=source.related_goal_id,
        notes=source.notes,
        is_review_milestone_hit=False,
        created_at=now,
        updated_at=now,
    )
    session.add(new_block)

    source.status = "completed"
    source.end_date = week_start - timedelta(days=1)
    source.updated_at = next_updated_at(source.updated_at)
    session.add(source)

    _copy_enabled_rules_to_block(
        session,
        source_block_id=source.id,
        target_block_id=new_block.id,
    )
    _copy_weekly_targets_to_block(
        session,
        source_block_id=source.id,
        target_block_id=new_block.id,
    )
    session.flush()
    return new_block


def create_training_block(session: Session, payload: TrainingBlockCreate) -> TrainingBlock:
    existing_block = session.get(TrainingBlock, payload.id)
    if existing_block is not None:
        raise TrainingBlockAlreadyExistsError

    if payload.related_goal_id is not None:
        _ensure_local_goal_exists(session, payload.related_goal_id)

    now = datetime.now(UTC)
    copied_from_rules: list[Rule] = []
    outgoing_active_blocks: list[TrainingBlock] = []
    if payload.status == "active":
        outgoing_active_blocks = _get_other_active_blocks(
            session,
            exclude_block_id=payload.id,
        )
        _complete_active_blocks(
            session,
            outgoing_active_blocks,
            set_missing_end_date=True,
        )
        session.flush()

    training_block = TrainingBlock(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        period_kind=PERIOD_KIND_WEEKLY_FOCUS,
        related_goal_id=payload.related_goal_id,
        notes=payload.notes,
        is_review_milestone_hit=False,
        created_at=now,
        updated_at=now,
    )
    session.add(training_block)
    if payload.status == "active" and outgoing_active_blocks:
        copied_from_rules = _copy_all_rules_to_block(
            session,
            source_block_id=outgoing_active_blocks[0].id,
            target_block_id=payload.id,
        )
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

    if updates.get("status") == "active":
        outgoing_active_blocks = _get_other_active_blocks(
            session,
            exclude_block_id=block_id,
        )
        _complete_active_blocks(
            session,
            outgoing_active_blocks,
            set_missing_end_date=False,
        )
        session.flush()

    for field_name, value in updates.items():
        setattr(training_block, field_name, value)

    if updates:
        training_block.updated_at = next_updated_at(training_block.updated_at)

    session.add(training_block)
    session.commit()
    session.refresh(training_block)
    return training_block


def _find_active_weekly_focus_for_week(session: Session, week_start: date) -> TrainingBlock | None:
    week_end = week_start + timedelta(days=6)
    exact_match = select(TrainingBlock).where(
        TrainingBlock.user_id == LOCAL_USER_ID,
        TrainingBlock.period_kind == PERIOD_KIND_WEEKLY_FOCUS,
        TrainingBlock.status == "active",
        TrainingBlock.start_date == week_start,
    )
    exact = session.exec(exact_match).first()
    if exact is not None:
        return exact

    covering = (
        select(TrainingBlock)
        .where(
            TrainingBlock.user_id == LOCAL_USER_ID,
            TrainingBlock.period_kind == PERIOD_KIND_WEEKLY_FOCUS,
            TrainingBlock.status == "active",
            TrainingBlock.start_date <= week_start,
        )
        .order_by(col(TrainingBlock.start_date).desc())
    )
    for block in session.exec(covering):
        if block.end_date is None or block.end_date >= week_end:
            return block
    return None


def _find_rollover_source(session: Session, week_start: date) -> TrainingBlock | None:
    prior_sunday = week_start - timedelta(days=1)
    stale_statement = (
        select(TrainingBlock)
        .where(
            TrainingBlock.user_id == LOCAL_USER_ID,
            TrainingBlock.period_kind == PERIOD_KIND_WEEKLY_FOCUS,
            TrainingBlock.status == "active",
            TrainingBlock.start_date < week_start,
        )
        .order_by(col(TrainingBlock.start_date).desc())
    )
    stale = session.exec(stale_statement).first()
    if stale is not None:
        return stale

    completed_statement = (
        select(TrainingBlock)
        .where(
            TrainingBlock.user_id == LOCAL_USER_ID,
            TrainingBlock.period_kind == PERIOD_KIND_WEEKLY_FOCUS,
            TrainingBlock.status == "completed",
            TrainingBlock.end_date == prior_sunday,
        )
        .order_by(col(TrainingBlock.start_date).desc())
    )
    return session.exec(completed_statement).first()


def _next_week_bounds(source: TrainingBlock) -> tuple[date, date]:
    next_monday = source.start_date + timedelta(days=7)
    return next_monday, next_monday + timedelta(days=6)


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


def _copy_all_rules_to_block(
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
            activity_id=source_rule.activity_id,
            rule_type=source_rule.rule_type,
            threshold_value=source_rule.threshold_value,
            window_days=source_rule.window_days,
            limit_unit=source_rule.limit_unit,
            enabled=source_rule.enabled,
            created_at=now,
            updated_at=now,
        )
        session.add(rule)
    return source_rules


def _copy_enabled_rules_to_block(
    session: Session,
    *,
    source_block_id: str,
    target_block_id: str,
) -> list[Rule]:
    now = datetime.now(UTC)
    source_rules = list_rules(session, source_block_id)
    copied: list[Rule] = []
    for source_rule in source_rules:
        if not source_rule.enabled:
            continue
        rule = Rule(
            id=f"rule-{uuid4()}",
            training_block_id=target_block_id,
            activity_class_id=source_rule.activity_class_id,
            activity_id=source_rule.activity_id,
            rule_type=source_rule.rule_type,
            threshold_value=source_rule.threshold_value,
            window_days=source_rule.window_days,
            limit_unit=source_rule.limit_unit,
            enabled=source_rule.enabled,
            created_at=now,
            updated_at=now,
        )
        session.add(rule)
        copied.append(source_rule)
    return copied


def _copy_weekly_targets_to_block(
    session: Session,
    *,
    source_block_id: str,
    target_block_id: str,
) -> list[WeeklyTarget]:
    now = datetime.now(UTC)
    source_targets = list_weekly_targets(session, source_block_id)
    for source_target in source_targets:
        target = WeeklyTarget(
            id=f"wt-{uuid4()}",
            training_block_id=target_block_id,
            activity_class_id=source_target.activity_class_id,
            activity_id=source_target.activity_id,
            target_value=source_target.target_value,
            target_unit=source_target.target_unit,
            target_kind=source_target.target_kind,
            created_at=now,
            updated_at=now,
        )
        session.add(target)
    return source_targets


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
