"""Big-bang weekly rules migration, seed, and legacy cleanup."""

from __future__ import annotations

import importlib
import inspect
from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest
from alembic import command
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.engine import Connection, Engine
from sqlmodel import Session, select

from app.models.block import TrainingBlock
from app.tests.helpers.postgres_migration import (
    postgres_engine,
    postgres_tests_requested,
    resolve_postgres_database_url,
    stop_ephemeral_postgres_container,
)
from app.tests.helpers.wru_b1_fixtures import (
    WRU_B1_PRE_MIGRATION_REVISION,
    active_weekly_block_row,
    count_training_blocks,
    enabled_rule_count,
    expected_migration_week_bounds,
    require_wru_b1_migration_revision,
    revision_after_pre_migration,
    rule_signatures_for_block,
    seed_activity_class_for_wru_b1,
    seed_completed_legacy_block,
    seed_legacy_active_block_with_rules,
    seed_legacy_active_block_without_rules,
    weekly_target_signatures_for_block,
    wru_b1_revision_paths,
)
from app.tests.test_migrations import (
    _make_alembic_config,
    _normalized_default,
    _sqlite_column_defaults,
)
from app.tests.test_seed_data import _make_migrated_engine, _run_seed

REMOVED_SERVICE_SYMBOLS = (
    "setup_weekly_focus",
    "reset_focus_series",
    "update_focus_title",
    "_try_legacy_cutover",
)

REMOVED_API_ROUTES = (
    ("POST", "/api/training-blocks/active/setup"),
    ("POST", "/api/training-blocks/active/reset-focus"),
)


def _upgrade_sqlite(tmp_path: Path, revision: str = "head") -> tuple[str, Engine]:
    database_url = f"sqlite:///{tmp_path / 'wru-b1.db'}"
    config = _make_alembic_config(database_url)
    command.upgrade(config, revision)
    return database_url, create_engine(database_url)


def _run_wru_b1_migration_on_seeded_db(
    tmp_path: Path,
    *,
    seed_fn: object,
) -> Engine:
    database_url, engine = _upgrade_sqlite(tmp_path, WRU_B1_PRE_MIGRATION_REVISION)
    config = _make_alembic_config(database_url)
    assert revision_after_pre_migration(config) is not None, (
        "WRU.B1 migration revision must exist after "
        f"{WRU_B1_PRE_MIGRATION_REVISION} before data migration tests can run."
    )

    with engine.begin() as connection:
        seed_activity_class_for_wru_b1(connection)
        seed_fn(connection)  # type: ignore[operator]

    command.upgrade(config, "head")
    return create_engine(database_url)


# --- Alembic revision presence ---


def test_wru_b1_migration_revision_exists_after_weekly_focus_schema() -> None:
    require_wru_b1_migration_revision()
    paths = wru_b1_revision_paths()
    revision_text = paths[-1].read_text(encoding="utf-8")
    assert "def upgrade()" in revision_text
    assert "def downgrade()" in revision_text
    assert "weekly_focus" in revision_text


# --- Data migration: legacy wipe + current-week seed ---


def _seed_legacy_active_and_completed(connection: Connection) -> None:
    seed_legacy_active_block_with_rules(connection)
    seed_completed_legacy_block(connection)


def test_weekly_rules_migration_wipes_legacy_history_and_preserves_enabled_rules(
    tmp_path: Path,
) -> None:
    engine = _run_wru_b1_migration_on_seeded_db(
        tmp_path,
        seed_fn=_seed_legacy_active_and_completed,
    )

    counts = count_training_blocks(engine)
    assert counts == {
        "total": 1,
        "active": 1,
        "completed": 0,
        "weekly_focus": 1,
        "legacy": 0,
    }

    week_start, week_end = expected_migration_week_bounds()
    active = active_weekly_block_row(engine)
    assert active["period_kind"] == "weekly_focus"
    assert active["status"] == "active"
    assert active["start_date"] == week_start.isoformat()
    assert active["end_date"] == week_end.isoformat()
    assert active["week_number"] == 1
    assert active["focus_series_id"] is not None

    enabled_before = 1
    assert enabled_rule_count(engine, active["id"]) == enabled_before
    assert rule_signatures_for_block(engine, active["id"]) == [
        ("cls-wru-foot", None, "weekly_load_cap", 120.0, 7, True),
    ]
    assert weekly_target_signatures_for_block(engine, active["id"]) == [
        ("cls-wru-foot", None, 8.0, "km"),
    ]

    with engine.connect() as connection:
        old_rule_ids = connection.execute(
            text(
                "SELECT id FROM rules WHERE id IN ('rule-wru-enabled', 'rule-wru-disabled')"
            )
        ).fetchall()
    assert old_rule_ids == []


def test_wru_b1_migration_creates_empty_current_week_when_no_blocks_exist(
    tmp_path: Path,
) -> None:
    database_url, engine = _upgrade_sqlite(tmp_path, WRU_B1_PRE_MIGRATION_REVISION)
    config = _make_alembic_config(database_url)
    assert revision_after_pre_migration(config) is not None

    command.upgrade(config, "head")

    counts = count_training_blocks(engine)
    assert counts == {
        "total": 1,
        "active": 1,
        "completed": 0,
        "weekly_focus": 1,
        "legacy": 0,
    }

    week_start, week_end = expected_migration_week_bounds()
    active = active_weekly_block_row(engine)
    assert active["period_kind"] == "weekly_focus"
    assert active["start_date"] == week_start.isoformat()
    assert active["end_date"] == week_end.isoformat()
    assert rule_signatures_for_block(engine, active["id"]) == []
    assert weekly_target_signatures_for_block(engine, active["id"]) == []


def test_wru_b1_migration_creates_valid_empty_week_when_active_legacy_has_no_rules(
    tmp_path: Path,
) -> None:
    engine = _run_wru_b1_migration_on_seeded_db(
        tmp_path,
        seed_fn=seed_legacy_active_block_without_rules,
    )

    counts = count_training_blocks(engine)
    assert counts["total"] == 1
    assert counts["completed"] == 0

    active = active_weekly_block_row(engine)
    assert active["period_kind"] == "weekly_focus"
    assert rule_signatures_for_block(engine, active["id"]) == []


# --- Schema cleanup: period_kind default ---


def test_wru_b1_sqlite_head_schema_defaults_period_kind_to_weekly_focus(
    tmp_path: Path,
) -> None:
    _, engine = _upgrade_sqlite(tmp_path)
    defaults = _sqlite_column_defaults(engine, "training_blocks")
    assert _normalized_default(defaults.get("period_kind")) == "weekly_focus"


# --- Code cleanup: legacy symbols and cutover paths ---


def test_wru_b1_retires_period_kind_legacy_constant() -> None:
    training_blocks = importlib.import_module("app.services.training_blocks")
    assert not hasattr(training_blocks, "PERIOD_KIND_LEGACY"), (
        "WRU.B1 must remove PERIOD_KIND_LEGACY; weekly_focus is the only period_kind."
    )


def test_wru_b1_removes_legacy_cutover_helpers_from_training_blocks_service() -> None:
    training_blocks = importlib.import_module("app.services.training_blocks")
    assert not hasattr(training_blocks, "_try_legacy_cutover"), (
        "WRU.B1 must remove _try_legacy_cutover; big-bang migration replaces lazy cutover."
    )


def test_wru_b1_removes_allow_legacy_cutover_from_active_resolution() -> None:
    training_blocks = importlib.import_module("app.services.training_blocks")
    get_active_params = inspect.signature(training_blocks.get_active_training_block).parameters
    ensure_params = inspect.signature(training_blocks.ensure_active_weekly_focus).parameters
    assert "allow_legacy_cutover" not in get_active_params, (
        "get_active_training_block must not accept allow_legacy_cutover after WRU.B1."
    )
    assert "allow_legacy_cutover" not in ensure_params, (
        "ensure_active_weekly_focus must not accept allow_legacy_cutover after WRU.B1."
    )


def test_wru_b1_removes_manual_weekly_focus_lifecycle_service_functions() -> None:
    training_blocks = importlib.import_module("app.services.training_blocks")
    for symbol in REMOVED_SERVICE_SYMBOLS:
        if symbol == "_try_legacy_cutover":
            continue
        assert not hasattr(training_blocks, symbol), (
            f"WRU.B1 must remove training_blocks.{symbol}; weekly period is system-managed."
        )


def test_wru_b1_create_training_block_defaults_to_weekly_focus(
    app_with_test_database: FastAPI,
) -> None:
    from app.schemas.training_blocks import TrainingBlockCreate
    from app.services.training_blocks import create_training_block
    from app.tests.helpers.seed import with_session

    for session in with_session(app_with_test_database):
        created = create_training_block(
            session,
            TrainingBlockCreate(
                id="blk-wru-created",
                name="Should not stay legacy",
                start_date=date(2026, 6, 1),
                status="archived",
            ),
        )

    assert created.period_kind == "weekly_focus"


# --- Removed API routes ---


async def test_wru_b1_removed_weekly_focus_setup_and_reset_routes_not_registered(
    app_with_test_database: FastAPI,
) -> None:
    paths = app_with_test_database.openapi().get("paths", {})
    for _method, path in REMOVED_API_ROUTES:
        assert path not in paths, (
            f"WRU.B1 must unregister {path}; weekly period is system-managed."
        )


async def test_wru_b1_patch_focus_title_route_rejected(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import (
        WEEK_ONE_END,
        WEEK_ONE_START,
        seed_weekly_focus_block,
    )

    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wru-patch-removed",
        focus_series_id="fs-wru-patch",
        focus_title="Before",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )

    response = await client.patch(
        "/api/training-blocks/blk-wru-patch-removed",
        json={"focus_title": "After"},
    )

    assert response.status_code in {404, 405, 422}, (
        "WRU.B1 must remove focus_title patch handling; weekly label is calendar-only."
    )


# --- Seed ---


def test_wru_b1_seed_creates_active_weekly_focus_with_calendar_week_dates(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "wru-b1-seed.db"
    database_url = f"sqlite:///{database_path}"
    _make_migrated_engine(database_path)
    _run_seed(database_url)

    engine = create_engine(database_url)
    with Session(engine) as session:
        blocks = session.exec(select(TrainingBlock)).all()

    assert len(blocks) == 1
    block = blocks[0]
    assert block.period_kind == "weekly_focus"
    assert block.status == "active"
    assert block.start_date.weekday() == 0, "Weekly seed block must start on Monday."
    assert block.end_date is not None
    assert block.end_date.weekday() == 6, "Weekly seed block must end on Sunday."
    assert (block.end_date - block.start_date).days == 6
    assert "Phase" not in block.name
    assert block.start_date != date(2026, 4, 7)


def test_wru_b1_seed_does_not_create_completed_legacy_history_blocks(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "wru-b1-seed-history.db"
    database_url = f"sqlite:///{database_path}"
    _make_migrated_engine(database_path)
    _run_seed(database_url)

    engine = create_engine(database_url)
    counts = count_training_blocks(engine)
    assert counts["completed"] == 0
    assert counts["legacy"] == 0


# --- Postgres migration gate ---


@pytest.fixture
def postgres_database_url() -> Iterator[str]:
    if not postgres_tests_requested():
        pytest.skip(
            "Postgres WRU.B1 migration tests run via `make test-postgres`, CI, or "
            "POSTGRES_TEST_URL / RUN_POSTGRES_TESTS=1."
        )

    try:
        database_url = resolve_postgres_database_url()
    except RuntimeError as exc:
        pytest.skip(str(exc))

    if database_url is None:
        pytest.skip(
            "Postgres WRU.B1 migration tests require POSTGRES_TEST_URL or RUN_POSTGRES_TESTS=1."
        )

    try:
        yield database_url
    finally:
        stop_ephemeral_postgres_container()


@pytest.mark.postgres
def test_wru_b1_postgres_migration_wipes_legacy_and_seeds_current_week(
    postgres_database_url: str,
) -> None:
    config = _make_alembic_config(postgres_database_url)
    command.upgrade(config, WRU_B1_PRE_MIGRATION_REVISION)

    with postgres_engine(postgres_database_url) as engine:
        with engine.begin() as connection:
            seed_activity_class_for_wru_b1(connection)
            seed_legacy_active_block_with_rules(connection)
            seed_completed_legacy_block(connection)

    command.upgrade(config, "head")

    with postgres_engine(postgres_database_url) as engine:
        counts = count_training_blocks(engine)
        assert counts["active"] == 1
        assert counts["completed"] == 0
        assert counts["weekly_focus"] == 1
        assert counts["legacy"] == 0

        inspector = sa_inspect(engine)
        defaults = {
            column["name"]: column.get("default")
            for column in inspector.get_columns("training_blocks")
        }
        period_default = _normalized_default(defaults.get("period_kind"))
        assert period_default == "weekly_focus"
