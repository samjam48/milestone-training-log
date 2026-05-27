from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, Column, ForeignKey, String
from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import Activity


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_logs"
    __table_args__ = (CheckConstraint("rpe IS NULL OR (rpe >= 1 AND rpe <= 10)"),)

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    activity_id: str = Field(sa_column=Column(String, ForeignKey("activities.id"), nullable=False))
    logged_date: date
    duration_minutes: int = Field(nullable=False)
    volume_value: float = Field(nullable=False)
    volume_unit: str | None = None
    rpe: int | None = None
    post_activity_feel: str | None = None
    notes: str | None = None
    rule_violations_at_log: list[dict[str, Any]] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    created_at: datetime
    updated_at: datetime

    activity: Activity = Relationship(back_populates="logs")
