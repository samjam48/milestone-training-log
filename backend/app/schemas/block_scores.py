"""Schema for GET /api/training-blocks/{id}/scores response (B3.0)."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.dashboard import DailySafetyScoreRead


class BlockScoresRead(BaseModel):
    block_id: str
    start_date: str
    end_date: str
    scores: list[DailySafetyScoreRead]
