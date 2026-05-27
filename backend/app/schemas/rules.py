from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, field_validator


class RuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    activity_class_id: str | None = None
    rule_type: str
    threshold_value: float
    window_days: int
    enabled: bool = True


class RulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_class_id: str | None = None
    rule_type: str | None = None
    threshold_value: float | None = None
    window_days: int | None = None
    enabled: bool | None = None

    @field_validator("rule_type", "threshold_value", "window_days", mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field may not be null")
        return value


class RuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    training_block_id: str
    activity_class_id: str | None
    rule_type: str
    threshold_value: float
    window_days: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def ensure_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
