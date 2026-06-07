from typing import Literal

TrainingBlockStatus = Literal["active", "completed", "archived"]
GoalStatus = Literal["active", "achieved", "missed", "paused"]
GoalTimeframe = Literal["monthly", "quarterly"]
RuleType = Literal[
    "rest_between_class",
    "frequency_limit",
    "weekly_load_cap",
    "consecutive_day_limit",
    "weekly_volume_cap",
    "daily_volume_cap",
    "weekly_activity_count",
]
FrequencyUnit = Literal["daily", "weekly"]
