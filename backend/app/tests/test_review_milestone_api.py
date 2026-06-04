"""API and service-hook tests for review milestone auto-detection (B10.1)."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.models.block import TrainingBlock
from app.schemas.activity_logs import ActivityLogCreate
from app.services.activity_logs import create_activity_log
from app.tests.helpers.review_milestone_test_utils import (
    ACTIVE_BLOCK_ID,
    freeze_review_milestone_today,
    get_maybe_update_review_milestone_after_log,
    milestone_trigger_log_payload,
    seed_review_milestone_eligible_graph,
)
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_training_block,
    with_session,
)

maybe_update_review_milestone_after_log = get_maybe_update_review_milestone_after_log()


async def test_patch_training_block_rejects_client_write_to_is_review_milestone_hit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-ms-patch",
        name="Patch Guard",
        start_date=date(2026, 4, 7),
        status="active",
        is_review_milestone_hit=False,
    )

    response = await client.patch(
        "/api/training-blocks/blk-ms-patch",
        json={"is_review_milestone_hit": True},
    )

    assert response.status_code == 422

    active = await client.get("/api/training-blocks/active")
    assert active.status_code == 200
    assert active.json()["is_review_milestone_hit"] is False


async def test_post_activity_log_latches_review_milestone_on_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_review_milestone_eligible_graph(app_with_test_database)
    freeze_review_milestone_today(monkeypatch)

    before = await client.get("/api/training-blocks/active")
    assert before.status_code == 200
    assert before.json()["is_review_milestone_hit"] is False

    create_response = await client.post(
        "/api/activity-logs",
        json=milestone_trigger_log_payload(),
    )
    assert create_response.status_code == 201

    after = await client.get("/api/training-blocks/active")
    assert after.status_code == 200
    assert after.json()["id"] == ACTIVE_BLOCK_ID
    assert after.json()["is_review_milestone_hit"] is True


async def test_post_activity_log_keeps_review_milestone_false_when_prior_day_had_flare(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_review_milestone_eligible_graph(
        app_with_test_database,
        flare_on_day_before_as_of=True,
    )
    freeze_review_milestone_today(monkeypatch)

    create_response = await client.post(
        "/api/activity-logs",
        json=milestone_trigger_log_payload(),
    )
    assert create_response.status_code == 201

    active = await client.get("/api/training-blocks/active")
    assert active.status_code == 200
    assert active.json()["is_review_milestone_hit"] is False


async def test_post_activity_log_does_not_latch_review_milestone_without_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-orphan",
        name="Orphan",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-orphan",
        activity_class_id="cls-orphan",
        name="Orphan walk",
    )
    freeze_review_milestone_today(monkeypatch)

    response = await client.post(
        "/api/activity-logs",
        json={
            **milestone_trigger_log_payload(),
            "id": "log-orphan",
            "activity_id": "act-orphan",
        },
    )
    assert response.status_code == 201

    active = await client.get("/api/training-blocks/active")
    assert active.status_code == 404


def test_maybe_update_review_milestone_after_log_is_no_op_without_active_block(
    app_with_test_database: FastAPI,
) -> None:
    for session in with_session(app_with_test_database):
        maybe_update_review_milestone_after_log(session)


def test_maybe_update_review_milestone_after_log_skips_when_block_already_flagged(
    app_with_test_database: FastAPI,
) -> None:
    seed_review_milestone_eligible_graph(
        app_with_test_database,
        flare_on_day_before_as_of=True,
        is_review_milestone_hit=True,
    )

    for session in with_session(app_with_test_database):
        maybe_update_review_milestone_after_log(session)
        block = session.get(TrainingBlock, ACTIVE_BLOCK_ID)
        assert block is not None
        assert block.is_review_milestone_hit is True


def test_create_activity_log_service_latches_review_milestone_when_eligible(
    app_with_test_database: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_review_milestone_eligible_graph(app_with_test_database)
    freeze_review_milestone_today(monkeypatch)

    for session in with_session(app_with_test_database):
        create_activity_log(
            session,
            ActivityLogCreate.model_validate(milestone_trigger_log_payload()),
        )
        block = session.get(TrainingBlock, ACTIVE_BLOCK_ID)
        assert block is not None
        assert block.is_review_milestone_hit is True
