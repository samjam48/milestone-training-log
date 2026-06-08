"""Migrate weekly recovery_targets into weekly_targets.

Revision ID: 20260607_0004
Revises: 20260607_0003
Create Date: 2026-06-07

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260607_0004"
down_revision: str | None = "20260607_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO weekly_targets (
                id, training_block_id, activity_class_id, activity_id,
                target_value, target_unit, target_kind, created_at, updated_at
            )
            SELECT
                'wt-rt-' || rt.id,
                rt.training_block_id,
                a.activity_class_id,
                rt.activity_id,
                CAST(rt.target_frequency AS FLOAT),
                'sessions',
                'minimum',
                rt.created_at,
                rt.updated_at
            FROM recovery_targets rt
            INNER JOIN activities a ON a.id = rt.activity_id
            WHERE rt.frequency_unit = 'weekly'
            AND NOT EXISTS (
                SELECT 1
                FROM weekly_targets wt
                WHERE wt.training_block_id = rt.training_block_id
                AND wt.activity_id = rt.activity_id
            )
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM weekly_targets WHERE id LIKE 'wt-rt-%'"))
