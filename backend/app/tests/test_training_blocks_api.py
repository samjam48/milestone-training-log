from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_daily_check_in, seed_flare_up_incident
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    seed_rule,
    seed_training_block,
)


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


def _assert_training_block_review_payload(
    payload: dict[str, Any],
    *,
    block_id: str,
    name: str,
    start_date: str,
    status: str,
    end_date: str | None,
    total_sessions: int,
    clean_days: int,
) -> None:
    block = payload["block"]
    assert block["id"] == block_id
    assert block["name"] == name
    assert block["start_date"] == start_date
    assert block["status"] == status
    assert block["end_date"] == end_date
    assert "created_at" in block
    assert "updated_at" in block
    datetime.fromisoformat(block["created_at"])
    datetime.fromisoformat(block["updated_at"])
    assert "user_id" not in block
    assert isinstance(payload["daily_scores"], list)
    assert isinstance(payload["load_series"], list)
    assert isinstance(payload["flare_up_dates"], list)
    assert payload["total_sessions"] == total_sessions
    assert payload["clean_days"] == clean_days


def _seed_review_block_graph(
    app_with_test_database: FastAPI,
    *,
    block_id: str,
    block_start: date,
    block_end: date | None,
    block_status: str,
    seed_rules: bool,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id=block_id,
        name="Review Block",
        start_date=block_start,
        end_date=block_end,
        status=block_status,
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-review",
        name="Foot Load",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-review",
        activity_class_id="cls-foot-review",
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
    )
    if seed_rules:
        seed_rule(
            app_with_test_database,
            rule_id="rule-cap-review",
            training_block_id=block_id,
            rule_type="weekly_load_cap",
            threshold_value=120,
            window_days=7,
            activity_class_id="cls-foot-review",
            enabled=True,
        )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-in-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 4, 8),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-outside-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 4, 12),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-review-in-range",
        check_in_date=date(2026, 4, 8),
        pain_level=2,
        has_flare_up=False,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-in-range",
        incident_date=date(2026, 4, 9),
        body_part="Left heel",
        severity=6,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-outside-range",
        incident_date=date(2026, 4, 12),
        body_part="Left heel",
        severity=6,
    )


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


async def test_get_training_block_review_returns_not_found_for_missing_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/review")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_get_training_block_review_returns_review_payload_for_completed_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_review_block_graph(
        app_with_test_database,
        block_id="blk-review-complete",
        block_start=date(2026, 4, 7),
        block_end=date(2026, 4, 10),
        block_status="completed",
        seed_rules=True,
    )

    response = await client.get("/api/training-blocks/blk-review-complete/review")

    assert response.status_code == 200
    payload = response.json()
    _assert_training_block_review_payload(
        payload,
        block_id="blk-review-complete",
        name="Review Block",
        start_date="2026-04-07",
        status="completed",
        end_date="2026-04-10",
        total_sessions=1,
        clean_days=3,
    )
    assert len(payload["load_series"]) == 4
    assert payload["load_series"][0]["date"] == "2026-04-07"
    assert payload["load_series"][-1]["date"] == "2026-04-10"
    assert [score["date"] for score in payload["daily_scores"]] == [
        "2026-04-08",
        "2026-04-09",
    ]
    assert payload["flare_up_dates"] == ["2026-04-09"]
    assert payload["load_series"]


async def test_get_training_block_review_supports_open_block_and_defaults_end_date_to_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_review_block_graph(
        app_with_test_database,
        block_id="blk-review-open",
        block_start=date(2026, 5, 1),
        block_end=None,
        block_status="active",
        seed_rules=True,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-open-in-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 5, 2),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-review-open-in-range",
        check_in_date=date(2026, 5, 2),
        pain_level=2,
        has_flare_up=False,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-open-in-range",
        incident_date=date(2026, 5, 3),
        body_part="Left heel",
        severity=6,
    )

    response = await client.get("/api/training-blocks/blk-review-open/review")

    assert response.status_code == 200
    payload = response.json()
    expected_clean_days = (date.today() - date(2026, 5, 1)).days
    _assert_training_block_review_payload(
        payload,
        block_id="blk-review-open",
        name="Review Block",
        start_date="2026-05-01",
        status="active",
        end_date=None,
        total_sessions=1,
        clean_days=expected_clean_days,
    )
    assert payload["block"]["end_date"] is None
    assert payload["daily_scores"]
    assert payload["load_series"]
    assert payload["flare_up_dates"]


async def test_get_training_block_review_empty_load_series_without_graph_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-review-empty",
        name="Review Block Empty",
        start_date=date(2026, 5, 1),
        status="active",
    )

    response = await client.get("/api/training-blocks/blk-review-empty/review")

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"]["id"] == "blk-review-empty"
    assert payload["load_series"] == []


async def test_create_active_training_block_copies_previous_active_rules_and_closes_outgoing_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-old-active",
        name="Old Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-load",
        training_block_id="blk-old-active",
        activity_class_id="cls-foot",
        rule_type="weekly_load_cap",
        threshold_value=120.0,
        window_days=7,
        enabled=True,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-rest",
        training_block_id="blk-old-active",
        activity_class_id=None,
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
        enabled=False,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-gap",
        training_block_id="blk-old-active",
        activity_class_id="cls-foot",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
        enabled=True,
    )

    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-new-active",
            "name": "New Active",
            "start_date": "2026-05-01",
            "status": "active",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "active"

    new_rules_response = await client.get("/api/training-blocks/blk-new-active/rules")
    assert new_rules_response.status_code == 200
    new_rules = new_rules_response.json()
    assert len(new_rules) == 3
    assert {rule["training_block_id"] for rule in new_rules} == {"blk-new-active"}
    assert {rule["id"] for rule in new_rules}.isdisjoint(
        {"rule-old-load", "rule-old-rest", "rule-old-gap"}
    )
    assert {
        (
            rule["activity_class_id"],
            rule["rule_type"],
            rule["threshold_value"],
            rule["window_days"],
            rule["enabled"],
        )
        for rule in new_rules
    } == {
        ("cls-foot", "weekly_load_cap", 120.0, 7, True),
        (None, "frequency_limit", 3.0, 7, False),
        ("cls-foot", "rest_between_class", 2.0, 7, True),
    }

    blocks_response = await client.get("/api/training-blocks")
    assert blocks_response.status_code == 200
    blocks_by_id = {block["id"]: block for block in blocks_response.json()}
    assert blocks_by_id["blk-old-active"]["status"] == "completed"
    assert blocks_by_id["blk-old-active"]["end_date"] == str(date.today())

    old_rules_response = await client.get("/api/training-blocks/blk-old-active/rules")
    assert old_rules_response.status_code == 200
    assert {rule["id"] for rule in old_rules_response.json()} == {
        "rule-old-load",
        "rule-old-rest",
        "rule-old-gap",
    }


async def test_create_active_training_block_preserves_existing_end_date_while_copying_rules(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-preserve",
        name="Foot Load",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-old-preserve",
        name="Old Active Preserve",
        start_date=date(2026, 4, 7),
        end_date=date(2026, 5, 31),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-old-preserve",
        training_block_id="blk-old-preserve",
        activity_class_id="cls-foot-preserve",
        rule_type="weekly_load_cap",
        threshold_value=150.0,
        window_days=7,
        enabled=True,
    )

    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-new-preserve",
            "name": "New Active Preserve",
            "start_date": "2026-06-01",
            "status": "active",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "active"

    blocks_response = await client.get("/api/training-blocks")
    assert blocks_response.status_code == 200
    blocks_by_id = {block["id"]: block for block in blocks_response.json()}
    assert blocks_by_id["blk-old-preserve"]["status"] == "completed"
    assert blocks_by_id["blk-old-preserve"]["end_date"] == "2026-05-31"

    new_rules_response = await client.get("/api/training-blocks/blk-new-preserve/rules")
    assert new_rules_response.status_code == 200
    assert len(new_rules_response.json()) == 1
    assert new_rules_response.json()[0]["activity_class_id"] == "cls-foot-preserve"


async def test_create_completed_training_block_does_not_copy_or_archive_existing_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-completed",
        name="Foot Load",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-active-completed",
        name="Current Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-active-completed",
        training_block_id="blk-active-completed",
        activity_class_id="cls-foot-completed",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
        enabled=True,
    )

    response = await client.post(
        "/api/training-blocks",
        json={
            "id": "blk-completed",
            "name": "Completed Block",
            "start_date": "2026-05-01",
            "status": "completed",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"

    blocks_response = await client.get("/api/training-blocks")
    assert blocks_response.status_code == 200
    blocks_by_id = {block["id"]: block for block in blocks_response.json()}
    assert blocks_by_id["blk-active-completed"]["status"] == "active"
    assert blocks_by_id["blk-active-completed"]["end_date"] is None
    assert blocks_by_id["blk-completed"]["status"] == "completed"

    active_rules_response = await client.get("/api/training-blocks/blk-active-completed/rules")
    assert active_rules_response.status_code == 200
    assert {rule["id"] for rule in active_rules_response.json()} == {
        "rule-active-completed"
    }

    new_rules_response = await client.get("/api/training-blocks/blk-completed/rules")
    assert new_rules_response.status_code == 200
    assert new_rules_response.json() == []
