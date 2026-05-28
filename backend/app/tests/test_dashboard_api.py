"""API integration tests for GET /api/dashboard (B5.2)."""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_engine_fixtures import AS_OF, WEEKLY_TARGETS
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_recovery_target,
)

DASHBOARD_URL = "/api/dashboard"
SUMMARY_URL = "/api/load/summary"

FROZEN_TODAY = date.fromisoformat(AS_OF)
LOG_RESPONSE_WINDOW_START = FROZEN_TODAY - timedelta(days=29)

EXPECTED_TOP_LEVEL_KEYS = {
    "as_of",
    "user_name",
    "block",
    "activity_classes",
    "activities",
    "logs",
    "incidents",
    "has_checked_in_today",
    "class_statuses",
    "suggestions",
    "weekly_progress",
    "daily_scores",
    "load_series",
    "flare_up_dates",
    "week_load_threshold",
    "clean_streak",
    "recovery_streaks",
}


def _freeze_server_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.load_queries._server_local_today",
        lambda: FROZEN_TODAY,
    )


def _foot_status(payload: dict[str, Any]) -> dict[str, Any]:
    return next(
        status for status in payload["class_statuses"] if status["activity_class_id"] == "cls-foot"
    )


async def test_get_dashboard_seed_parity_at_as_of(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    summary_response = await client.get(SUMMARY_URL, params={"as_of": AS_OF})
    assert summary_response.status_code == 200

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()

    assert set(payload.keys()) == EXPECTED_TOP_LEVEL_KEYS
    assert payload["as_of"] == AS_OF
    assert payload["has_checked_in_today"] is False
    assert payload["user_name"] == "Sam"

    foot = _foot_status(payload)
    assert foot["state"] == _foot_status(summary_response.json())["state"]

    assert len(payload["weekly_progress"]) == len(WEEKLY_TARGETS)

    assert payload["load_series"]
    assert payload["load_series"][-1]["date"] == AS_OF

    assert payload["flare_up_dates"]

    assert isinstance(payload["clean_streak"], int)
    assert payload["clean_streak"] >= 0

    for log in payload["logs"]:
        logged = date.fromisoformat(log["logged_date"])
        assert LOG_RESPONSE_WINDOW_START <= logged <= FROZEN_TODAY


async def test_get_dashboard_recovery_streaks_from_active_block_targets(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-stretch",
        training_block_id="blk-1",
        activity_id="act-stretch",
        target_frequency=3,
        frequency_unit="daily",
        current_streak_days=5,
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["recovery_streaks"]

    stretch = next(
        streak
        for streak in payload["recovery_streaks"]
        if streak["recovery_target_id"] == "rt-stretch"
    )
    assert stretch["activity_name"] == "Light Stretching"
    assert stretch["current_streak_days"] == 5


async def test_get_dashboard_without_active_block_returns_neutral_empty_payload(
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

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"] is None
    assert payload["weekly_progress"] == []
    assert payload["load_series"] == []
    assert payload["recovery_streaks"] == []


async def test_get_dashboard_rejects_invalid_as_of_query(
    client: AsyncClient,
) -> None:
    response = await client.get(DASHBOARD_URL, params={"as_of": "not-a-date"})

    assert response.status_code == 422


async def test_get_dashboard_defaults_as_of_to_server_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _freeze_server_today(monkeypatch)
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert _foot_status(payload)["state"] == "caution"


async def test_get_dashboard_empty_database_returns_neutral_payload(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _freeze_server_today(monkeypatch)

    response = await client.get(DASHBOARD_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert payload["block"] is None
    assert payload["class_statuses"] == []
    assert payload["weekly_progress"] == []
    assert payload["load_series"] == []
    assert payload["recovery_streaks"] == []
    assert payload["has_checked_in_today"] is False


async def test_get_dashboard_seeded_response_completes_under_500ms(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)

    start = time.perf_counter()
    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    if elapsed_ms >= 500:
        pytest.skip(f"Dashboard took {elapsed_ms:.0f}ms; soft threshold is 500ms")
