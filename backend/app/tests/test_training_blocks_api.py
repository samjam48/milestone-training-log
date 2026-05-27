from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import seed_goal, seed_training_block


def _assert_training_block_payload(
    payload: dict[str, Any],
    *,
    block_id: str,
    name: str,
    start_date: str,
    status: str,
    end_date: str | None = None,
    related_goal_id: str | None = None,
    notes: str | None = None,
    is_review_milestone_hit: bool = False,
) -> None:
    assert payload["id"] == block_id
    assert payload["name"] == name
    assert payload["start_date"] == start_date
    assert payload["status"] == status
    assert payload["end_date"] == end_date
    assert payload["related_goal_id"] == related_goal_id
    assert payload["notes"] == notes
    assert payload["is_review_milestone_hit"] is is_review_milestone_hit
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload


async def test_list_training_blocks_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/training-blocks")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_training_blocks_returns_local_blocks_in_start_date_desc_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-old",
        name="Older Block",
        start_date=date(2026, 3, 1),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-new",
        name="Newer Block",
        start_date=date(2026, 5, 1),
        status="archived",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-mid-a",
        name="Same Start A",
        start_date=date(2026, 4, 1),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-mid-b",
        name="Same Start B",
        start_date=date(2026, 4, 1),
        status="completed",
    )

    response = await client.get("/api/training-blocks")

    assert response.status_code == 200
    assert [block["id"] for block in response.json()] == [
        "blk-new",
        "blk-mid-a",
        "blk-mid-b",
        "blk-old",
    ]


async def test_get_active_training_block_returns_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Active Block",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-completed",
        name="Completed Block",
        start_date=date(2026, 3, 1),
        status="completed",
    )

    response = await client.get("/api/training-blocks/active")

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-active",
        name="Active Block",
        start_date="2026-04-07",
        status="active",
    )


async def test_get_active_training_block_returns_not_found_when_none_active(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/active")

    assert response.status_code == 404
    assert response.json() == {"detail": "Active training block not found"}


async def test_create_training_block_defaults_status_to_active(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-1",
            "name": "Week 1-2 Rehab",
            "start_date": "2026-04-07",
        },
    )

    assert response.status_code == 201
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="Week 1-2 Rehab",
        start_date="2026-04-07",
        status="active",
    )


async def test_create_training_block_returns_created_payload_without_server_owned_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-2",
            "name": "Progression Block",
            "start_date": "2026-05-01",
            "end_date": "2026-05-14",
            "status": "archived",
            "notes": "Archived planning block",
        },
    )

    assert response.status_code == 201
    _assert_training_block_payload(
        response.json(),
        block_id="blk-2",
        name="Progression Block",
        start_date="2026-05-01",
        end_date="2026-05-14",
        status="archived",
        notes="Archived planning block",
    )


async def test_create_training_block_rejects_client_owned_server_or_relationship_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-invalid",
            "user_id": "not-local",
            "name": "Invalid",
            "start_date": "2026-04-07",
            "is_review_milestone_hit": True,
            "created_at": "2026-05-27T08:00:00Z",
            "rules": [],
        },
    )

    assert response.status_code == 422


async def test_create_training_block_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Existing Block",
        start_date=date(2026, 4, 7),
        status="completed",
    )

    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-1",
            "name": "Duplicate",
            "start_date": "2026-05-01",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Training block already exists"}


async def test_create_active_training_block_completes_previous_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-old",
        name="Old Active",
        start_date=date(2026, 3, 1),
        status="active",
    )

    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-new",
            "name": "New Active",
            "start_date": "2026-05-01",
            "status": "active",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "active"

    list_response = await client.get("/api/training-blocks")
    blocks_by_id = {block["id"]: block for block in list_response.json()}
    assert blocks_by_id["blk-old"]["status"] == "completed"
    assert blocks_by_id["blk-new"]["status"] == "active"


async def test_create_training_block_validates_related_goal_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(app_with_test_database)

    valid_response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-linked",
            "name": "Linked Block",
            "start_date": "2026-04-07",
            "related_goal_id": "goal-1",
            "status": "archived",
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["related_goal_id"] == "goal-1"

    invalid_response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-missing-goal",
            "name": "Missing Goal",
            "start_date": "2026-04-07",
            "related_goal_id": "missing-goal",
            "status": "archived",
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Goal not found"}


async def test_patch_training_block_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Before",
        start_date=date(2026, 4, 7),
        status="archived",
        notes="Before notes",
    )

    response = await client.patch(
        "/api/training-blocks/blk-1",
        json={
            "name": "After",
            "notes": "After notes",
        },
    )

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="After",
        start_date="2026-04-07",
        status="archived",
        notes="After notes",
    )


async def test_patch_training_block_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Unchanged",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.patch("/api/training-blocks/blk-1", json={})

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="Unchanged",
        start_date="2026-04-07",
        status="archived",
    )


async def test_patch_training_block_allows_nullable_fields_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(app_with_test_database)
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Linked Block",
        start_date=date(2026, 4, 7),
        status="archived",
        end_date=date(2026, 5, 31),
        related_goal_id="goal-1",
        notes="Clear me",
    )

    response = await client.patch(
        "/api/training-blocks/blk-1",
        json={
            "end_date": None,
            "related_goal_id": None,
            "notes": None,
        },
    )

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="Linked Block",
        start_date="2026-04-07",
        status="archived",
    )


async def test_patch_training_block_to_active_completes_previous_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Current Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-archived",
        name="To Activate",
        start_date=date(2026, 5, 1),
        status="archived",
    )

    response = await client.patch(
        "/api/training-blocks/blk-archived",
        json={"status": "active"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"

    list_response = await client.get("/api/training-blocks")
    blocks_by_id = {block["id"]: block for block in list_response.json()}
    assert blocks_by_id["blk-active"]["status"] == "completed"
    assert blocks_by_id["blk-archived"]["status"] == "active"


async def test_patch_active_block_to_completed_does_not_promote_another_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-archived",
        name="Archived",
        start_date=date(2026, 3, 1),
        status="archived",
    )

    response = await client.patch(
        "/api/training-blocks/blk-active",
        json={"status": "completed"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    active_response = await client.get("/api/training-blocks/active")
    assert active_response.status_code == 404


async def test_patch_missing_training_block_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/training-blocks/missing-block",
        json={"name": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize("invalid_status", ["Active", "banana"])
async def test_create_training_block_rejects_invalid_status(
    client: AsyncClient,
    invalid_status: str,
) -> None:
    response = await client.post(
        "/api/training-blocks",
        json={
            "id": f"blk-invalid-{invalid_status.lower()}",
            "name": "Invalid Status Block",
            "start_date": "2026-04-07",
            "status": invalid_status,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("name", {"name": None}),
        ("start_date", {"start_date": None}),
        ("status", {"status": None}),
    ],
)
async def test_patch_training_block_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Before",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.patch("/api/training-blocks/blk-1", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/training-blocks")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_training_block_payload(
        list_response.json()[0],
        block_id="blk-1",
        name="Before",
        start_date="2026-04-07",
        status="archived",
    )
