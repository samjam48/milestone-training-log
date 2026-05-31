from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.services import dev_reset

router = APIRouter()


@router.post("/dev/reset")
async def post_dev_reset(session: Session = Depends(get_session)) -> dict[str, str]:
    """Reset the database to the canonical seed state. Dev-mode only."""
    dev_reset.reset_to_seed_data(session)
    return {"status": "ok"}
