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


HitType = Literal[
    "elevated_load",
    "rest_debt",
    "symptom_marker",
    "acute_attribution",
    "symptom_contributor",
]
SymptomSource = Literal["check_in_pain", "check_in_flare", "flare_incident"]


class DelayedTaxHitRead(BaseModel):
    hit_type: HitType
    message: str
    activity_class_id: str | None = None
    contributing_date: str | None = None
    daily_load: float | None = None
    baseline_median_daily_load: float | None = None
    days_since_last_session: int | None = None
    required_rest_days: int | None = None
    cumulative_load: float | None = None
    symptom_date: str | None = None
    symptom_source: SymptomSource | None = None
    pain_level: int | None = None
    check_in_id: str | None = None
    incident_id: str | None = None
    primary: bool | None = None
    contributor_hit_type: HitType | None = None


class DelayedTaxResponse(BaseModel):
    as_of: date
    risk_window_days: int
    baseline_days: int
    pain_threshold: int
    hits: list[DelayedTaxHitRead]
