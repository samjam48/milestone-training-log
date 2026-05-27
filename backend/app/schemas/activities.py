from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

ActivityType = Literal["performance", "recovery"]


class ActivityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_class_id: str
    name: str
    type: ActivityType
    default_volume_unit: str
    is_active: bool = True


class ActivityPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_class_id: str | None = None
    name: str | None = None
    type: ActivityType | None = None
    default_volume_unit: str | None = None
    is_active: bool | None = None

    @field_validator(
        "activity_class_id",
        "name",
        "type",
        "default_volume_unit",
        "is_active",
        mode="before",
    )
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    activity_class_id: str
    name: str
    type: str
    default_volume_unit: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
