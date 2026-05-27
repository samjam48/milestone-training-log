from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ActivityLogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_id: str
    logged_date: date
    duration_minutes: int
    volume_value: float
    volume_unit: str | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    post_activity_feel: str | None = None
    notes: str | None = None
    rule_violations_at_log: list[dict[str, Any]] | None = None


class ActivityLogPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_id: str | None = None
    logged_date: date | None = None
    duration_minutes: int | None = None
    volume_value: float | None = None
    volume_unit: str | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    post_activity_feel: str | None = None
    notes: str | None = None
    rule_violations_at_log: list[dict[str, Any]] | None = None

    @field_validator(
        "activity_id",
        "logged_date",
        "duration_minutes",
        "volume_value",
        mode="before",
    )
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    activity_id: str
    logged_date: date
    duration_minutes: int
    volume_value: float
    volume_unit: str | None
    rpe: int | None
    post_activity_feel: str | None
    notes: str | None
    rule_violations_at_log: list[dict[str, Any]] | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
