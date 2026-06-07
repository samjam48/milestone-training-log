"""WTL.B2 — Weekly target service behavior (failing tests until implemented).

Covers activity-scoped create/update validation, class derivation, duplicate
activity conflicts, and delete in the service layer (not router-owned logic).
"""

from __future__ import annotations

import importlib
from datetime import date

import pytest
from fastapi import FastAPI

from app.models.block import WeeklyTarget
from app.schemas.weekly_targets import WeeklyTargetCreate, WeeklyTargetPatch
from app.services.weekly_targets import (
    WeeklyTargetPairAlreadyExistsError,
    create_weekly_target,
    update_weekly_target,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_training_block,
    seed_weekly_target,
    with_session,
)

weekly_targets_service = importlib.import_module("app.services.weekly_targets")


def _activity_scoped_create_payload(**overrides: object) -> WeeklyTargetCreate:
    payload = {
        "id": "wt-walk",
        "activity_id": "act-walk",
        "target_value": 3.0,
        "target_unit": "sessions",
    }
    payload.update(overrides)
    return WeeklyTargetCreate.model_validate(payload)


def _seed_wtl_b2_service_graph(app_with_test_database: FastAPI) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-wtl-b2",
        name="WTL B2 Block",
        start_date=date(2026, 6, 1),
        status="active",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-performance",
        name="Performance",
        class_type="performance",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-performance",
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-performance",
        name="Stationary Bike",
        activity_type="performance",
        default_volume_unit="minutes",
    )


def test_create_weekly_target_accepts_activity_id_payload_shape() -> None:
    payload = _activity_scoped_create_payload()

    assert payload.activity_id == "act-walk"
    assert payload.target_kind == "minimum"


def test_create_weekly_target_derives_activity_class_id_from_activity_id(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    payload = _activity_scoped_create_payload(
        id="wt-walk",
        target_unit="km",
    )

    for session in with_session(app_with_test_database):
        created = create_weekly_target(session, "blk-wtl-b2", payload)

    assert created.activity_id == "act-walk"
    assert created.activity_class_id == "cls-performance"
    assert created.target_kind == "minimum"


def test_create_weekly_target_raises_for_missing_activity(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    payload = _activity_scoped_create_payload(
        id="wt-missing",
        activity_id="missing-activity",
    )

    with pytest.raises(Exception) as exc_info:
        for session in with_session(app_with_test_database):
            create_weekly_target(session, "blk-wtl-b2", payload)

    assert exc_info.value.__class__.__name__ == "ActivityNotFoundError"


def test_create_weekly_target_raises_for_inactive_activity(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-retired",
        activity_class_id="cls-performance",
        name="Retired Walk",
        activity_type="performance",
        default_volume_unit="km",
        is_active=False,
    )
    payload = _activity_scoped_create_payload(
        id="wt-retired",
        activity_id="act-retired",
        target_value=2.0,
    )

    with pytest.raises(Exception) as exc_info:
        for session in with_session(app_with_test_database):
            create_weekly_target(session, "blk-wtl-b2", payload)

    assert exc_info.value.__class__.__name__ == "ActivityInactiveError"


def test_create_weekly_target_raises_for_duplicate_block_activity_pair(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-existing",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=2.0,
        target_unit="sessions",
    )
    payload = _activity_scoped_create_payload(
        id="wt-duplicate",
        target_value=4.0,
    )

    with pytest.raises(WeeklyTargetPairAlreadyExistsError):
        for session in with_session(app_with_test_database):
            create_weekly_target(session, "blk-wtl-b2", payload)


def test_update_weekly_target_moves_activity_and_derives_class_id(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )
    payload = WeeklyTargetPatch.model_validate({"activity_id": "act-bike"})

    for session in with_session(app_with_test_database):
        updated = update_weekly_target(session, "wt-walk", payload)

    assert updated.activity_id == "act-bike"
    assert updated.activity_class_id == "cls-performance"


def test_update_weekly_target_raises_when_moving_to_existing_block_activity_pair(
    app_with_test_database: FastAPI,
) -> None:
    _seed_wtl_b2_service_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-bike",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-bike",
        target_value=2.0,
        target_unit="minutes",
    )
    payload = WeeklyTargetPatch.model_validate({"activity_id": "act-bike"})

    with pytest.raises(WeeklyTargetPairAlreadyExistsError):
        for session in with_session(app_with_test_database):
            update_weekly_target(session, "wt-walk", payload)


def test_delete_weekly_target_removes_persisted_row(
    app_with_test_database: FastAPI,
) -> None:
    delete_weekly_target = getattr(weekly_targets_service, "delete_weekly_target", None)
    assert delete_weekly_target is not None, "delete_weekly_target must be implemented"

    _seed_wtl_b2_service_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-delete-me",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )

    for session in with_session(app_with_test_database):
        delete_weekly_target(session, "wt-delete-me")
        assert session.get(WeeklyTarget, "wt-delete-me") is None
