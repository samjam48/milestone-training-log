from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.weekly_targets import (
    WeeklyTargetCreate,
    WeeklyTargetPatch,
    WeeklyTargetRead,
)
from app.services.weekly_targets import (
    ActivityClassNotFoundError,
    TrainingBlockNotFoundError,
    WeeklyTargetAlreadyExistsError,
    WeeklyTargetNotFoundError,
    WeeklyTargetPairAlreadyExistsError,
    create_weekly_target,
    list_weekly_targets,
    update_weekly_target,
)

training_block_weekly_targets_router = APIRouter(
    prefix="/api/training-blocks",
    tags=["weekly-targets"],
)
weekly_targets_router = APIRouter(prefix="/api/weekly-targets", tags=["weekly-targets"])

SessionDep = Annotated[Session, Depends(get_session)]


@training_block_weekly_targets_router.get(
    "/{block_id}/weekly-targets",
    response_model=list[WeeklyTargetRead],
)
async def get_weekly_targets(
    block_id: str,
    session: SessionDep,
) -> list[WeeklyTargetRead]:
    try:
        weekly_targets = list_weekly_targets(session, block_id)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    return [WeeklyTargetRead.model_validate(target) for target in weekly_targets]


@training_block_weekly_targets_router.post(
    "/{block_id}/weekly-targets",
    response_model=WeeklyTargetRead,
    status_code=status.HTTP_201_CREATED,
)
async def post_weekly_target(
    block_id: str,
    payload: WeeklyTargetCreate,
    session: SessionDep,
) -> WeeklyTargetRead:
    try:
        weekly_target = create_weekly_target(session, block_id, payload)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    except WeeklyTargetAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Weekly target already exists",
        ) from exc
    except WeeklyTargetPairAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Weekly target for this activity class already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return WeeklyTargetRead.model_validate(weekly_target)


@weekly_targets_router.patch("/{target_id}", response_model=WeeklyTargetRead)
async def patch_weekly_target(
    target_id: str,
    payload: WeeklyTargetPatch,
    session: SessionDep,
) -> WeeklyTargetRead:
    try:
        weekly_target = update_weekly_target(session, target_id, payload)
    except WeeklyTargetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly target not found",
        ) from exc
    except WeeklyTargetPairAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Weekly target for this activity class already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return WeeklyTargetRead.model_validate(weekly_target)
