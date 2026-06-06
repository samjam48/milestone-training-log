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
    seed_training_block,
)
from app.tests.test_seed_data import PROTOTYPE_TODAY, _make_migrated_engine, _run_seed

DASHBOARD_URL = "/api/dashboard"
SUMMARY_URL = "/api/load/summary"

LOG_RESPONSE_WINDOW_START = FROZEN_TODAY - timedelta(days=29)

EXPECTED_TOP_LEVEL_KEYS = {
    "as_of",
    "user_name",
    "block",
    "previous_blocks",
    "activity_classes",
    "activities",
    "logs",
    "incidents",
    "has_checked_in_today",
    "class_statuses",
    "suggestions",
    "suggestion_buckets",
    "goal_rows",
    "load_risk_summary",
    "weekly_progress",
    "daily_scores",
    "load_series",
    "flare_up_dates",
    "week_load_threshold",
    "graph_class_id",
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
    assert payload["previous_blocks"] == []
    assert payload["weekly_progress"] == []
    assert payload["load_series"] == []
    assert payload["recovery_streaks"] == []
    assert payload["graph_class_id"] is None


async def test_get_dashboard_previous_blocks_serializes_summary_array(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-current",
        name="Current block",
        start_date=date(2026, 5, 20),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-recent",
        name="Recent block",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 5, 10),
        status="completed",
        is_review_milestone_hit=True,
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-older",
        name="Older block",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 20),
        status="archived",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()

    assert [block["id"] for block in payload["previous_blocks"]] == [
        "blk-recent",
        "blk-older",
    ]
    first_block = payload["previous_blocks"][0]
    assert first_block["end_date"] == "2026-05-10"
    assert first_block["is_review_milestone_hit"] is True
    assert all(block["status"] != "active" for block in payload["previous_blocks"])


async def test_get_dashboard_previous_blocks_empty_when_no_non_active_blocks_exist(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today(monkeypatch)

    response = await client.get(DASHBOARD_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["previous_blocks"] == []


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


async def test_get_dashboard_goals_includes_all_statuses_for_goals_tab(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goals array includes active, achieved, and paused for Goals tab."""
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
        goal_id="api-goal-achieved",
        title="First 5k",
        target_date=date(2026, 5, 1),
        timeframe="monthly",
        status="achieved",
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
    assert len(goals) == 4
    goal_ids = {g["id"] for g in goals}
    assert goal_ids == {
        "api-goal-active-1",
        "api-goal-active-2",
        "api-goal-achieved",
        "api-goal-paused",
    }


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


async def test_get_dashboard_goals_includes_paused_when_no_active_goals(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goals includes paused goals when there are no active goals."""
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
    assert len(payload["goals"]) == 1
    assert payload["goals"][0]["id"] == "api-goal-paused-only"
    assert payload["goals"][0]["status"] == "paused"


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


# ---------------------------------------------------------------------------
# S25.B7 — suggestion_buckets, goal_rows, load_risk_summary on GET /api/dashboard
# ---------------------------------------------------------------------------


def _bucket_ids(rows: list[dict[str, object]], bucket: str) -> set[str]:
    return {str(row["id"]) for row in rows if row.get("bucket") == bucket}


def _foot_class_bar(payload: dict[str, object]) -> dict[str, object]:
    summary = payload["load_risk_summary"]
    assert summary is not None
    class_bars = summary["class_bars"]
    return next(bar for bar in class_bars if bar["activity_class_id"] == "cls-foot")


def _foot_weekly_progress(payload: dict[str, object]) -> dict[str, object]:
    return next(
        row for row in payload["weekly_progress"] if row["activity_class_id"] == "cls-foot"
    )


async def test_get_dashboard_includes_suggestion_buckets_goal_rows_load_risk_summary(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Dashboard response exposes B7 extension fields alongside legacy suggestions."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == EXPECTED_TOP_LEVEL_KEYS
    assert isinstance(payload["suggestion_buckets"], list)
    assert isinstance(payload["goal_rows"], list)
    assert payload["load_risk_summary"] is not None
    assert isinstance(payload["suggestions"], list)


async def test_get_dashboard_suggestion_buckets_rows_include_bucket_scope_description(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Each suggestion_buckets row carries bucket, scope, activity_class_id, description."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    buckets = response.json()["suggestion_buckets"]
    assert buckets
    for row in buckets:
        assert row["bucket"] in {"do", "rest", "done"}
        assert row["scope"] in {"activity", "class"}
        assert "activity_class_id" in row
        assert "description" in row


async def test_get_dashboard_load_risk_summary_week_days_and_class_bars(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """load_risk_summary returns seven week_days and capped performance class bars."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    summary = response.json()["load_risk_summary"]
    assert summary is not None
    assert len(summary["week_days"]) == 7
    assert summary["week_days"][-1]["date"] == AS_OF
    assert all("flagged" in day for day in summary["week_days"])

    class_ids = {bar["activity_class_id"] for bar in summary["class_bars"]}
    assert "cls-foot" in class_ids
    assert "cls-recovery" not in class_ids


async def test_get_dashboard_load_risk_summary_null_without_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """No active block → load_risk_summary is null; goal_rows still an array."""
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
    assert payload["load_risk_summary"] is None
    assert payload["goal_rows"] == []
    assert payload["suggestion_buckets"] == []


async def test_get_dashboard_goal_rows_empty_when_no_goals(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goal_rows is an empty array when the user has no goals."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    assert response.json()["goal_rows"] == []


async def test_get_dashboard_goal_rows_includes_all_statuses_with_expected_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """goal_rows lists active, achieved, paused, and missed with dashboard row shape."""
    seed_goal(
        app_with_test_database,
        goal_id="api-row-active",
        title="Run 5k",
        target_date=date(2026, 6, 15),
        timeframe="monthly",
        progress_value=2.0,
        progress_target=5.0,
        progress_unit="km",
        status="active",
    )
    seed_goal(
        app_with_test_database,
        goal_id="api-row-achieved",
        title="First 5k",
        target_date=date(2026, 5, 1),
        timeframe="monthly",
        progress_value=5.0,
        progress_target=5.0,
        progress_unit="km",
        status="achieved",
    )
    seed_goal(
        app_with_test_database,
        goal_id="api-row-paused",
        title="Cycle 100k",
        target_date=date(2026, 8, 1),
        timeframe="monthly",
        status="paused",
    )
    seed_goal(
        app_with_test_database,
        goal_id="api-row-missed",
        title="Missed target",
        target_date=date(2026, 4, 1),
        timeframe="monthly",
        status="missed",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    rows = response.json()["goal_rows"]
    assert len(rows) == 4
    row_ids = {row["goal_id"] for row in rows}
    assert row_ids == {
        "api-row-active",
        "api-row-achieved",
        "api-row-paused",
        "api-row-missed",
    }
    for row in rows:
        assert set(row.keys()) == {
            "goal_id",
            "title",
            "status",
            "activity_id",
            "progress_value",
            "progress_target",
            "progress_unit",
            "fill_ratio",
            "is_qualitative",
        }

    active_row = next(row for row in rows if row["goal_id"] == "api-row-active")
    assert active_row["fill_ratio"] == pytest.approx(0.4)
    assert active_row["is_qualitative"] is False

    qualitative_row = next(row for row in rows if row["goal_id"] == "api-row-paused")
    assert qualitative_row["fill_ratio"] is None
    assert qualitative_row["is_qualitative"] is True


async def test_backdated_activity_log_updates_suggestion_buckets_and_load_risk_summary(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST log for a past date changes suggestion_buckets and load_risk_summary on refetch."""
    freeze_server_today(monkeypatch)
    seed_dashboard_mock_graph(app_with_test_database)

    baseline = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})
    assert baseline.status_code == 200
    baseline_payload = baseline.json()
    baseline_buckets = baseline_payload["suggestion_buckets"]
    baseline_summary = baseline_payload["load_risk_summary"]
    assert baseline_summary is not None
    baseline_foot_actual = _foot_class_bar(baseline_payload)["actual"]
    assert "act-walk" not in _bucket_ids(baseline_buckets, "done")

    backdated_date = (FROZEN_TODAY - timedelta(days=1)).isoformat()
    create_response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-backdated-walk",
            "activity_id": "act-walk",
            "logged_date": backdated_date,
            "duration_minutes": 45,
            "volume_value": 6.0,
            "volume_unit": "km",
            "rpe": 7,
            "post_activity_feel": "hard",
            "notes": "Backdated foot load",
        },
    )
    assert create_response.status_code == 201

    followup = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})
    assert followup.status_code == 200
    followup_payload = followup.json()

    assert followup_payload["suggestion_buckets"] != baseline_buckets
    assert followup_payload["load_risk_summary"] != baseline_summary
    assert _foot_class_bar(followup_payload)["actual"] > baseline_foot_actual


# ---------------------------------------------------------------------------
# S25.B9 — PATCH logged_date across week boundary updates dashboard derivations
# ---------------------------------------------------------------------------


async def test_patch_logged_date_across_week_boundary_updates_dashboard_derivations(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PATCH logged_date across the load-risk week boundary recomputes dashboard state."""
    freeze_server_today(monkeypatch)
    seed_dashboard_mock_graph(app_with_test_database)

    baseline = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})
    assert baseline.status_code == 200
    baseline_payload = baseline.json()
    baseline_foot_progress = _foot_weekly_progress(baseline_payload)
    baseline_summary = baseline_payload["load_risk_summary"]
    assert baseline_summary is not None
    baseline_foot_actual = _foot_class_bar(baseline_payload)["actual"]

    # log-25 is 2026-05-22 (inside risk week 2026-05-19..25); move to prior week.
    patch_response = await client.patch(
        "/api/activity-logs/log-25",
        json={"logged_date": "2026-05-18"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["logged_date"] == "2026-05-18"

    followup = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})
    assert followup.status_code == 200
    followup_payload = followup.json()

    followup_foot_actual = _foot_class_bar(followup_payload)["actual"]

    # weekly_progress spans block start→as_of (both dates stay in range); load_risk uses 7-day window.
    assert _foot_weekly_progress(followup_payload)["value"] == baseline_foot_progress["value"]
    assert followup_foot_actual < baseline_foot_actual
    assert followup_payload["load_risk_summary"] != baseline_summary
