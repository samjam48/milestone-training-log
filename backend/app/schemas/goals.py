from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.enums import GoalStatus, GoalTimeframe


class GoalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    target_date: date
    timeframe: GoalTimeframe
    activity_class_id: str | None = None
    progress_value: float | None = None
    progress_target: float | None = None
    progress_unit: str | None = None
    status: GoalStatus = "active"


class GoalPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    target_date: date | None = None
    timeframe: GoalTimeframe | None = None
    activity_class_id: str | None = None
    progress_value: float | None = None
    progress_target: float | None = None
    progress_unit: str | None = None
    status: GoalStatus | None = None

    @field_validator("title", "description", "target_date", "timeframe", "status", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    target_date: date
    timeframe: str
    activity_class_id: str | None
    progress_value: float | None
    progress_target: float | None
    progress_unit: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
