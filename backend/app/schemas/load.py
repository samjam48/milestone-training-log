from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ActivityClassStatusRead(BaseModel):
    activity_class_id: str
    state: Literal["safe", "caution", "danger"]
    label: str | None = None
    reason: str
    last_done_date: str | None = None
    next_safe_date: str | None = None


class SuggestionRead(BaseModel):
    id: str
    label: str
    state: Literal["safe", "caution", "danger"]
    reason: str
    next_safe_date: str | None = None
    last_done_date: str | None = None


class WeeklyProgressRead(BaseModel):
    weekly_target_id: str
    activity_class_id: str
    class_name: str
    value: float
    target: float
    unit: str
    state: Literal["safe", "caution", "danger", "neutral"]


class LoadSummaryRead(BaseModel):
    as_of: date
    class_statuses: list[ActivityClassStatusRead]
    suggestions: list[SuggestionRead]
    weekly_progress: list[WeeklyProgressRead]


class CheckViolationsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_id: str
    volume_value: float
    rpe: int
    as_of: date | None = None


class RuleViolationRead(BaseModel):
    rule_id: str
    rule_type: str
    message: str
    severity: Literal["caution", "danger"]


class CheckViolationsResponse(BaseModel):
    violations: list[RuleViolationRead]
