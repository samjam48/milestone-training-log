from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import (
    seed_activity_class,
    seed_goal,
    seed_training_block,
)


def _assert_goal_payload(
    payload: dict[str, Any],
    *,
    goal_id: str,
    title: str,
    description: str,
    target_date: str,
    timeframe: str,
    status: str,
    activity_class_id: str | None = None,
    progress_value: float | None = None,
    progress_target: float | None = None,
    progress_unit: str | None = None,
) -> None:
    assert payload["id"] == goal_id
    assert payload["title"] == title
    assert payload["description"] == description
    assert payload["target_date"] == target_date
    assert payload["timeframe"] == timeframe
    assert payload["status"] == status
    assert payload["activity_class_id"] == activity_class_id
    assert payload["progress_value"] == progress_value
    assert payload["progress_target"] == progress_target
    assert payload["progress_unit"] == progress_unit
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload


async def test_list_goals_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/goals")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_goals_returns_local_goals_in_target_date_then_id_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-later",
        title="Later Goal",
        target_date=date(2026, 8, 31),
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-earlier-b",
        title="Earlier B",
        target_date=date(2026, 6, 30),
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-earlier-a",
        title="Earlier A",
        target_date=date(2026, 6, 30),
    )

    response = await client.get("/api/goals")

    assert response.status_code == 200
    payload = response.json()
    assert [goal["id"] for goal in payload] == [
        "goal-earlier-a",
        "goal-earlier-b",
        "goal-later",
    ]
    assert all("user_id" not in goal for goal in payload)


async def test_list_goals_filters_by_status(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-active",
        title="Active Goal",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-achieved",
        title="Achieved Goal",
        status="achieved",
        target_date=date(2026, 7, 31),
    )

    response = await client.get("/api/goals", params={"status": "achieved"})

    assert response.status_code == 200
    assert [goal["id"] for goal in response.json()] == ["goal-achieved"]


async def test_list_goals_filters_by_timeframe(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-monthly",
        title="Monthly Goal",
        timeframe="monthly",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-quarterly",
        title="Quarterly Goal",
        timeframe="quarterly",
        target_date=date(2026, 9, 30),
    )

    response = await client.get("/api/goals", params={"timeframe": "quarterly"})

    assert response.status_code == 200
    assert [goal["id"] for goal in response.json()] == ["goal-quarterly"]


async def test_list_goals_combines_status_and_timeframe_filters(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-match",
        title="Match",
        timeframe="monthly",
        status="active",
        target_date=date(2026, 6, 30),
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-wrong-status",
        title="Wrong Status",
        timeframe="monthly",
        status="achieved",
        target_date=date(2026, 7, 31),
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-wrong-timeframe",
        title="Wrong Timeframe",
        timeframe="quarterly",
        status="active",
        target_date=date(2026, 9, 30),
    )

    response = await client.get(
        "/api/goals",
        params={"status": "active", "timeframe": "monthly"},
    )

    assert response.status_code == 200
    assert [goal["id"] for goal in response.json()] == ["goal-match"]


async def test_list_goals_returns_empty_list_when_filters_match_nothing(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-active",
        title="Active Goal",
        status="active",
        timeframe="monthly",
    )

    response = await client.get(
        "/api/goals",
        params={"status": "achieved", "timeframe": "monthly"},
    )

    assert response.status_code == 200
    assert response.json() == []


async def test_create_goal_defaults_status_to_active(client: AsyncClient) -> None:
    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-1",
            "title": "Walk 20km",
            "description": "Monthly walking goal",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
        },
    )

    assert response.status_code == 201
    _assert_goal_payload(
        response.json(),
        goal_id="goal-1",
        title="Walk 20km",
        description="Monthly walking goal",
        target_date="2026-06-30",
        timeframe="monthly",
        status="active",
    )


async def test_create_goal_returns_created_payload_without_server_owned_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-quarterly",
            "title": "Quarterly volume",
            "description": "Build consistent load",
            "target_date": "2026-09-30",
            "timeframe": "quarterly",
            "status": "achieved",
        },
    )

    assert response.status_code == 201
    _assert_goal_payload(
        response.json(),
        goal_id="goal-quarterly",
        title="Quarterly volume",
        description="Build consistent load",
        target_date="2026-09-30",
        timeframe="quarterly",
        status="achieved",
    )


async def test_create_goal_accepts_optional_progress_and_class_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )

    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-progress",
            "title": "Foot load target",
            "description": "Track weekly foot load",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
            "activity_class_id": "cls-foot-load",
            "progress_value": 12.5,
            "progress_target": 20.0,
            "progress_unit": "km",
            "status": "active",
        },
    )

    assert response.status_code == 201
    _assert_goal_payload(
        response.json(),
        goal_id="goal-progress",
        title="Foot load target",
        description="Track weekly foot load",
        target_date="2026-06-30",
        timeframe="monthly",
        status="active",
        activity_class_id="cls-foot-load",
        progress_value=12.5,
        progress_target=20.0,
        progress_unit="km",
    )


async def test_create_qualitative_goal_omits_progress_fields_and_returns_nulls(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-qualitative",
            "title": "Feel confident on stairs",
            "description": "Qualitative rehab milestone",
            "target_date": "2026-07-15",
            "timeframe": "monthly",
        },
    )

    assert response.status_code == 201
    _assert_goal_payload(
        response.json(),
        goal_id="goal-qualitative",
        title="Feel confident on stairs",
        description="Qualitative rehab milestone",
        target_date="2026-07-15",
        timeframe="monthly",
        status="active",
    )


async def test_create_goal_rejects_client_owned_server_or_relationship_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-invalid",
            "user_id": "not-local",
            "title": "Invalid",
            "description": "Attempts to set server-owned fields.",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
            "training_blocks": [],
        },
    )

    assert response.status_code == 422


async def test_create_goal_validates_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )

    valid_response = await client.post(
        "/api/goals",
        json={
            "id": "goal-linked",
            "title": "Linked Goal",
            "description": "Uses a valid class",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
            "activity_class_id": "cls-foot-load",
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["activity_class_id"] == "cls-foot-load"

    invalid_response = await client.post(
        "/api/goals",
        json={
            "id": "goal-missing-class",
            "title": "Missing Class",
            "description": "References a missing class",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
            "activity_class_id": "missing-class",
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_create_goal_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="Existing Goal",
    )

    response = await client.post(
        "/api/goals",
        json={
            "id": "goal-1",
            "title": "Duplicate",
            "description": "Same client-supplied ID.",
            "target_date": "2026-07-31",
            "timeframe": "monthly",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Goal already exists"}


async def test_patch_goal_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="Before",
        description="Before description",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        status="active",
    )

    response = await client.patch(
        "/api/goals/goal-1",
        json={
            "title": "After",
            "description": "After description",
            "target_date": "2026-07-31",
            "timeframe": "quarterly",
            "status": "achieved",
        },
    )

    assert response.status_code == 200
    _assert_goal_payload(
        response.json(),
        goal_id="goal-1",
        title="After",
        description="After description",
        target_date="2026-07-31",
        timeframe="quarterly",
        status="achieved",
    )


async def test_patch_goal_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="Unchanged",
        description="Unchanged description",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        status="active",
    )

    response = await client.patch("/api/goals/goal-1", json={})

    assert response.status_code == 200
    _assert_goal_payload(
        response.json(),
        goal_id="goal-1",
        title="Unchanged",
        description="Unchanged description",
        target_date="2026-06-30",
        timeframe="monthly",
        status="active",
    )


async def test_patch_goal_allows_nullable_fields_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="Tracked Goal",
        description="Has progress fields",
        activity_class_id="cls-foot-load",
        progress_value=10.0,
        progress_target=20.0,
        progress_unit="km",
    )

    response = await client.patch(
        "/api/goals/goal-1",
        json={
            "activity_class_id": None,
            "progress_value": None,
            "progress_target": None,
            "progress_unit": None,
        },
    )

    assert response.status_code == 200
    _assert_goal_payload(
        response.json(),
        goal_id="goal-1",
        title="Tracked Goal",
        description="Has progress fields",
        target_date="2026-06-30",
        timeframe="monthly",
        status="active",
    )


async def test_patch_missing_goal_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/goals/missing-goal",
        json={"title": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Goal not found"}


async def test_goal_delete_route_is_not_available(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="No Delete",
    )

    response = await client.delete("/api/goals/goal-1")

    assert response.status_code == 405


async def test_patch_training_block_links_goal_created_via_goal_api(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Rehab Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    create_response = await client.post(
        "/api/goals",
        json={
            "id": "goal-linked",
            "title": "Walk 20km",
            "description": "Monthly walking goal",
            "target_date": "2026-06-30",
            "timeframe": "monthly",
        },
    )
    assert create_response.status_code == 201

    patch_response = await client.patch(
        "/api/training-blocks/blk-1",
        json={"related_goal_id": "goal-linked"},
    )

    assert patch_response.status_code == 200
    assert patch_response.json()["related_goal_id"] == "goal-linked"


async def test_patch_goal_linked_from_active_block_does_not_change_block_status(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-active-link",
        title="Linked Goal",
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Active Block",
        start_date=date(2026, 4, 7),
        status="active",
        related_goal_id="goal-active-link",
    )

    response = await client.patch(
        "/api/goals/goal-active-link",
        json={
            "title": "Updated Linked Goal",
            "status": "achieved",
        },
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Linked Goal"
    assert response.json()["status"] == "achieved"

    active_block_response = await client.get("/api/training-blocks/active")
    assert active_block_response.status_code == 200
    assert active_block_response.json()["status"] == "active"
    assert active_block_response.json()["related_goal_id"] == "goal-active-link"


@pytest.mark.parametrize(
    ("invalid_status", "invalid_timeframe"),
    [
        ("Active", "monthly"),
        ("active", "Monthly"),
        ("banana", "quarterly"),
        ("active", "yearly"),
    ],
)
async def test_create_goal_rejects_invalid_status_and_timeframe(
    client: AsyncClient,
    invalid_status: str,
    invalid_timeframe: str,
) -> None:
    response = await client.post(
        "/api/goals",
        json={
            "id": f"goal-invalid-{invalid_status}-{invalid_timeframe}",
            "title": "Invalid enum goal",
            "description": "Should be rejected at API boundary",
            "target_date": "2026-06-30",
            "timeframe": invalid_timeframe,
            "status": invalid_status,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("title", {"title": None}),
        ("target_date", {"target_date": None}),
        ("timeframe", {"timeframe": None}),
        ("status", {"status": None}),
    ],
)
async def test_patch_goal_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    seed_goal(
        app_with_test_database,
        goal_id="goal-1",
        title="Before",
        description="Before description",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        status="active",
    )

    response = await client.patch("/api/goals/goal-1", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/goals")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_goal_payload(
        list_response.json()[0],
        goal_id="goal-1",
        title="Before",
        description="Before description",
        target_date="2026-06-30",
        timeframe="monthly",
        status="active",
    )
