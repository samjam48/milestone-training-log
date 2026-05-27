from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, String
from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import ActivityClass

if TYPE_CHECKING:
    from app.models.block import TrainingBlock


class Goal(SQLModel, table=True):
    __tablename__ = "goals"

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    title: str
    description: str
    target_date: date
    timeframe: str
    activity_class_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=True),
    )
    progress_value: float | None = None
    progress_target: float | None = None
    progress_unit: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    activity_class: ActivityClass | None = Relationship(back_populates="goals")
    training_blocks: list["TrainingBlock"] = Relationship(back_populates="related_goal")
