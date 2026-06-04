"""Schema for GET /api/training-blocks/{id}/review response (B9.2)."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.dashboard import DailySafetyScoreRead, LoadPointRead
from app.schemas.training_blocks import TrainingBlockRead


class BlockReviewRead(BaseModel):
    block: TrainingBlockRead
    daily_scores: list[DailySafetyScoreRead]
    load_series: list[LoadPointRead]
    flare_up_dates: list[str]
    total_sessions: int
    clean_days: int
