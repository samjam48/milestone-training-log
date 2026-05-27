from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.activity_classes import (
    ActivityClassCreate,
    ActivityClassPatch,
    ActivityClassRead,
)
from app.services.activity_classes import (
    ActivityClassAlreadyExistsError,
    ActivityClassNotFoundError,
    create_activity_class,
    list_activity_classes,
    update_activity_class,
)

router = APIRouter(prefix="/api/activity-classes", tags=["activity-classes"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[ActivityClassRead])
async def get_activity_classes(session: SessionDep) -> list[ActivityClassRead]:
    return [
        ActivityClassRead.model_validate(activity_class)
        for activity_class in list_activity_classes(session)
    ]


@router.post("", response_model=ActivityClassRead, status_code=status.HTTP_201_CREATED)
async def post_activity_class(
    payload: ActivityClassCreate,
    session: SessionDep,
) -> ActivityClassRead:
    try:
        activity_class = create_activity_class(session, payload)
    except ActivityClassAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Activity class already exists",
        ) from exc
    return ActivityClassRead.model_validate(activity_class)


@router.patch("/{class_id}", response_model=ActivityClassRead)
async def patch_activity_class(
    class_id: str,
    payload: ActivityClassPatch,
    session: SessionDep,
) -> ActivityClassRead:
    try:
        activity_class = update_activity_class(session, class_id, payload)
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return ActivityClassRead.model_validate(activity_class)
