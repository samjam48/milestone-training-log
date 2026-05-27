from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class RecoveryTargetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_id: str
    target_frequency: int
    frequency_unit: Literal["daily", "weekly"]

    @field_validator("target_frequency")
    @classmethod
    def validate_target_frequency(cls, value: int) -> int:
        if value < 1:
            raise ValueError("target_frequency must be at least 1")
        return value


class RecoveryTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    training_block_id: str
    activity_id: str
    target_frequency: int
    frequency_unit: str
    current_streak_days: int
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
