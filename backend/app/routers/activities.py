from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.activities import ActivityCreate, ActivityPatch, ActivityRead
from app.services.activities import (
    ActivityAlreadyExistsError,
    ActivityClassNotFoundError,
    ActivityNotFoundError,
    create_activity,
    list_activities,
    update_activity,
)

router = APIRouter(prefix="/api/activities", tags=["activities"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[ActivityRead])
async def get_activities(
    session: SessionDep,
    class_id: str | None = None,
    is_active: Annotated[bool | None, Query()] = None,
) -> list[ActivityRead]:
    return [
        ActivityRead.model_validate(activity)
        for activity in list_activities(
            session,
            class_id=class_id,
            is_active=is_active,
        )
    ]


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
async def post_activity(
    payload: ActivityCreate,
    session: SessionDep,
) -> ActivityRead:
    try:
        activity = create_activity(session, payload)
    except ActivityAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Activity already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return ActivityRead.model_validate(activity)


@router.patch("/{activity_id}", response_model=ActivityRead)
async def patch_activity(
    activity_id: str,
    payload: ActivityPatch,
    session: SessionDep,
) -> ActivityRead:
    try:
        activity = update_activity(session, activity_id, payload)
    except ActivityNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return ActivityRead.model_validate(activity)
