from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models.activity import ActivityClass
from app.models.goal import Goal
from app.schemas.goals import GoalCreate, GoalPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class GoalAlreadyExistsError(Exception):
    pass


class GoalNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


def list_goals(
    session: Session,
    *,
    status: str | None = None,
    timeframe: str | None = None,
) -> list[Goal]:
    statement = select(Goal).where(Goal.user_id == LOCAL_USER_ID)
    if status is not None:
        statement = statement.where(Goal.status == status)
    if timeframe is not None:
        statement = statement.where(Goal.timeframe == timeframe)
    statement = statement.order_by(col(Goal.target_date), Goal.id)
    return list(session.exec(statement).all())


def create_goal(session: Session, payload: GoalCreate) -> Goal:
    existing_goal = session.get(Goal, payload.id)
    if existing_goal is not None:
        raise GoalAlreadyExistsError

    if payload.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.activity_class_id)

    now = datetime.now(UTC)
    goal = Goal(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        title=payload.title,
        description=payload.description,
        target_date=payload.target_date,
        timeframe=payload.timeframe,
        activity_class_id=payload.activity_class_id,
        progress_value=payload.progress_value,
        progress_target=payload.progress_target,
        progress_unit=payload.progress_unit,
        status=payload.status,
        created_at=now,
        updated_at=now,
    )
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def update_goal(session: Session, goal_id: str, payload: GoalPatch) -> Goal:
    goal = _get_local_goal(session, goal_id)
    updates = payload.model_dump(exclude_unset=True)

    if "activity_class_id" in updates and updates["activity_class_id"] is not None:
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))

    for field_name, value in updates.items():
        setattr(goal, field_name, value)

    if updates:
        goal.updated_at = next_updated_at(goal.updated_at)

    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def _ensure_local_activity_class_exists(session: Session, class_id: str) -> None:
    statement = select(ActivityClass).where(
        ActivityClass.id == class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError


def _get_local_goal(session: Session, goal_id: str) -> Goal:
    statement = select(Goal).where(
        Goal.id == goal_id,
        Goal.user_id == LOCAL_USER_ID,
    )
    goal = session.exec(statement).first()
    if goal is None:
        raise GoalNotFoundError
    return goal
