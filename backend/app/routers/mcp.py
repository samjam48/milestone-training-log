from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.schemas.mcp import McpContextRead
from app.services.mcp_context import get_mcp_context

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/context", response_model=McpContextRead)
async def get_mcp_context_route(
    session: SessionDep,
    as_of: date | None = None,
) -> McpContextRead:
    return get_mcp_context(session, as_of=as_of)
