"""P25.7 — Exercise-only volume caps with units (API tests).

plans/tickets-stage-2-5-polish-followup-2026-06-06.md
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.seed import seed_rule
from app.tests.test_rules_api import _seed_exercise_rule_graph, _seed_rule_graph


def _assert_volume_cap_payload(
    payload: dict[str, Any],
    *,
    rule_id: str,
    rule_type: str,
    limit_unit: str,
    activity_id: str,
    activity_class_id: str = "cls-foot-load",
    threshold_value: float = 10.0,
    window_days: int = 7,
) -> None:
    assert payload["id"] == rule_id
    assert payload["rule_type"] == rule_type
    assert payload["activity_id"] == activity_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["limit_unit"] == limit_unit
    assert payload["threshold_value"] == threshold_value
    assert payload["window_days"] == window_days
    assert payload["enabled"] is True


async def test_create_exercise_weekly_volume_cap_persists_limit_unit_km(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """POST exercise weekly_volume_cap stores limit_unit for km caps."""
    _seed_exercise_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-walk-weekly-km",
            "activity_class_id": "cls-foot-load",
            "activity_id": "act-walk",
            "rule_type": "weekly_volume_cap",
            "threshold_value": 12.0,
            "window_days": 7,
            "limit_unit": "km",
        },
    )

    assert response.status_code == 201
    _assert_volume_cap_payload(
        response.json(),
        rule_id="rule-walk-weekly-km",
        rule_type="weekly_volume_cap",
        limit_unit="km",
        activity_id="act-walk",
        threshold_value=12.0,
    )


async def test_create_exercise_daily_volume_cap_persists_limit_unit_hours(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """POST exercise daily_volume_cap stores limit_unit for hours caps."""
    _seed_exercise_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-walk-daily-hours",
            "activity_class_id": "cls-foot-load",
            "activity_id": "act-walk",
            "rule_type": "daily_volume_cap",
            "threshold_value": 2.0,
            "window_days": 1,
            "limit_unit": "hours",
        },
    )

    assert response.status_code == 201
    _assert_volume_cap_payload(
        response.json(),
        rule_id="rule-walk-daily-hours",
        rule_type="daily_volume_cap",
        limit_unit="hours",
        activity_id="act-walk",
        threshold_value=2.0,
        window_days=1,
    )


async def test_patch_exercise_volume_cap_updates_limit_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """PATCH can change limit_unit on an exercise volume-cap rule."""
    _seed_exercise_rule_graph(app_with_test_database)
    seed_rule(
        app_with_test_database,
        rule_id="rule-walk-cap",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        activity_id="act-walk",
        rule_type="weekly_volume_cap",
        threshold_value=10.0,
        window_days=7,
        limit_unit="km",
    )

    response = await client.patch(
        "/api/rules/rule-walk-cap",
        json={"limit_unit": "minutes"},
    )

    assert response.status_code == 200
    assert response.json()["limit_unit"] == "minutes"


async def test_create_rule_rejects_weekly_load_cap_with_clear_message(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """New weekly_load_cap creates are deprecated (align with S25.B2 pattern)."""
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-deprecated-load",
            "activity_class_id": "cls-foot-load",
            "rule_type": "weekly_load_cap",
            "threshold_value": 100.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "weekly_load_cap rules are deprecated"}


async def test_create_rule_rejects_class_level_volume_cap_without_exercise(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Volume caps are exercise-only — class-level creates are rejected."""
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-class-volume",
            "activity_class_id": "cls-foot-load",
            "rule_type": "weekly_volume_cap",
            "threshold_value": 20.0,
            "window_days": 7,
            "limit_unit": "km",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Volume caps require activity_id (exercise-scoped only)",
    }


@pytest.mark.parametrize("limit_unit", ["km", "minutes", "hours"])
async def test_create_exercise_volume_cap_requires_limit_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    limit_unit: str,
) -> None:
    """Exercise volume-cap creates require limit_unit."""
    _seed_exercise_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": f"rule-missing-unit-{limit_unit}",
            "activity_class_id": "cls-foot-load",
            "activity_id": "act-walk",
            "rule_type": "weekly_volume_cap",
            "threshold_value": 10.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "limit_unit is required for volume-cap rules"}
