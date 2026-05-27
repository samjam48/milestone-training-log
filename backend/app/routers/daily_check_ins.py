from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.daily_check_ins import DailyCheckInCreate, DailyCheckInPatch, DailyCheckInRead
from app.services.daily_check_ins import (
    ActivityClassNotFoundError,
    DailyCheckInAlreadyExistsError,
    DailyCheckInNotFoundError,
    FlareUpDetailsRequiredError,
    FlareUpIncidentAlreadyExistsError,
    build_daily_check_in_read_payload,
    get_daily_check_in_by_date,
    list_daily_check_ins,
    update_daily_check_in,
    upsert_daily_check_in,
)

router = APIRouter(prefix="/api/daily-check-ins", tags=["daily-check-ins"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[DailyCheckInRead])
async def get_daily_check_ins(
    session: SessionDep,
    start_date: Annotated[date | None, Query(alias="from")] = None,
    end_date: Annotated[date | None, Query(alias="to")] = None,
) -> list[DailyCheckInRead]:
    return [
        DailyCheckInRead.model_validate(build_daily_check_in_read_payload(check_in, session))
        for check_in in list_daily_check_ins(
            session,
            start_date=start_date,
            end_date=end_date,
        )
    ]


@router.post("", response_model=DailyCheckInRead, status_code=status.HTTP_201_CREATED)
async def post_daily_check_in(
    payload: DailyCheckInCreate,
    session: SessionDep,
    response: Response,
) -> DailyCheckInRead:
    try:
        check_in, created = upsert_daily_check_in(session, payload)
    except DailyCheckInAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Daily check-in already exists",
        ) from exc
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
    except FlareUpDetailsRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Flare-up details are required",
        ) from exc

    if not created:
        response.status_code = status.HTTP_200_OK
    return DailyCheckInRead.model_validate(build_daily_check_in_read_payload(check_in, session))


@router.get("/today", response_model=DailyCheckInRead)
async def get_today_daily_check_in(session: SessionDep) -> DailyCheckInRead:
    return _read_daily_check_in_by_date(session, date.today())


@router.get("/{check_in_date}", response_model=DailyCheckInRead)
async def get_daily_check_in(
    check_in_date: date,
    session: SessionDep,
) -> DailyCheckInRead:
    return _read_daily_check_in_by_date(session, check_in_date)


@router.patch("/{check_in_date}", response_model=DailyCheckInRead)
async def patch_daily_check_in(
    check_in_date: date,
    payload: DailyCheckInPatch,
    session: SessionDep,
) -> DailyCheckInRead:
    try:
        check_in = update_daily_check_in(session, check_in_date, payload)
    except DailyCheckInNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily check-in not found",
        ) from exc
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
    except FlareUpDetailsRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Flare-up details are required",
        ) from exc
    return DailyCheckInRead.model_validate(build_daily_check_in_read_payload(check_in, session))


def _read_daily_check_in_by_date(session: Session, check_in_date: date) -> DailyCheckInRead:
    try:
        check_in = get_daily_check_in_by_date(session, check_in_date)
    except DailyCheckInNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Daily check-in not found",
        ) from exc
    return DailyCheckInRead.model_validate(build_daily_check_in_read_payload(check_in, session))
