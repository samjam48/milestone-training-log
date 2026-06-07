from datetime import UTC, datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

BASE_ACTIVITY_TARGET_UNITS = frozenset({"sessions", "minutes"})


def supported_target_units_for_activity(default_volume_unit: str) -> frozenset[str]:
    return BASE_ACTIVITY_TARGET_UNITS | {default_volume_unit}


class WeeklyTargetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_id: str | None = None
    activity_class_id: str | None = None
    target_value: float
    target_unit: str
    target_kind: str = "minimum"

    @model_validator(mode="after")
    def validate_scope_fields(self) -> Self:
        if self.activity_id is None and self.activity_class_id is None:
            raise ValueError("activity_id or activity_class_id is required")
        if self.activity_id is not None and self.activity_class_id is not None:
            raise ValueError("Provide activity_id or activity_class_id, not both")
        return self


class WeeklyTargetPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_id: str | None = None
    activity_class_id: str | None = None
    target_value: float | None = None
    target_unit: str | None = None

    @field_validator(
        "activity_id",
        "activity_class_id",
        "target_value",
        "target_unit",
        mode="before",
    )
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
    activity_id: str | None = None
    target_value: float
    target_unit: str
    target_kind: str = "minimum"
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
