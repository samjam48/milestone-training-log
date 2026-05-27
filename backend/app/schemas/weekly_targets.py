from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, field_validator


class WeeklyTargetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_class_id: str
    target_value: float
    target_unit: str


class WeeklyTargetPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_class_id: str | None = None
    target_value: float | None = None
    target_unit: str | None = None

    @field_validator("activity_class_id", "target_value", "target_unit", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class WeeklyTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    training_block_id: str
    activity_class_id: str
    target_value: float
    target_unit: str
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
