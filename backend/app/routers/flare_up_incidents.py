from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.flare_up_incidents import (
    FlareUpIncidentCreate,
    FlareUpIncidentPatch,
    FlareUpIncidentRead,
)
from app.services.flare_up_incidents import (
    ActivityClassNotFoundError,
    DailyCheckInNotFoundError,
    FlareUpIncidentAlreadyExistsError,
    FlareUpIncidentNotFoundError,
    create_flare_up_incident,
    list_flare_up_incidents,
    update_flare_up_incident,
)

router = APIRouter(prefix="/api/flare-up-incidents", tags=["flare-up-incidents"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[FlareUpIncidentRead])
async def get_flare_up_incidents(session: SessionDep) -> list[FlareUpIncidentRead]:
    return [
        FlareUpIncidentRead.model_validate(incident)
        for incident in list_flare_up_incidents(session)
    ]


@router.post("", response_model=FlareUpIncidentRead, status_code=status.HTTP_201_CREATED)
async def post_flare_up_incident(
    payload: FlareUpIncidentCreate,
    session: SessionDep,
) -> FlareUpIncidentRead:
    try:
        incident = create_flare_up_incident(session, payload)
    except FlareUpIncidentAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Flare-up incident already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    except DailyCheckInNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily check-in not found",
        ) from exc
    return FlareUpIncidentRead.model_validate(incident)


@router.patch("/{incident_id}", response_model=FlareUpIncidentRead)
async def patch_flare_up_incident(
    incident_id: str,
    payload: FlareUpIncidentPatch,
    session: SessionDep,
) -> FlareUpIncidentRead:
    try:
        incident = update_flare_up_incident(session, incident_id, payload)
    except FlareUpIncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flare-up incident not found",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    except DailyCheckInNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily check-in not found",
        ) from exc
    return FlareUpIncidentRead.model_validate(incident)
