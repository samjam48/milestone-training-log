from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.goals import GoalCreate, GoalPatch, GoalRead
from app.services.goals import (
    ActivityClassNotFoundError,
    GoalAlreadyExistsError,
    GoalNotFoundError,
    create_goal,
    list_goals,
    update_goal,
)

router = APIRouter(prefix="/api/goals", tags=["goals"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[GoalRead])
async def get_goals(
    session: SessionDep,
    status: Annotated[str | None, Query()] = None,
    timeframe: Annotated[str | None, Query()] = None,
) -> list[GoalRead]:
    goals = list_goals(session, status=status, timeframe=timeframe)
    return [GoalRead.model_validate(goal) for goal in goals]


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def post_goal(payload: GoalCreate, session: SessionDep) -> GoalRead:
    try:
        goal = create_goal(session, payload)
    except GoalAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Goal already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return GoalRead.model_validate(goal)


@router.patch("/{goal_id}", response_model=GoalRead)
async def patch_goal(
    goal_id: str,
    payload: GoalPatch,
    session: SessionDep,
) -> GoalRead:
    try:
        goal = update_goal(session, goal_id, payload)
    except GoalNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return GoalRead.model_validate(goal)
