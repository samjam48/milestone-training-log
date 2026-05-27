"""API integration tests for load summary and check-violations routes (B4.2)."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI
from httpx import AsyncClient

from app.services.load_engine import compute_weekly_progress
from app.tests.helpers.load_api_seed import seed_load_mock_graph
from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    BLOCK_START,
    LOGS,
    WEEKLY_TARGETS,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
)

SUMMARY_URL = "/api/load/summary"
CHECK_VIOLATIONS_URL = "/api/load/check-violations"


def _foot_status(payload: dict[str, Any]) -> dict[str, Any]:
    return next(
        s for s in payload["class_statuses"] if s["activity_class_id"] == "cls-foot"
    )


def _expected_weekly_progress() -> list[Any]:
    return compute_weekly_progress(
        WEEKLY_TARGETS,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        LOGS,
        BLOCK_START,
        AS_OF,
    )


async def test_get_load_summary_returns_404_until_router_exists(
    client: AsyncClient,
) -> None:
    response = await client.get(SUMMARY_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"]
    assert payload["class_statuses"] == []
    assert payload["suggestions"] == []
    assert payload["weekly_progress"] == []


async def test_get_load_summary_with_mock_seed_asserts_cls_foot_caution(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)

    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert "class_statuses" in payload
    assert "suggestions" in payload
    assert "weekly_progress" in payload

    foot = _foot_status(payload)
    assert foot["state"] == "caution"
    assert foot["last_done_date"] == "2026-05-22"
    assert "rest" in foot["reason"].lower()


async def test_get_load_summary_response_uses_snake_case_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)

    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) >= {"as_of", "class_statuses", "suggestions", "weekly_progress"}

    foot = _foot_status(payload)
    assert "activity_class_id" in foot
    assert "state" in foot
    assert "reason" in foot

    assert payload["suggestions"]
    suggestion = payload["suggestions"][0]
    assert "id" in suggestion
    assert "state" in suggestion

    assert payload["weekly_progress"]
    progress = payload["weekly_progress"][0]
    assert set(progress.keys()) >= {
        "weekly_target_id",
        "activity_class_id",
        "class_name",
        "value",
        "target",
        "unit",
        "state",
    }


async def test_get_load_summary_weekly_progress_uses_active_block_start_through_as_of(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)

    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    assert response.json()["weekly_progress"] == _expected_weekly_progress()


async def test_get_load_summary_without_active_block_returns_neutral_payload(
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
    )

    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert payload["weekly_progress"] == []
    foot = _foot_status(payload)
    assert foot["state"] == "safe"
    assert payload["suggestions"]


async def test_get_load_summary_empty_database_returns_safe_defaults(
    client: AsyncClient,
) -> None:
    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert payload["class_statuses"] == []
    assert payload["suggestions"] == []
    assert payload["weekly_progress"] == []


async def test_get_load_summary_rejects_invalid_as_of_query(
    client: AsyncClient,
) -> None:
    response = await client.get(SUMMARY_URL, params={"as_of": "not-a-date"})

    assert response.status_code == 422


async def test_get_load_summary_excludes_logs_after_as_of(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-future",
        activity_id="act-walk",
        logged_date=date(2026, 5, 26),
        volume_value=99.0,
        rpe=10,
    )

    response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    foot = _foot_status(response.json())
    assert foot["last_done_date"] == "2026-05-22"


async def test_post_check_violations_returns_404_until_router_exists(
    client: AsyncClient,
) -> None:
    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={"activity_id": "act-walk", "volume_value": 1.5, "rpe": 3},
    )

    assert response.status_code == 200
    assert response.json() == {"violations": []}


async def test_post_check_violations_flags_rest_between_class_and_frequency_limit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)
    seed_activity_log(
        app_with_test_database,
        log_id="log-freq-window",
        activity_id="act-bike",
        logged_date=date(2026, 5, 20),
        volume_value=10.0,
        rpe=3,
    )

    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={
            "activity_id": "act-walk",
            "volume_value": 1.5,
            "rpe": 3,
            "as_of": AS_OF,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"violations"}
    rule_types = {v["rule_type"] for v in payload["violations"]}
    assert "rest_between_class" in rule_types
    assert "frequency_limit" in rule_types

    for violation in payload["violations"]:
        assert set(violation.keys()) >= {"rule_id", "rule_type", "message", "severity"}
        assert violation["severity"] in {"caution", "danger"}


async def test_post_check_violations_without_active_block_returns_empty_violations(
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
    )

    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={
            "activity_id": "act-walk",
            "volume_value": 50.0,
            "rpe": 10,
            "as_of": AS_OF,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"violations": []}


async def test_post_check_violations_unknown_activity_returns_empty_violations(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)

    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={
            "activity_id": "act-missing",
            "volume_value": 1.0,
            "rpe": 5,
            "as_of": AS_OF,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"violations": []}


async def test_post_check_violations_rejects_invalid_as_of_in_body(
    client: AsyncClient,
) -> None:
    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={
            "activity_id": "act-walk",
            "volume_value": 1.0,
            "rpe": 5,
            "as_of": "05/25/2026",
        },
    )

    assert response.status_code == 422


async def test_post_check_violations_is_dry_run_and_does_not_persist_logs(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_load_mock_graph(app_with_test_database)

    list_before = await client.get("/api/activity-logs")
    assert list_before.status_code == 200
    before_count = len(list_before.json())

    response = await client.post(
        CHECK_VIOLATIONS_URL,
        json={
            "activity_id": "act-walk",
            "volume_value": 99.0,
            "rpe": 10,
            "as_of": AS_OF,
        },
    )

    assert response.status_code == 200
    assert response.json()["violations"]

    list_after = await client.get("/api/activity-logs")
    assert list_after.status_code == 200
    assert len(list_after.json()) == before_count
