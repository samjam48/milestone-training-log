"""B10.4 — GET /api/training-blocks/{id}/scores removed; use /review instead.

These tests fail until the /scores route, block_scores service, and schema are removed.
Review endpoint coverage lives in test_training_blocks_api.py.
"""

from __future__ import annotations

import datetime

from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_daily_check_in
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_training_block,
)

BLOCK_ID = "blk-scores-removed"
SCORES_URL = f"/api/training-blocks/{BLOCK_ID}/scores"
REVIEW_URL = f"/api/training-blocks/{BLOCK_ID}/review"


def _seed_block_with_data(app_with_test_database: FastAPI) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-scores",
        name="Foot Load",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-scores",
        activity_class_id="cls-foot-scores",
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
    )
    seed_training_block(
        app_with_test_database,
        block_id=BLOCK_ID,
        name="Block Scores Removal Test",
        start_date=datetime.date(2026, 4, 7),
        end_date=datetime.date(2026, 5, 25),
        status="active",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-scores-01",
        activity_id="act-walk-scores",
        logged_date=datetime.date(2026, 4, 8),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-scores-01",
        check_in_date=datetime.date(2026, 4, 8),
        pain_level=2,
        has_flare_up=False,
    )


async def test_block_scores_route_removed_returns_404(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Legacy /scores must be removed — FastAPI route-not-found, not domain 404."""
    _seed_block_with_data(app_with_test_database)

    response = await client.get(SCORES_URL)

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


async def test_block_scores_route_removed_for_missing_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/blk-does-not-exist/scores")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


async def test_review_supplies_daily_scores_after_scores_removal(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Migrated from B3.0 scores tests — same seeded block via /review daily_scores."""
    _seed_block_with_data(app_with_test_database)

    response = await client.get(REVIEW_URL)

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"]["id"] == BLOCK_ID
    assert isinstance(payload["daily_scores"], list)
    assert len(payload["daily_scores"]) > 0

    states = [score["state"] for score in payload["daily_scores"]]
    assert "safe" in states

    apr_8_scores = [s for s in payload["daily_scores"] if s["date"] == "2026-04-08"]
    assert len(apr_8_scores) == 1
    assert apr_8_scores[0]["state"] == "safe"
    assert apr_8_scores[0]["violations"] == []
    assert apr_8_scores[0]["had_flare_up"] is False
