from datetime import date, datetime

from sqlalchemy import CheckConstraint, Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import ActivityClass


class DailyCheckIn(SQLModel, table=True):
    __tablename__ = "daily_check_ins"
    __table_args__ = (
        UniqueConstraint("user_id", "check_in_date"),
        CheckConstraint("pain_level >= 0 AND pain_level <= 10"),
        CheckConstraint("readiness_level >= 0 AND readiness_level <= 10"),
        CheckConstraint("stiffness_level >= 0 AND stiffness_level <= 10"),
    )

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    check_in_date: date
    pain_level: int = Field(nullable=False)
    readiness_level: int = Field(nullable=False)
    stiffness_level: int = Field(nullable=False)
    has_flare_up: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    flare_up_incidents: list["FlareUpIncident"] = Relationship(back_populates="daily_check_in")


class FlareUpIncident(SQLModel, table=True):
    __tablename__ = "flare_up_incidents"
    __table_args__ = (CheckConstraint("severity >= 0 AND severity <= 10"),)

    id: str = Field(sa_column=Column(String, primary_key=True, autoincrement=False))
    user_id: str = Field(
        default="local",
        sa_column=Column(String, nullable=False, default="local", server_default="local"),
    )
    incident_date: date
    body_part: str
    severity: int = Field(nullable=False)
    activity_class_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("activity_classes.id"), nullable=True),
    )
    daily_check_in_id: str | None = Field(
        default=None,
        sa_column=Column(String, ForeignKey("daily_check_ins.id"), nullable=True),
    )
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    activity_class: ActivityClass | None = Relationship(back_populates="flare_up_incidents")
    daily_check_in: DailyCheckIn | None = Relationship(back_populates="flare_up_incidents")
