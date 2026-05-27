from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ActivityClassCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str
    type: str
    default_recovery_window_days: int = 3


class ActivityClassPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    type: str | None = None
    default_recovery_window_days: int | None = None

    @field_validator(
        "name",
        "description",
        "type",
        "default_recovery_window_days",
        mode="before",
    )
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class ActivityClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    type: str
    default_recovery_window_days: int
    created_at: datetime
