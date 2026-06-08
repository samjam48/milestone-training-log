"""WRU.B1 — helpers for big-bang weekly rules migration tests."""

from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.services.training_blocks import calendar_week_bounds
from app.tests.test_migrations import _migration_revision_files

WRU_B1_PRE_MIGRATION_REVISION = "20260607_0005"


def expected_migration_week_bounds(as_of: date | None = None) -> tuple[date, date]:
    """Calendar week the WRU.B1 migration seeds (matches DB CURRENT_DATE / date('now'))."""
    return calendar_week_bounds(as_of or date.today())


def _utc_now() -> datetime:
    return datetime(2026, 6, 7, 12, 0, tzinfo=UTC).replace(tzinfo=None)


def wru_b1_revision_paths() -> list[Path]:
    """Alembic revisions that perform WRU.B1 big-bang weekly rules data migration."""
    paths: list[Path] = []
    for path in _migration_revision_files():
        revision_text = path.read_text(encoding="utf-8")
        if f'revision: str = "{WRU_B1_PRE_MIGRATION_REVISION}"' in revision_text:
            continue
        lowered = revision_text.lower()
        if "weekly_rules" in lowered or "wru.b1" in lowered or "wru_b1" in lowered:
            paths.append(path)
            continue
        if (
            "training_blocks" in lowered
            and "weekly_focus" in lowered
            and "delete" in lowered
            and f'down_revision: str | None = "{WRU_B1_PRE_MIGRATION_REVISION}"' in revision_text
        ):
            paths.append(path)
    return paths


def require_wru_b1_migration_revision() -> Path:
    paths = wru_b1_revision_paths()
    if not paths:
        pytest.fail(
            "WRU.B1 requires an Alembic data migration revision after "
            f"{WRU_B1_PRE_MIGRATION_REVISION} that deletes legacy training_blocks "
            "and seeds one weekly_focus row for the current calendar week."
        )
    return paths[-1]


def revision_after_pre_migration(config: Config) -> str | None:
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()
    if head is None or head == WRU_B1_PRE_MIGRATION_REVISION:
        return None
    return head


def seed_activity_class_for_wru_b1(connection: Connection) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO activity_classes (
                id, user_id, name, description, type,
                default_recovery_window_days, created_at
            ) VALUES (
                'cls-wru-foot', 'local', 'Foot Load', '', 'performance',
                3, :created_at
            )
            """
        ),
        {"created_at": now},
    )


def seed_legacy_active_block_with_rules(
    connection: Connection,
    *,
    block_id: str = "blk-wru-legacy-active",
    include_disabled_rule: bool = True,
    include_weekly_target: bool = True,
) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO training_blocks (
                id, user_id, name, start_date, end_date, status,
                period_kind, related_goal_id, notes,
                is_review_milestone_hit, created_at, updated_at
            ) VALUES (
                :block_id, 'local', 'Return to Walking — Phase 2',
                '2026-04-07', '2026-05-31', 'active',
                'legacy', NULL, NULL,
                false, :created_at, :updated_at
            )
            """
        ),
        {"block_id": block_id, "created_at": now, "updated_at": now},
    )
    connection.execute(
        text(
            """
            INSERT INTO rules (
                id, training_block_id, activity_class_id, rule_type,
                threshold_value, window_days, enabled, created_at, updated_at
            ) VALUES (
                'rule-wru-enabled', :block_id, 'cls-wru-foot', 'weekly_load_cap',
                120.0, 7, true, :created_at, :updated_at
            )
            """
        ),
        {"block_id": block_id, "created_at": now, "updated_at": now},
    )
    if include_disabled_rule:
        connection.execute(
            text(
                """
                INSERT INTO rules (
                    id, training_block_id, activity_class_id, rule_type,
                    threshold_value, window_days, enabled, created_at, updated_at
                ) VALUES (
                    'rule-wru-disabled', :block_id, 'cls-wru-foot', 'frequency_limit',
                    3.0, 7, false, :created_at, :updated_at
                )
                """
            ),
            {"block_id": block_id, "created_at": now, "updated_at": now},
        )
    if include_weekly_target:
        connection.execute(
            text(
                """
                INSERT INTO weekly_targets (
                    id, training_block_id, activity_class_id,
                    target_value, target_unit, created_at, updated_at
                ) VALUES (
                    'wt-wru-foot', :block_id, 'cls-wru-foot',
                    8.0, 'km', :created_at, :updated_at
                )
                """
            ),
            {"block_id": block_id, "created_at": now, "updated_at": now},
        )


def seed_completed_legacy_block(
    connection: Connection,
    *,
    block_id: str = "blk-wru-legacy-completed",
) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO training_blocks (
                id, user_id, name, start_date, end_date, status,
                period_kind, related_goal_id, notes,
                is_review_milestone_hit, created_at, updated_at
            ) VALUES (
                :block_id, 'local', 'Return to Walking — Phase 1',
                '2026-03-01', '2026-04-06', 'completed',
                'legacy', NULL, NULL,
                false, :created_at, :updated_at
            )
            """
        ),
        {"block_id": block_id, "created_at": now, "updated_at": now},
    )


def seed_legacy_active_block_without_rules(
    connection: Connection,
    *,
    block_id: str = "blk-wru-legacy-empty",
) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO training_blocks (
                id, user_id, name, start_date, end_date, status,
                period_kind, related_goal_id, notes,
                is_review_milestone_hit, created_at, updated_at
            ) VALUES (
                :block_id, 'local', 'Empty legacy block',
                '2026-04-07', NULL, 'active',
                'legacy', NULL, NULL,
                false, :created_at, :updated_at
            )
            """
        ),
        {"block_id": block_id, "created_at": now, "updated_at": now},
    )


def count_training_blocks(engine: Engine) -> dict[str, int]:
    with engine.connect() as connection:
        total = connection.execute(
            text("SELECT COUNT(*) FROM training_blocks")
        ).scalar_one()
        active = connection.execute(
            text("SELECT COUNT(*) FROM training_blocks WHERE status = 'active'")
        ).scalar_one()
        completed = connection.execute(
            text("SELECT COUNT(*) FROM training_blocks WHERE status = 'completed'")
        ).scalar_one()
        weekly_focus = connection.execute(
            text(
                "SELECT COUNT(*) FROM training_blocks WHERE period_kind = 'weekly_focus'"
            )
        ).scalar_one()
        legacy = connection.execute(
            text("SELECT COUNT(*) FROM training_blocks WHERE period_kind = 'legacy'")
        ).scalar_one()
    return {
        "total": int(total),
        "active": int(active),
        "completed": int(completed),
        "weekly_focus": int(weekly_focus),
        "legacy": int(legacy),
    }


def active_weekly_block_row(engine: Engine) -> dict[str, Any]:
    with engine.connect() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, name, start_date, end_date, status, period_kind,
                           week_number, focus_series_id
                    FROM training_blocks
                    WHERE status = 'active'
                    """
                )
            )
            .mappings()
            .one()
        )
    return dict(row)


def rule_signatures_for_block(engine: Engine, block_id: str) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT activity_class_id, activity_id, rule_type,
                       threshold_value, window_days, enabled
                FROM rules
                WHERE training_block_id = :block_id
                ORDER BY rule_type, threshold_value
                """
            ),
            {"block_id": block_id},
        ).mappings().all()
    return [
        (
            row["activity_class_id"],
            row["activity_id"],
            row["rule_type"],
            row["threshold_value"],
            row["window_days"],
            bool(row["enabled"]),
        )
        for row in rows
    ]


def weekly_target_signatures_for_block(
    engine: Engine,
    block_id: str,
) -> list[tuple[Any, ...]]:
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT activity_class_id, activity_id, target_value, target_unit
                FROM weekly_targets
                WHERE training_block_id = :block_id
                ORDER BY activity_class_id, target_value
                """
            ),
            {"block_id": block_id},
        ).mappings().all()
    return [
        (
            row["activity_class_id"],
            row["activity_id"],
            row["target_value"],
            row["target_unit"],
        )
        for row in rows
    ]


def enabled_rule_count(engine: Engine, block_id: str) -> int:
    with engine.connect() as connection:
        count = connection.execute(
            text(
                """
                SELECT COUNT(*) FROM rules
                WHERE training_block_id = :block_id AND enabled IS TRUE
                """
            ),
            {"block_id": block_id},
        ).scalar_one()
    return int(count)
