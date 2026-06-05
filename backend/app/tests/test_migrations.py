from __future__ import annotations

from pathlib import Path
from typing import cast

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"
ALEMBIC_ROOT = BACKEND_ROOT / "alembic"
ALEMBIC_ENV = ALEMBIC_ROOT / "env.py"
ALEMBIC_SCRIPT_TEMPLATE = ALEMBIC_ROOT / "script.py.mako"
ALEMBIC_VERSIONS = ALEMBIC_ROOT / "versions"

APPLICATION_TABLES = {
    "activity_classes",
    "activities",
    "activity_logs",
    "daily_check_ins",
    "flare_up_incidents",
    "training_blocks",
    "rules",
    "weekly_targets",
    "recovery_targets",
    "goals",
}

TOP_LEVEL_USER_TABLES = {
    "activity_classes",
    "activities",
    "activity_logs",
    "daily_check_ins",
    "flare_up_incidents",
    "training_blocks",
    "goals",
}

EXPECTED_FOREIGN_KEYS = {
    "activities": {("activity_class_id", "activity_classes", "id")},
    "activity_logs": {("activity_id", "activities", "id")},
    "flare_up_incidents": {
        ("activity_class_id", "activity_classes", "id"),
        ("daily_check_in_id", "daily_check_ins", "id"),
    },
    "training_blocks": {("related_goal_id", "goals", "id")},
    "rules": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_class_id", "activity_classes", "id"),
    },
    "weekly_targets": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_class_id", "activity_classes", "id"),
    },
    "recovery_targets": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_id", "activities", "id"),
    },
}

EXPECTED_UNIQUE_COLUMN_SETS = {
    "daily_check_ins": {frozenset({"user_id", "check_in_date"})},
    "weekly_targets": {frozenset({"training_block_id", "activity_class_id"})},
    "recovery_targets": {frozenset({"training_block_id", "activity_id"})},
}


def _read_required_text(path: Path) -> str:
    assert path.exists(), f"Expected {path.relative_to(BACKEND_ROOT)} to exist."
    return path.read_text(encoding="utf-8")


def _migration_revision_files() -> list[Path]:
    assert ALEMBIC_VERSIONS.exists(), "Expected alembic/versions to exist."
    return sorted(
        path
        for path in ALEMBIC_VERSIONS.glob("*.py")
        if path.name != "__init__.py" and not path.name.startswith(".")
    )


def _make_alembic_config(database_url: str) -> Config:
    assert ALEMBIC_INI.exists(), "Expected alembic.ini before running migrations."
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", database_url)
    config.set_main_option("script_location", str(ALEMBIC_ROOT))
    return config


def _run_upgrade(database_path: Path) -> Engine:
    database_url = f"sqlite:///{database_path}"
    command.upgrade(_make_alembic_config(database_url), "head")
    return create_engine(database_url)


def _normalized_default(default_value: object) -> str | None:
    if default_value is None:
        return None

    text = str(default_value).strip().strip("()").strip()
    if "::" in text:
        text = text.split("::", 1)[0].strip()
    return text.strip("'\"").lower()


def _sqlite_column_defaults(engine: Engine, table_name: str) -> dict[str, str | None]:
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(f"PRAGMA table_info({table_name})").mappings().all()

    return {cast(str, row["name"]): _normalized_default(row["dflt_value"]) for row in rows}


def _foreign_key_triples(engine: Engine, table_name: str) -> set[tuple[str, str, str]]:
    inspector = inspect(engine)
    triples: set[tuple[str, str, str]] = set()

    for foreign_key in inspector.get_foreign_keys(table_name):
        constrained_columns = foreign_key["constrained_columns"]
        referred_columns = foreign_key["referred_columns"]
        referred_table = foreign_key["referred_table"]

        for constrained_column, referred_column in zip(
            constrained_columns,
            referred_columns,
            strict=True,
        ):
            triples.add((constrained_column, referred_table, referred_column))

    return triples


def _unique_column_sets(engine: Engine, table_name: str) -> set[frozenset[str]]:
    inspector = inspect(engine)
    return {
        frozenset(constraint["column_names"])
        for constraint in inspector.get_unique_constraints(table_name)
    }


def test_alembic_project_files_are_initialized() -> None:
    assert ALEMBIC_INI.exists(), "B1.2 requires backend/alembic.ini."
    assert ALEMBIC_ENV.exists(), "B1.2 requires backend/alembic/env.py."
    assert ALEMBIC_SCRIPT_TEMPLATE.exists(), "B1.2 requires backend/alembic/script.py.mako."
    assert ALEMBIC_VERSIONS.is_dir(), "B1.2 requires backend/alembic/versions/."


def test_default_alembic_config_defers_database_url_to_shared_settings() -> None:
    config = Config(str(ALEMBIC_INI))

    assert config.get_main_option("sqlalchemy.url") in {
        None,
        "",
    }, "Normal Alembic runs must use app.settings.DATABASE_URL, not alembic.ini."


def test_alembic_env_imports_central_sqlmodel_metadata_surface() -> None:
    env_text = _read_required_text(ALEMBIC_ENV)

    assert "app.models" in env_text
    assert "app.settings" in env_text
    assert "DATABASE_URL" in env_text
    assert "SQLModel.metadata" in env_text
    assert "target_metadata = SQLModel.metadata" in env_text
    assert "app.models.activity" not in env_text
    assert "app.models.log" not in env_text
    assert "app.models.checkin" not in env_text
    assert "app.models.block" not in env_text
    assert "app.models.goal" not in env_text


def test_single_initial_migration_revision_exists() -> None:
    revisions = _migration_revision_files()

    assert len(revisions) == 1, "B1.2 requires one initial migration revision."

    revision_text = revisions[0].read_text(encoding="utf-8")
    assert "def upgrade()" in revision_text
    assert "def downgrade()" in revision_text
    for table_name in APPLICATION_TABLES:
        assert table_name in revision_text


def test_upgrade_head_creates_phase_one_schema_in_temporary_sqlite(
    tmp_path: Path,
) -> None:
    engine = _run_upgrade(tmp_path / "migration-test.db")
    inspector = inspect(engine)

    assert set(inspector.get_table_names()).issuperset(APPLICATION_TABLES | {"alembic_version"})

    for table_name in APPLICATION_TABLES:
        primary_key = inspector.get_pk_constraint(table_name)
        assert primary_key["constrained_columns"] == ["id"]

    for table_name in TOP_LEVEL_USER_TABLES:
        defaults = _sqlite_column_defaults(engine, table_name)
        assert defaults["user_id"] == "local"

    assert _sqlite_column_defaults(engine, "activity_classes")[
        "default_recovery_window_days"
    ] == "3"
    assert _sqlite_column_defaults(engine, "training_blocks")[
        "is_review_milestone_hit"
    ] in {"0", "false"}

    activity_log_columns = {
        column["name"]: column for column in inspector.get_columns("activity_logs")
    }
    assert "json" in str(activity_log_columns["rule_violations_at_log"]["type"]).lower()

    for table_name, expected_unique_sets in EXPECTED_UNIQUE_COLUMN_SETS.items():
        assert expected_unique_sets.issubset(_unique_column_sets(engine, table_name))

    for table_name, expected_foreign_keys in EXPECTED_FOREIGN_KEYS.items():
        assert expected_foreign_keys.issubset(_foreign_key_triples(engine, table_name))


def test_downgrade_base_removes_application_tables_from_temporary_sqlite(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'migration-downgrade-test.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(database_url)
    assert APPLICATION_TABLES.isdisjoint(inspect(engine).get_table_names())
