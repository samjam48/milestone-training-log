"""WRU.B2 — Always resolve active weekly rules.

Failing tests until get_active_training_block and ensure_active_weekly_focus
auto-create the current calendar week and retire legacy fallbacks.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterator
from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlmodel import Session, col, select

from app.models.block import TrainingBlock
from app.services.dashboard import get_dashboard
from app.services.rules import list_rules
from app.services.training_blocks import TrainingBlockNotFoundError, calendar_week_bounds
from app.services.weekly_targets import list_weekly_targets
from app.tests.helpers.load_api_test_utils import freeze_server_today_as
from app.tests.helpers.seed import with_session
from app.tests.helpers.weekly_focus_fixtures import (
    SUNDAY_AS_OF,
    WEEK_FIVE_END,
    WEEK_FIVE_START,
    WEEK_ONE_END,
    WEEK_ONE_START,
    seed_legacy_active_block,
    seed_weekly_focus_block,
)
from app.tests.helpers.wru_b2_fixtures import (
    WRU_B2_AS_OF,
    WRU_B2_NEXT_MONDAY,
    WRU_B2_NEXT_WEEK_END,
    WRU_B2_NEXT_WEEK_START,
    WRU_B2_WEEK_END,
    WRU_B2_WEEK_START,
    assert_auto_created_weekly_block,
    assert_weekly_focus_api_payload,
    require_training_blocks_service,
    seed_legacy_completed_month_block,
    seed_week_one_with_rules_and_targets,
)


def _rule_signature(rule: object) -> tuple[object, ...]:
    return (
        getattr(rule, "activity_class_id"),
        getattr(rule, "activity_id"),
        getattr(rule, "rule_type"),
        getattr(rule, "threshold_value"),
        getattr(rule, "window_days"),
        getattr(rule, "enabled"),
    )


def _target_signature(target: object) -> tuple[object, ...]:
    return (
        getattr(target, "activity_class_id"),
        getattr(target, "activity_id"),
        getattr(target, "target_value"),
        getattr(target, "target_unit"),
        getattr(target, "target_kind"),
    )


@pytest.fixture
def session(app_with_test_database: FastAPI) -> Iterator[Session]:
    for db_session in with_session(app_with_test_database):
        yield db_session


# --- AC1: get_active_training_block always runs ensure_active_weekly_focus ---


def test_get_active_training_block_with_as_of_auto_creates_current_week(
    app_with_test_database: FastAPI,
) -> None:
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.get_active_training_block(session, as_of=WRU_B2_AS_OF)

    assert_auto_created_weekly_block(active, as_of=WRU_B2_AS_OF, week_number=1)


def test_get_active_training_block_without_as_of_auto_creates_from_server_today(
    app_with_test_database: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, WRU_B2_AS_OF)
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.get_active_training_block(session)

    assert_auto_created_weekly_block(active, as_of=WRU_B2_AS_OF, week_number=1)


def test_get_active_training_block_never_returns_legacy_active_block(
    app_with_test_database: FastAPI,
) -> None:
    seed_legacy_active_block(app_with_test_database, block_id="blk-wru-b2-legacy")
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.get_active_training_block(session, as_of=WRU_B2_AS_OF)

    assert active.period_kind == "weekly_focus"
    assert active.id != "blk-wru-b2-legacy"
    assert_auto_created_weekly_block(active, as_of=WRU_B2_AS_OF, week_number=1)


# --- AC2: ensure_active_weekly_focus creates when no row exists ---


def test_ensure_active_weekly_focus_creates_week_one_when_no_blocks_exist(
    app_with_test_database: FastAPI,
) -> None:
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, WRU_B2_AS_OF)
        rules = list_rules(session, active.id)
        targets = list_weekly_targets(session, active.id)

    assert active is not None
    assert_auto_created_weekly_block(active, as_of=WRU_B2_AS_OF, week_number=1)
    assert rules == []
    assert targets == []


def test_ensure_active_weekly_focus_does_not_raise_not_found_for_missing_week(
    app_with_test_database: FastAPI,
) -> None:
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        try:
            service.get_active_training_block(session, as_of=WRU_B2_AS_OF)
        except TrainingBlockNotFoundError as exc:
            pytest.fail(
                "WRU.B2 must auto-create the current week instead of raising "
                f"TrainingBlockNotFoundError: {exc}"
            )


# --- AC3: Dashboard block payload ---


def test_dashboard_block_payload_is_weekly_focus_with_calendar_week_dates(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    dashboard = get_dashboard(session, as_of=WRU_B2_AS_OF)

    assert dashboard.block is not None
    assert dashboard.block.period_kind == "weekly_focus"
    assert dashboard.block.start_date == WRU_B2_WEEK_START
    assert dashboard.block.end_date == WRU_B2_WEEK_END
    assert dashboard.block.status == "active"


def test_dashboard_block_uses_calendar_label_without_requiring_focus_title(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    from app.tests.helpers.wru_b2_fixtures import expected_calendar_week_name

    dashboard = get_dashboard(session, as_of=WRU_B2_AS_OF)

    assert dashboard.block is not None
    assert dashboard.block.name == expected_calendar_week_name(
        WRU_B2_WEEK_START,
        WRU_B2_WEEK_END,
    )
    # UI uses calendar label only; focus_title must not be required for rendering.
    assert dashboard.block.focus_title is None or dashboard.block.focus_title == dashboard.block.name


def test_dashboard_never_returns_legacy_period_kind(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_legacy_active_block(app_with_test_database)

    dashboard = get_dashboard(session, as_of=WRU_B2_AS_OF)

    assert dashboard.block is not None
    assert dashboard.block.period_kind == "weekly_focus"
    assert dashboard.block.period_kind != "legacy"


# --- AC4: GET /api/training-blocks/active ---


async def test_get_active_api_auto_creates_when_database_has_zero_blocks(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    freeze_server_today_as(monkeypatch, WRU_B2_AS_OF)

    response = await client.get("/api/training-blocks/active")

    assert response.status_code == 200
    assert_weekly_focus_api_payload(response.json(), as_of=WRU_B2_AS_OF, week_number=1)


async def test_get_active_api_returns_current_week_with_as_of(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wru-b2-api-current",
        focus_series_id="fs-wru-b2-api",
        focus_title="API week",
        week_number=1,
        start_date=WRU_B2_WEEK_START,
        end_date=WRU_B2_WEEK_END,
        status="active",
    )

    response = await client.get(
        "/api/training-blocks/active",
        params={"as_of": WRU_B2_AS_OF.isoformat()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "blk-wru-b2-api-current"
    assert payload["period_kind"] == "weekly_focus"
    assert payload["start_date"] == WRU_B2_WEEK_START.isoformat()
    assert payload["end_date"] == WRU_B2_WEEK_END.isoformat()


async def test_get_active_api_monday_rollover_copies_enabled_rules_and_targets(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_week_one_with_rules_and_targets(app_with_test_database)

    response = await client.get(
        "/api/training-blocks/active",
        params={"as_of": WRU_B2_NEXT_MONDAY.isoformat()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_kind"] == "weekly_focus"
    assert payload["week_number"] == 2
    assert payload["start_date"] == WRU_B2_NEXT_WEEK_START.isoformat()
    assert payload["end_date"] == WRU_B2_NEXT_WEEK_END.isoformat()

    for session in with_session(app_with_test_database):
        week_two_rules = list_rules(session, payload["id"])
        week_two_targets = list_weekly_targets(session, payload["id"])
        week_one_rules = list_rules(session, "blk-wru-b2-week-1")

    enabled_week_one = [rule for rule in week_one_rules if rule.enabled]
    assert len(week_two_rules) == len(enabled_week_one)
    assert Counter(_rule_signature(rule) for rule in week_two_rules) == Counter(
        _rule_signature(rule) for rule in enabled_week_one
    )
    assert len(week_two_targets) == 1
    assert week_two_targets[0].target_value == 3.0


# --- AC5: previous_blocks lists completed weekly periods only ---


def test_dashboard_previous_blocks_empty_when_no_completed_weeks(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    dashboard = get_dashboard(session, as_of=WRU_B2_AS_OF)

    assert dashboard.block is not None
    assert dashboard.previous_blocks == []


def test_dashboard_previous_blocks_lists_completed_weekly_periods_newest_first(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_week_one_with_rules_and_targets(app_with_test_database)
    service = require_training_blocks_service()

    for db_session in with_session(app_with_test_database):
        service.ensure_active_weekly_focus(db_session, WRU_B2_NEXT_MONDAY)

    dashboard = get_dashboard(session, as_of=WRU_B2_NEXT_MONDAY)

    assert dashboard.block is not None
    assert dashboard.block.week_number == 2
    assert len(dashboard.previous_blocks) == 1
    previous = dashboard.previous_blocks[0]
    assert previous.period_kind == "weekly_focus"
    assert previous.status == "completed"
    assert previous.start_date == WRU_B2_WEEK_START
    assert previous.end_date == WRU_B2_WEEK_END
    assert previous.id == "blk-wru-b2-week-1"


def test_dashboard_previous_blocks_excludes_legacy_month_style_blocks(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    seed_week_one_with_rules_and_targets(app_with_test_database)
    seed_legacy_completed_month_block(app_with_test_database)
    service = require_training_blocks_service()

    for db_session in with_session(app_with_test_database):
        service.ensure_active_weekly_focus(db_session, WRU_B2_NEXT_MONDAY)

    dashboard = get_dashboard(session, as_of=WRU_B2_NEXT_MONDAY)

    assert [block.id for block in dashboard.previous_blocks] == ["blk-wru-b2-week-1"]
    assert all(block.period_kind == "weekly_focus" for block in dashboard.previous_blocks)


# --- Edge cases ---


def test_catch_up_missed_mondays_via_get_active_training_block(
    app_with_test_database: FastAPI,
) -> None:
    seed_week_one_with_rules_and_targets(app_with_test_database)
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.get_active_training_block(session, as_of=WEEK_FIVE_START)
        weekly_focus_blocks = list(
            session.exec(
                select(TrainingBlock)
                .where(TrainingBlock.period_kind == "weekly_focus")
                .order_by(col(TrainingBlock.start_date))
            ).all()
        )

    assert active is not None
    assert active.start_date == WEEK_FIVE_START
    assert active.end_date == WEEK_FIVE_END
    assert active.week_number == 5
    completed_weeks = [block for block in weekly_focus_blocks if block.status == "completed"]
    assert len(completed_weeks) == 4
    assert [block.week_number for block in completed_weeks] == [1, 2, 3, 4]


def test_first_week_after_fresh_install_is_auto_created_empty_week(
    app_with_test_database: FastAPI,
) -> None:
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        active = service.get_active_training_block(session, as_of=SUNDAY_AS_OF)
        rules = list_rules(session, active.id)
        targets = list_weekly_targets(session, active.id)
        week_start, week_end = calendar_week_bounds(SUNDAY_AS_OF)

    assert active.period_kind == "weekly_focus"
    assert active.start_date == week_start
    assert active.end_date == week_end
    assert active.week_number == 1
    assert rules == []
    assert targets == []


def test_get_active_training_block_returns_existing_week_without_duplicate_create(
    app_with_test_database: FastAPI,
) -> None:
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wru-b2-existing",
        focus_series_id="fs-existing",
        focus_title="Existing",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )
    service = require_training_blocks_service()

    for session in with_session(app_with_test_database):
        first = service.get_active_training_block(session, as_of=SUNDAY_AS_OF)
        second = service.get_active_training_block(session, as_of=SUNDAY_AS_OF)
        count = len(
            session.exec(
                select(TrainingBlock).where(TrainingBlock.period_kind == "weekly_focus")
            ).all()
        )

    assert first.id == second.id == "blk-wru-b2-existing"
    assert count == 1
