"""Add activity_classes.load_weight.

Revision ID: 20260818_0008
Revises: 20260614_0007
Create Date: 2026-08-18

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260818_0008"
down_revision: str | None = "20260614_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activity_classes",
        sa.Column("load_weight", sa.Float(), server_default="1.0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("activity_classes", "load_weight")
