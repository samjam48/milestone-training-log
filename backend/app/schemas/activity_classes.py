import math
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _reject_non_finite_load_weight(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("load_weight must be a finite number")
    return value


class ActivityClassCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str
    type: str
    default_recovery_window_days: int = 3
    load_weight: float = Field(default=1.0, ge=0, le=10)

    @field_validator("load_weight")
    @classmethod
    def reject_non_finite_load_weight(cls, value: float) -> float:
        return _reject_non_finite_load_weight(value)


class ActivityClassPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    type: str | None = None
    default_recovery_window_days: int | None = None
    load_weight: float | None = Field(default=None, ge=0, le=10)

    @field_validator(
        "name",
        "description",
        "type",
        "default_recovery_window_days",
        "load_weight",
        mode="before",
    )
    @classmethod
    def reject_explicit_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value

    @field_validator("load_weight")
    @classmethod
    def reject_non_finite_load_weight(cls, value: float) -> float:
        return _reject_non_finite_load_weight(value)


class ActivityClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    type: str
    default_recovery_window_days: int
    load_weight: float
    created_at: datetime
