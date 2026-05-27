from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FlareUpForCheckInCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    body_part: str
    severity: int = Field(ge=0, le=10)
    activity_class_id: str | None = None
    notes: str | None = None


class FlareUpForCheckInPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    body_part: str | None = None
    severity: int | None = Field(default=None, ge=0, le=10)
    activity_class_id: str | None = None
    notes: str | None = None

    @field_validator("body_part", "severity", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class FlareUpForCheckInRead(BaseModel):
    id: str
    incident_date: date
    body_part: str
    severity: int
    activity_class_id: str | None
    daily_check_in_id: str
    notes: str | None


class DailyCheckInCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    check_in_date: date
    pain_level: int = Field(ge=0, le=10)
    readiness_level: int = Field(ge=0, le=10)
    stiffness_level: int = Field(ge=0, le=10)
    has_flare_up: bool
    notes: str | None = None
    flare_up: FlareUpForCheckInCreate | None = None

    @model_validator(mode="after")
    def validate_flare_up_state(self) -> "DailyCheckInCreate":
        if self.has_flare_up and self.flare_up is None:
            raise ValueError("Flare-up details are required when has_flare_up is true")
        if not self.has_flare_up and self.flare_up is not None:
            raise ValueError("Flare-up details may not be supplied when has_flare_up is false")
        return self


class DailyCheckInPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pain_level: int | None = Field(default=None, ge=0, le=10)
    readiness_level: int | None = Field(default=None, ge=0, le=10)
    stiffness_level: int | None = Field(default=None, ge=0, le=10)
    has_flare_up: bool | None = None
    notes: str | None = None
    flare_up: FlareUpForCheckInPatch | None = None

    @field_validator(
        "pain_level",
        "readiness_level",
        "stiffness_level",
        "has_flare_up",
        mode="before",
    )
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value

    @model_validator(mode="after")
    def reject_contradictory_flare_up_state(self) -> "DailyCheckInPatch":
        if self.has_flare_up is False and self.flare_up is not None:
            raise ValueError("Flare-up details may not be supplied when has_flare_up is false")
        return self


class DailyCheckInRead(BaseModel):
    id: str
    check_in_date: date
    pain_level: int
    readiness_level: int
    stiffness_level: int
    has_flare_up: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
    flare_up: FlareUpForCheckInRead | None = None

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
