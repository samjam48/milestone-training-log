"""Test-side helpers for B10.1 review milestone (import shim + seed graphs)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest
from fastapi import FastAPI

from app.services.training_blocks import calendar_week_bounds
from app.tests.helpers.load_api_seed import seed_daily_check_in, seed_flare_up_incident
from app.tests.helpers.load_api_test_utils import freeze_server_today_as
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_weekly_target,
)
from app.tests.helpers.weekly_focus_fixtures import seed_weekly_focus_block

AS_OF = date(2026, 5, 26)
DAY_BEFORE_AS_OF = date(2026, 5, 25)
FOOT_CLASS_ID = "cls-foot-ms"
WALK_ACTIVITY_ID = "act-walk-ms"
ACTIVE_BLOCK_ID = "blk-ms-active"
FOOT_TARGET_ID = "wt-foot-ms"


def _missing_feature(name: str) -> Callable[..., Any]:
    def _raise(*_args: object, **_kwargs: object) -> Any:
        raise AssertionError(f"B10.1: implement {name}")

    return _raise


def get_evaluate_review_milestone() -> Callable[..., bool]:
    try:
        from app.services.review_milestone import evaluate_review_milestone
    except ImportError:
        return _missing_feature("app.services.review_milestone.evaluate_review_milestone")
    return evaluate_review_milestone


def get_maybe_update_review_milestone_after_log() -> Callable[..., None]:
    try:
        from app.services.review_milestone import maybe_update_review_milestone_after_log
    except ImportError:
        return _missing_feature(
            "app.services.review_milestone.maybe_update_review_milestone_after_log"
        )
    return maybe_update_review_milestone_after_log


def freeze_review_milestone_today(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin server-local as_of to the milestone evaluation date."""
    freeze_server_today_as(monkeypatch, AS_OF)
    try:
        import app.services.review_milestone as review_milestone_mod
    except ImportError:
        return
    monkeypatch.setattr(
        review_milestone_mod,
        "_server_local_today",
        lambda: AS_OF,
    )


def _seed_foot_graph(app_with_test_database: FastAPI) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id=FOOT_CLASS_ID,
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id=WALK_ACTIVITY_ID,
        activity_class_id=FOOT_CLASS_ID,
        name="Walk",
    )


def seed_review_milestone_eligible_graph(
    app_with_test_database: FastAPI,
    *,
    flare_on_day_before_as_of: bool = False,
    is_review_milestone_hit: bool = False,
) -> None:
    """Active weekly rules block, 8 km target, 7 km on day before as_of; clean last two days."""
    _seed_foot_graph(app_with_test_database)
    week_start, week_end = calendar_week_bounds(AS_OF)
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=ACTIVE_BLOCK_ID,
        focus_series_id="fs-ms-test",
        focus_title=None,
        week_number=1,
        start_date=week_start,
        end_date=week_end,
        status="active",
        is_review_milestone_hit=is_review_milestone_hit,
    )
    seed_weekly_target(
        app_with_test_database,
        target_id=FOOT_TARGET_ID,
        training_block_id=ACTIVE_BLOCK_ID,
        activity_class_id=FOOT_CLASS_ID,
        target_value=8.0,
        target_unit="km",
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-ms-prior-volume",
        activity_id=WALK_ACTIVITY_ID,
        logged_date=DAY_BEFORE_AS_OF,
        volume_value=7.0,
        volume_unit="km",
        rule_violations_at_log=[],
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-ms-day-before",
        check_in_date=DAY_BEFORE_AS_OF,
        pain_level=2,
        has_flare_up=flare_on_day_before_as_of,
    )
    seed_daily_check_in(
        app_with_test_database,
        check_in_id="ci-ms-as-of",
        check_in_date=AS_OF,
        pain_level=2,
        has_flare_up=False,
    )
    if flare_on_day_before_as_of:
        seed_flare_up_incident(
            app_with_test_database,
            incident_id="inc-ms-day-before",
            incident_date=DAY_BEFORE_AS_OF,
            daily_check_in_id="ci-ms-day-before",
        )


def milestone_trigger_log_payload() -> dict[str, Any]:
    """POST body: completes 8 km target on as_of with no violations."""
    return {
        "id": "log-ms-trigger",
        "activity_id": WALK_ACTIVITY_ID,
        "logged_date": AS_OF.isoformat(),
        "duration_minutes": 30,
        "volume_value": 1.0,
        "volume_unit": "km",
        "rpe": 5,
        "post_activity_feel": "steady",
        "notes": "Trigger milestone evaluation",
        "rule_violations_at_log": [],
    }
