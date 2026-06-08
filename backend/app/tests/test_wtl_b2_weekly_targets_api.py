"""WTL.B2 — Weekly target API and service behavior (failing tests until implemented).

Covers activity-scoped create/patch/delete, legacy class target compatibility,
validation, duplicate conflicts, and edge-case HTTP responses.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_training_block,
    seed_weekly_target,
)


def _assert_activity_scoped_weekly_target_payload(
    payload: dict[str, Any],
    *,
    target_id: str,
    training_block_id: str,
    activity_id: str,
    activity_class_id: str,
    target_value: float,
    target_unit: str,
    target_kind: str = "minimum",
) -> None:
    assert payload["id"] == target_id
    assert payload["training_block_id"] == training_block_id
    assert payload["activity_id"] == activity_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["target_value"] == target_value
    assert payload["target_unit"] == target_unit
    assert payload["target_kind"] == target_kind
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])


def _seed_wtl_b2_graph(app_with_test_database: FastAPI) -> None:
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
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
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
    seed_activity(
        app_with_test_database,
        activity_id="act-foam-roll",
        activity_class_id="cls-recovery",
        name="Foam Roll",
        activity_type="recovery",
        default_volume_unit="minutes",
    )


async def test_list_weekly_targets_returns_legacy_class_and_activity_scoped_targets(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-class-legacy",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        target_value=12.0,
        target_unit="km",
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-activity-scoped",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )

    response = await client.get("/api/training-blocks/blk-wtl-b2/weekly-targets")

    assert response.status_code == 200
    payloads = {target["id"]: target for target in response.json()}
    assert set(payloads) == {"wt-class-legacy", "wt-activity-scoped"}
    assert payloads["wt-class-legacy"]["activity_id"] is None
    assert payloads["wt-class-legacy"]["activity_class_id"] == "cls-performance"
    assert payloads["wt-activity-scoped"]["activity_id"] == "act-walk"
    assert payloads["wt-activity-scoped"]["activity_class_id"] == "cls-performance"
    assert payloads["wt-activity-scoped"]["target_kind"] == "minimum"


async def test_create_activity_scoped_weekly_target_returns_created_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-walk",
            "activity_id": "act-walk",
            "target_value": 3.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 201
    _assert_activity_scoped_weekly_target_payload(
        response.json(),
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_id="act-walk",
        activity_class_id="cls-performance",
        target_value=3.0,
        target_unit="sessions",
    )


async def test_create_activity_scoped_weekly_target_defaults_target_kind_to_minimum(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-bike",
            "activity_id": "act-bike",
            "target_value": 90.0,
            "target_unit": "minutes",
        },
    )

    assert response.status_code == 201
    assert response.json()["target_kind"] == "minimum"


async def test_create_activity_scoped_weekly_target_accepts_explicit_target_kind(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-recovery",
            "activity_id": "act-foam-roll",
            "target_value": 2.0,
            "target_unit": "sessions",
            "target_kind": "minimum",
        },
    )

    assert response.status_code == 201
    assert response.json()["target_kind"] == "minimum"


async def test_create_activity_scoped_weekly_target_derives_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-recovery-derived",
            "activity_id": "act-foam-roll",
            "target_value": 4.0,
            "target_unit": "minutes",
        },
    )

    assert response.status_code == 201
    assert response.json()["activity_class_id"] == "cls-recovery"
    assert response.json()["activity_id"] == "act-foam-roll"


async def test_create_activity_scoped_weekly_target_returns_not_found_for_missing_activity(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-missing-activity",
            "activity_id": "missing-activity",
            "target_value": 3.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


async def test_create_activity_scoped_weekly_target_rejects_inactive_activity(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-retired",
        activity_class_id="cls-performance",
        name="Retired Walk",
        activity_type="performance",
        default_volume_unit="km",
        is_active=False,
    )

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-retired",
            "activity_id": "act-retired",
            "target_value": 2.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Activity is not active"}


async def test_create_activity_scoped_target_conflict_duplicate_activity(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-existing",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=2.0,
        target_unit="sessions",
    )

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-duplicate",
            "activity_id": "act-walk",
            "target_value": 4.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Weekly target for this activity already exists",
    }


@pytest.mark.parametrize("target_unit", ["sessions", "minutes", "km"])
async def test_create_activity_scoped_weekly_target_accepts_supported_units(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    target_unit: str,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": f"wt-{target_unit}",
            "activity_id": "act-walk",
            "target_value": 3.0,
            "target_unit": target_unit,
        },
    )

    assert response.status_code == 201
    assert response.json()["target_unit"] == target_unit


async def test_create_activity_scoped_weekly_target_accepts_activity_default_volume_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-strength",
        activity_class_id="cls-performance",
        name="Strength Work",
        activity_type="performance",
        default_volume_unit="sets",
    )

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-strength",
            "activity_id": "act-strength",
            "target_value": 12.0,
            "target_unit": "sets",
        },
    )

    assert response.status_code == 201
    assert response.json()["target_unit"] == "sets"


async def test_create_activity_scoped_weekly_target_rejects_unsupported_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": "wt-bad-unit",
            "activity_id": "act-walk",
            "target_value": 3.0,
            "target_unit": "reps",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Unsupported target unit"}


@pytest.mark.parametrize("target_value", [0, -1])
async def test_create_activity_scoped_weekly_target_rejects_non_positive_target_value(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    target_value: float,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-wtl-b2/weekly-targets",
        json={
            "id": f"wt-value-{target_value}",
            "activity_id": "act-walk",
            "target_value": target_value,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "target_value must be greater than 0"}


async def test_patch_activity_scoped_weekly_target_updates_value_and_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-walk",
        json={
            "target_value": 5.0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 200
    _assert_activity_scoped_weekly_target_payload(
        response.json(),
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_id="act-walk",
        activity_class_id="cls-performance",
        target_value=5.0,
        target_unit="km",
    )


async def test_patch_activity_scoped_weekly_target_moves_to_another_activity(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-walk",
        json={"activity_id": "act-bike"},
    )

    assert response.status_code == 200
    _assert_activity_scoped_weekly_target_payload(
        response.json(),
        target_id="wt-walk",
        training_block_id="blk-wtl-b2",
        activity_id="act-bike",
        activity_class_id="cls-performance",
        target_value=3.0,
        target_unit="sessions",
    )


async def test_patch_activity_scoped_weekly_target_returns_conflict_when_target_activity_exists(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
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

    response = await client.patch(
        "/api/weekly-targets/wt-walk",
        json={"activity_id": "act-bike"},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Weekly target for this activity already exists",
    }


async def test_patch_legacy_class_weekly_target_remains_patchable_by_value_and_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-class-legacy",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-class-legacy",
        json={
            "target_value": 10.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "wt-class-legacy"
    assert payload["activity_class_id"] == "cls-performance"
    assert payload.get("activity_id") is None
    assert payload["target_value"] == 10.0
    assert payload["target_unit"] == "sessions"


async def test_delete_weekly_target_removes_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_wtl_b2_graph(app_with_test_database)
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-delete-me",
        training_block_id="blk-wtl-b2",
        activity_class_id="cls-performance",
        activity_id="act-walk",
        target_value=3.0,
        target_unit="sessions",
    )

    delete_response = await client.delete("/api/weekly-targets/wt-delete-me")

    assert delete_response.status_code == 204

    list_response = await client.get("/api/training-blocks/blk-wtl-b2/weekly-targets")
    assert list_response.status_code == 200
    assert list_response.json() == []


async def test_delete_missing_weekly_target_returns_not_found(
    client: AsyncClient,
) -> None:
    response = await client.delete("/api/weekly-targets/missing-target")

    assert response.status_code == 404
    assert response.json() == {"detail": "Weekly target not found"}


async def test_create_activity_scoped_weekly_target_returns_not_found_for_missing_block(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks/missing-block/weekly-targets",
        json={
            "id": "wt-orphan",
            "activity_id": "act-walk",
            "target_value": 3.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_patch_missing_weekly_target_returns_not_found_for_activity_scoped_update(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/weekly-targets/missing-target",
        json={"activity_id": "act-walk"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Weekly target not found"}
