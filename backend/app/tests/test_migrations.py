from __future__ import annotations

from pathlib import Path
from typing import cast

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
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
    "goals": {("activity_id", "activities", "id")},
    "rules": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_class_id", "activity_classes", "id"),
        ("activity_id", "activities", "id"),
    },
    "weekly_targets": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_class_id", "activity_classes", "id"),
        ("activity_id", "activities", "id"),
    },
    "recovery_targets": {
        ("training_block_id", "training_blocks", "id"),
        ("activity_id", "activities", "id"),
    },
}

STAGE_2_5_GOALS_COLUMNS = {
    "activity_id",
    "auto_track_progress",
}

STAGE_2_5_RULES_COLUMNS = {
    "activity_id",
    "limit_unit",
}

EXPECTED_UNIQUE_COLUMN_SETS = {
    "daily_check_ins": {frozenset({"user_id", "check_in_date"})},
    "weekly_targets": {
        frozenset({"training_block_id", "activity_class_id"}),
        frozenset({"training_block_id", "activity_id"}),
    },
    "recovery_targets": {frozenset({"training_block_id", "activity_id"})},
}

STAGE_2_5_HEAD_REVISION = "20260606_0002"


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
    unique_sets = {
        frozenset(constraint["column_names"])
        for constraint in inspector.get_unique_constraints(table_name)
    }
    for index in inspector.get_indexes(table_name):
        if index.get("unique"):
            column_names = [name for name in index["column_names"] if name is not None]
            unique_sets.add(frozenset(column_names))
    return unique_sets


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

    assert len(revisions) >= 1, "B1.2 requires at least one initial migration revision."

    initial_revision_text = revisions[0].read_text(encoding="utf-8")
    assert "def upgrade()" in initial_revision_text
    assert "def downgrade()" in initial_revision_text
    for table_name in APPLICATION_TABLES:
        assert table_name in initial_revision_text


def _revision_file_for_id(revision_id: str) -> Path:
    revision_marker = f'revision: str = "{revision_id}"'
    matches = [
        path
        for path in _migration_revision_files()
        if revision_marker in path.read_text(encoding="utf-8")
    ]
    assert len(matches) == 1, (
        f"Expected exactly one Alembic revision file for {revision_id}, found {len(matches)}."
    )
    return matches[0]


def test_stage_2_5_migration_revision_adds_goals_and_rules_schema_extensions() -> None:
    revisions = _migration_revision_files()

    assert len(revisions) >= 2, (
        "S25.B1 requires a second Alembic revision for goals and rules schema extensions."
    )

    stage_2_5_revision_text = _revision_file_for_id(STAGE_2_5_HEAD_REVISION).read_text(
        encoding="utf-8"
    )
    assert "def upgrade()" in stage_2_5_revision_text
    assert "def downgrade()" in stage_2_5_revision_text
    assert "goals" in stage_2_5_revision_text
    assert "rules" in stage_2_5_revision_text
    assert "activity_id" in stage_2_5_revision_text
    assert "auto_track_progress" in stage_2_5_revision_text
    assert "limit_unit" in stage_2_5_revision_text


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

    goal_columns = {column["name"]: column for column in inspector.get_columns("goals")}
    rule_columns = {column["name"]: column for column in inspector.get_columns("rules")}

    assert STAGE_2_5_GOALS_COLUMNS.issubset(goal_columns)
    assert STAGE_2_5_RULES_COLUMNS.issubset(rule_columns)
    assert goal_columns["activity_id"]["nullable"] is True
    assert goal_columns["auto_track_progress"]["nullable"] is False
    assert _normalized_default(goal_columns["auto_track_progress"].get("default")) in {
        "0",
        "false",
    }
    assert rule_columns["activity_id"]["nullable"] is True
    assert rule_columns["limit_unit"]["nullable"] is True

    goal_defaults = _sqlite_column_defaults(engine, "goals")
    assert goal_defaults["auto_track_progress"] in {"0", "false"}


def test_stage_2_5_migration_disables_existing_weekly_activity_count_rules(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'weekly-activity-count-migration.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, "20260527_0001")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO training_blocks (
                    id, user_id, name, start_date, status,
                    is_review_milestone_hit, created_at, updated_at
                ) VALUES (
                    'blk-cross-class', 'local', 'Legacy Block', '2026-04-07', 'active',
                    0, '2026-04-07T00:00:00', '2026-04-07T00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO rules (
                    id, training_block_id, activity_class_id, rule_type,
                    threshold_value, window_days, enabled, created_at, updated_at
                ) VALUES (
                    'rule-cross-class', 'blk-cross-class', NULL, 'weekly_activity_count',
                    4, 7, 1, '2026-04-07T00:00:00', '2026-04-07T00:00:00'
                )
                """
            )
        )

    command.upgrade(config, STAGE_2_5_HEAD_REVISION)

    with engine.connect() as connection:
        enabled = connection.execute(
            text("SELECT enabled FROM rules WHERE id = 'rule-cross-class'")
        ).scalar_one()

    assert enabled in {0, False}


def test_downgrade_base_removes_application_tables_from_temporary_sqlite(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite:///{tmp_path / 'migration-downgrade-test.db'}"
    config = _make_alembic_config(database_url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(database_url)
    assert APPLICATION_TABLES.isdisjoint(inspect(engine).get_table_names())
