from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_rule,
    seed_training_block,
)


def _assert_rule_payload(
    payload: dict[str, Any],
    *,
    rule_id: str,
    training_block_id: str,
    rule_type: str,
    threshold_value: float,
    window_days: int,
    activity_class_id: str | None = None,
    enabled: bool = True,
) -> None:
    assert payload["id"] == rule_id
    assert payload["training_block_id"] == training_block_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["rule_type"] == rule_type
    assert payload["threshold_value"] == threshold_value
    assert payload["window_days"] == window_days
    assert payload["enabled"] is enabled
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])


def _seed_rule_graph(app_with_test_database: FastAPI) -> None:
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


def _seed_exercise_rule_graph(app_with_test_database: FastAPI) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_activity_class(
        app_with_test_database,
        class_id="cls-upper",
        name="Upper Body",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot-load",
        name="Morning Walk",
        default_volume_unit="km",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-bands",
        activity_class_id="cls-upper",
        name="Resistance Bands",
        default_volume_unit="sets",
    )


async def test_list_rules_returns_empty_list(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Empty Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_rules_returns_rules_ordered_by_rule_type_then_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Ordered Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-z",
        training_block_id="blk-1",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-a",
        training_block_id="blk-1",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-b",
        training_block_id="blk-1",
        rule_type="frequency_limit",
        threshold_value=2.0,
        window_days=7,
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert [rule["id"] for rule in response.json()] == [
        "rule-a",
        "rule-b",
        "rule-z",
    ]


async def test_list_rules_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/rules")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize("parent_status", ["completed", "archived"])
async def test_list_rules_remains_readable_when_parent_block_is_not_active(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    parent_status: str,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Inactive Parent",
        start_date=date(2026, 4, 7),
        status=parent_status,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "rule-1"


async def test_create_class_scoped_rule_returns_created_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-rest",
            "activity_class_id": "cls-foot-load",
            "rule_type": "rest_between_class",
            "threshold_value": 2.0,
            "window_days": 7,
            "enabled": False,
        },
    )

    assert response.status_code == 201
    _assert_rule_payload(
        response.json(),
        rule_id="rule-rest",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
        enabled=False,
    )


async def test_create_cross_class_rule_rejects_null_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Cross-Class Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-cross",
            "activity_class_id": None,
            "rule_type": "weekly_activity_count",
            "threshold_value": 4.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "activity_class_id is required"}


async def test_create_rule_rejects_weekly_activity_count_with_clear_message(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-deprecated",
            "activity_class_id": "cls-foot-load",
            "rule_type": "weekly_activity_count",
            "threshold_value": 4.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "weekly_activity_count rules are deprecated",
    }


async def test_create_rule_rejects_null_activity_class_id_for_class_scoped_rule(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-no-class",
            "activity_class_id": None,
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "activity_class_id is required"}


async def test_create_exercise_rule_rejects_activity_id_without_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_exercise_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-orphan-exercise",
            "activity_class_id": None,
            "activity_id": "act-walk",
            "rule_type": "frequency_limit",
            "threshold_value": 2.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "activity_class_id is required"}


async def test_create_exercise_rule_rejects_activity_not_in_activity_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_exercise_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-wrong-class",
            "activity_class_id": "cls-foot-load",
            "activity_id": "act-bands",
            "rule_type": "frequency_limit",
            "threshold_value": 2.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Activity does not belong to activity class",
    }


async def test_create_rule_defaults_enabled_to_true(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-enabled-default",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 201
    assert response.json()["enabled"] is True


async def test_create_rule_rejects_training_block_id_and_timestamps_in_body(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-invalid",
            "training_block_id": "other-block",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
        },
    )

    assert response.status_code == 422


async def test_create_rule_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks/missing-block/rules",
        json={
            "id": "rule-orphan",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_create_rule_validates_activity_class_id_when_supplied(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    valid_response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-valid-class",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["activity_class_id"] == "cls-foot-load"

    invalid_response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-missing-class",
            "activity_class_id": "missing-class",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_create_rule_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-1",
            "activity_class_id": "cls-foot-load",
            "rule_type": "weekly_load_cap",
            "threshold_value": 100.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Rule already exists"}


@pytest.mark.parametrize(
    "missing_field",
    ["threshold_value", "window_days"],
)
async def test_create_rule_rejects_missing_required_numeric_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    missing_field: str,
) -> None:
    _seed_rule_graph(app_with_test_database)

    payload: dict[str, object] = {
        "id": "rule-incomplete",
        "activity_class_id": "cls-foot-load",
        "rule_type": "frequency_limit",
        "threshold_value": 3.0,
        "window_days": 7,
    }
    del payload[missing_field]

    response = await client.post("/api/training-blocks/blk-1/rules", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "rule_type",
    [
        "rest_between_class",
        "frequency_limit",
        "consecutive_day_limit",
    ],
)
async def test_create_rule_accepts_known_rule_type_strings(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    rule_type: str,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": f"rule-{rule_type}",
            "activity_class_id": "cls-foot-load",
            "rule_type": rule_type,
            "threshold_value": 1.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 201
    assert response.json()["rule_type"] == rule_type


async def test_patch_rule_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
        enabled=True,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={
            "threshold_value": 4.0,
            "enabled": False,
        },
    )

    assert response.status_code == 200
    _assert_rule_payload(
        response.json(),
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=4.0,
        window_days=7,
        enabled=False,
    )


async def test_patch_rule_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch("/api/rules/rule-1", json={})

    assert response.status_code == 200
    _assert_rule_payload(
        response.json(),
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )


async def test_patch_rule_rejects_activity_class_id_clear_on_class_scoped_rule(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": None},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "activity_class_id is required"}


async def test_patch_rule_rejects_rule_type_change_to_weekly_activity_count(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={"rule_type": "weekly_activity_count"},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "weekly_activity_count rules are deprecated",
    }


async def test_patch_rule_updates_threshold_value_and_window_days_independently(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    threshold_response = await client.patch(
        "/api/rules/rule-1",
        json={"threshold_value": 5.0},
    )
    assert threshold_response.status_code == 200
    assert threshold_response.json()["threshold_value"] == 5.0
    assert threshold_response.json()["window_days"] == 7

    window_response = await client.patch(
        "/api/rules/rule-1",
        json={"window_days": 14},
    )
    assert window_response.status_code == 200
    assert window_response.json()["threshold_value"] == 5.0
    assert window_response.json()["window_days"] == 14


async def test_patch_rule_validates_activity_class_id_when_changed(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    valid_response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": "cls-recovery"},
    )
    assert valid_response.status_code == 200
    assert valid_response.json()["activity_class_id"] == "cls-recovery"

    invalid_response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": "missing-class"},
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_patch_missing_rule_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/rules/missing-rule",
        json={"enabled": False},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Rule not found"}


async def test_delete_rule_returns_no_content_and_removes_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.delete("/api/rules/rule-1")

    assert response.status_code == 204
    assert response.content == b""

    list_response = await client.get("/api/training-blocks/blk-1/rules")
    assert list_response.status_code == 200
    assert list_response.json() == []


async def test_delete_missing_rule_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.delete("/api/rules/missing-rule")

    assert response.status_code == 404
    assert response.json() == {"detail": "Rule not found"}


@pytest.mark.parametrize("invalid_rule_type", ["REST_BETWEEN", "banana", "rest_between"])
async def test_create_rule_rejects_invalid_rule_type(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_rule_type: str,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": f"rule-invalid-{invalid_rule_type.lower()}",
            "activity_class_id": "cls-foot-load",
            "rule_type": invalid_rule_type,
            "threshold_value": 2.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("rule_type", {"rule_type": None}),
        ("threshold_value", {"threshold_value": None}),
        ("window_days", {"window_days": None}),
    ],
)
async def test_patch_rule_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    _seed_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch("/api/rules/rule-1", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/training-blocks/blk-1/rules")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_rule_payload(
        list_response.json()[0],
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )


async def test_patch_rule_accepts_activity_id_and_limit_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_exercise_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={
            "activity_id": "act-walk",
            "limit_unit": "sessions",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["activity_id"] == "act-walk"
    assert payload["limit_unit"] == "sessions"


async def test_patch_rule_rejects_activity_not_in_activity_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_exercise_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_id": "act-bands"},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Activity does not belong to activity class",
    }


async def test_patch_legacy_cross_class_rule_allows_idempotent_update(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Legacy Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-legacy-cross",
        training_block_id="blk-1",
        activity_class_id=None,
        rule_type="weekly_activity_count",
        threshold_value=4.0,
        window_days=7,
        enabled=False,
    )

    response = await client.patch(
        "/api/rules/rule-legacy-cross",
        json={"threshold_value": 5.0},
    )

    assert response.status_code == 200
    assert response.json()["threshold_value"] == 5.0
    assert response.json()["enabled"] is False


async def test_patch_legacy_cross_class_rule_rejects_re_enable(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Legacy Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-legacy-cross",
        training_block_id="blk-1",
        activity_class_id=None,
        rule_type="weekly_activity_count",
        threshold_value=4.0,
        window_days=7,
        enabled=False,
    )

    response = await client.patch(
        "/api/rules/rule-legacy-cross",
        json={"enabled": True},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Cannot enable deprecated weekly_activity_count rule",
    }
