from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.enums import TrainingBlockStatus


class TrainingBlockCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    start_date: date
    end_date: date | None = None
    status: TrainingBlockStatus = "active"
    related_goal_id: str | None = None
    notes: str | None = None


class TrainingBlockPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: TrainingBlockStatus | None = None
    related_goal_id: str | None = None
    notes: str | None = None

    @field_validator("name", "start_date", "status", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class TrainingBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: date
    end_date: date | None
    status: str
    related_goal_id: str | None
    notes: str | None
    is_review_milestone_hit: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
