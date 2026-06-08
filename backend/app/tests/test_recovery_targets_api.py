from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.services.training_blocks import calendar_week_bounds
from app.tests.helpers.load_api_test_utils import freeze_server_today_as
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_recovery_target,
    seed_training_block,
)
from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block


def _seed_recovery_target_graph(
    app_with_test_database: FastAPI,
    *,
    block_id: str = "blk-active",
    block_status: str = "active",
    block_start: date = date(2026, 5, 1),
    block_end: date | None = None,
    activity_id: str = "act-mobility",
    block_anchor: date | None = None,
    block_span: tuple[date, date] | None = None,
) -> None:
    if block_span is not None:
        week_start, week_end = block_span
    elif block_end is not None:
        week_start, week_end = block_start, block_end
    else:
        anchor = block_anchor or date(2026, 5, 27)
        week_start, week_end = calendar_week_bounds(anchor)
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=block_id,
        focus_series_id="fs-recovery-test",
        focus_title=None,
        week_number=1,
        start_date=week_start,
        end_date=week_end if block_status == "active" else block_end,
        status=block_status,
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-performance",
        name="Performance",
        class_type="performance",
    )
    seed_activity(
        app_with_test_database,
        activity_id=activity_id,
        activity_class_id="cls-recovery",
        name="Mobility",
        activity_type="recovery",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk",
        activity_class_id="cls-performance",
        name="Walk",
        activity_type="performance",
    )


def _assert_recovery_target_payload(
    payload: dict[str, Any],
    *,
    target_id: str,
    training_block_id: str,
    activity_id: str,
    target_frequency: int,
    frequency_unit: str,
    current_streak_days: int,
) -> None:
    assert payload["id"] == target_id
    assert payload["training_block_id"] == training_block_id
    assert payload["activity_id"] == activity_id
    assert payload["target_frequency"] == target_frequency
    assert payload["frequency_unit"] == frequency_unit
    assert payload["current_streak_days"] == current_streak_days
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])


async def _get_recovery_target_streak(
    client: AsyncClient,
    *,
    block_id: str,
    target_id: str,
) -> int:
    response = await client.get(f"/api/training-blocks/{block_id}/recovery-targets")
    assert response.status_code == 200
    target = next(item for item in response.json() if item["id"] == target_id)
    return int(target["current_streak_days"])


async def _create_recovery_target(
    client: AsyncClient,
    *,
    block_id: str,
    target_id: str,
    activity_id: str,
    target_frequency: int = 1,
    frequency_unit: str = "daily",
) -> None:
    response = await client.post(
        f"/api/training-blocks/{block_id}/recovery-targets",
        json={
            "id": target_id,
            "activity_id": activity_id,
            "target_frequency": target_frequency,
            "frequency_unit": frequency_unit,
        },
    )
    assert response.status_code == 201


async def _create_recovery_log(
    client: AsyncClient,
    *,
    log_id: str,
    activity_id: str,
    logged_date: date,
) -> None:
    response = await client.post(
        "/api/activity-logs",
        json={
            "id": log_id,
            "activity_id": activity_id,
            "logged_date": logged_date.isoformat(),
            "duration_minutes": 20,
            "volume_value": 1.0,
            "volume_unit": "minutes",
        },
    )
    assert response.status_code == 201


async def test_list_recovery_targets_returns_empty_list(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.get("/api/training-blocks/blk-active/recovery-targets")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_recovery_targets_returns_targets_ordered_by_activity_then_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-stretch",
        activity_class_id="cls-recovery",
        name="Stretch",
        activity_type="recovery",
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-b",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-a",
        training_block_id="blk-active",
        activity_id="act-stretch",
        target_frequency=2,
        frequency_unit="weekly",
    )

    response = await client.get("/api/training-blocks/blk-active/recovery-targets")

    assert response.status_code == 200
    assert [target["id"] for target in response.json()] == ["rt-b", "rt-a"]


async def test_list_recovery_targets_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/recovery-targets")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize("parent_status", ["completed", "archived"])
async def test_list_recovery_targets_remains_readable_when_parent_block_is_not_active(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    parent_status: str,
) -> None:
    _seed_recovery_target_graph(
        app_with_test_database,
        block_status=parent_status,
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-1",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    response = await client.get("/api/training-blocks/blk-active/recovery-targets")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "rt-1"


async def test_create_recovery_target_returns_created_payload_with_zero_streak(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-mobility",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )

    assert response.status_code == 201
    _assert_recovery_target_payload(
        response.json(),
        target_id="rt-mobility",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
        current_streak_days=0,
    )


async def test_create_recovery_target_rejects_server_owned_fields_in_body(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-invalid",
            "training_block_id": "other-block",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": "daily",
            "current_streak_days": 5,
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
        },
    )

    assert response.status_code == 422


async def test_create_recovery_target_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks/missing-block/recovery-targets",
        json={
            "id": "rt-orphan",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_create_recovery_target_validates_activity_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    valid_response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-valid",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["activity_id"] == "act-mobility"

    invalid_response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-missing-activity",
            "activity_id": "missing-activity",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity not found"}


async def test_create_recovery_target_rejects_performance_activity(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-walk",
            "activity_id": "act-walk",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Activity must be a recovery activity"}


async def test_create_recovery_target_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-1",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-1",
            "activity_id": "act-mobility",
            "target_frequency": 2,
            "frequency_unit": "weekly",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Recovery target already exists"}


async def test_create_recovery_target_returns_conflict_for_duplicate_block_activity_pair(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-existing",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-new",
            "activity_id": "act-mobility",
            "target_frequency": 2,
            "frequency_unit": "weekly",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Recovery target for this activity already exists",
    }


@pytest.mark.parametrize("invalid_frequency", [0, -1])
async def test_create_recovery_target_rejects_target_frequency_below_one(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_frequency: int,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-invalid-frequency",
            "activity_id": "act-mobility",
            "target_frequency": invalid_frequency,
            "frequency_unit": "daily",
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize("invalid_unit", ["monthly", "day", "", "Daily", "WEEKLY"])
async def test_create_recovery_target_rejects_invalid_frequency_unit(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_unit: str,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-invalid-unit",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": invalid_unit,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "missing_field",
    ["activity_id", "target_frequency", "frequency_unit"],
)
async def test_create_recovery_target_rejects_missing_required_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    missing_field: str,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)

    payload: dict[str, object] = {
        "id": "rt-incomplete",
        "activity_id": "act-mobility",
        "target_frequency": 1,
        "frequency_unit": "daily",
    }
    del payload[missing_field]

    response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json=payload,
    )

    assert response.status_code == 422


async def test_recovery_target_patch_and_delete_routes_are_not_available(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-1",
        training_block_id="blk-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    patch_response = await client.patch(
        "/api/recovery-targets/rt-1",
        json={"target_frequency": 2},
    )
    delete_response = await client.delete("/api/recovery-targets/rt-1")

    assert patch_response.status_code == 404
    assert delete_response.status_code == 404


async def test_daily_streak_counts_consecutive_calendar_days_meeting_target(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 5, 27))
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-day-1",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 25),
    )
    await _create_recovery_log(
        client,
        log_id="log-day-2",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 26),
    )
    await _create_recovery_log(
        client,
        log_id="log-day-3",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 3


async def test_daily_streak_backfilled_log_recalculates_as_of_logged_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 1, 14))
    _seed_recovery_target_graph(
        app_with_test_database,
        block_start=date(2026, 1, 1),
        block_anchor=date(2026, 1, 12),
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    for day_offset, log_id in enumerate(["log-jan-12", "log-jan-13", "log-jan-14"]):
        await _create_recovery_log(
            client,
            log_id=log_id,
            activity_id="act-mobility",
            logged_date=date(2026, 1, 12) + timedelta(days=day_offset),
        )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 3


async def test_daily_streak_is_zero_when_ending_day_does_not_meet_target(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=2,
        frequency_unit="daily",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-day-1",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 25),
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-day-2",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 26),
    )

    await _create_recovery_log(
        client,
        log_id="log-day-3",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 0


async def test_daily_streak_requires_target_frequency_logs_on_each_day(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 5, 27))
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=2,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-a",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )
    streak_after_one = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak_after_one == 0

    await _create_recovery_log(
        client,
        log_id="log-b",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )
    streak_after_two = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak_after_two == 1


async def test_weekly_streak_counts_consecutive_iso_weeks_meeting_target(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 5, 27))
    _seed_recovery_target_graph(
        app_with_test_database,
        block_span=(date(2026, 5, 1), date(2026, 5, 31)),
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-weekly",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="weekly",
    )

    await _create_recovery_log(
        client,
        log_id="log-week-1",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 12),
    )
    await _create_recovery_log(
        client,
        log_id="log-week-2",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 20),
    )
    await _create_recovery_log(
        client,
        log_id="log-week-3",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-weekly",
    )
    assert streak == 3


async def test_weekly_streak_is_zero_when_ending_week_does_not_meet_target(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-weekly",
        activity_id="act-mobility",
        target_frequency=2,
        frequency_unit="weekly",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-prior-week",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 12),
    )

    await _create_recovery_log(
        client,
        log_id="log-current-week",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 18),
    )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-weekly",
    )
    assert streak == 0


async def test_delete_recovery_log_reduces_daily_streak_on_recalculation(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 5, 27))
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    for day_offset, log_id in enumerate(["log-1", "log-2", "log-3"]):
        await _create_recovery_log(
            client,
            log_id=log_id,
            activity_id="act-mobility",
            logged_date=date(2026, 5, 25) + timedelta(days=day_offset),
        )

    assert (
        await _get_recovery_target_streak(
            client,
            block_id="blk-active",
            target_id="rt-daily",
        )
        == 3
    )

    delete_response = await client.delete("/api/activity-logs/log-3")
    assert delete_response.status_code == 204

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 0


async def test_patch_recovery_log_date_recalculates_streak_from_latest_affected_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, date(2026, 5, 27))
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-25",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 25),
    )
    await _create_recovery_log(
        client,
        log_id="log-26",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 26),
    )
    await _create_recovery_log(
        client,
        log_id="log-27",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    patch_response = await client.patch(
        "/api/activity-logs/log-27",
        json={"logged_date": "2026-05-24"},
    )
    assert patch_response.status_code == 200

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 0


async def test_streak_recalculation_ignores_logs_outside_active_block_window(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(
        app_with_test_database,
        block_start=date(2026, 5, 20),
        block_end=date(2026, 5, 26),
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-before-block",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 19),
    )
    await _create_recovery_log(
        client,
        log_id="log-in-window",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 25),
    )
    await _create_recovery_log(
        client,
        log_id="log-after-block",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 0


async def test_streak_updates_only_for_matching_target_on_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(
        app_with_test_database,
        block_id="blk-archived",
        block_status="archived",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Recovery Block Active",
        start_date=date(2026, 5, 1),
        status="active",
    )
    seed_recovery_target(
        app_with_test_database,
        target_id="rt-archived",
        training_block_id="blk-archived",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
        current_streak_days=0,
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-active",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-today",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    active_streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-active",
    )
    archived_streak = await _get_recovery_target_streak(
        client,
        block_id="blk-archived",
        target_id="rt-archived",
    )
    assert active_streak == 1
    assert archived_streak == 0


async def test_recovery_log_without_matching_target_is_no_op_for_streaks(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-other",
        activity_class_id="cls-recovery",
        name="Other recovery",
        activity_type="recovery",
    )

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-untracked",
            "activity_id": "act-other",
            "logged_date": "2026-05-27",
            "duration_minutes": 20,
            "volume_value": 1.0,
        },
    )

    assert response.status_code == 201


async def test_performance_activity_log_does_not_update_recovery_streaks(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-daily",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )

    response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-27",
            "duration_minutes": 30,
            "volume_value": 3.0,
            "volume_unit": "km",
        },
    )
    assert response.status_code == 201

    streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-daily",
    )
    assert streak == 0


async def test_multiple_recovery_targets_update_independently(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(app_with_test_database)
    seed_activity(
        app_with_test_database,
        activity_id="act-stretch",
        activity_class_id="cls-recovery",
        name="Stretch",
        activity_type="recovery",
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-mobility",
        activity_id="act-mobility",
        target_frequency=1,
        frequency_unit="daily",
    )
    await _create_recovery_target(
        client,
        block_id="blk-active",
        target_id="rt-stretch",
        activity_id="act-stretch",
        target_frequency=1,
        frequency_unit="daily",
    )

    await _create_recovery_log(
        client,
        log_id="log-mobility",
        activity_id="act-mobility",
        logged_date=date(2026, 5, 27),
    )

    mobility_streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-mobility",
    )
    stretch_streak = await _get_recovery_target_streak(
        client,
        block_id="blk-active",
        target_id="rt-stretch",
    )
    assert mobility_streak == 1
    assert stretch_streak == 0


async def test_recovery_target_crud_works_without_active_block_and_logs_skip_streak_updates(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_recovery_target_graph(
        app_with_test_database,
        block_status="completed",
    )

    create_response = await client.post(
        "/api/training-blocks/blk-active/recovery-targets",
        json={
            "id": "rt-completed-block",
            "activity_id": "act-mobility",
            "target_frequency": 1,
            "frequency_unit": "daily",
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["current_streak_days"] == 0

    log_response = await client.post(
        "/api/activity-logs",
        json={
            "id": "log-no-active-block",
            "activity_id": "act-mobility",
            "logged_date": "2026-05-27",
            "duration_minutes": 20,
            "volume_value": 1.0,
        },
    )
    assert log_response.status_code == 201

    list_response = await client.get("/api/training-blocks/blk-active/recovery-targets")
    assert list_response.status_code == 200
    assert list_response.json()[0]["current_streak_days"] == 0
