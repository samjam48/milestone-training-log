from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.block_review import BlockReviewRead
from app.schemas.training_blocks import (
    TrainingBlockCreate,
    TrainingBlockPatch,
    TrainingBlockRead,
)
from app.services.block_review import get_block_review
from app.services.training_blocks import (
    GoalNotFoundError,
    TrainingBlockAlreadyExistsError,
    TrainingBlockNotFoundError,
    create_training_block,
    get_active_training_block,
    list_training_blocks,
    update_training_block,
)

router = APIRouter(prefix="/api/training-blocks", tags=["training-blocks"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[TrainingBlockRead])
async def get_training_blocks(session: SessionDep) -> list[TrainingBlockRead]:
    return [
        TrainingBlockRead.model_validate(training_block)
        for training_block in list_training_blocks(session)
    ]


@router.get("/active", response_model=TrainingBlockRead)
async def get_active_block(session: SessionDep) -> TrainingBlockRead:
    try:
        training_block = get_active_training_block(session)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active training block not found",
        ) from exc
    return TrainingBlockRead.model_validate(training_block)


@router.get("/{block_id}/review", response_model=BlockReviewRead)
async def get_block_review_route(
    block_id: str,
    session: SessionDep,
) -> BlockReviewRead:
    try:
        return get_block_review(session, block_id)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc


@router.post("", response_model=TrainingBlockRead, status_code=status.HTTP_201_CREATED)
async def post_training_block(
    payload: TrainingBlockCreate,
    session: SessionDep,
) -> TrainingBlockRead:
    try:
        training_block = create_training_block(session, payload)
    except TrainingBlockAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Training block already exists",
        ) from exc
    except GoalNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        ) from exc
    return TrainingBlockRead.model_validate(training_block)


@router.patch("/{block_id}", response_model=TrainingBlockRead)
async def patch_training_block(
    block_id: str,
    payload: TrainingBlockPatch,
    session: SessionDep,
) -> TrainingBlockRead:
    try:
        training_block = update_training_block(session, block_id, payload)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    except GoalNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        ) from exc
    return TrainingBlockRead.model_validate(training_block)
