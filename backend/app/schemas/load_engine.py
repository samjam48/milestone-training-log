"""DTOs for the pure load engine (computed outputs, not persisted)."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

SafetyState = Literal["safe", "caution", "danger"]
ProgressState = Literal["safe", "caution", "danger", "neutral"]
ViolationSeverity = Literal["caution", "danger"]
HitType = Literal[
    "elevated_load",
    "rest_debt",
    "symptom_marker",
    "acute_attribution",
    "symptom_contributor",
]
SymptomSource = Literal["check_in_pain", "check_in_flare", "flare_incident"]


class RuleViolationSnapshot(TypedDict):
    rule_id: str
    rule_type: str
    message: str
    severity: ViolationSeverity


class ActivityClassStatus(TypedDict, total=False):
    activity_class_id: str
    state: SafetyState
    label: str
    reason: str
    last_done_date: str
    next_safe_date: str


class DailySafetyScore(TypedDict, total=False):
    date: str
    state: SafetyState | Literal["neutral"]
    violations: list[RuleViolationSnapshot]
    had_flare_up: bool
    pain_level: int | None


SuggestionBucket = Literal["do", "rest", "done"]
SuggestionScope = Literal["activity", "class"]


class Suggestion(TypedDict, total=False):
    id: str
    label: str
    state: SafetyState
    reason: str
    next_safe_date: str
    last_done_date: str
    bucket: SuggestionBucket
    scope: SuggestionScope
    activity_class_id: str
    description: str | None


class WeeklyProgress(TypedDict):
    weekly_target_id: str
    activity_class_id: str
    class_name: str
    value: float
    target: float
    unit: str
    state: ProgressState
    period_start: str
    period_end: str


class LoadPoint(TypedDict):
    date: str
    load: float
    daily_load: float


class DelayedTaxHit(TypedDict, total=False):
    hit_type: HitType
    activity_class_id: str
    message: str
    contributing_date: str
    daily_load: float
    baseline_median_daily_load: float
    days_since_last_session: int
    required_rest_days: int
    cumulative_load: float
    symptom_date: str
    symptom_source: SymptomSource
    pain_level: int
    check_in_id: str
    incident_id: str
    primary: bool
    contributor_hit_type: HitType


class LoadRiskDay(TypedDict):
    date: str
    flagged: bool


class LoadRiskExerciseBar(TypedDict):
    activity_id: str
    activity_name: str
    actual: float
    limit: float
    unit: str


class LoadRiskClassBar(TypedDict):
    activity_class_id: str
    class_name: str
    actual: float
    limit: float
    unit: str
    exercises: list[LoadRiskExerciseBar]


class LoadRiskSummary(TypedDict):
    week_days: list[LoadRiskDay]
    class_bars: list[LoadRiskClassBar]


LogDict = dict[str, Any]
ActivityDict = dict[str, Any]
ActivityClassDict = dict[str, Any]
RuleDict = dict[str, Any]
CheckInDict = dict[str, Any]
IncidentDict = dict[str, Any]
WeeklyTargetDict = dict[str, Any]
GoalDict = dict[str, Any]
RecoveryTargetDict = dict[str, Any]
