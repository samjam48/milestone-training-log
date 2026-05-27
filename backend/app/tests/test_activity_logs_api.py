from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    utc_datetime,
)


def _seed_log_graph(
    app_with_test_database: FastAPI,
    *,
    class_id: str = "cls-load",
    activity_id: str = "act-walk",
    activity_is_active: bool = True,
) -> None:
    seed_activity_class(app_with_test_database, class_id=class_id, name=f"{class_id} class")
    seed_activity(
        app_with_test_database,
        activity_id=activity_id,
        activity_class_id=class_id,
        name=f"{activity_id} activity",
        is_active=activity_is_active,
    )


def _assert_activity_log_payload(
    payload: dict[str, Any],
    *,
    log_id: str,
    activity_id: str,
    logged_date: str,
    duration_minutes: int,
    volume_value: float,
    volume_unit: str | None,
    rpe: int | None,
    post_activity_feel: str | None,
    notes: str | None,
    rule_violations_at_log: list[dict[str, Any]] | None,
) -> None:
    assert payload["id"] == log_id
    assert payload["activity_id"] == activity_id
    assert payload["logged_date"] == logged_date
    assert payload["duration_minutes"] == duration_minutes
    assert payload["volume_value"] == volume_value
    assert payload["volume_unit"] == volume_unit
    assert payload["rpe"] == rpe
    assert payload["post_activity_feel"] == post_activity_feel
    assert payload["notes"] == notes
    assert payload["rule_violations_at_log"] == rule_violations_at_log
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload
    assert "activity" not in payload


async def test_list_activity_logs_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/activity-logs")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_activity_logs_returns_local_logs_in_stable_recent_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-old",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
        created_at=utc_datetime(9),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-newer-created",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        created_at=utc_datetime(11),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-alpha-same-created",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        created_at=utc_datetime(10),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-beta-same-created",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        created_at=utc_datetime(10),
    )

    response = await client.get("/api/activity-logs")

    assert response.status_code == 200
    payload = response.json()
    assert [log["id"] for log in payload] == [
        "log-newer-created",
        "log-alpha-same-created",
        "log-beta-same-created",
        "log-old",
    ]
    assert all("user_id" not in log for log in payload)
    assert all("activity" not in log for log in payload)


async def test_list_activity_logs_filters_from_start_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-before",
        activity_id="act-walk",
        logged_date=date(2026, 5, 19),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-on-start",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-after",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.get("/api/activity-logs", params={"from": "2026-05-20"})

    assert response.status_code == 200
    assert [log["id"] for log in response.json()] == ["log-after", "log-on-start"]


async def test_list_activity_logs_filters_to_end_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-before",
        activity_id="act-walk",
        logged_date=date(2026, 5, 19),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-on-end",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-after",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.get("/api/activity-logs", params={"to": "2026-05-20"})

    assert response.status_code == 200
    assert [log["id"] for log in response.json()] == ["log-on-end", "log-before"]


async def test_list_activity_logs_filters_by_activity_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database, activity_id="act-walk")
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-load",
        name="Bike",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-bike",
        activity_id="act-bike",
        logged_date=date(2026, 5, 22),
    )

    response = await client.get("/api/activity-logs", params={"activity_id": "act-walk"})

    assert response.status_code == 200
    assert [log["id"] for log in response.json()] == ["log-walk"]


async def test_list_activity_logs_filters_by_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database, class_id="cls-load", activity_id="act-walk")
    _seed_log_graph(app_with_test_database, class_id="cls-recovery", activity_id="act-mobility")
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-mobility",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 22),
    )

    response = await client.get("/api/activity-logs", params={"class_id": "cls-load"})

    assert response.status_code == 200
    assert [log["id"] for log in response.json()] == ["log-walk"]


async def test_list_activity_logs_applies_combined_filters(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database, class_id="cls-load", activity_id="act-walk")
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-load",
        name="Bike",
    )
    _seed_log_graph(app_with_test_database, class_id="cls-recovery", activity_id="act-mobility")
    seed_activity_log(
        app_with_test_database,
        log_id="log-target",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-before-window",
        activity_id="act-walk",
        logged_date=date(2026, 5, 18),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-after-window",
        activity_id="act-walk",
        logged_date=date(2026, 5, 22),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-other-activity",
        activity_id="act-bike",
        logged_date=date(2026, 5, 20),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-other-class",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 20),
    )

    response = await client.get(
        "/api/activity-logs",
        params={
            "from": "2026-05-19",
            "to": "2026-05-21",
            "activity_id": "act-walk",
            "class_id": "cls-load",
        },
    )

    assert response.status_code == 200
    assert [log["id"] for log in response.json()] == ["log-target"]


async def test_list_activity_logs_returns_empty_when_from_is_after_to(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-window",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )

    response = await client.get(
        "/api/activity-logs",
        params={"from": "2026-05-22", "to": "2026-05-20"},
    )

    assert response.status_code == 200
    assert response.json() == []


async def test_create_activity_log_returns_created_payload_without_server_owned_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    rule_violations = [
        {
            "rule_id": "rule-volume-cap",
            "message": "Weekly load is above target",
            "current_value": 12.5,
            "limit": 10,
        }
    ]

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 45,
            "volume_value": 4.5,
            "volume_unit": "km",
            "rpe": 6,
            "post_activity_feel": "steady",
            "notes": "No symptom spike",
            "rule_violations_at_log": rule_violations,
        },
    )

    assert response.status_code == 201
    _assert_activity_log_payload(
        response.json(),
        log_id="log-walk",
        activity_id="act-walk",
        logged_date="2026-05-21",
        duration_minutes=45,
        volume_value=4.5,
        volume_unit="km",
        rpe=6,
        post_activity_feel="steady",
        notes="No symptom spike",
        rule_violations_at_log=rule_violations,
    )


async def test_create_activity_log_rejects_server_owned_or_relationship_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-invalid",
            "user_id": "not-local",
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 45,
            "volume_value": 4.5,
            "volume_unit": "km",
            "rpe": 6,
            "post_activity_feel": "steady",
            "notes": "Invalid payload",
            "rule_violations_at_log": [],
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
            "activity": {"id": "act-walk"},
        },
    )

    assert response.status_code == 422


async def test_create_activity_log_preserves_null_volume_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-no-unit",
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 20,
            "volume_value": 1.0,
            "volume_unit": None,
        },
    )

    assert response.status_code == 201
    assert response.json()["volume_unit"] is None


@pytest.mark.parametrize(
    ("log_id", "rpe_payload"),
    [
        ("log-omitted-rpe", {}),
        ("log-null-rpe", {"rpe": None}),
    ],
)
async def test_create_activity_log_allows_omitted_or_null_rpe(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    log_id: str,
    rpe_payload: dict[str, None],
) -> None:
    _seed_log_graph(app_with_test_database)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": log_id,
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 20,
            "volume_value": 1.0,
            **rpe_payload,
        },
    )

    assert response.status_code == 201
    assert response.json()["rpe"] is None


@pytest.mark.parametrize("invalid_rpe", [0, 11])
async def test_create_activity_log_rejects_rpe_outside_valid_range(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_rpe: int,
) -> None:
    _seed_log_graph(app_with_test_database)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": f"log-rpe-{invalid_rpe}",
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 20,
            "volume_value": 1.0,
            "rpe": invalid_rpe,
        },
    )

    assert response.status_code == 422


async def test_create_activity_log_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-22",
            "duration_minutes": 20,
            "volume_value": 1.0,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Activity log already exists"}


async def test_create_activity_log_to_missing_activity_returns_stable_client_error(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-walk",
            "activity_id": "missing-activity",
            "logged_date": "2026-05-21",
            "duration_minutes": 20,
            "volume_value": 1.0,
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


async def test_patch_activity_log_updates_present_fields_and_json_snapshot(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database, activity_id="act-walk")
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-load",
        name="Bike",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        duration_minutes=30,
        volume_value=3.0,
        volume_unit="km",
        rpe=5,
        post_activity_feel="steady",
        notes="Before patch",
        rule_violations_at_log=[],
        updated_at=utc_datetime(10),
    )
    rule_violations = [
        {
            "rule_id": "rule-rpe-cap",
            "message": "RPE above recovery cap",
            "current_value": 9,
            "limit": 6,
        }
    ]

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={
            "activity_id": "act-bike",
            "logged_date": "2026-05-22",
            "duration_minutes": 40,
            "volume_value": 4.25,
            "volume_unit": "minutes",
            "rpe": 7,
            "post_activity_feel": "tired",
            "notes": "After patch",
            "rule_violations_at_log": rule_violations,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_activity_log_payload(
        payload,
        log_id="log-walk",
        activity_id="act-bike",
        logged_date="2026-05-22",
        duration_minutes=40,
        volume_value=4.25,
        volume_unit="minutes",
        rpe=7,
        post_activity_feel="tired",
        notes="After patch",
        rule_violations_at_log=rule_violations,
    )
    assert datetime.fromisoformat(payload["updated_at"]) > utc_datetime(10)


async def test_patch_activity_log_allows_nullable_fields_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        volume_unit="km",
        rpe=5,
        post_activity_feel="steady",
        notes="Before patch",
        rule_violations_at_log=[{"rule_id": "rule-volume-cap", "current_value": 12}],
    )

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={
            "volume_unit": None,
            "rpe": None,
            "post_activity_feel": None,
            "notes": None,
            "rule_violations_at_log": None,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["volume_unit"] is None
    assert payload["rpe"] is None
    assert payload["post_activity_feel"] is None
    assert payload["notes"] is None
    assert payload["rule_violations_at_log"] is None


async def test_patch_activity_log_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        duration_minutes=30,
        volume_value=3.0,
        volume_unit="km",
        rpe=5,
        post_activity_feel="steady",
        notes="Before patch",
        rule_violations_at_log=[],
    )

    response = await client.patch("/api/activity-logs/log-walk", json={})

    assert response.status_code == 200
    _assert_activity_log_payload(
        response.json(),
        log_id="log-walk",
        activity_id="act-walk",
        logged_date="2026-05-21",
        duration_minutes=30,
        volume_value=3.0,
        volume_unit="km",
        rpe=5,
        post_activity_feel="steady",
        notes="Before patch",
        rule_violations_at_log=[],
    )


async def test_patch_activity_log_to_missing_activity_returns_stable_client_error(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"activity_id": "missing-activity"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


@pytest.mark.parametrize("invalid_rpe", [0, 11])
async def test_patch_activity_log_rejects_rpe_outside_valid_range_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_rpe: int,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        rpe=5,
    )

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"rpe": invalid_rpe},
    )

    assert response.status_code == 422

    list_response = await client.get("/api/activity-logs")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["rpe"] == 5


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("activity_id", {"activity_id": None}),
        ("logged_date", {"logged_date": None}),
        ("duration_minutes", {"duration_minutes": None}),
        ("volume_value", {"volume_value": None}),
    ],
)
async def test_patch_activity_log_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        duration_minutes=30,
        volume_value=3.0,
    )

    response = await client.patch("/api/activity-logs/log-walk", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/activity-logs")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["activity_id"] == "act-walk"
    assert list_response.json()[0]["logged_date"] == "2026-05-21"
    assert list_response.json()[0]["duration_minutes"] == 30
    assert list_response.json()[0]["volume_value"] == 3.0


async def test_patch_missing_activity_log_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/activity-logs/missing-log",
        json={"notes": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity log not found"}


async def test_activity_logs_for_inactive_activities_remain_visible_and_editable(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database, activity_is_active=False)
    seed_activity_log(
        app_with_test_database,
        log_id="log-inactive",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
        notes="Before patch",
    )

    list_response = await client.get("/api/activity-logs")
    assert list_response.status_code == 200
    assert [log["id"] for log in list_response.json()] == ["log-inactive"]

    patch_response = await client.patch(
        "/api/activity-logs/log-inactive",
        json={"notes": "Edited inactive activity log"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["notes"] == "Edited inactive activity log"


async def test_delete_activity_log_returns_no_content_and_removes_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.delete("/api/activity-logs/log-walk")

    assert response.status_code == 204
    assert response.content == b""

    list_response = await client.get("/api/activity-logs")
    assert list_response.status_code == 200
    assert list_response.json() == []

    patch_response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"notes": "Already deleted"},
    )
    assert patch_response.status_code == 404
    assert patch_response.json() == {"detail": "Activity log not found"}


async def test_delete_missing_activity_log_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.delete("/api/activity-logs/missing-log")

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity log not found"}
