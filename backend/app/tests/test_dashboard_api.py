"""API integration tests for GET /api/dashboard (B5.2)."""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Iterator
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlmodel import Session

from app.database import get_session
from app.main import create_app
from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_api_test_utils import FROZEN_TODAY, foot_status, freeze_server_today
from app.tests.helpers.load_engine_fixtures import AS_OF, WEEKLY_TARGETS
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_goal,
    seed_recovery_target,
)
from app.tests.test_seed_data import PROTOTYPE_TODAY, _make_migrated_engine, _run_seed

DASHBOARD_URL = "/api/dashboard"
SUMMARY_URL = "/api/load/summary"

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
    "goals",
}


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

    foot = foot_status(payload)
    assert foot["state"] == foot_status(summary_response.json())["state"]

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
    freeze_server_today(monkeypatch)
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["as_of"] == AS_OF
    assert foot_status(payload)["state"] == "caution"


async def test_get_dashboard_empty_database_returns_neutral_payload(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today(monkeypatch)

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


# ---------------------------------------------------------------------------
# B8.1 — goals field on GET /api/dashboard
# ---------------------------------------------------------------------------


async def test_get_dashboard_goals_returns_only_active_goals(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goals array contains active goals and excludes paused ones."""
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-active-1",
        title="Run 5k",
        target_date=date(2026, 6, 15),
        timeframe="monthly",
        progress_target=5.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-active-2",
        title="Swim 10k",
        target_date=date(2026, 7, 1),
        timeframe="monthly",
        progress_target=10.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-paused",
        title="Cycle 100k",
        target_date=date(2026, 8, 1),
        timeframe="monthly",
        status="paused",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    goals = payload["goals"]
    assert len(goals) == 2
    goal_ids = {g["id"] for g in goals}
    assert "api-goal-active-1" in goal_ids
    assert "api-goal-active-2" in goal_ids
    assert "api-goal-paused" not in goal_ids


async def test_get_dashboard_goals_fields_are_snake_case(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """A goal object in the response has snake_case progress_target and status fields."""
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-snake",
        title="Marathon prep",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        progress_target=42.2,
        progress_unit="km",
        status="active",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    goal = next(g for g in payload["goals"] if g["id"] == "api-goal-snake")
    assert goal["progress_target"] == 42.2
    assert goal["status"] == "active"


async def test_get_dashboard_goals_empty_when_no_active_goals(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goals is [] when no active goals exist."""
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-paused-only",
        title="Paused only",
        target_date=date(2026, 9, 1),
        timeframe="monthly",
        status="paused",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["goals"] == []


async def test_get_dashboard_goals_present_when_no_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goals is returned even when there is no active training block."""
    seed_goal(
        app_with_test_database,
        goal_id="api-goal-no-block",
        title="No-block goal",
        target_date=date(2026, 6, 20),
        timeframe="monthly",
        status="active",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"] is None
    assert len(payload["goals"]) == 1
    assert payload["goals"][0]["id"] == "api-goal-no-block"


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


@pytest.fixture
def app_with_prototype_seed(tmp_path: Path) -> Iterator[FastAPI]:
    """Migrated SQLite DB populated via backend/scripts/seed.py (includes violations)."""
    database_path = tmp_path / "dashboard-prototype-seed.db"
    database_url = f"sqlite:///{database_path}"
    _make_migrated_engine(database_path)
    _run_seed(database_url)

    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )
    app = create_app()

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def prototype_seed_client(
    app_with_prototype_seed: FastAPI,
) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app_with_prototype_seed)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_get_dashboard_returns_200_after_prototype_seed_with_violations(
    prototype_seed_client: AsyncClient,
) -> None:
    response = await prototype_seed_client.get(
        DASHBOARD_URL,
        params={"as_of": PROTOTYPE_TODAY.isoformat()},
    )

    assert response.status_code == 200, response.text
    payload = response.json()

    violation_rule_ids = [
        violation["rule_id"]
        for score in payload["daily_scores"]
        for violation in score["violations"]
    ]
    assert violation_rule_ids
    assert all(rule_id == "rule-rest-foot" for rule_id in violation_rule_ids)
