from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas.dashboard import DashboardRead
from app.services.dashboard import get_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=DashboardRead)
async def get_dashboard_route(
    session: SessionDep,
    as_of: date | None = None,
) -> DashboardRead:
    return get_dashboard(session, as_of=as_of)
