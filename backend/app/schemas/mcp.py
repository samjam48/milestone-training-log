from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


class McpActiveBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_date: date
    end_date: date | None
    status: str
    is_review_milestone_hit: bool


class McpRecentLogRead(BaseModel):
    activity_name: str
    load_score: float
    logged_date: date


class McpTodayCheckInRead(BaseModel):
    pain: int
    readiness: int
    stiffness: int
    has_flare_up: bool


class McpClassStatusRead(BaseModel):
    activity_class_id: str
    state: Literal["safe", "caution", "danger"]
    reason: str


class McpContextRead(BaseModel):
    active_block: McpActiveBlockRead | None
    recent_logs: list[McpRecentLogRead]
    today_check_in: McpTodayCheckInRead | None
    class_statuses: list[McpClassStatusRead]
