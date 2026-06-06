from datetime import UTC, date, datetime

from sqlmodel import Session, col, select

from app.models.activity import Activity, ActivityClass
from app.models.goal import Goal
from app.models.log import ActivityLog
from app.schemas.goals import GoalCreate, GoalPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class GoalAlreadyExistsError(Exception):
    pass


class GoalNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class ActivityNotFoundError(Exception):
    pass


class GoalValidationError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


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

    _validate_auto_track_fields(
        auto_track_progress=payload.auto_track_progress,
        activity_id=payload.activity_id,
        progress_target=payload.progress_target,
        progress_unit=payload.progress_unit,
    )

    activity_class_id = payload.activity_class_id
    if payload.activity_id is not None:
        activity = _get_local_activity(session, payload.activity_id)
        activity_class_id = activity.activity_class_id
    elif payload.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.activity_class_id)

    now = datetime.now(UTC)
    goal = Goal(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        title=payload.title,
        description=payload.description,
        target_date=payload.target_date,
        timeframe=payload.timeframe,
        activity_class_id=activity_class_id,
        activity_id=payload.activity_id,
        auto_track_progress=payload.auto_track_progress,
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

    if "activity_id" in updates and updates["activity_id"] is not None:
        activity = _get_local_activity(session, str(updates["activity_id"]))
        updates["activity_class_id"] = activity.activity_class_id
    elif "activity_class_id" in updates and updates["activity_class_id"] is not None:
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))

    for field_name, value in updates.items():
        setattr(goal, field_name, value)

    _validate_auto_track_fields(
        auto_track_progress=goal.auto_track_progress,
        activity_id=goal.activity_id,
        progress_target=goal.progress_target,
        progress_unit=goal.progress_unit,
    )

    if updates:
        goal.updated_at = next_updated_at(goal.updated_at)

    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def recompute_auto_tracked_goals(session: Session, *, activity_ids: set[str]) -> None:
    if not activity_ids:
        return

    statement = select(Goal).where(
        Goal.user_id == LOCAL_USER_ID,
        Goal.auto_track_progress == True,  # noqa: E712
        col(Goal.activity_id).in_(activity_ids),
    )
    goals = list(session.exec(statement).all())
    if not goals:
        return

    for goal in goals:
        period_start = _goal_period_start(goal.target_date, goal.timeframe)
        log_statement = select(ActivityLog).where(
            ActivityLog.user_id == LOCAL_USER_ID,
            ActivityLog.activity_id == goal.activity_id,
            ActivityLog.logged_date >= period_start,
            ActivityLog.logged_date <= goal.target_date,
            ActivityLog.volume_unit == goal.progress_unit,
        )
        logs = list(session.exec(log_statement).all())
        goal.progress_value = sum(log.volume_value for log in logs)
        if (
            goal.progress_target is not None
            and goal.progress_value >= goal.progress_target
            and goal.status != "achieved"
        ):
            goal.status = "achieved"
        goal.updated_at = next_updated_at(goal.updated_at)
        session.add(goal)

    session.commit()


def _goal_period_start(target_date: date, timeframe: str) -> date:
    if timeframe == "monthly":
        return target_date.replace(day=1)
    quarter_start_month = ((target_date.month - 1) // 3) * 3 + 1
    return date(target_date.year, quarter_start_month, 1)


def _validate_auto_track_fields(
    *,
    auto_track_progress: bool,
    activity_id: str | None,
    progress_target: float | None,
    progress_unit: str | None,
) -> None:
    if not auto_track_progress:
        return
    if activity_id is None:
        raise GoalValidationError("activity_id is required when auto_track_progress is enabled")
    if progress_target is None:
        raise GoalValidationError("progress_target is required when auto_track_progress is enabled")
    if progress_unit is None:
        raise GoalValidationError("progress_unit is required when auto_track_progress is enabled")


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


def _get_local_goal(session: Session, goal_id: str) -> Goal:
    statement = select(Goal).where(
        Goal.id == goal_id,
        Goal.user_id == LOCAL_USER_ID,
    )
    goal = session.exec(statement).first()
    if goal is None:
        raise GoalNotFoundError
    return goal
