"""API integration tests for GET /api/mcp/context (B10.3)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.services.training_blocks import calendar_week_bounds, calendar_week_label
from app.tests.helpers.load_api_seed import seed_daily_check_in, seed_dashboard_mock_graph
from app.tests.helpers.load_api_test_utils import FROZEN_TODAY, foot_status, freeze_server_today
from app.tests.helpers.load_engine_fixtures import AS_OF
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_training_block,
)

MCP_CONTEXT_URL = "/api/mcp/context"

EXPECTED_TOP_LEVEL_KEYS = frozenset(
    {
        "active_block",
        "recent_logs",
        "today_check_in",
        "class_statuses",
    }
)

ACTIVE_BLOCK_KEYS = frozenset(
    {
        "id",
        "name",
        "start_date",
        "end_date",
        "status",
        "is_review_milestone_hit",
    }
)

RECENT_LOG_KEYS = frozenset(
    {
        "activity_name",
        "load_score",
        "logged_date",
    }
)

TODAY_CHECK_IN_KEYS = frozenset(
    {
        "pain",
        "readiness",
        "stiffness",
        "has_flare_up",
    }
)

CLASS_STATUS_KEYS = frozenset(
    {
        "activity_class_id",
        "state",
        "reason",
    }
)

RECENT_LOG_WINDOW_START = FROZEN_TODAY - timedelta(days=6)


async def test_get_mcp_context_seeded_db_returns_200_with_all_required_keys(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    freeze_server_today(monkeypatch)

    response = await client.get(MCP_CONTEXT_URL)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == EXPECTED_TOP_LEVEL_KEYS

    active_block = payload["active_block"]
    assert active_block is not None
    assert set(active_block.keys()) == ACTIVE_BLOCK_KEYS
    assert active_block["id"] == "blk-1"
    week_start, week_end = calendar_week_bounds(date.fromisoformat(AS_OF))
    assert active_block["name"] == calendar_week_label(week_start, week_end)
    assert active_block["start_date"] == week_start.isoformat()
    assert active_block["status"] == "active"
    assert active_block["is_review_milestone_hit"] is False

    assert payload["today_check_in"] is None

    assert payload["class_statuses"]
    for status in payload["class_statuses"]:
        assert CLASS_STATUS_KEYS <= set(status.keys())

    foot = foot_status(payload)
    assert foot["state"] in {"safe", "caution", "danger"}

    assert payload["recent_logs"]
    for log in payload["recent_logs"]:
        assert RECENT_LOG_KEYS <= set(log.keys())
        logged = log["logged_date"]
        assert RECENT_LOG_WINDOW_START.isoformat() <= logged <= AS_OF

    walk_log = next(
        entry for entry in payload["recent_logs"] if entry["logged_date"] == "2026-05-22"
    )
    assert walk_log["activity_name"] == "Morning Walk"
    assert walk_log["load_score"] == 4.5


async def test_get_mcp_context_auto_creates_weekly_focus_when_no_block_exists(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
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
    freeze_server_today(monkeypatch)

    response = await client.get(MCP_CONTEXT_URL)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == EXPECTED_TOP_LEVEL_KEYS
    active_block = payload["active_block"]
    assert active_block is not None
    assert set(active_block.keys()) == ACTIVE_BLOCK_KEYS
    assert active_block["status"] == "active"
    assert active_block["is_review_milestone_hit"] is False
    assert payload["recent_logs"] == []
    assert payload["today_check_in"] is None
    assert payload["class_statuses"]
    foot = foot_status(payload)
    assert foot["state"] == "safe"


async def test_get_mcp_context_today_check_in_when_check_in_exists_for_server_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_dashboard_mock_graph(app_with_test_database)
    freeze_server_today(monkeypatch)
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-today",
        check_in_date=FROZEN_TODAY,
        pain_level=3,
        readiness_level=6,
        stiffness_level=4,
        has_flare_up=True,
    )

    response = await client.get(MCP_CONTEXT_URL)

    assert response.status_code == 200
    today = response.json()["today_check_in"]
    assert today is not None
    assert set(today.keys()) == TODAY_CHECK_IN_KEYS
    assert today == {
        "pain": 3,
        "readiness": 6,
        "stiffness": 4,
        "has_flare_up": True,
    }


async def test_get_mcp_context_recent_log_uses_default_rpe_five_for_load_score(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
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
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Block",
        start_date=FROZEN_TODAY - timedelta(days=30),
        status="active",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-no-rpe",
        activity_id="act-walk",
        logged_date=FROZEN_TODAY,
        volume_value=2.0,
        rpe=None,
    )
    freeze_server_today(monkeypatch)

    response = await client.get(MCP_CONTEXT_URL)

    assert response.status_code == 200
    logs = response.json()["recent_logs"]
    assert len(logs) == 1
    assert logs[0]["activity_name"] == "Walk"
    assert logs[0]["load_score"] == 10.0
