from datetime import date, datetime

from sqlalchemy import Boolean, Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import Activity, ActivityClass
from app.models.goal import Goal


class TrainingBlock(SQLModel, table=True):
    __tablename__ = "training_blocks"

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    name: str
    start_date: date
    end_date: date | None = None
    status: str
    related_goal_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("goals.id"), nullable=True),
    )
    notes: str | None = None
    is_review_milestone_hit: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False, server_default="0"),
    )
    created_at: datetime
    updated_at: datetime

    related_goal: Goal | None = Relationship(back_populates="training_blocks")
    rules: list["Rule"] = Relationship(back_populates="training_block")
    weekly_targets: list["WeeklyTarget"] = Relationship(back_populates="training_block")
    recovery_targets: list["RecoveryTarget"] = Relationship(back_populates="training_block")


class Rule(SQLModel, table=True):
    __tablename__ = "rules"

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    training_block_id: str = Field(
        sa_column=Column(String, ForeignKey("training_blocks.id"), nullable=False)
    )
    activity_class_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=True),
    )
    rule_type: str
    threshold_value: float
    window_days: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    training_block: TrainingBlock = Relationship(back_populates="rules")
    activity_class: ActivityClass | None = Relationship(back_populates="rules")


class WeeklyTarget(SQLModel, table=True):
    __tablename__ = "weekly_targets"
    __table_args__ = (UniqueConstraint("training_block_id", "activity_class_id"),)

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    training_block_id: str = Field(
        sa_column=Column(String, ForeignKey("training_blocks.id"), nullable=False)
    )
    activity_class_id: str = Field(
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=False)
    )
    target_value: float
    target_unit: str
    created_at: datetime
    updated_at: datetime

    training_block: TrainingBlock = Relationship(back_populates="weekly_targets")
    activity_class: ActivityClass = Relationship(back_populates="weekly_targets")


class RecoveryTarget(SQLModel, table=True):
    __tablename__ = "recovery_targets"
    __table_args__ = (UniqueConstraint("training_block_id", "activity_id"),)

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    training_block_id: str = Field(
        sa_column=Column(String, ForeignKey("training_blocks.id"), nullable=False)
    )
    activity_id: str = Field(sa_column=Column(String, ForeignKey("activities.id"), nullable=False))
    target_frequency: int
    frequency_unit: str
    current_streak_days: int
    created_at: datetime
    updated_at: datetime

    training_block: TrainingBlock = Relationship(back_populates="recovery_targets")
    activity: Activity = Relationship()
