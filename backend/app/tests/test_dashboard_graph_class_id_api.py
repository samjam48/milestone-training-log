"""B10.2 — GET /api/dashboard top-level graph_class_id integration tests."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_dashboard_mock_graph
from app.tests.helpers.load_engine_fixtures import AS_OF, BLOCK_START
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_rule,
    seed_training_block,
)

DASHBOARD_URL = "/api/dashboard"


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


async def test_get_dashboard_graph_class_id_weekly_load_cap_on_foot_not_first_performance_sort(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Enabled weekly_load_cap on foot drives graph_class_id, not first performance class by ID."""
    _seed_two_performance_classes_with_foot_cap(
        app_with_test_database,
        include_weekly_load_cap=True,
    )
    first_performance_by_sort = sorted(["cls-arm", "cls-foot"])[0]
    assert first_performance_by_sort == "cls-arm"

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] == "cls-foot"
    assert payload["graph_class_id"] != first_performance_by_sort
    assert payload["week_load_threshold"] is None


async def test_get_dashboard_graph_class_id_falls_back_to_first_performance_class_without_cap(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """With no weekly_load_cap rules, graph_class_id is the first performance class by ID sort."""
    _seed_two_performance_classes_with_foot_cap(
        app_with_test_database,
        include_weekly_load_cap=False,
    )
    expected = sorted(["cls-arm", "cls-foot"])[0]

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] == expected
    assert payload["graph_class_id"] == "cls-arm"
    assert payload["week_load_threshold"] is None


async def test_get_dashboard_graph_class_id_null_without_weekly_load_cap_on_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Auto-created weekly rules without weekly_load_cap → graph_class_id null."""
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
    seed_rule(
        app_with_test_database,
        rule_id="rule-cap-orphan",
        training_block_id="blk-completed",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
        activity_class_id="cls-foot",
        enabled=True,
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-completed",
        name="Completed",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 1),
        status="completed",
    )

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"] is not None
    assert payload["block"]["period_kind"] == "weekly_focus"
    assert payload["graph_class_id"] == "cls-foot"
    assert payload["load_series"]


async def test_get_dashboard_seeded_mock_graph_class_id_matches_load_series_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Mock graph has foot weekly_load_cap; graph_class_id matches that class and threshold."""
    seed_dashboard_mock_graph(app_with_test_database)

    response = await client.get(DASHBOARD_URL, params={"as_of": AS_OF})

    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_class_id"] == "cls-foot"
    assert payload["week_load_threshold"] is None
    assert payload["load_series"]
