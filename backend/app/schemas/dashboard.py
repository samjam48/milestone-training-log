from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.activities import ActivityRead
from app.schemas.activity_classes import ActivityClassRead
from app.schemas.activity_logs import ActivityLogRead
from app.schemas.flare_up_incidents import FlareUpIncidentRead
from app.schemas.goals import GoalRead
from app.schemas.load import (
    ActivityClassStatusRead,
    RuleViolationRead,
    SuggestionRead,
    WeeklyProgressRead,
)
from app.schemas.training_blocks import TrainingBlockRead


class LoadPointRead(BaseModel):
    date: date
    load: float
    daily_load: float


class DailySafetyScoreRead(BaseModel):
    date: date
    state: Literal["safe", "caution", "danger", "neutral"]
    violations: list[RuleViolationRead]
    had_flare_up: bool
    pain_level: int | None = None


class RecoveryStreakRead(BaseModel):
    recovery_target_id: str
    activity_id: str
    activity_name: str
    activity_class_id: str
    target_frequency: int
    frequency_unit: Literal["daily", "weekly"]
    current_streak_days: int


class DashboardRead(BaseModel):
    as_of: date
    user_name: str
    block: TrainingBlockRead | None
    activity_classes: list[ActivityClassRead]
    activities: list[ActivityRead]
    logs: list[ActivityLogRead]
    incidents: list[FlareUpIncidentRead]
    has_checked_in_today: bool
    class_statuses: list[ActivityClassStatusRead]
    suggestions: list[SuggestionRead]
    weekly_progress: list[WeeklyProgressRead]
    daily_scores: list[DailySafetyScoreRead]
    load_series: list[LoadPointRead]
    flare_up_dates: list[str]
    week_load_threshold: int
    clean_streak: int
    recovery_streaks: list[RecoveryStreakRead]
    goals: list[GoalRead]

    model_config = ConfigDict(from_attributes=True)


def load_point_from_dict(point: dict[str, Any]) -> LoadPointRead:
    return LoadPointRead(
        date=date.fromisoformat(point["date"]),
        load=float(point["load"]),
        daily_load=float(point["daily_load"]),
    )


def daily_safety_score_from_dict(score: dict[str, Any]) -> DailySafetyScoreRead:
    return DailySafetyScoreRead(
        date=date.fromisoformat(score["date"]),
        state=score["state"],
        violations=[RuleViolationRead.model_validate(v) for v in score["violations"]],
        had_flare_up=bool(score["had_flare_up"]),
        pain_level=score.get("pain_level"),
    )
