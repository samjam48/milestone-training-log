"""WRU.B1 — Big-bang weekly rules migration.

Revision ID: 20260608_0006
Revises: 20260607_0005
Create Date: 2026-06-08

Deletes all legacy training_blocks, seeds one weekly_focus row for the current
calendar week, and copies enabled rules plus weekly targets from the prior
active legacy block when present. The single-active weekly_focus unique guard
from 20260607_0005 (uq_training_blocks_user_active_weekly_focus) is unchanged.
"""
from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Connection

revision: str = "20260608_0006"
down_revision: str | None = "20260607_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOCAL_USER_ID = "local"
PERIOD_KIND_WEEKLY_FOCUS = "weekly_focus"


def _calendar_week_bounds(as_of: date) -> tuple[date, date]:
    monday = as_of - timedelta(days=as_of.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _calendar_week_label(week_start: date, week_end: date) -> str:
    if week_start.year == week_end.year:
        if week_start.month == week_end.month:
            return (
                f"{week_start.strftime('%b')} {week_start.day} – "
                f"{week_end.day}, {week_end.year}"
            )
        return (
            f"{week_start.strftime('%b')} {week_start.day} – "
            f"{week_end.strftime('%b')} {week_end.day}, {week_end.year}"
        )
    return (
        f"{week_start.strftime('%b')} {week_start.day}, {week_start.year} – "
        f"{week_end.strftime('%b')} {week_end.day}, {week_end.year}"
    )


def _migration_as_of(connection: Connection) -> date:
    if connection.dialect.name == "postgresql":
        value = connection.execute(sa.text("SELECT CURRENT_DATE")).scalar_one()
    else:
        value = connection.execute(sa.text("SELECT date('now')")).scalar_one()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _fetch_active_legacy_block(connection: Connection) -> sa.Row[Any] | None:
    return connection.execute(
        sa.text(
            """
            SELECT id
            FROM training_blocks
            WHERE user_id = :user_id
              AND status = 'active'
              AND period_kind = 'legacy'
            ORDER BY start_date DESC, id ASC
            LIMIT 1
            """
        ),
        {"user_id": LOCAL_USER_ID},
    ).first()


def _fetch_enabled_rules(connection: Connection, block_id: str) -> list[sa.Row[Any]]:
    return list(
        connection.execute(
            sa.text(
                """
                SELECT activity_class_id, activity_id, rule_type,
                       threshold_value, window_days, limit_unit, enabled
                FROM rules
                WHERE training_block_id = :block_id AND enabled IS TRUE
                ORDER BY rule_type, threshold_value
                """
            ),
            {"block_id": block_id},
        ).fetchall()
    )


def _fetch_weekly_targets(connection: Connection, block_id: str) -> list[sa.Row[Any]]:
    return list(
        connection.execute(
            sa.text(
                """
                SELECT activity_class_id, activity_id, target_value,
                       target_unit, target_kind
                FROM weekly_targets
                WHERE training_block_id = :block_id
                ORDER BY activity_class_id, target_value
                """
            ),
            {"block_id": block_id},
        ).fetchall()
    )


def _wipe_training_block_graph(connection: Connection) -> None:
    connection.execute(sa.text("DELETE FROM rules"))
    connection.execute(sa.text("DELETE FROM weekly_targets"))
    connection.execute(sa.text("DELETE FROM recovery_targets"))
    connection.execute(sa.text("DELETE FROM training_blocks"))


def _insert_weekly_focus_block(
    connection: Connection,
    *,
    block_id: str,
    focus_series_id: str,
    week_start: date,
    week_end: date,
    now: datetime,
) -> None:
    connection.execute(
        sa.text(
            """
            INSERT INTO training_blocks (
                id, user_id, name, start_date, end_date, status,
                period_kind, focus_series_id, focus_title, week_number,
                related_goal_id, notes, is_review_milestone_hit,
                created_at, updated_at
            ) VALUES (
                :block_id, :user_id, :name, :week_start, :week_end, 'active',
                :period_kind, :focus_series_id, NULL, 1,
                NULL, NULL, false,
                :created_at, :updated_at
            )
            """
        ),
        {
            "block_id": block_id,
            "user_id": LOCAL_USER_ID,
            "name": _calendar_week_label(week_start, week_end),
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "period_kind": PERIOD_KIND_WEEKLY_FOCUS,
            "focus_series_id": focus_series_id,
            "created_at": now,
            "updated_at": now,
        },
    )


def _insert_copied_rules(
    connection: Connection,
    *,
    block_id: str,
    rules: Sequence[sa.Row[Any]],
    now: datetime,
) -> None:
    for rule in rules:
        connection.execute(
            sa.text(
                """
                INSERT INTO rules (
                    id, training_block_id, activity_class_id, activity_id,
                    rule_type, threshold_value, window_days, limit_unit,
                    enabled, created_at, updated_at
                ) VALUES (
                    :rule_id, :block_id, :activity_class_id, :activity_id,
                    :rule_type, :threshold_value, :window_days, :limit_unit,
                    :enabled, :created_at, :updated_at
                )
                """
            ),
            {
                "rule_id": f"rule-{uuid4()}",
                "block_id": block_id,
                "activity_class_id": rule.activity_class_id,
                "activity_id": rule.activity_id,
                "rule_type": rule.rule_type,
                "threshold_value": rule.threshold_value,
                "window_days": rule.window_days,
                "limit_unit": rule.limit_unit,
                "enabled": rule.enabled,
                "created_at": now,
                "updated_at": now,
            },
        )


def _insert_copied_weekly_targets(
    connection: Connection,
    *,
    block_id: str,
    targets: Sequence[sa.Row[Any]],
    now: datetime,
) -> None:
    for target in targets:
        connection.execute(
            sa.text(
                """
                INSERT INTO weekly_targets (
                    id, training_block_id, activity_class_id, activity_id,
                    target_value, target_unit, target_kind,
                    created_at, updated_at
                ) VALUES (
                    :target_id, :block_id, :activity_class_id, :activity_id,
                    :target_value, :target_unit, :target_kind,
                    :created_at, :updated_at
                )
                """
            ),
            {
                "target_id": f"wt-{uuid4()}",
                "block_id": block_id,
                "activity_class_id": target.activity_class_id,
                "activity_id": target.activity_id,
                "target_value": target.target_value,
                "target_unit": target.target_unit,
                "target_kind": target.target_kind,
                "created_at": now,
                "updated_at": now,
            },
        )


def _run_big_bang_weekly_rules_migration(connection: Connection) -> None:
    as_of = _migration_as_of(connection)
    week_start, week_end = _calendar_week_bounds(as_of)
    now = datetime.now(UTC).replace(tzinfo=None)

    legacy_block = _fetch_active_legacy_block(connection)
    copied_rules: list[sa.Row[Any]] = []
    copied_targets: list[sa.Row[Any]] = []
    if legacy_block is not None:
        copied_rules = _fetch_enabled_rules(connection, str(legacy_block.id))
        copied_targets = _fetch_weekly_targets(connection, str(legacy_block.id))

    _wipe_training_block_graph(connection)
    _alter_training_blocks_period_default(PERIOD_KIND_WEEKLY_FOCUS)

    block_id = f"blk-{uuid4()}"
    focus_series_id = f"fs-{uuid4()}"
    _insert_weekly_focus_block(
        connection,
        block_id=block_id,
        focus_series_id=focus_series_id,
        week_start=week_start,
        week_end=week_end,
        now=now,
    )
    _insert_copied_rules(connection, block_id=block_id, rules=copied_rules, now=now)
    _insert_copied_weekly_targets(
        connection,
        block_id=block_id,
        targets=copied_targets,
        now=now,
    )


def _alter_training_blocks_period_default(server_default: str) -> None:
    with op.batch_alter_table("training_blocks") as batch_op:
        batch_op.alter_column(
            "period_kind",
            existing_type=sa.String(),
            server_default=server_default,
        )


def upgrade() -> None:
    connection = op.get_bind()
    _run_big_bang_weekly_rules_migration(connection)


def downgrade() -> None:
    _alter_training_blocks_period_default("legacy")
