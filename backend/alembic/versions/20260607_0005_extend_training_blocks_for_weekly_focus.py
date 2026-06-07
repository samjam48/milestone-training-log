"""Extend training_blocks for weekly focus lifecycle.

Revision ID: 20260607_0005
Revises: 20260607_0004
Create Date: 2026-06-07

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260607_0005"
down_revision: str | None = "20260607_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ACTIVE_WEEKLY_FOCUS_INDEX = "uq_training_blocks_user_active_weekly_focus"
FOCUS_SERIES_WEEK_INDEX = "uq_training_blocks_user_focus_series_week"


def upgrade() -> None:
    op.add_column(
        "training_blocks",
        sa.Column(
            "period_kind",
            sa.String(),
            nullable=False,
            server_default="legacy",
        ),
    )
    op.add_column(
        "training_blocks",
        sa.Column("focus_series_id", sa.String(), nullable=True),
    )
    op.add_column(
        "training_blocks",
        sa.Column("focus_title", sa.String(), nullable=True),
    )
    op.add_column(
        "training_blocks",
        sa.Column("week_number", sa.Integer(), nullable=True),
    )
    op.execute(sa.text("UPDATE training_blocks SET period_kind = 'legacy'"))
    op.create_index(
        ACTIVE_WEEKLY_FOCUS_INDEX,
        "training_blocks",
        ["user_id"],
        unique=True,
        sqlite_where=sa.text("status = 'active' AND period_kind = 'weekly_focus'"),
        postgresql_where=sa.text("status = 'active' AND period_kind = 'weekly_focus'"),
    )
    op.create_index(
        FOCUS_SERIES_WEEK_INDEX,
        "training_blocks",
        ["user_id", "focus_series_id", "week_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(FOCUS_SERIES_WEEK_INDEX, table_name="training_blocks")
    op.drop_index(ACTIVE_WEEKLY_FOCUS_INDEX, table_name="training_blocks")
    op.drop_column("training_blocks", "week_number")
    op.drop_column("training_blocks", "focus_title")
    op.drop_column("training_blocks", "focus_series_id")
    op.drop_column("training_blocks", "period_kind")
