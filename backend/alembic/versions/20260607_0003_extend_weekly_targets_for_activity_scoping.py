"""Extend weekly_targets for activity-scoped weekly minimum targets.

Revision ID: 20260607_0003
Revises: 20260606_0002
Create Date: 2026-06-07

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260607_0003"
down_revision: str | None = "20260606_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WEEKLY_TARGET_CLASS_LEGACY_INDEX = (
    "uq_weekly_targets_training_block_id_activity_class_id_legacy"
)
WEEKLY_TARGET_ACTIVITY_INDEX = "uq_weekly_targets_training_block_id_activity_id"
WEEKLY_TARGETS_REBUILD_TABLE = "weekly_targets_wtl_b1_rebuild"


def _create_partial_weekly_target_uniques() -> None:
    op.create_index(
        WEEKLY_TARGET_CLASS_LEGACY_INDEX,
        "weekly_targets",
        ["training_block_id", "activity_class_id"],
        unique=True,
        sqlite_where=sa.text("activity_id IS NULL"),
        postgresql_where=sa.text("activity_id IS NULL"),
    )
    op.create_index(
        WEEKLY_TARGET_ACTIVITY_INDEX,
        "weekly_targets",
        ["training_block_id", "activity_id"],
        unique=True,
        sqlite_where=sa.text("activity_id IS NOT NULL"),
        postgresql_where=sa.text("activity_id IS NOT NULL"),
    )


def upgrade() -> None:
    op.create_table(
        WEEKLY_TARGETS_REBUILD_TABLE,
        sa.Column("id", sa.String(), autoincrement=False, nullable=False),
        sa.Column("training_block_id", sa.String(), nullable=False),
        sa.Column("activity_class_id", sa.String(), nullable=False),
        sa.Column("activity_id", sa.String(), nullable=True),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("target_unit", sa.String(), nullable=False),
        sa.Column(
            "target_kind",
            sa.String(),
            server_default="minimum",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_class_id"], ["activity_classes.id"]),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"]),
        sa.ForeignKeyConstraint(["training_block_id"], ["training_blocks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            f"""
            INSERT INTO {WEEKLY_TARGETS_REBUILD_TABLE} (
                id, training_block_id, activity_class_id, activity_id,
                target_value, target_unit, target_kind, created_at, updated_at
            )
            SELECT
                id, training_block_id, activity_class_id, NULL,
                target_value, target_unit, 'minimum', created_at, updated_at
            FROM weekly_targets
            """
        )
    )
    op.drop_table("weekly_targets")
    op.rename_table(WEEKLY_TARGETS_REBUILD_TABLE, "weekly_targets")
    _create_partial_weekly_target_uniques()


def downgrade() -> None:
    op.drop_index(WEEKLY_TARGET_ACTIVITY_INDEX, table_name="weekly_targets")
    op.drop_index(WEEKLY_TARGET_CLASS_LEGACY_INDEX, table_name="weekly_targets")

    op.create_table(
        WEEKLY_TARGETS_REBUILD_TABLE,
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
    op.execute(
        sa.text(
            f"""
            INSERT INTO {WEEKLY_TARGETS_REBUILD_TABLE} (
                id, training_block_id, activity_class_id,
                target_value, target_unit, created_at, updated_at
            )
            SELECT
                id, training_block_id, activity_class_id,
                target_value, target_unit, created_at, updated_at
            FROM weekly_targets
            WHERE activity_id IS NULL
            """
        )
    )
    op.drop_table("weekly_targets")
    op.rename_table(WEEKLY_TARGETS_REBUILD_TABLE, "weekly_targets")
