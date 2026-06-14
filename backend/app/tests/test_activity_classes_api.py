from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.models.activity import Activity
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    seed_rule,
    seed_training_block,
    seed_weekly_target,
    utc_datetime,
    with_session,
)


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


async def test_delete_empty_activity_class_returns_no_content_and_removes_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-empty",
        name="Empty Class",
    )

    response = await client.delete("/api/activity-classes/cls-empty")

    assert response.status_code == 204
    assert response.content == b""

    list_response = await client.get("/api/activity-classes")
    assert list_response.status_code == 200
    assert list_response.json() == []


async def test_delete_activity_class_cascades_unlogged_activities_in_one_transaction(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot-load",
        name="Walk",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-run",
        activity_class_id="cls-foot-load",
        name="Run",
        is_active=False,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-stretch",
        activity_class_id="cls-recovery",
        name="Stretch",
    )

    response = await client.delete("/api/activity-classes/cls-foot-load")

    assert response.status_code == 204
    assert response.content == b""

    classes_response = await client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    assert [activity_class["id"] for activity_class in classes_response.json()] == [
        "cls-recovery",
    ]

    activities_response = await client.get("/api/activities")
    assert activities_response.status_code == 200
    assert [activity["id"] for activity in activities_response.json()] == [
        "act-stretch",
    ]

    logs_response = await client.get("/api/activity-logs")
    assert logs_response.status_code == 200
    assert logs_response.json() == []


async def test_delete_activity_class_with_logged_activity_returns_conflict_and_preserves_rows(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot-load",
        name="Walk",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-run",
        activity_class_id="cls-foot-load",
        name="Run",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-walk",
        activity_id="act-walk",
        logged_date=date(2026, 5, 21),
    )

    response = await client.delete("/api/activity-classes/cls-foot-load")

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Cannot delete activity class while activities have logs",
    }

    classes_response = await client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    assert len(classes_response.json()) == 1
    assert classes_response.json()[0]["id"] == "cls-foot-load"

    activities_response = await client.get("/api/activities")
    assert activities_response.status_code == 200
    assert {activity["id"] for activity in activities_response.json()} == {
        "act-walk",
        "act-run",
    }

    logs_response = await client.get("/api/activity-logs")
    assert logs_response.status_code == 200
    assert len(logs_response.json()) == 1
    assert logs_response.json()[0]["id"] == "log-walk"


@pytest.mark.parametrize(
    "goal_reference",
    [
        {"activity_class_id": "cls-foot-load"},
        {"activity_id": "act-walk"},
    ],
    ids=["class", "activity"],
)
async def test_delete_activity_class_with_goal_reference_returns_conflict_and_preserves_rows(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    goal_reference: dict[str, str],
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    if "activity_id" in goal_reference:
        seed_activity(
            app_with_test_database,
            activity_id="act-walk",
            activity_class_id="cls-foot-load",
            name="Walk",
        )
    seed_goal(
        app_with_test_database,
        goal_id="goal-walk",
        title="Walk goal",
        activity_class_id=goal_reference.get("activity_class_id"),
        activity_id=goal_reference.get("activity_id"),
    )

    response = await client.delete("/api/activity-classes/cls-foot-load")

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Cannot delete activity class while goals reference it",
    }

    classes_response = await client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    assert len(classes_response.json()) == 1
    assert classes_response.json()[0]["id"] == "cls-foot-load"

    goals_response = await client.get("/api/goals")
    assert goals_response.status_code == 200
    assert len(goals_response.json()) == 1
    assert goals_response.json()[0]["id"] == "goal-walk"


async def test_delete_activity_class_cascades_class_and_exercise_rules(
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
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot-load",
        name="Walk",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-class-cap",
        training_block_id="blk-1",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
        activity_class_id="cls-foot-load",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-walk-cap",
        training_block_id="blk-1",
        rule_type="weekly_load_cap",
        threshold_value=40.0,
        window_days=7,
        activity_class_id="cls-foot-load",
        activity_id="act-walk",
    )

    response = await client.delete("/api/activity-classes/cls-foot-load")

    assert response.status_code == 204
    assert response.content == b""

    classes_response = await client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    assert classes_response.json() == []

    activities_response = await client.get("/api/activities")
    assert activities_response.status_code == 200
    assert activities_response.json() == []

    rules_response = await client.get("/api/training-blocks/blk-1/rules")
    assert rules_response.status_code == 200
    assert rules_response.json() == []


async def test_delete_activity_cascades_exercise_scoped_rules(
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
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot-load",
        name="Walk",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-walk-cap",
        training_block_id="blk-1",
        rule_type="weekly_load_cap",
        threshold_value=40.0,
        window_days=7,
        activity_class_id="cls-foot-load",
        activity_id="act-walk",
    )

    for session in with_session(app_with_test_database):
        activity = session.get(Activity, "act-walk")
        assert activity is not None
        session.delete(activity)
        session.commit()

    rules_response = await client.get("/api/training-blocks/blk-1/rules")
    assert rules_response.status_code == 200
    assert rules_response.json() == []


async def test_delete_activity_class_with_weekly_target_ref_returns_conflict_preserves_rows(
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
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    seed_weekly_target(
        app_with_test_database,
        target_id="wt-foot-load",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.delete("/api/activity-classes/cls-foot-load")

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Cannot delete activity class while weekly targets reference it",
    }

    classes_response = await client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    assert len(classes_response.json()) == 1
    assert classes_response.json()[0]["id"] == "cls-foot-load"

    targets_response = await client.get("/api/training-blocks/blk-1/weekly-targets")
    assert targets_response.status_code == 200
    assert len(targets_response.json()) == 1
    assert targets_response.json()[0]["id"] == "wt-foot-load"
