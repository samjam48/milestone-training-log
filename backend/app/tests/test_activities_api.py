from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import seed_activity, seed_activity_class, utc_datetime


def _assert_activity_payload(
    payload: dict[str, Any],
    *,
    activity_id: str,
    activity_class_id: str,
    name: str,
    activity_type: str,
    default_volume_unit: str,
    is_active: bool,
) -> None:
    assert payload["id"] == activity_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["name"] == name
    assert payload["type"] == activity_type
    assert payload["default_volume_unit"] == default_volume_unit
    assert payload["is_active"] is is_active
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload
    assert "activity_class" not in payload


async def test_list_activities_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/activities")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_activities_returns_local_activities_in_stable_name_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity_class(app_with_test_database, class_id="cls-recovery", name="Recovery")
    seed_activity(
        app_with_test_database,
        activity_id="act-zeta",
        activity_class_id="cls-load",
        name="Walk",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-alpha",
        activity_class_id="cls-recovery",
        name="Mobility",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-beta",
        activity_class_id="cls-load",
        name="Mobility",
    )

    response = await client.get("/api/activities")

    assert response.status_code == 200
    payload = response.json()
    assert [activity["id"] for activity in payload] == [
        "act-alpha",
        "act-beta",
        "act-zeta",
    ]
    assert all("user_id" not in activity for activity in payload)
    assert all("activity_class" not in activity for activity in payload)


async def test_list_activities_filters_by_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity_class(app_with_test_database, class_id="cls-recovery", name="Recovery")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-mobility",
        activity_class_id="cls-recovery",
        name="Mobility",
    )

    response = await client.get("/api/activities", params={"class_id": "cls-load"})

    assert response.status_code == 200
    assert [activity["id"] for activity in response.json()] == ["act-walk"]


@pytest.mark.parametrize(
    ("is_active_filter", "expected_ids"),
    [
        ("true", ["act-mobility", "act-walk"]),
        ("false", ["act-bike"]),
    ],
)
async def test_list_activities_filters_by_active_state(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    is_active_filter: str,
    expected_ids: list[str],
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        is_active=True,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-load",
        name="Bike",
        is_active=False,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-mobility",
        activity_class_id="cls-load",
        name="Mobility",
        is_active=True,
    )

    response = await client.get("/api/activities", params={"is_active": is_active_filter})

    assert response.status_code == 200
    assert [activity["id"] for activity in response.json()] == expected_ids


async def test_list_activities_applies_class_and_active_filters_together(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity_class(app_with_test_database, class_id="cls-recovery", name="Recovery")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        is_active=True,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-load",
        name="Bike",
        is_active=False,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-mobility",
        activity_class_id="cls-recovery",
        name="Mobility",
        is_active=False,
    )

    response = await client.get(
        "/api/activities",
        params={"class_id": "cls-load", "is_active": "false"},
    )

    assert response.status_code == 200
    assert [activity["id"] for activity in response.json()] == ["act-bike"]


async def test_create_activity_returns_created_payload_without_server_owned_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")

    response = await client.post(
        "/api/activities",
        json={
            "id": "act-walk",
            "activity_class_id": "cls-load",
            "name": "Walk",
            "type": "performance",
            "default_volume_unit": "minutes",
            "is_active": False,
        },
    )

    assert response.status_code == 201
    _assert_activity_payload(
        response.json(),
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=False,
    )


@pytest.mark.parametrize("activity_type", ["performance", "recovery"])
async def test_create_activity_accepts_supported_activity_types(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    activity_type: str,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")

    response = await client.post(
        "/api/activities",
        json={
            "id": f"act-{activity_type}",
            "activity_class_id": "cls-load",
            "name": f"{activity_type.title()} Activity",
            "type": activity_type,
            "default_volume_unit": "minutes",
        },
    )

    assert response.status_code == 201
    _assert_activity_payload(
        response.json(),
        activity_id=f"act-{activity_type}",
        activity_class_id="cls-load",
        name=f"{activity_type.title()} Activity",
        activity_type=activity_type,
        default_volume_unit="minutes",
        is_active=True,
    )


async def test_create_activity_rejects_invalid_activity_type(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")

    response = await client.post(
        "/api/activities",
        json={
            "id": "act-training",
            "activity_class_id": "cls-load",
            "name": "Invalid Training Type",
            "type": "training",
            "default_volume_unit": "minutes",
        },
    )

    assert response.status_code == 422


async def test_create_activity_defaults_is_active_to_true(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")

    response = await client.post(
        "/api/activities",
        json={
            "id": "act-walk",
            "activity_class_id": "cls-load",
            "name": "Walk",
            "type": "performance",
            "default_volume_unit": "minutes",
        },
    )

    assert response.status_code == 201
    assert response.json()["is_active"] is True


async def test_create_activity_rejects_server_owned_or_relationship_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")

    response = await client.post(
        "/api/activities",
        json={
            "id": "act-invalid",
            "user_id": "not-local",
            "activity_class_id": "cls-load",
            "name": "Invalid",
            "type": "performance",
            "default_volume_unit": "minutes",
            "is_active": True,
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
            "activity_class": {"id": "cls-load"},
            "logs": [],
        },
    )

    assert response.status_code == 422


async def test_create_activity_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
    )

    response = await client.post(
        "/api/activities",
        json={
            "id": "act-walk",
            "activity_class_id": "cls-load",
            "name": "Duplicate",
            "type": "performance",
            "default_volume_unit": "minutes",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Activity already exists"}


async def test_create_activity_to_missing_class_returns_stable_client_error(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/activities",
        json={
            "id": "act-walk",
            "activity_class_id": "missing-class",
            "name": "Walk",
            "type": "performance",
            "default_volume_unit": "minutes",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity class not found"}


async def test_patch_activity_updates_present_fields_and_changes_updated_at(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity_class(app_with_test_database, class_id="cls-recovery", name="Recovery")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
        updated_at=utc_datetime(9),
    )

    response = await client.patch(
        "/api/activities/act-walk",
        json={
            "activity_class_id": "cls-recovery",
            "name": "Recovery Walk",
            "default_volume_unit": "km",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_activity_payload(
        payload,
        activity_id="act-walk",
        activity_class_id="cls-recovery",
        name="Recovery Walk",
        activity_type="performance",
        default_volume_unit="km",
        is_active=True,
    )
    assert datetime.fromisoformat(payload["updated_at"]) > utc_datetime(9)


@pytest.mark.parametrize(
    ("initial_state", "patched_state"),
    [
        (True, False),
        (False, True),
    ],
)
async def test_patch_activity_supports_deactivation_and_reactivation(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    initial_state: bool,
    patched_state: bool,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        is_active=initial_state,
    )

    response = await client.patch(
        "/api/activities/act-walk",
        json={"is_active": patched_state},
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is patched_state


async def test_patch_activity_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )

    response = await client.patch("/api/activities/act-walk", json={})

    assert response.status_code == 200
    _assert_activity_payload(
        response.json(),
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )


async def test_patch_activity_to_missing_class_returns_stable_client_error(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
    )

    response = await client.patch(
        "/api/activities/act-walk",
        json={"activity_class_id": "missing-class"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity class not found"}


async def test_patch_activity_rejects_invalid_activity_type_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )

    response = await client.patch(
        "/api/activities/act-walk",
        json={"type": "training"},
    )

    assert response.status_code == 422

    list_response = await client.get("/api/activities")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_activity_payload(
        list_response.json()[0],
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("activity_class_id", {"activity_class_id": None}),
        ("name", {"name": None}),
        ("type", {"type": None}),
        ("default_volume_unit", {"default_volume_unit": None}),
        ("is_active", {"is_active": None}),
    ],
)
async def test_patch_activity_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    seed_activity_class(app_with_test_database, class_id="cls-load", name="Foot Load")
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )

    response = await client.patch("/api/activities/act-walk", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/activities")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_activity_payload(
        list_response.json()[0],
        activity_id="act-walk",
        activity_class_id="cls-load",
        name="Walk",
        activity_type="performance",
        default_volume_unit="minutes",
        is_active=True,
    )


async def test_patch_missing_activity_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/activities/missing-activity",
        json={"name": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}
