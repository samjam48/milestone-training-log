"""Add goals and rules Stage 2.5 schema extensions.

Revision ID: 20260606_0002
Revises: 20260527_0001
Create Date: 2026-06-06

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260606_0002"
down_revision: str | None = "20260527_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.add_column(sa.Column("activity_id", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column("auto_track_progress", sa.Boolean(), server_default="0", nullable=False),
        )
        batch_op.create_foreign_key(
            "fk_goals_activity_id_activities",
            "activities",
            ["activity_id"],
            ["id"],
        )

    with op.batch_alter_table("rules", schema=None) as batch_op:
        batch_op.add_column(sa.Column("activity_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("limit_unit", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            "fk_rules_activity_id_activities",
            "activities",
            ["activity_id"],
            ["id"],
        )

    op.execute(
        sa.text(
            "UPDATE rules SET enabled = 0 WHERE rule_type = 'weekly_activity_count'"
        )
    )


def downgrade() -> None:
    with op.batch_alter_table("rules", schema=None) as batch_op:
        batch_op.drop_constraint("fk_rules_activity_id_activities", type_="foreignkey")
        batch_op.drop_column("limit_unit")
        batch_op.drop_column("activity_id")

    with op.batch_alter_table("goals", schema=None) as batch_op:
        batch_op.drop_constraint("fk_goals_activity_id_activities", type_="foreignkey")
        batch_op.drop_column("auto_track_progress")
        batch_op.drop_column("activity_id")
