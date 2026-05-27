from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.activity_logs import ActivityLogCreate, ActivityLogPatch, ActivityLogRead
from app.services.activity_logs import (
    ActivityLogAlreadyExistsError,
    ActivityLogNotFoundError,
    ActivityNotFoundError,
    create_activity_log,
    delete_activity_log,
    list_activity_logs,
    update_activity_log,
)

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[ActivityLogRead])
async def get_activity_logs(
    session: SessionDep,
    start_date: Annotated[date | None, Query(alias="from")] = None,
    end_date: Annotated[date | None, Query(alias="to")] = None,
    activity_id: str | None = None,
    class_id: str | None = None,
) -> list[ActivityLogRead]:
    return [
        ActivityLogRead.model_validate(activity_log)
        for activity_log in list_activity_logs(
            session,
            start_date=start_date,
            end_date=end_date,
            activity_id=activity_id,
            class_id=class_id,
        )
    ]


@router.post("", response_model=ActivityLogRead, status_code=status.HTTP_201_CREATED)
async def post_activity_log(
    payload: ActivityLogCreate,
    session: SessionDep,
) -> ActivityLogRead:
    try:
        activity_log = create_activity_log(session, payload)
    except ActivityLogAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Activity log already exists",
        ) from exc
    except ActivityNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        ) from exc
    return ActivityLogRead.model_validate(activity_log)


@router.patch("/{log_id}", response_model=ActivityLogRead)
async def patch_activity_log(
    log_id: str,
    payload: ActivityLogPatch,
    session: SessionDep,
) -> ActivityLogRead:
    try:
        activity_log = update_activity_log(session, log_id, payload)
    except ActivityLogNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity log not found",
        ) from exc
    except ActivityNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        ) from exc
    return ActivityLogRead.model_validate(activity_log)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity_log_route(log_id: str, session: SessionDep) -> Response:
    try:
        delete_activity_log(session, log_id)
    except ActivityLogNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity log not found",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
