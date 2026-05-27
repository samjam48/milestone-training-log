from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.recovery_targets import RecoveryTargetCreate, RecoveryTargetRead
from app.services.recovery_targets import (
    ActivityNotFoundError,
    ActivityNotRecoveryError,
    RecoveryTargetAlreadyExistsError,
    RecoveryTargetPairAlreadyExistsError,
    TrainingBlockNotFoundError,
    create_recovery_target,
    list_recovery_targets,
)

router = APIRouter(prefix="/api/training-blocks", tags=["recovery-targets"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/{block_id}/recovery-targets", response_model=list[RecoveryTargetRead])
async def get_recovery_targets(
    block_id: str,
    session: SessionDep,
) -> list[RecoveryTargetRead]:
    try:
        recovery_targets = list_recovery_targets(session, block_id)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    return [RecoveryTargetRead.model_validate(target) for target in recovery_targets]


@router.post(
    "/{block_id}/recovery-targets",
    response_model=RecoveryTargetRead,
    status_code=status.HTTP_201_CREATED,
)
async def post_recovery_target(
    block_id: str,
    payload: RecoveryTargetCreate,
    session: SessionDep,
) -> RecoveryTargetRead:
    try:
        recovery_target = create_recovery_target(session, block_id, payload)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    except RecoveryTargetAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recovery target already exists",
        ) from exc
    except RecoveryTargetPairAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recovery target for this activity already exists",
        ) from exc
    except ActivityNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        ) from exc
    except ActivityNotRecoveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Activity must be a recovery activity",
        ) from exc
    return RecoveryTargetRead.model_validate(recovery_target)
