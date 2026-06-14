from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.block import Rule, WeeklyTarget
    from app.models.checkin import FlareUpIncident
    from app.models.goal import Goal
    from app.models.log import ActivityLog


class ActivityClass(SQLModel, table=True):
    __tablename__ = "activity_classes"

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    name: str
    description: str
    type: str
    default_recovery_window_days: int = Field(
        default=3,
        sa_column=Column(Integer, nullable=False, default=3, server_default="3"),
    )
    created_at: datetime

    activities: list["Activity"] = Relationship(back_populates="activity_class")
    flare_up_incidents: list["FlareUpIncident"] = Relationship(back_populates="activity_class")
    goals: list["Goal"] = Relationship(back_populates="activity_class")
    rules: list["Rule"] = Relationship(
        back_populates="activity_class",
        sa_relationship_kwargs={"passive_deletes": True},
    )
    weekly_targets: list["WeeklyTarget"] = Relationship(back_populates="activity_class")


class Activity(SQLModel, table=True):
    __tablename__ = "activities"

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    activity_class_id: str = Field(
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=False)
    )
    name: str
    type: str
    default_volume_unit: str = Field(nullable=False)
    is_active: bool
    created_at: datetime
    updated_at: datetime

    activity_class: ActivityClass = Relationship(back_populates="activities")
    logs: list["ActivityLog"] = Relationship(back_populates="activity")
    goals: list["Goal"] = Relationship(back_populates="activity")
    rules: list["Rule"] = Relationship(
        back_populates="activity",
        sa_relationship_kwargs={"passive_deletes": True},
    )
    weekly_targets: list["WeeklyTarget"] = Relationship(back_populates="activity")
