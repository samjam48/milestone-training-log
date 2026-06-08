"""WTL.B7 — Weekly focus training_blocks schema (failing tests until implemented)."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine

from app.models.block import TrainingBlock
from app.tests.test_migrations import (
    _make_alembic_config,
    _migration_revision_files,
    _normalized_default,
    _sqlite_column_defaults,
    _unique_column_sets,
)

WTL_B7_TRAINING_BLOCK_COLUMNS = {
    "period_kind",
    "focus_series_id",
    "focus_title",
    "week_number",
}

WRU_B1_PERIOD_KIND_DEFAULT = "weekly_focus"


def _wtl_b7_revision_paths() -> list[Path]:
    return [
        path
        for path in _migration_revision_files()
        if "training_blocks" in path.read_text(encoding="utf-8")
        and "period_kind" in path.read_text(encoding="utf-8")
    ]


def _run_upgrade(database_url: str) -> Engine:
    command.upgrade(_make_alembic_config(database_url), "head")
    return create_engine(database_url)


def test_wtl_b7_migration_revision_extends_training_blocks_for_weekly_focus() -> None:
    revision_paths = _wtl_b7_revision_paths()
    assert revision_paths, (
        "WTL.B7 requires an Alembic revision extending training_blocks with "
        "period_kind, focus_series_id, focus_title, and week_number."
    )
    revision_text = revision_paths[-1].read_text(encoding="utf-8")
    for column in WTL_B7_TRAINING_BLOCK_COLUMNS:
        assert column in revision_text
    assert "weekly_focus" in revision_text


def test_wtl_b7_training_block_model_exposes_weekly_focus_fields() -> None:
    model_fields = set(TrainingBlock.model_fields)
    missing = WTL_B7_TRAINING_BLOCK_COLUMNS - model_fields
    assert not missing, f"TrainingBlock model missing WTL.B7 fields: {sorted(missing)}"


def test_wtl_b7_sqlite_head_schema_adds_training_block_weekly_focus_columns(
    tmp_path: Path,
) -> None:
    engine = _run_upgrade(f"sqlite:///{tmp_path / 'wtl-b7-schema.db'}")
    inspector = inspect(engine)
    column_names = {column["name"] for column in inspector.get_columns("training_blocks")}
    assert WTL_B7_TRAINING_BLOCK_COLUMNS.issubset(column_names)

    period_kind = next(
        column
        for column in inspector.get_columns("training_blocks")
        if column["name"] == "period_kind"
    )
    assert period_kind["nullable"] is False
    defaults = _sqlite_column_defaults(engine, "training_blocks")
    assert _normalized_default(defaults.get("period_kind")) == WRU_B1_PERIOD_KIND_DEFAULT


def test_wtl_b7_migration_declares_single_active_weekly_focus_guard() -> None:
    revision_paths = _wtl_b7_revision_paths()
    assert revision_paths, "WTL.B7 migration revision must exist before index guard test."
    revision_text = revision_paths[-1].read_text(encoding="utf-8").lower()
    assert "weekly_focus" in revision_text
    assert "unique" in revision_text
    assert "user_id" in revision_text


def test_wtl_b7_sqlite_head_schema_indexes_support_focus_series_lookup(
    tmp_path: Path,
) -> None:
    engine = _run_upgrade(f"sqlite:///{tmp_path / 'wtl-b7-indexes.db'}")
    unique_sets = _unique_column_sets(engine, "training_blocks")
    series_lookup = frozenset({"user_id", "focus_series_id", "week_number"})
    assert series_lookup in unique_sets or any(
        series_lookup.issubset(column_set) for column_set in unique_sets
    ), (
        "WTL.B7 expects an index on (user_id, focus_series_id, week_number) "
        "for focus-series queries."
    )
