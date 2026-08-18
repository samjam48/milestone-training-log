"""GET /api/dashboard combined load-series and null graph_class_id contract."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_engine_fixtures import AS_OF, BLOCK_START
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_rule,
    seed_training_block,
)

DASHBOARD_URL = "/api/dashboard"
GRAPH_WINDOW_DAYS = 30


def _seed_two_performance_classes_with_foot_cap(
    app_with_test_database: FastAPI,
    *,
    include_weekly_load_cap: bool,
) -> None:
    """cls-arm sorts before cls-foot; optional weekly_load_cap applies only to foot."""
    seed_activity_class(
        app_with_test_database,
        class_id="cls-arm",
        name="Arm Load",
        class_type="performance",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot",
        name="Foot Load",
        class_type="performance",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-arm",
        activity_class_id="cls-arm",
        name="Arm work",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-foot",
        name="Walk",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-graph",
        name="Graph class block",
        start_date=date.fromisoformat(BLOCK_START),
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-rest-foot",
        training_block_id="blk-graph",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=3,
        activity_class_id="cls-foot",
        enabled=True,
    )
    if include_weekly_load_cap:
        seed_rule(
            app_with_test_database,
            rule_id="rule-cap-foot",
            training_block_id="blk-graph",
            rule_type="weekly_load_cap",
            threshold_value=90.0,
            window_days=7,
            activity_class_id="cls-foot",
            enabled=True,
        )


def _as_of_point(payload: dict[str, Any]) -> dict[str, Any]:
    series = payload["load_series"]
    assert isinstance(series, list)
    return next(point for point in series if point["date"] == AS_OF)


async def test_get_dashboard_graph_class_id_is_null_when_weekly_load_cap_targets_later_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Combined graph: weekly_load_cap no longer selects graph_class_id."""
    _seed_two_performance_classes_with_foot_cap(
        app_with_test_database,
        include_weekly_load_cap=True,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-arm-as-of",
        activity_id="act-arm",
        logged_date=date.fromisoformat(AS_OF),
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )
    first_performance_by_sort = sorted(["cls-arm", "cls-foot"])[0]
    assert first_performance_by_sort == "cls-arm"

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["load_series"]) == GRAPH_WINDOW_DAYS
    # Arm log must contribute even though the former graph class was foot (cap).
    assert _as_of_point(payload)["daily_load"] == pytest.approx(1.5)
    assert payload["graph_class_id"] is None
    assert payload["week_load_threshold"] is None


async def test_get_dashboard_graph_class_id_is_null_without_weekly_load_cap(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Combined graph: graph_class_id stays null instead of first performance class."""
    _seed_two_performance_classes_with_foot_cap(
        app_with_test_database,
        include_weekly_load_cap=False,
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] is None
    assert len(payload["load_series"]) == GRAPH_WINDOW_DAYS
    assert payload["week_load_threshold"] is None


async def test_get_dashboard_graph_class_id_is_null_on_auto_created_weekly_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Auto-created weekly focus still returns a 30-day series with null graph_class_id."""
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
        block_id="blk-completed",
        name="Completed",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 1),
        status="completed",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-cap-completed",
        training_block_id="blk-completed",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
        activity_class_id="cls-foot",
        enabled=True,
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"] is not None
    assert payload["block"]["period_kind"] == "weekly_focus"
    assert payload["graph_class_id"] is None
    assert len(payload["load_series"]) == GRAPH_WINDOW_DAYS
    expected_start = date.fromisoformat(AS_OF) - timedelta(days=GRAPH_WINDOW_DAYS - 1)
    assert payload["load_series"][0]["date"] == expected_start.isoformat()
    assert payload["load_series"][-1]["date"] == AS_OF


async def test_get_dashboard_seeded_mock_graph_class_id_is_null_for_combined_series(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Mock graph still returns a series; graph_class_id is null; classes expose load_weight."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] is None
    assert payload["week_load_threshold"] is None
    assert len(payload["load_series"]) == GRAPH_WINDOW_DAYS
    assert payload["activity_classes"]
    for activity_class in payload["activity_classes"]:
        assert "load_weight" in activity_class
        assert activity_class["load_weight"] == pytest.approx(1.0)


async def test_get_dashboard_recovery_only_logs_return_all_zero_combined_series(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Recovery logs do not contribute; series is 30 all-zero points, graph_class_id null."""
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery-only",
        name="Recovery Only",
        class_type="recovery",
        load_weight=10.0,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-stretch-only",
        activity_class_id="cls-recovery-only",
        name="Stretch",
        activity_type="recovery",
        default_volume_unit="minutes",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-stretch-only",
        activity_id="act-stretch-only",
        logged_date=date.fromisoformat(AS_OF),
        duration_minutes=40,
        volume_value=40.0,
        volume_unit="minutes",
        rpe=10,
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] is None
    assert len(payload["load_series"]) == GRAPH_WINDOW_DAYS
    assert all(point["daily_load"] == pytest.approx(0.0) for point in payload["load_series"])
    assert all(point["load"] == pytest.approx(0.0) for point in payload["load_series"])
