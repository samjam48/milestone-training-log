from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FlareUpIncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    incident_date: date
    body_part: str
    severity: int = Field(ge=0, le=10)
    activity_class_id: str | None = None
    daily_check_in_id: str | None = None
    notes: str | None = None


class FlareUpIncidentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    incident_date: date | None = None
    body_part: str | None = None
    severity: int | None = Field(default=None, ge=0, le=10)
    activity_class_id: str | None = None
    daily_check_in_id: str | None = None
    notes: str | None = None

    @field_validator("incident_date", "body_part", "severity", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class FlareUpIncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_date: date
    body_part: str
    severity: int
    activity_class_id: str | None
    daily_check_in_id: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
