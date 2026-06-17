"""Cascade rule scope deletes.

Revision ID: 20260614_0007
Revises: 20260608_0006
Create Date: 2026-06-14

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260614_0007"
down_revision: str | None = "20260608_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RULE_FK_NAMING_CONVENTION = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}

RULE_SCOPE_FOREIGN_KEYS = (
    (
        "activity_class_id",
        "activity_classes",
        "fk_rules_activity_class_id_activity_classes",
    ),
    (
        "activity_id",
        "activities",
        "fk_rules_activity_id_activities",
    ),
)


def upgrade() -> None:
    _replace_rule_scope_foreign_keys(ondelete="CASCADE")


def downgrade() -> None:
    _replace_rule_scope_foreign_keys(ondelete=None)


def _replace_rule_scope_foreign_keys(*, ondelete: str | None) -> None:
    bind = op.get_bind()

    if bind.dialect.name == "sqlite":
        existing_names = _rule_scope_foreign_key_names()
        with op.batch_alter_table(
            "rules",
            schema=None,
            naming_convention=RULE_FK_NAMING_CONVENTION,
        ) as batch_op:
            for column_name, referred_table, default_name in RULE_SCOPE_FOREIGN_KEYS:
                batch_op.drop_constraint(
                    existing_names.get(column_name, default_name),
                    type_="foreignkey",
                )
                batch_op.create_foreign_key(
                    default_name,
                    referred_table,
                    [column_name],
                    ["id"],
                    ondelete=ondelete,
                )
        return

    for column_name, referred_table, default_name in RULE_SCOPE_FOREIGN_KEYS:
        existing_name = _rule_scope_foreign_key_names().get(column_name)
        if existing_name is not None:
            op.drop_constraint(existing_name, "rules", type_="foreignkey")
        op.create_foreign_key(
            default_name,
            "rules",
            referred_table,
            [column_name],
            ["id"],
            ondelete=ondelete,
        )


def _rule_scope_foreign_key_names() -> dict[str, str]:
    inspector = sa.inspect(op.get_bind())
    names: dict[str, str] = {}

    for foreign_key in inspector.get_foreign_keys("rules"):
        constrained_columns = foreign_key["constrained_columns"]
        referred_table = foreign_key["referred_table"]
        name = foreign_key["name"]

        if name is None or len(constrained_columns) != 1:
            continue

        column_name = str(constrained_columns[0])
        if any(
            column_name == expected_column and referred_table == expected_table
            for expected_column, expected_table, _default_name in RULE_SCOPE_FOREIGN_KEYS
        ):
            names[column_name] = str(name)

    return names
