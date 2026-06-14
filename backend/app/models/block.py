from datetime import date, datetime

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import Activity, ActivityClass
from app.models.goal import Goal


class TrainingBlock(SQLModel, table=True):
    __tablename__ = "training_blocks"
    __table_args__ = (
        Index(
            "uq_training_blocks_user_active_weekly_focus",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'active' AND period_kind = 'weekly_focus'"),
            postgresql_where=text("status = 'active' AND period_kind = 'weekly_focus'"),
        ),
        Index(
            "uq_training_blocks_user_focus_series_week",
            "user_id",
            "focus_series_id",
            "week_number",
            unique=True,
        ),
    )

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    name: str
    start_date: date
    end_date: date | None = None
    status: str
    period_kind: str = Field(
        default="weekly_focus",
        sa_column=Column(
            String,
            nullable=False,
            default="weekly_focus",
            server_default="weekly_focus",
        ),
    )
    focus_series_id: str | None = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    focus_title: str | None = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    week_number: int | None = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
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
        sa_column=Column(
            String,
            ForeignKey("activity_classes.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    activity_id: str | None = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("activities.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    rule_type: str
    threshold_value: float
    window_days: int
    limit_unit: str | None = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    enabled: bool
    created_at: datetime
    updated_at: datetime

    training_block: TrainingBlock = Relationship(back_populates="rules")
    activity_class: ActivityClass | None = Relationship(back_populates="rules")
    activity: Activity | None = Relationship(back_populates="rules")


class WeeklyTarget(SQLModel, table=True):
    __tablename__ = "weekly_targets"
    __table_args__ = (
        Index(
            "uq_weekly_targets_training_block_id_activity_class_id_legacy",
            "training_block_id",
            "activity_class_id",
            unique=True,
            sqlite_where=text("activity_id IS NULL"),
            postgresql_where=text("activity_id IS NULL"),
        ),
        Index(
            "uq_weekly_targets_training_block_id_activity_id",
            "training_block_id",
            "activity_id",
            unique=True,
            sqlite_where=text("activity_id IS NOT NULL"),
            postgresql_where=text("activity_id IS NOT NULL"),
        ),
    )

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    training_block_id: str = Field(
        sa_column=Column(String, ForeignKey("training_blocks.id"), nullable=False)
    )
    activity_class_id: str = Field(
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=False)
    )
    activity_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("activities.id"), nullable=True),
    )
    target_value: float
    target_unit: str
    target_kind: str = Field(
        default="minimum",
        sa_column=Column(String, nullable=False, default="minimum", server_default="minimum"),
    )
    created_at: datetime
    updated_at: datetime

    training_block: TrainingBlock = Relationship(back_populates="weekly_targets")
    activity_class: ActivityClass = Relationship(back_populates="weekly_targets")
    activity: Activity | None = Relationship(back_populates="weekly_targets")


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
