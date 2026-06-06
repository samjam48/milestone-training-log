from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_test_utils import (
    FROZEN_TODAY,
    freeze_server_today,
    freeze_server_today_as,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    seed_training_block,
    utc_datetime,
)

TODAY_ISO = FROZEN_TODAY.isoformat()
FUTURE_DATE_ISO = "2026-05-26"


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


# ---------------------------------------------------------------------------
# S25.B9 — Log date validation + derived-state recompute
# ---------------------------------------------------------------------------


def _install_recompute_derived_state_spy(
    monkeypatch: pytest.MonkeyPatch,
) -> list[dict[str, object]]:
    calls: list[dict[str, object]] = []

    def _spy(
        _session: object,
        *,
        activity_ids: set[str],
        anchor_date: date,
    ) -> None:
        calls.append({"activity_ids": set(activity_ids), "anchor_date": anchor_date})

    monkeypatch.setattr(
        "app.services.activity_logs.recompute_derived_state",
        _spy,
        raising=False,
    )
    return calls


def _install_goal_recompute_spy(monkeypatch: pytest.MonkeyPatch) -> list[set[str]]:
    calls: list[set[str]] = []

    def _spy(_session: object, *, activity_ids: set[str]) -> None:
        calls.append(set(activity_ids))

    monkeypatch.setattr(
        "app.services.goals.recompute_auto_tracked_goals",
        _spy,
    )
    return calls


def _seed_auto_track_goal_graph(
    app_with_test_database: FastAPI,
    *,
    goal_id: str,
    activity_id: str,
    activity_name: str,
    progress_target: float = 20.0,
    progress_unit: str = "km",
    target_date: date = date(2026, 6, 30),
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id=activity_id,
        activity_class_id="cls-foot",
        name=activity_name,
        default_volume_unit=progress_unit,
    )
    seed_goal(
        app_with_test_database,
        goal_id=goal_id,
        title=f"{activity_name} target",
        description="Auto-tracked goal for log recompute tests",
        target_date=target_date,
        timeframe="monthly",
        activity_class_id="cls-foot",
        activity_id=activity_id,
        auto_track_progress=True,
        progress_target=progress_target,
        progress_unit=progress_unit,
        progress_value=None,
        status="active",
    )


async def _goal_progress_value(client: AsyncClient, goal_id: str) -> float | None:
    response = await client.get("/api/goals")
    assert response.status_code == 200
    goal = next(item for item in response.json() if item["id"] == goal_id)
    return goal["progress_value"]


async def test_create_activity_log_rejects_future_logged_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_log_graph(app_with_test_database)
    freeze_server_today(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-future",
            "activity_id": "act-walk",
            "logged_date": FUTURE_DATE_ISO,
            "duration_minutes": 30,
            "volume_value": 3.0,
            "volume_unit": "km",
        },
    )

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert "logged_date" in error_fields


@pytest.mark.parametrize("logged_date", [TODAY_ISO, "2026-05-20"])
async def test_create_activity_log_accepts_logged_date_on_or_before_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    logged_date: str,
) -> None:
    _seed_log_graph(app_with_test_database)
    freeze_server_today(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": f"log-{logged_date}",
            "activity_id": "act-walk",
            "logged_date": logged_date,
            "duration_minutes": 30,
            "volume_value": 3.0,
            "volume_unit": "km",
        },
    )

    assert response.status_code == 201
    assert response.json()["logged_date"] == logged_date


async def test_patch_activity_log_rejects_future_logged_date_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )
    freeze_server_today(monkeypatch)

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"logged_date": FUTURE_DATE_ISO},
    )

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert "logged_date" in error_fields

    list_response = await client.get("/api/activity-logs")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["logged_date"] == "2026-05-20"


async def test_create_activity_log_calls_recompute_derived_state(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_log_graph(app_with_test_database)
    calls = _install_recompute_derived_state_spy(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-recompute-create",
            "activity_id": "act-walk",
            "logged_date": "2026-05-21",
            "duration_minutes": 30,
            "volume_value": 3.0,
            "volume_unit": "km",
        },
    )

    assert response.status_code == 201
    assert calls == [
        {
            "activity_ids": {"act-walk"},
            "anchor_date": date(2026, 5, 21),
        }
    ]


async def test_patch_activity_log_calls_recompute_derived_state(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 20),
    )
    calls = _install_recompute_derived_state_spy(monkeypatch)

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"logged_date": "2026-05-22"},
    )

    assert response.status_code == 200
    assert calls == [
        {
            "activity_ids": {"act-walk"},
            "anchor_date": date(2026, 5, 22),
        }
    ]


async def test_delete_activity_log_calls_recompute_derived_state(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_log_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )
    calls = _install_recompute_derived_state_spy(monkeypatch)

    response = await client.delete("/api/activity-logs/log-walk")

    assert response.status_code == 204
    assert calls == [
        {
            "activity_ids": {"act-walk"},
            "anchor_date": date(2026, 5, 21),
        }
    ]


async def test_create_activity_log_calls_recompute_auto_tracked_goals(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 6, 30))
    _seed_auto_track_goal_graph(
        app_with_test_database,
        goal_id="goal-auto-walk",
        activity_id="act-walk",
        activity_name="Walk",
    )
    goal_calls = _install_goal_recompute_spy(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-goal-recompute",
            "activity_id": "act-walk",
            "logged_date": "2026-06-10",
            "duration_minutes": 30,
            "volume_value": 5.0,
            "volume_unit": "km",
        },
    )

    assert response.status_code == 201
    assert goal_calls == [{"act-walk"}]


async def test_patch_logged_date_recomputes_auto_tracked_goal_progress(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 6, 30))
    _seed_auto_track_goal_graph(
        app_with_test_database,
        goal_id="goal-auto-walk",
        activity_id="act-walk",
        activity_name="Walk",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-june",
        activity_id="act-walk",
        logged_date=date(2026, 6, 10),
        volume_value=5.0,
        volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-may",
        activity_id="act-walk",
        logged_date=date(2026, 5, 31),
        volume_value=4.0,
        volume_unit="km",
    )

    assert await _goal_progress_value(client, "goal-auto-walk") is None

    patch_into_period = await client.patch(
        "/api/activity-logs/log-may",
        json={"logged_date": "2026-06-12"},
    )
    assert patch_into_period.status_code == 200
    assert await _goal_progress_value(client, "goal-auto-walk") == 9.0

    patch_out_of_period = await client.patch(
        "/api/activity-logs/log-june",
        json={"logged_date": "2026-05-15"},
    )
    assert patch_out_of_period.status_code == 200
    assert await _goal_progress_value(client, "goal-auto-walk") == 4.0


async def test_patch_activity_id_recomputes_goals_for_both_activities(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot",
        name="Walk",
        default_volume_unit="km",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-bike",
        activity_class_id="cls-foot",
        name="Bike",
        default_volume_unit="km",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-auto-walk",
        title="Walk target",
        description="Auto-tracked walk goal",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="cls-foot",
        activity_id="act-walk",
        auto_track_progress=True,
        progress_target=20.0,
        progress_unit="km",
        progress_value=None,
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-auto-bike",
        title="Bike target",
        description="Auto-tracked bike goal",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="cls-foot",
        activity_id="act-bike",
        auto_track_progress=True,
        progress_target=20.0,
        progress_unit="km",
        progress_value=None,
        status="active",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 6, 10),
        volume_value=5.0,
        volume_unit="km",
    )

    assert await _goal_progress_value(client, "goal-auto-walk") is None
    assert await _goal_progress_value(client, "goal-auto-bike") is None

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"activity_id": "act-bike"},
    )

    assert response.status_code == 200
    assert await _goal_progress_value(client, "goal-auto-walk") == 0.0
    assert await _goal_progress_value(client, "goal-auto-bike") == 5.0


async def test_patch_activity_id_calls_recompute_derived_state_for_both_activities(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
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
        logged_date=date(2026, 5, 20),
    )
    calls = _install_recompute_derived_state_spy(monkeypatch)

    response = await client.patch(
        "/api/activity-logs/log-walk",
        json={"activity_id": "act-bike"},
    )

    assert response.status_code == 200
    assert len(calls) == 1
    assert calls[0]["activity_ids"] == {"act-walk", "act-bike"}
    assert calls[0]["anchor_date"] == date(2026, 5, 20)


async def test_create_recovery_log_calls_recompute_derived_state_for_recovery_streak(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Recovery Block",
        start_date=date(2026, 5, 1),
        status="active",
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
        activity_id="act-mobility",
        activity_class_id="cls-recovery",
        name="Mobility",
        activity_type="recovery",
    )
    calls = _install_recompute_derived_state_spy(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-recovery",
            "activity_id": "act-mobility",
            "logged_date": "2026-05-21",
            "duration_minutes": 20,
            "volume_value": 1.0,
            "volume_unit": "minutes",
        },
    )

    assert response.status_code == 201
    assert calls == [
        {
            "activity_ids": {"act-mobility"},
            "anchor_date": date(2026, 5, 21),
        }
    ]
