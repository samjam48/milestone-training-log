from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas.load import CheckViolationsRequest, CheckViolationsResponse, LoadSummaryRead
from app.services.load_queries import check_load_violations, get_load_summary

router = APIRouter(prefix="/api/load", tags=["load"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/summary", response_model=LoadSummaryRead)
async def get_load_summary_route(
    session: SessionDep,
    as_of: date | None = None,
) -> LoadSummaryRead:
    return get_load_summary(session, as_of=as_of)


@router.post("/check-violations", response_model=CheckViolationsResponse)
async def post_check_violations_route(
    payload: CheckViolationsRequest,
    session: SessionDep,
) -> CheckViolationsResponse:
    return check_load_violations(
        session,
        activity_id=payload.activity_id,
        volume_value=payload.volume_value,
        rpe=payload.rpe,
        as_of=payload.as_of,
    )
