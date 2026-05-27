"""Create initial Phase 1 schema.

Revision ID: 20260527_0001
Revises:
Create Date: 2026-05-27

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260527_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_classes",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("default_recovery_window_days", sa.Integer(), server_default="3", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "daily_check_ins",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("check_in_date", sa.Date(), nullable=False),
        sa.Column("pain_level", sa.Integer(), nullable=False),
        sa.Column("readiness_level", sa.Integer(), nullable=False),
        sa.Column("stiffness_level", sa.Integer(), nullable=False),
        sa.Column("has_flare_up", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("pain_level >= 0 AND pain_level <= 10"),
        sa.CheckConstraint("readiness_level >= 0 AND readiness_level <= 10"),
        sa.CheckConstraint("stiffness_level >= 0 AND stiffness_level <= 10"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "check_in_date"),
    )
    op.create_table(
        "goals",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("timeframe", sa.String(), nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=True),
        sa.Column("progress_value", sa.Float(), nullable=True),
        sa.Column("progress_target", sa.Float(), nullable=True),
        sa.Column("progress_unit", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "activities",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("default_volume_unit", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "flare_up_incidents",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column("body_part", sa.String(), nullable=False),
        sa.Column("severity", sa.Integer(), nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=True),
        sa.Column("daily_check_in_id", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("severity >= 0 AND severity <= 10"),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.ForeignKeyConstraint(["daily_check_in_id"], ["daily_check_ins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "training_blocks",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("related_goal_id", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("is_review_milestone_hit", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["related_goal_id"], ["goals.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.String(), server_default="local", nullable=False),
        sa.Column("activity_id", sa.String(), nullable=False),
        sa.Column("logged_date", sa.Date(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("volume_value", sa.Float(), nullable=False),
        sa.Column("volume_unit", sa.String(), nullable=True),
        sa.Column("rpe", sa.Integer(), nullable=True),
        sa.Column("post_activity_feel", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("rule_violations_at_log", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("rpe IS NULL OR (rpe >= 1 AND rpe <= 10)"),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "recovery_targets",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("training_block_id", sa.String(), nullable=False),
        sa.Column("activity_id", sa.String(), nullable=False),
        sa.Column("target_frequency", sa.Integer(), nullable=False),
        sa.Column("frequency_unit", sa.String(), nullable=False),
        sa.Column("current_streak_days", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"]),
        sa.ForeignKeyConstraint(["training_block_id"], ["training_blocks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_block_id", "activity_id"),
    )
    op.create_table(
        "rules",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("training_block_id", sa.String(), nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=True),
        sa.Column("rule_type", sa.String(), nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("window_days", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.ForeignKeyConstraint(["training_block_id"], ["training_blocks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "weekly_targets",
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("training_block_id", sa.String(), nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=False),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("target_unit", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.ForeignKeyConstraint(["training_block_id"], ["training_blocks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_block_id", "activity_class_id"),
    )


def downgrade() -> None:
    op.drop_table("weekly_targets")
    op.drop_table("rules")
    op.drop_table("recovery_targets")
    op.drop_table("activity_logs")
    op.drop_table("training_blocks")
    op.drop_table("flare_up_incidents")
    op.drop_table("activities")
    op.drop_table("goals")
    op.drop_table("daily_check_ins")
    op.drop_table("activity_classes")
