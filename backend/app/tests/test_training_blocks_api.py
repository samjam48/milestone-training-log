from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.load_api_seed import seed_daily_check_in, seed_flare_up_incident
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_goal,
    seed_rule,
    seed_training_block,
)


def _assert_training_block_payload(
    payload: dict[str, Any],
    *,
    block_id: str,
    name: str,
    start_date: str,
    status: str,
    end_date: str | None = None,
    related_goal_id: str | None = None,
    notes: str | None = None,
    is_review_milestone_hit: bool = False,
) -> None:
    assert payload["id"] == block_id
    assert payload["name"] == name
    assert payload["start_date"] == start_date
    assert payload["status"] == status
    assert payload["end_date"] == end_date
    assert payload["related_goal_id"] == related_goal_id
    assert payload["notes"] == notes
    assert payload["is_review_milestone_hit"] is is_review_milestone_hit
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload


def _assert_training_block_review_payload(
    payload: dict[str, Any],
    *,
    block_id: str,
    name: str,
    start_date: str,
    status: str,
    end_date: str | None,
    total_sessions: int,
    clean_days: int,
) -> None:
    block = payload["block"]
    assert block["id"] == block_id
    assert block["name"] == name
    assert block["start_date"] == start_date
    assert block["status"] == status
    assert block["end_date"] == end_date
    assert "created_at" in block
    assert "updated_at" in block
    datetime.fromisoformat(block["created_at"])
    datetime.fromisoformat(block["updated_at"])
    assert "user_id" not in block
    assert isinstance(payload["daily_scores"], list)
    assert isinstance(payload["load_series"], list)
    assert isinstance(payload["flare_up_dates"], list)
    assert payload["total_sessions"] == total_sessions
    assert payload["clean_days"] == clean_days


def _seed_review_block_graph(
    app_with_test_database: FastAPI,
    *,
    block_id: str,
    block_start: date,
    block_end: date | None,
    block_status: str,
    seed_rules: bool,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id=block_id,
        name="Review Block",
        start_date=block_start,
        end_date=block_end,
        status=block_status,
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-review",
        name="Foot Load",
        class_type="performance",
        default_recovery_window_days=3,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-review",
        activity_class_id="cls-foot-review",
        name="Morning Walk",
        activity_type="performance",
        default_volume_unit="km",
    )
    if seed_rules:
        seed_rule(
            app_with_test_database,
            rule_id="rule-cap-review",
            training_block_id=block_id,
            rule_type="weekly_load_cap",
            threshold_value=120,
            window_days=7,
            activity_class_id="cls-foot-review",
            enabled=True,
        )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-in-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 4, 8),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-outside-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 4, 12),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-review-in-range",
        check_in_date=date(2026, 4, 8),
        pain_level=2,
        has_flare_up=False,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-in-range",
        incident_date=date(2026, 4, 9),
        body_part="Left heel",
        severity=6,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-outside-range",
        incident_date=date(2026, 4, 12),
        body_part="Left heel",
        severity=6,
    )


async def test_list_training_blocks_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/training-blocks")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_training_blocks_returns_local_blocks_in_start_date_desc_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-old",
        name="Older Block",
        start_date=date(2026, 3, 1),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-new",
        name="Newer Block",
        start_date=date(2026, 5, 1),
        status="archived",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-mid-a",
        name="Same Start A",
        start_date=date(2026, 4, 1),
        status="completed",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-mid-b",
        name="Same Start B",
        start_date=date(2026, 4, 1),
        status="completed",
    )

    response = await client.get("/api/training-blocks")

    assert response.status_code == 200
    assert [block["id"] for block in response.json()] == [
        "blk-new",
        "blk-mid-a",
        "blk-mid-b",
        "blk-old",
    ]


async def test_get_active_training_block_auto_creates_current_week_when_none_active(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.tests.helpers.load_api_test_utils import freeze_server_today_as
    from app.tests.helpers.wru_b2_fixtures import (
        WRU_B2_AS_OF,
        assert_weekly_focus_api_payload,
    )

    freeze_server_today_as(monkeypatch, WRU_B2_AS_OF)

    response = await client.get("/api/training-blocks/active")

    assert response.status_code == 200
    assert_weekly_focus_api_payload(response.json(), as_of=WRU_B2_AS_OF, week_number=1)


async def test_patch_training_block_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Before",
        start_date=date(2026, 4, 7),
        status="archived",
        notes="Before notes",
    )

    response = await client.patch(
        "/api/training-blocks/blk-1",
        json={
            "name": "After",
            "notes": "After notes",
        },
    )

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="After",
        start_date="2026-04-07",
        status="archived",
        notes="After notes",
    )


async def test_patch_training_block_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Unchanged",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.patch("/api/training-blocks/blk-1", json={})

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="Unchanged",
        start_date="2026-04-07",
        status="archived",
    )


async def test_patch_training_block_allows_nullable_fields_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_goal(app_with_test_database)
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Linked Block",
        start_date=date(2026, 4, 7),
        status="archived",
        end_date=date(2026, 5, 31),
        related_goal_id="goal-1",
        notes="Clear me",
    )

    response = await client.patch(
        "/api/training-blocks/blk-1",
        json={
            "end_date": None,
            "related_goal_id": None,
            "notes": None,
        },
    )

    assert response.status_code == 200
    _assert_training_block_payload(
        response.json(),
        block_id="blk-1",
        name="Linked Block",
        start_date="2026-04-07",
        status="archived",
    )


async def test_patch_training_block_to_active_completes_previous_active_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Current Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-archived",
        name="To Activate",
        start_date=date(2026, 5, 1),
        status="archived",
    )

    response = await client.patch(
        "/api/training-blocks/blk-archived",
        json={"status": "active"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"

    list_response = await client.get("/api/training-blocks")
    blocks_by_id = {block["id"]: block for block in list_response.json()}
    assert blocks_by_id["blk-active"]["status"] == "completed"
    assert blocks_by_id["blk-archived"]["status"] == "active"


async def test_patch_active_block_to_completed_does_not_promote_another_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-active",
        name="Active",
        start_date=date(2026, 4, 7),
        status="active",
    )
    seed_training_block(
        app_with_test_database,
        block_id="blk-archived",
        name="Archived",
        start_date=date(2026, 3, 1),
        status="archived",
    )

    response = await client.patch(
        "/api/training-blocks/blk-active",
        json={"status": "completed"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    active_response = await client.get("/api/training-blocks/active")
    assert active_response.status_code == 200
    assert active_response.json()["period_kind"] == "weekly_focus"
    assert active_response.json()["id"] != "blk-active"


async def test_patch_missing_training_block_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/training-blocks/missing-block",
        json={"name": "Missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize(
    ("field_name", "null_patch"),
    [
        ("name", {"name": None}),
        ("start_date", {"start_date": None}),
        ("status", {"status": None}),
    ],
)
async def test_patch_training_block_rejects_null_required_fields_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
    null_patch: dict[str, None],
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Before",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.patch("/api/training-blocks/blk-1", json=null_patch)

    assert response.status_code == 422
    error_fields = {
        str(error_location[-1])
        for error in response.json()["detail"]
        if (error_location := error.get("loc"))
    }
    assert field_name in error_fields

    list_response = await client.get("/api/training-blocks")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    _assert_training_block_payload(
        list_response.json()[0],
        block_id="blk-1",
        name="Before",
        start_date="2026-04-07",
        status="archived",
    )


async def test_get_training_block_review_returns_not_found_for_missing_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/review")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_get_training_block_review_returns_review_payload_for_completed_block(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_review_block_graph(
        app_with_test_database,
        block_id="blk-review-complete",
        block_start=date(2026, 4, 7),
        block_end=date(2026, 4, 10),
        block_status="completed",
        seed_rules=True,
    )

    response = await client.get("/api/training-blocks/blk-review-complete/review")

    assert response.status_code == 200
    payload = response.json()
    _assert_training_block_review_payload(
        payload,
        block_id="blk-review-complete",
        name="Review Block",
        start_date="2026-04-07",
        status="completed",
        end_date="2026-04-10",
        total_sessions=1,
        clean_days=3,
    )
    assert len(payload["load_series"]) == 4
    assert payload["load_series"][0]["date"] == "2026-04-07"
    assert payload["load_series"][-1]["date"] == "2026-04-10"
    assert [score["date"] for score in payload["daily_scores"]] == [
        "2026-04-08",
        "2026-04-09",
    ]
    assert payload["flare_up_dates"] == ["2026-04-09"]
    assert payload["load_series"]


async def test_get_training_block_review_supports_open_block_and_defaults_end_date_to_today(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_review_block_graph(
        app_with_test_database,
        block_id="blk-review-open",
        block_start=date(2026, 5, 1),
        block_end=None,
        block_status="active",
        seed_rules=True,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-review-open-in-range",
        activity_id="act-walk-review",
        logged_date=date(2026, 5, 2),
        volume_value=1.5,
        volume_unit="km",
        rpe=3,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-review-open-in-range",
        check_in_date=date(2026, 5, 2),
        pain_level=2,
        has_flare_up=False,
    )
    seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-review-open-in-range",
        incident_date=date(2026, 5, 3),
        body_part="Left heel",
        severity=6,
    )

    response = await client.get("/api/training-blocks/blk-review-open/review")

    assert response.status_code == 200
    payload = response.json()
    expected_clean_days = (date.today() - date(2026, 5, 1)).days
    _assert_training_block_review_payload(
        payload,
        block_id="blk-review-open",
        name="Review Block",
        start_date="2026-05-01",
        status="active",
        end_date=None,
        total_sessions=1,
        clean_days=expected_clean_days,
    )
    assert payload["block"]["end_date"] is None
    assert payload["daily_scores"]
    assert payload["load_series"]
    assert payload["flare_up_dates"]


async def test_get_training_block_review_all_zero_load_series_without_performance_classes(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """No performance classes → combined series is all-zero points over the block range."""
    seed_training_block(
        app_with_test_database,
        block_id="blk-review-empty",
        name="Review Block Empty",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 3),
        status="completed",
    )

    response = await client.get("/api/training-blocks/blk-review-empty/review")

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"]["id"] == "blk-review-empty"
    assert [point["date"] for point in payload["load_series"]] == [
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
    ]
    assert all(point["daily_load"] == pytest.approx(0.0) for point in payload["load_series"])
    assert all(point["load"] == pytest.approx(0.0) for point in payload["load_series"])
    assert payload["daily_scores"] == []


async def test_get_training_block_review_load_series_uses_combined_load_tax(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Block review series is combined load tax, not a single-class volume×rpe graph."""
    seed_training_block(
        app_with_test_database,
        block_id="blk-review-combined",
        name="Review Combined",
        start_date=date(2026, 4, 7),
        end_date=date(2026, 4, 10),
        status="completed",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-arm-review",
        name="Arm Load",
        class_type="performance",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-review",
        name="Foot Load",
        class_type="performance",
        load_weight=1.0,
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-arm-review",
        activity_class_id="cls-arm-review",
        name="Arm work",
        default_volume_unit="km",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-review-combined",
        activity_class_id="cls-foot-review",
        name="Walk",
        default_volume_unit="km",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-cap-arm-review",
        training_block_id="blk-review-combined",
        rule_type="weekly_load_cap",
        threshold_value=120,
        window_days=7,
        activity_class_id="cls-arm-review",
        enabled=True,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-arm-review-combined",
        activity_id="act-arm-review",
        logged_date=date(2026, 4, 8),
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-foot-review-combined",
        activity_id="act-walk-review-combined",
        logged_date=date(2026, 4, 8),
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )

    response = await client.get("/api/training-blocks/blk-review-combined/review")

    assert response.status_code == 200
    payload = response.json()
    assert [point["date"] for point in payload["load_series"]] == [
        "2026-04-07",
        "2026-04-08",
        "2026-04-09",
        "2026-04-10",
    ]
    day_point = next(point for point in payload["load_series"] if point["date"] == "2026-04-08")
    # Two performance classes, each 2km @ RPE 5 → load tax 1.5 each, combined 3.0.
    assert day_point["daily_load"] == pytest.approx(3.0)
    assert day_point["daily_load"] != pytest.approx(10.0)
    assert day_point["daily_load"] != pytest.approx(1.5)
    later_point = next(point for point in payload["load_series"] if point["date"] == "2026-04-10")
    assert later_point["load"] > 0
    assert later_point["daily_load"] == pytest.approx(0.0)


async def test_get_training_block_review_completed_block_with_no_data_returns_empty_daily_scores(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """B10.4 edge case — previous block with no scores in range → empty daily_scores."""
    seed_training_block(
        app_with_test_database,
        block_id="blk-review-no-scores",
        name="Empty Completed Block",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 3),
        status="completed",
    )

    response = await client.get("/api/training-blocks/blk-review-no-scores/review")

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"]["id"] == "blk-review-no-scores"
    assert payload["daily_scores"] == []


def _assert_weekly_focus_payload(
    payload: dict[str, Any],
    *,
    focus_title: str,
    week_number: int,
    period_kind: str = "weekly_focus",
) -> None:
    assert payload["period_kind"] == period_kind
    assert payload["focus_title"] == focus_title
    assert payload["week_number"] == week_number
    assert payload["focus_series_id"] is not None


async def test_get_active_training_block_returns_weekly_focus_fields_after_ensure(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import (
        SUNDAY_AS_OF,
        WEEK_ONE_END,
        WEEK_ONE_START,
        seed_weekly_focus_block,
    )

    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wf-api-active",
        focus_series_id="fs-api",
        focus_title="API focus",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )

    response = await client.get(
        "/api/training-blocks/active",
        params={"as_of": SUNDAY_AS_OF.isoformat()},
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_weekly_focus_payload(payload, focus_title="API focus", week_number=1)
    assert payload["id"] == "blk-wf-api-active"
    assert payload["start_date"] == WEEK_ONE_START.isoformat()
    assert payload["end_date"] == WEEK_ONE_END.isoformat()


async def test_get_active_training_block_rolls_forward_without_as_of(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.tests.helpers.load_api_test_utils import freeze_server_today_as
    from app.tests.helpers.weekly_focus_fixtures import (
        MONDAY_AS_OF,
        WEEK_ONE_END,
        WEEK_ONE_START,
        WEEK_TWO_END,
        WEEK_TWO_START,
        seed_weekly_focus_block,
    )

    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wf-api-rollover",
        focus_series_id="fs-api-rollover",
        focus_title="Rollover focus",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )

    freeze_server_today_as(monkeypatch, MONDAY_AS_OF)

    response = await client.get("/api/training-blocks/active")

    assert response.status_code == 200
    payload = response.json()
    _assert_weekly_focus_payload(payload, focus_title="Rollover focus", week_number=2)
    assert payload["id"] != "blk-wf-api-rollover"
    assert payload["start_date"] == WEEK_TWO_START.isoformat()
    assert payload["end_date"] == WEEK_TWO_END.isoformat()


async def test_get_training_block_review_still_works_for_completed_weekly_focus(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    from app.tests.helpers.weekly_focus_fixtures import (
        MONDAY_AS_OF,
        WEEK_ONE_END,
        WEEK_ONE_START,
        seed_weekly_focus_block,
    )

    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wf-review",
        focus_series_id="fs-review",
        focus_title="Review focus",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="completed",
    )
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-wf-review",
        name="Foot Load",
        class_type="performance",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-wf-review",
        activity_class_id="cls-foot-wf-review",
        name="Morning Walk",
        default_volume_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-wf-review",
        activity_id="act-walk-wf-review",
        logged_date=WEEK_ONE_START,
        volume_value=1.0,
        volume_unit="km",
        rpe=3,
    )

    response = await client.get(
        "/api/training-blocks/blk-wf-review/review",
        params={"as_of": MONDAY_AS_OF.isoformat()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["block"]["id"] == "blk-wf-review"
    assert payload["block"]["focus_title"] == "Review focus"
    assert payload["block"]["week_number"] == 1
    assert payload["total_sessions"] == 1
