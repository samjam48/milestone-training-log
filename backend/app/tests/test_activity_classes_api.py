from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import seed_activity_class, utc_datetime


def _assert_activity_class_payload(
    payload: dict[str, Any],
    *,
    class_id: str,
    name: str,
    description: str,
    class_type: str,
    default_recovery_window_days: int,
) -> None:
    assert payload["id"] == class_id
    assert payload["name"] == name
    assert payload["description"] == description
    assert payload["type"] == class_type
    assert payload["default_recovery_window_days"] == default_recovery_window_days
    assert "created_at" in payload
    datetime.fromisoformat(payload["created_at"])
    assert "user_id" not in payload


async def test_list_activity_classes_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/activity-classes")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_activity_classes_returns_local_classes_in_stable_name_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-zeta",
        name="Walking",
        created_at=utc_datetime(8),
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-alpha",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
        created_at=utc_datetime(9),
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-beta",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=2,
        created_at=utc_datetime(10),
    )

    response = await client.get("/api/activity-classes")

    assert response.status_code == 200
    payload = response.json()
    assert [activity_class["id"] for activity_class in payload] == [
        "cls-alpha",
        "cls-beta",
        "cls-zeta",
    ]
    assert all("user_id" not in activity_class for activity_class in payload)


async def test_create_activity_class_returns_created_payload_without_server_owned_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/activity-classes",
        json={
            "id": "cls-foot-load",
            "name": "High-Intensity Foot Load",
            "description": "Impact-heavy lower limb loading.",
            "type": "performance",
            "default_recovery_window_days": 4,
        },
    )

    assert response.status_code == 201
    _assert_activity_class_payload(
        response.json(),
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
        description="Impact-heavy lower limb loading.",
        class_type="performance",
        default_recovery_window_days=4,
    )


async def test_create_activity_class_defaults_recovery_window_to_three(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/activity-classes",
        json={
            "id": "cls-recovery",
            "name": "Low-Impact Recovery",
            "description": "Recovery work with low tissue load.",
            "type": "recovery",
        },
    )

    assert response.status_code == 201
    assert response.json()["default_recovery_window_days"] == 3


async def test_create_activity_class_rejects_client_owned_server_or_relationship_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/activity-classes",
        json={
            "id": "cls-invalid",
            "user_id": "not-local",
            "name": "Invalid",
            "description": "Attempts to set server-owned fields.",
            "type": "performance",
            "default_recovery_window_days": 3,
            "created_at": "2026-05-27T08:00:00Z",
            "activities": [],
        },
    )

    assert response.status_code == 422


async def test_create_activity_class_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
    )

    response = await client.post(
        "/api/activity-classes",
        json={
            "id": "cls-foot-load",
            "name": "Duplicate",
            "description": "Same client-supplied ID.",
            "type": "performance",
            "default_recovery_window_days": 3,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Activity class already exists"}


async def test_patch_activity_class_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
        description="Before",
        class_type="performance",
        default_recovery_window_days=3,
    )

    response = await client.patch(
        "/api/activity-classes/cls-foot-load",
        json={
            "description": "Updated recovery guidance.",
            "default_recovery_window_days": 5,
        },
    )

    assert response.status_code == 200
    _assert_activity_class_payload(
        response.json(),
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
        description="Updated recovery guidance.",
        class_type="performance",
        default_recovery_window_days=5,
    )


async def test_patch_activity_class_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Low-Impact Recovery",
        description="Before",
        class_type="recovery",
        default_recovery_window_days=1,
    )

    response = await client.patch("/api/activity-classes/cls-recovery", json={})

    assert response.status_code == 200
    _assert_activity_class_payload(
        response.json(),
        class_id="cls-recovery",
        name="Low-Impact Recovery",
        description="Before",
        class_type="recovery",
        default_recovery_window_days=1,
    )


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("name", {"name": None}),
        ("default_recovery_window_days", {"default_recovery_window_days": None}),
    ],
)
async def test_patch_activity_class_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
        description="Before",
        class_type="performance",
        default_recovery_window_days=3,
    )

    response = await client.patch("/api/activity-classes/cls-foot-load", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/activity-classes")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_activity_class_payload(
        list_response.json()[0],
        class_id="cls-foot-load",
        name="High-Intensity Foot Load",
        description="Before",
        class_type="performance",
        default_recovery_window_days=3,
    )


async def test_patch_missing_activity_class_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/activity-classes/missing-class",
        json={"name": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity class not found"}
