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
from app.schemas.load_engine import LoadRiskSummary
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


class GoalDashboardRowRead(BaseModel):
    goal_id: str
    title: str
    status: str
    activity_id: str | None
    progress_value: float | None
    progress_target: float | None
    progress_unit: str | None
    fill_ratio: float | None
    is_qualitative: bool


class LoadRiskDayRead(BaseModel):
    date: date
    flagged: bool


class LoadRiskExerciseBarRead(BaseModel):
    activity_id: str
    activity_name: str
    actual: float
    limit: float
    unit: str


class LoadRiskClassBarRead(BaseModel):
    activity_class_id: str
    class_name: str
    actual: float
    limit: float
    unit: str
    exercises: list[LoadRiskExerciseBarRead]


class LoadRiskSummaryRead(BaseModel):
    week_days: list[LoadRiskDayRead]
    class_bars: list[LoadRiskClassBarRead]


class DashboardRead(BaseModel):
    as_of: date
    user_name: str
    block: TrainingBlockRead | None
    previous_blocks: list[TrainingBlockRead]
    activity_classes: list[ActivityClassRead]
    activities: list[ActivityRead]
    logs: list[ActivityLogRead]
    incidents: list[FlareUpIncidentRead]
    has_checked_in_today: bool
    class_statuses: list[ActivityClassStatusRead]
    suggestions: list[SuggestionRead]
    suggestion_buckets: list[SuggestionRead]
    goal_rows: list[GoalDashboardRowRead]
    load_risk_summary: LoadRiskSummaryRead | None
    weekly_progress: list[WeeklyProgressRead]
    daily_scores: list[DailySafetyScoreRead]
    load_series: list[LoadPointRead]
    graph_class_id: str | None
    flare_up_dates: list[str]
    week_load_threshold: int
    clean_streak: int
    recovery_streaks: list[RecoveryStreakRead]
    goals: list[GoalRead]  # all local goals (Goals tab: active, achieved, paused, missed)

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


def load_risk_summary_from_dict(summary: LoadRiskSummary) -> LoadRiskSummaryRead:
    return LoadRiskSummaryRead(
        week_days=[
            LoadRiskDayRead(
                date=date.fromisoformat(day["date"]),
                flagged=bool(day["flagged"]),
            )
            for day in summary["week_days"]
        ],
        class_bars=[
            LoadRiskClassBarRead(
                activity_class_id=bar["activity_class_id"],
                class_name=bar["class_name"],
                actual=float(bar["actual"]),
                limit=float(bar["limit"]),
                unit=bar["unit"],
                exercises=[
                    LoadRiskExerciseBarRead(
                        activity_id=exercise["activity_id"],
                        activity_name=exercise["activity_name"],
                        actual=float(exercise["actual"]),
                        limit=float(exercise["limit"]),
                        unit=exercise["unit"],
                    )
                    for exercise in bar["exercises"]
                ],
            )
            for bar in summary["class_bars"]
        ],
    )
