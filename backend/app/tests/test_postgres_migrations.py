"""B11.2 — Postgres migration verification."""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import inspect, text

from app.tests.helpers.postgres_migration import (
    postgres_engine,
    postgres_tests_requested,
    resolve_postgres_database_url,
    stop_ephemeral_postgres_container,
)
from app.tests.test_migrations import (
    APPLICATION_TABLES,
    EXPECTED_FOREIGN_KEYS,
    TOP_LEVEL_USER_TABLES,
    _foreign_key_triples,
    _make_alembic_config,
    _normalized_default,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
MAKEFILE_PATH = REPO_ROOT / "Makefile"
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


@pytest.fixture(scope="module")
def postgres_database_url() -> Iterator[str]:
    if not postgres_tests_requested():
        pytest.skip(
            "Postgres migration tests run via `make test-postgres`, CI, or "
            "POSTGRES_TEST_URL / RUN_POSTGRES_TESTS=1."
        )

    try:
        database_url = resolve_postgres_database_url()
    except RuntimeError as exc:
        pytest.fail(str(exc))

    if database_url is None:
        pytest.skip(
            "Postgres migration tests require POSTGRES_TEST_URL or RUN_POSTGRES_TESTS=1."
        )

    try:
        yield database_url
    finally:
        stop_ephemeral_postgres_container()


def _run_postgres_upgrade(database_url: str) -> None:
    config = _make_alembic_config(database_url)
    command.upgrade(config, "head")


def test_makefile_or_ci_exposes_postgres_migration_gate() -> None:
    makefile_text = MAKEFILE_PATH.read_text(encoding="utf-8") if MAKEFILE_PATH.is_file() else ""
    has_make_target = "test-postgres:" in makefile_text

    workflow_files = sorted(WORKFLOWS_DIR.glob("*.yml")) + sorted(
        WORKFLOWS_DIR.glob("*.yaml")
    )
    ci_runs_postgres_migrations = False
    for workflow_path in workflow_files:
        workflow_text = workflow_path.read_text(encoding="utf-8").lower()
        mentions_postgres = "postgres" in workflow_text or "postgresql" in workflow_text
        mentions_migrations = "alembic" in workflow_text or "migration" in workflow_text
        if mentions_postgres and mentions_migrations:
            ci_runs_postgres_migrations = True
            break

    assert has_make_target or ci_runs_postgres_migrations, (
        "B11.2 requires `make test-postgres` and/or a GitHub Actions workflow that "
        "runs Alembic migrations against ephemeral Postgres."
    )


def test_pull_request_workflow_defines_migration_safety_gate_without_prod_secrets() -> None:
    workflow_files = sorted(WORKFLOWS_DIR.glob("*.yml")) + sorted(
        WORKFLOWS_DIR.glob("*.yaml")
    )
    workflow_text = "\n\n".join(
        workflow_path.read_text(encoding="utf-8") for workflow_path in workflow_files
    )
    lowered = workflow_text.lower()

    assert "pull_request" in lowered, (
        "PDH.CI1 requires the Postgres migration safety gate to run on PR checks."
    )
    assert "migration safety" in lowered, (
        "PDH.CI1 requires the PR check to be clearly labeled as a migration "
        "safety gate."
    )
    assert re.search(r"services:\s*\n\s+postgres:", workflow_text), (
        "PDH.CI1 requires the workflow to use a temporary Postgres service."
    )
    assert "postgres:16" in lowered, (
        "PDH.CI1 requires the workflow to use a temporary Postgres image, "
        "not production Supabase."
    )
    assert "postgres_test_url" in lowered, (
        "PDH.CI1 requires the workflow to provide a test-only Postgres URL."
    )
    assert "secrets." not in lowered, (
        "PDH.CI1 requires the migration safety workflow to avoid production "
        "GitHub secrets."
    )
    assert "supabase" not in lowered, (
        "PDH.CI1 requires the migration safety workflow to use temporary "
        "Postgres, not production Supabase."
    )


def test_sqlite_migration_suite_remains_in_test_migrations_module() -> None:
    migration_test_path = Path(__file__).resolve().parent / "test_migrations.py"
    migration_test_text = migration_test_path.read_text(encoding="utf-8")

    assert "test_upgrade_head_creates_phase_one_schema_in_temporary_sqlite" in migration_test_text
    assert "sqlite:///" in migration_test_text


@pytest.mark.postgres
def test_upgrade_head_creates_phase_one_schema_in_ephemeral_postgres(
    postgres_database_url: str,
) -> None:
    _run_postgres_upgrade(postgres_database_url)

    with postgres_engine(postgres_database_url) as engine:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())

        assert table_names.issuperset(APPLICATION_TABLES | {"alembic_version"})

        for table_name in APPLICATION_TABLES:
            primary_key = inspector.get_pk_constraint(table_name)
            assert primary_key["constrained_columns"] == ["id"]

        for table_name in TOP_LEVEL_USER_TABLES:
            columns = {column["name"]: column for column in inspector.get_columns(table_name)}
            user_id_default = columns["user_id"].get("default")
            assert user_id_default is not None
            assert _normalized_default(user_id_default) == "local"

        for table_name, expected_foreign_keys in EXPECTED_FOREIGN_KEYS.items():
            assert expected_foreign_keys.issubset(_foreign_key_triples(engine, table_name))


@pytest.mark.postgres
def test_activity_logs_json_column_migrates_cleanly_on_postgres(
    postgres_database_url: str,
) -> None:
    _run_postgres_upgrade(postgres_database_url)

    with postgres_engine(postgres_database_url) as engine:
        inspector = inspect(engine)
        activity_log_columns = {
            column["name"]: column for column in inspector.get_columns("activity_logs")
        }
        json_column_type = str(activity_log_columns["rule_violations_at_log"]["type"]).lower()
        assert "json" in json_column_type

        sample_violations = [
            {"rule_id": "rule-volume-cap", "current_value": 12, "threshold": 10},
        ]
        now = datetime.now(tz=UTC).replace(tzinfo=None)

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO activity_classes (
                        id, user_id, name, description, type,
                        default_recovery_window_days, created_at
                    ) VALUES (
                        :class_id, 'local', 'Foot load', 'Test class', 'load',
                        3, :created_at
                    )
                    """
                ),
                {"class_id": "cls-pg-json", "created_at": now},
            )
            connection.execute(
                text(
                    """
                    INSERT INTO activities (
                        id, user_id, activity_class_id, name, type,
                        default_volume_unit, is_active, created_at, updated_at
                    ) VALUES (
                        :activity_id, 'local', :class_id, 'Walk', 'performance',
                        'km', TRUE, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "activity_id": "act-pg-json",
                    "class_id": "cls-pg-json",
                    "created_at": now,
                    "updated_at": now,
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO activity_logs (
                        id, user_id, activity_id, logged_date, duration_minutes,
                        volume_value, volume_unit, rpe, notes,
                        rule_violations_at_log, created_at, updated_at
                    ) VALUES (
                        :log_id, 'local', :activity_id, :logged_date, 30,
                        3.0, 'km', 5, 'Postgres JSON roundtrip',
                        CAST(:rule_violations AS JSON), :created_at, :updated_at
                    )
                    """
                ),
                {
                    "log_id": "log-pg-json",
                    "activity_id": "act-pg-json",
                    "logged_date": now.date(),
                    "rule_violations": json.dumps(sample_violations),
                    "created_at": now,
                    "updated_at": now,
                },
            )
            stored_value = connection.execute(
                text(
                    """
                    SELECT rule_violations_at_log
                    FROM activity_logs
                    WHERE id = :log_id
                    """
                ),
                {"log_id": "log-pg-json"},
            ).scalar_one()

    assert stored_value == sample_violations
