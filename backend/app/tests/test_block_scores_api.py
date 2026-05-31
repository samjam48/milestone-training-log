"""Failing tests for GET /api/training-blocks/{id}/scores (B3.0).

The endpoint does not exist yet — all tests here are expected to FAIL
until the route, service, and schema are implemented.
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BLOCK_ID = "blk-scores-1"
BLOCK_START = datetime.date(2026, 4, 7)
BLOCK_END = datetime.date(2026, 5, 25)

SCORES_URL = f"/api/training-blocks/{BLOCK_ID}/scores"


# ---------------------------------------------------------------------------
# Seed helper — minimal graph with one activity log and one check-in
# ---------------------------------------------------------------------------


def _seed_block_with_data(app_with_test_database: FastAPI) -> None:
    """Seed one block, one activity class/activity, one log, one check-in."""
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
        name="Block Scores Test Block",
        start_date=BLOCK_START,
        end_date=BLOCK_END,
        status="active",
    )
    # A single light walk on 2026-04-08 — well within rest rules → "safe"
    seed_activity_log(
        app_with_test_database,
        log_id="log-scores-01",
        activity_id="act-walk-scores",
        logged_date=datetime.date(2026, 4, 8),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    # A check-in on the same date with no flare-up
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-scores-01",
        check_in_date=datetime.date(2026, 4, 8),
        pain_level=2,
        has_flare_up=False,
    )


# ---------------------------------------------------------------------------
# Test 1 — 200 with seeded data; scores list contains at least one "safe" day
# ---------------------------------------------------------------------------


async def test_block_scores_returns_200_with_seeded_data(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_block_with_data(app_with_test_database)

    response = await client.get(SCORES_URL)

    assert response.status_code == 200
    payload = response.json()

    # Top-level shape
    assert payload["block_id"] == BLOCK_ID
    assert payload["start_date"] == BLOCK_START.isoformat()
    assert payload["end_date"] == BLOCK_END.isoformat()
    assert isinstance(payload["scores"], list)
    assert len(payload["scores"]) > 0

    # Each score entry has the expected keys
    first_score = payload["scores"][0]
    assert "date" in first_score
    assert "state" in first_score
    assert "violations" in first_score
    assert "had_flare_up" in first_score

    # The log on 2026-04-08 is light — no violations — expect at least one "safe"
    states = [s["state"] for s in payload["scores"]]
    assert "safe" in states, f"Expected at least one 'safe' score, got: {states}"

    # The entry for 2026-04-08 specifically
    apr_8_scores = [s for s in payload["scores"] if s["date"] == "2026-04-08"]
    assert len(apr_8_scores) == 1
    apr_8 = apr_8_scores[0]
    assert apr_8["state"] == "safe"
    assert apr_8["violations"] == []
    assert apr_8["had_flare_up"] is False


# ---------------------------------------------------------------------------
# Test 2 — 404 for a non-existent block ID
# ---------------------------------------------------------------------------


async def test_block_scores_returns_404_for_missing_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/blk-does-not-exist/scores")

    assert response.status_code == 404
    # FastAPI's generic route-not-found returns {"detail": "Not Found"} (capital N).
    # The real endpoint must return the lowercase domain message so we can
    # distinguish a properly-handled block-not-found from a missing route.
    detail = response.json().get("detail", "")
    assert detail == "Training block not found", (
        f"Expected domain-level 404 detail, got: {detail!r}"
    )


# ---------------------------------------------------------------------------
# Test 3 — Block with no end_date defaults to today; no 500
# ---------------------------------------------------------------------------


async def test_block_scores_no_end_date_defaults_to_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-open-scores",
        name="Open Block Class",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-open",
        name="Open-ended block",
        start_date=datetime.date(2026, 5, 1),
        end_date=None,   # no end_date
        status="active",
    )

    response = await client.get("/api/training-blocks/blk-open/scores")

    assert response.status_code == 200
    payload = response.json()
    assert payload["block_id"] == "blk-open"
    # end_date in response should default to today (not null, not a 500)
    assert payload["end_date"] == datetime.date.today().isoformat()
    assert isinstance(payload["scores"], list)


# ---------------------------------------------------------------------------
# Test 4 — Block with no logs or check-ins → scores is []
# ---------------------------------------------------------------------------


async def test_block_scores_empty_block_returns_empty_scores(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-empty",
        name="Empty block",
        start_date=datetime.date(2026, 4, 1),
        end_date=datetime.date(2026, 4, 3),
        status="completed",
    )

    response = await client.get("/api/training-blocks/blk-empty/scores")

    assert response.status_code == 200
    payload = response.json()
    assert payload["block_id"] == "blk-empty"
    assert payload["scores"] == []
