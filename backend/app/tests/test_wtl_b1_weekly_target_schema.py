"""Weekly target schema consolidation.

Covers Alembic schema extensions, recovery-target data migration, model shape,
relationships, docs contract, and SQLite/Postgres migration gates.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from importlib import import_module
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect as sqlalchemy_inspect
from sqlalchemy.orm import Mapper, RelationshipProperty
from sqlalchemy.sql.schema import Table, UniqueConstraint
from sqlmodel import Session, SQLModel

from app.tests.compose_support import REPO_ROOT
from app.tests.helpers.postgres_migration import (
    postgres_engine,
    postgres_tests_requested,
    resolve_postgres_database_url,
    stop_ephemeral_postgres_container,
)
from app.tests.test_migrations import (
    _foreign_key_triples,
    _make_alembic_config,
    _migration_revision_files,
    _normalized_default,
    _unique_column_sets,
)

if TYPE_CHECKING:
    from app.models.block import WeeklyTarget

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATABASE_SCHEMA_DOC = REPO_ROOT / "docs" / "database-schema.md"

STAGE_2_5_HEAD_REVISION = "20260606_0002"
WTL_B1_HEAD_REVISION = "20260607_0005"
WTL_B1_SCHEMA_BEFORE_CONFLICT_SEED = "20260607_0003"

WTL_B1_WEEKLY_TARGET_COLUMNS = {
    "activity_id",
    "target_kind",
}

WTL_B1_WEEKLY_TARGET_FOREIGN_KEYS = {
    ("activity_id", "activities", "id"),
}

WTL_B1_CLASS_LEGACY_UNIQUE_COLUMNS = frozenset({"training_block_id", "activity_class_id"})
WTL_B1_ACTIVITY_SCOPED_UNIQUE_COLUMNS = frozenset({"training_block_id", "activity_id"})

WTL_B1_TARGET_KIND_DEFAULT = "minimum"


def _utc_now() -> datetime:
    return datetime(2026, 6, 7, 9, 0, tzinfo=UTC).replace(tzinfo=None)


def _weekly_targets_section(database_schema_text: str) -> str:
    match_start = database_schema_text.find("### `weekly_targets`")
    assert match_start != -1, "docs/database-schema.md must document weekly_targets."
    next_section = database_schema_text.find("\n### `", match_start + 1)
    if next_section == -1:
        return database_schema_text[match_start:]
    return database_schema_text[match_start:next_section]


def _recovery_targets_section(database_schema_text: str) -> str:
    match_start = database_schema_text.find("### `recovery_targets`")
    assert match_start != -1, "docs/database-schema.md must document recovery_targets."
    next_section = database_schema_text.find("\n### `", match_start + 1)
    if next_section == -1:
        return database_schema_text[match_start:]
    return database_schema_text[match_start:next_section]


def _wtl_b1_revision_paths() -> list[Path]:
    return [
        path
        for path in _migration_revision_files()
        if "weekly_targets" in path.read_text(encoding="utf-8")
        and "activity_id" in path.read_text(encoding="utf-8")
    ]


def _revision_before_head(config: Config) -> str | None:
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()
    if head is None:
        return None
    revision = script.get_revision(head)
    if revision is None:
        return None
    return cast(str | None, revision.down_revision)


def _run_upgrade(database_url: str, revision: str = "head") -> Engine:
    command.upgrade(_make_alembic_config(database_url), revision)
    return create_engine(database_url)


def _seed_wtl_b1_migration_base(connection: Any) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO activity_classes (
                id, user_id, name, description, type,
                default_recovery_window_days, created_at
            ) VALUES (
                'cls-wtl', 'local', 'Recovery', 'WTL migration class', 'recovery',
                3, :created_at
            )
            """
        ),
        {"created_at": now},
    )
    connection.execute(
        text(
            """
            INSERT INTO activities (
                id, user_id, activity_class_id, name, type,
                default_volume_unit, is_active, created_at, updated_at
            ) VALUES (
                'act-foam-roll', 'local', 'cls-wtl', 'Foam roll', 'recovery',
                'minutes', 1, :created_at, :updated_at
            )
            """
        ),
        {"created_at": now, "updated_at": now},
    )
    connection.execute(
        text(
            """
            INSERT INTO activities (
                id, user_id, activity_class_id, name, type,
                default_volume_unit, is_active, created_at, updated_at
            ) VALUES (
                'act-walk', 'local', 'cls-wtl', 'Morning walk', 'performance',
                'km', 1, :created_at, :updated_at
            )
            """
        ),
        {"created_at": now, "updated_at": now},
    )
    connection.execute(
        text(
            """
            INSERT INTO training_blocks (
                id, user_id, name, start_date, status,
                is_review_milestone_hit, created_at, updated_at
            ) VALUES (
                'blk-wtl', 'local', 'WTL block', '2026-06-01', 'active',
                0, :created_at, :updated_at
            )
            """
        ),
        {"created_at": now, "updated_at": now},
    )


def _insert_legacy_class_weekly_target(connection: Any) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO weekly_targets (
                id, training_block_id, activity_class_id,
                target_value, target_unit, created_at, updated_at
            ) VALUES (
                'wt-class-legacy', 'blk-wtl', 'cls-wtl',
                12.0, 'km', :created_at, :updated_at
            )
            """
        ),
        {"created_at": now, "updated_at": now},
    )


def _insert_weekly_recovery_target(
    connection: Any,
    *,
    target_id: str = "rt-weekly",
    activity_id: str = "act-foam-roll",
    target_frequency: int = 3,
) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO recovery_targets (
                id, training_block_id, activity_id, target_frequency,
                frequency_unit, current_streak_days, created_at, updated_at
            ) VALUES (
                :target_id, 'blk-wtl', :activity_id, :target_frequency,
                'weekly', 2, :created_at, :updated_at
            )
            """
        ),
        {
            "target_id": target_id,
            "activity_id": activity_id,
            "target_frequency": target_frequency,
            "created_at": now,
            "updated_at": now,
        },
    )


def _insert_daily_recovery_target(connection: Any) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO recovery_targets (
                id, training_block_id, activity_id, target_frequency,
                frequency_unit, current_streak_days, created_at, updated_at
            ) VALUES (
                'rt-daily', 'blk-wtl', 'act-foam-roll', 1,
                'daily', 4, :created_at, :updated_at
            )
            """
        ),
        {"created_at": now, "updated_at": now},
    )


def _insert_activity_scoped_weekly_target(
    connection: Any,
    *,
    target_id: str,
    activity_id: str,
    target_value: float,
    target_unit: str = "sessions",
    target_kind: str = WTL_B1_TARGET_KIND_DEFAULT,
) -> None:
    now = _utc_now()
    connection.execute(
        text(
            """
            INSERT INTO weekly_targets (
                id, training_block_id, activity_class_id, activity_id,
                target_value, target_unit, target_kind, created_at, updated_at
            ) VALUES (
                :target_id, 'blk-wtl', 'cls-wtl', :activity_id,
                :target_value, :target_unit, :target_kind, :created_at, :updated_at
            )
            """
        ),
        {
            "target_id": target_id,
            "activity_id": activity_id,
            "target_value": target_value,
            "target_unit": target_unit,
            "target_kind": target_kind,
            "created_at": now,
            "updated_at": now,
        },
    )


def _weekly_target_column_names_on_engine(engine: Engine) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns("weekly_targets")}


def _require_wtl_b1_weekly_target_schema(engine: Engine) -> None:
    weekly_column_names = _weekly_target_column_names_on_engine(engine)
    assert WTL_B1_WEEKLY_TARGET_COLUMNS.issubset(weekly_column_names), (
        "WTL.B1 migration must add weekly_targets.activity_id and target_kind."
    )


def _weekly_target_rows_for_activity(
    connection: Any,
    *,
    activity_id: str,
) -> list[dict[str, Any]]:
    rows = connection.execute(
        text(
            """
            SELECT id, training_block_id, activity_class_id, activity_id,
                   target_value, target_unit, target_kind
            FROM weekly_targets
            WHERE training_block_id = 'blk-wtl' AND activity_id = :activity_id
            ORDER BY id
            """
        ),
        {"activity_id": activity_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _load_weekly_target_model() -> type[SQLModel]:
    block_module = import_module("app.models.block")
    weekly_target_model = getattr(block_module, "WeeklyTarget")
    assert isinstance(weekly_target_model, type)
    assert issubclass(weekly_target_model, SQLModel)
    return weekly_target_model


def _relationship_target_tables(model_class: type[SQLModel]) -> set[str]:
    mapper = cast(Mapper[SQLModel], sqlalchemy_inspect(model_class))
    return {
        cast(Table, relationship.mapper.local_table).name
        for relationship in mapper.relationships
        if isinstance(relationship, RelationshipProperty)
    }


def _weekly_target_table() -> Table:
    import_module("app.models")
    return SQLModel.metadata.tables["weekly_targets"]


def _weekly_target_column_names() -> set[str]:
    return set(_weekly_target_table().columns.keys())


def _weekly_target_unique_sets() -> set[frozenset[str]]:
    table = _weekly_target_table()
    unique_sets = {
        frozenset(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    for index in table.indexes:
        if index.unique:
            unique_sets.add(frozenset(column.name for column in index.columns))
    return unique_sets


@pytest.fixture(scope="module")
def postgres_database_url() -> Iterator[str]:
    if not postgres_tests_requested():
        pytest.skip(
            "Postgres WTL.B1 migration tests run via `make test-postgres`, CI, or "
            "POSTGRES_TEST_URL / RUN_POSTGRES_TESTS=1."
        )

    try:
        database_url = resolve_postgres_database_url()
    except RuntimeError as exc:
        pytest.fail(str(exc))

    if database_url is None:
        pytest.skip(
            "Postgres WTL.B1 migration tests require POSTGRES_TEST_URL or RUN_POSTGRES_TESTS=1."
        )

    try:
        yield database_url
    finally:
        stop_ephemeral_postgres_container()


def test_wtl_b1_migration_revision_extends_weekly_targets_schema() -> None:
    revisions = _migration_revision_files()

    assert len(revisions) >= 3, (
        "WTL.B1 requires a third Alembic revision extending weekly_targets."
    )

    wtl_revision_paths = _wtl_b1_revision_paths()
    assert wtl_revision_paths, (
        "WTL.B1 requires an Alembic revision that adds weekly_targets.activity_id."
    )

    wtl_revision_text = "\n".join(
        path.read_text(encoding="utf-8") for path in wtl_revision_paths
    )
    assert "weekly_targets" in wtl_revision_text
    assert "activity_id" in wtl_revision_text
    assert "target_kind" in wtl_revision_text
    assert "def upgrade()" in wtl_revision_text
    assert "def downgrade()" in wtl_revision_text


def test_wtl_b1_sqlite_head_schema_adds_weekly_target_columns_and_constraints(
    tmp_path: Path,
) -> None:
    engine = _run_upgrade(f"sqlite:///{tmp_path / 'wtl-b1-schema.db'}")
    inspector = inspect(engine)

    weekly_columns = {
        column["name"]: column for column in inspector.get_columns("weekly_targets")
    }
    assert WTL_B1_WEEKLY_TARGET_COLUMNS.issubset(weekly_columns)
    assert weekly_columns["activity_id"]["nullable"] is True
    assert _normalized_default(weekly_columns["target_kind"].get("default")) == (
        WTL_B1_TARGET_KIND_DEFAULT
    )

    foreign_keys = _foreign_key_triples(engine, "weekly_targets")
    assert WTL_B1_WEEKLY_TARGET_FOREIGN_KEYS.issubset(foreign_keys)

    unique_sets = _unique_column_sets(engine, "weekly_targets")
    assert WTL_B1_CLASS_LEGACY_UNIQUE_COLUMNS in unique_sets
    assert WTL_B1_ACTIVITY_SCOPED_UNIQUE_COLUMNS in unique_sets


def test_wtl_b1_migration_preserves_readable_legacy_class_weekly_targets(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-legacy-class.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        _insert_legacy_class_weekly_target(connection)

    command.upgrade(config, WTL_B1_HEAD_REVISION)

    _require_wtl_b1_weekly_target_schema(engine)

    with engine.connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT id, activity_class_id, activity_id, target_value, target_unit
                FROM weekly_targets
                WHERE id = 'wt-class-legacy'
                """
            )
        ).mappings().one()

    assert row["activity_class_id"] == "cls-wtl"
    assert row["activity_id"] is None
    assert row["target_value"] == 12.0
    assert row["target_unit"] == "km"


def test_wtl_b1_migration_converts_two_weekly_recovery_targets_in_same_class(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-recovery-same-class.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        _insert_weekly_recovery_target(
            connection,
            target_id="rt-foam-roll",
            activity_id="act-foam-roll",
            target_frequency=3,
        )
        _insert_weekly_recovery_target(
            connection,
            target_id="rt-walk",
            activity_id="act-walk",
            target_frequency=2,
        )

    command.upgrade(config, WTL_B1_HEAD_REVISION)
    _require_wtl_b1_weekly_target_schema(engine)

    with engine.connect() as connection:
        foam_roll_rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-foam-roll",
        )
        walk_rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-walk",
        )

    assert len(foam_roll_rows) == 1
    assert foam_roll_rows[0]["target_value"] == 3.0
    assert foam_roll_rows[0]["activity_class_id"] == "cls-wtl"

    assert len(walk_rows) == 1
    assert walk_rows[0]["target_value"] == 2.0
    assert walk_rows[0]["activity_class_id"] == "cls-wtl"


def test_wtl_b1_migration_converts_weekly_recovery_targets_to_activity_weekly_targets(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-recovery-weekly.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        _insert_weekly_recovery_target(connection, target_frequency=4)

    command.upgrade(config, WTL_B1_HEAD_REVISION)
    _require_wtl_b1_weekly_target_schema(engine)

    with engine.connect() as connection:
        migrated_rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-foam-roll",
        )

    assert len(migrated_rows) == 1
    migrated = migrated_rows[0]
    assert migrated["activity_class_id"] == "cls-wtl"
    assert migrated["target_value"] == 4.0
    assert migrated["target_unit"] == "sessions"
    assert migrated["target_kind"] == WTL_B1_TARGET_KIND_DEFAULT


def test_wtl_b1_migration_leaves_daily_recovery_targets_unconverted(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-recovery-daily.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        _insert_daily_recovery_target(connection)

    command.upgrade(config, WTL_B1_HEAD_REVISION)
    _require_wtl_b1_weekly_target_schema(engine)

    with engine.connect() as connection:
        daily_row = connection.execute(
            text(
                """
                SELECT id, frequency_unit
                FROM recovery_targets
                WHERE id = 'rt-daily'
                """
            )
        ).mappings().one()
        activity_rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-foam-roll",
        )

    assert daily_row["frequency_unit"] == "daily"
    assert activity_rows == []


def test_wtl_b1_migration_keeps_existing_weekly_target_on_recovery_conflict(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-recovery-conflict.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        _insert_weekly_recovery_target(connection, target_frequency=5)

    command.upgrade(config, WTL_B1_SCHEMA_BEFORE_CONFLICT_SEED)
    _require_wtl_b1_weekly_target_schema(engine)

    with engine.begin() as connection:
        _insert_activity_scoped_weekly_target(
            connection,
            target_id="wt-existing",
            activity_id="act-foam-roll",
            target_value=2.0,
        )

    command.upgrade(config, WTL_B1_HEAD_REVISION)

    with engine.connect() as connection:
        rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-foam-roll",
        )

    assert len(rows) == 1
    assert rows[0]["id"] == "wt-existing"
    assert rows[0]["target_value"] == 2.0
    assert rows[0]["target_unit"] == "sessions"


def test_weekly_target_migration_leaves_orphan_recovery_targets_unconverted(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'wtl-b1-recovery-orphan.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)
    engine = create_engine(database_url)
    now = _utc_now()
    with engine.begin() as connection:
        _seed_wtl_b1_migration_base(connection)
        connection.execute(
            text(
                """
                INSERT INTO activities (
                    id, user_id, activity_class_id, name, type,
                    default_volume_unit, is_active, created_at, updated_at
                ) VALUES (
                    'act-missing', 'local', 'cls-wtl', 'Deleted activity', 'recovery',
                    'minutes', 0, :created_at, :updated_at
                )
                """
            ),
            {"created_at": now, "updated_at": now},
        )
        _insert_weekly_recovery_target(
            connection,
            target_id="rt-orphan",
            activity_id="act-missing",
            target_frequency=2,
        )

    with engine.connect() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("DELETE FROM activities WHERE id = 'act-missing'"))
        connection.commit()
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.commit()

    command.upgrade(config, WTL_B1_HEAD_REVISION)
    _require_wtl_b1_weekly_target_schema(engine)

    with engine.connect() as connection:
        orphan_row = connection.execute(
            text(
                """
                SELECT id, activity_id, frequency_unit
                FROM recovery_targets
                WHERE id = 'rt-orphan'
                """
            )
        ).mappings().one()
        migrated_rows = _weekly_target_rows_for_activity(
            connection,
            activity_id="act-missing",
        )

    assert orphan_row["activity_id"] == "act-missing"
    assert orphan_row["frequency_unit"] == "weekly"
    assert migrated_rows == []


def test_wtl_b1_weekly_target_model_exposes_activity_scoped_fields() -> None:
    weekly_target_model = _load_weekly_target_model()
    model_fields = set(weekly_target_model.model_fields)

    assert {"activity_id", "target_kind"}.issubset(model_fields)
    assert WTL_B1_WEEKLY_TARGET_COLUMNS.issubset(_weekly_target_column_names())
    weekly_target_unique_sets = _weekly_target_unique_sets()
    assert WTL_B1_CLASS_LEGACY_UNIQUE_COLUMNS in weekly_target_unique_sets
    assert WTL_B1_ACTIVITY_SCOPED_UNIQUE_COLUMNS in weekly_target_unique_sets


def test_wtl_b1_weekly_target_model_links_activity_relationship() -> None:
    weekly_target_model = _load_weekly_target_model()
    activity_module = import_module("app.models.activity")
    activity_model = getattr(activity_module, "Activity")

    assert "activities" in _relationship_target_tables(weekly_target_model)
    assert "weekly_targets" in _relationship_target_tables(activity_model)


def test_wtl_b1_sqlite_persistence_roundtrips_activity_scoped_weekly_target() -> None:
    weekly_target_model = cast("type[WeeklyTarget]", _load_weekly_target_model())
    activity_module = import_module("app.models.activity")
    block_module = import_module("app.models.block")

    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    now = _utc_now()

    activity_class = activity_module.ActivityClass(
        id="cls-wtl-model",
        name="Recovery",
        description="Model roundtrip",
        type="recovery",
        created_at=now,
    )
    activity = activity_module.Activity(
        id="act-wtl-model",
        activity_class_id="cls-wtl-model",
        name="Foam roll",
        type="recovery",
        default_volume_unit="minutes",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    training_block = block_module.TrainingBlock(
        id="blk-wtl-model",
        name="Model block",
        start_date=now.date(),
        end_date=None,
        status="active",
        related_goal_id=None,
        notes=None,
        created_at=now,
        updated_at=now,
    )
    weekly_target = weekly_target_model(
        id="wt-activity-scoped",
        training_block_id="blk-wtl-model",
        activity_class_id="cls-wtl-model",
        activity_id="act-wtl-model",
        target_value=3,
        target_unit="sessions",
        target_kind=WTL_B1_TARGET_KIND_DEFAULT,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(activity_class)
        session.add(activity)
        session.add(training_block)
        session.add(weekly_target)
        session.commit()

        persisted = session.get(weekly_target_model, "wt-activity-scoped")

    assert persisted is not None
    assert persisted.activity_id == "act-wtl-model"
    assert persisted.activity_class_id == "cls-wtl-model"
    assert persisted.target_kind == WTL_B1_TARGET_KIND_DEFAULT
    assert persisted.target_unit == "sessions"


def test_wtl_b1_database_schema_docs_describe_consolidated_weekly_targets() -> None:
    assert DATABASE_SCHEMA_DOC.is_file(), "docs/database-schema.md must exist for WTL.B1."

    schema_text = DATABASE_SCHEMA_DOC.read_text(encoding="utf-8")
    weekly_section = _weekly_targets_section(schema_text)
    recovery_section = _recovery_targets_section(schema_text)

    assert "activity_id" in weekly_section
    assert "target_kind" in weekly_section
    assert "minimum" in weekly_section.lower()
    assert "user-facing" in weekly_section.lower() or "any activity" in weekly_section.lower()

    assert "deprecated" in recovery_section.lower() or "legacy" in recovery_section.lower()
    assert "daily" in recovery_section.lower()


@pytest.mark.postgres
def test_wtl_b1_postgres_head_schema_adds_weekly_target_columns_and_constraints(
    postgres_database_url: str,
) -> None:
    _run_upgrade(postgres_database_url)

    with postgres_engine(postgres_database_url) as engine:
        inspector = inspect(engine)
        weekly_columns = {
            column["name"]: column for column in inspector.get_columns("weekly_targets")
        }

        assert WTL_B1_WEEKLY_TARGET_COLUMNS.issubset(weekly_columns)
        assert weekly_columns["activity_id"]["nullable"] is True
        assert _normalized_default(weekly_columns["target_kind"].get("default")) == (
            WTL_B1_TARGET_KIND_DEFAULT
        )
        assert WTL_B1_WEEKLY_TARGET_FOREIGN_KEYS.issubset(
            _foreign_key_triples(engine, "weekly_targets")
        )
        unique_sets = _unique_column_sets(engine, "weekly_targets")
        assert WTL_B1_CLASS_LEGACY_UNIQUE_COLUMNS in unique_sets
        assert WTL_B1_ACTIVITY_SCOPED_UNIQUE_COLUMNS in unique_sets


@pytest.mark.postgres
def test_wtl_b1_postgres_migration_converts_weekly_recovery_targets(
    postgres_database_url: str,
) -> None:
    config = _make_alembic_config(postgres_database_url)
    command.upgrade(config, STAGE_2_5_HEAD_REVISION)

    with postgres_engine(postgres_database_url) as engine:
        with engine.begin() as connection:
            _seed_wtl_b1_migration_base(connection)
            _insert_weekly_recovery_target(connection, target_frequency=3)

    command.upgrade(config, WTL_B1_HEAD_REVISION)

    with postgres_engine(postgres_database_url) as engine:
        _require_wtl_b1_weekly_target_schema(engine)
        with engine.connect() as connection:
            rows = _weekly_target_rows_for_activity(
                connection,
                activity_id="act-foam-roll",
            )

    assert len(rows) == 1
    assert rows[0]["target_unit"] == "sessions"
    assert rows[0]["target_kind"] == WTL_B1_TARGET_KIND_DEFAULT
