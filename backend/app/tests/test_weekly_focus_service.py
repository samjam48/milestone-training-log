"""WTL.B7 / WRU.B1 — Weekly focus backend lifecycle.

Covers calendar week bounds, ensure_active_weekly_focus, rollover, catch-up
across missed Mondays, and historical isolation. Manual setup/reset/focus-title
and lazy legacy cutover tests were removed for WRU.B1.
"""

from __future__ import annotations

from collections import Counter

from fastapi import FastAPI
from sqlmodel import col, select

from app.models.block import TrainingBlock
from app.schemas.rules import RulePatch
from app.services.rules import list_rules, update_rule
from app.services.weekly_targets import list_weekly_targets
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_rule,
    seed_weekly_target,
    with_session,
)
from app.tests.helpers.weekly_focus_fixtures import (
    MONDAY_AS_OF,
    SUNDAY_AS_OF,
    WEEK_FIVE_END,
    WEEK_FIVE_START,
    WEEK_ONE_END,
    WEEK_ONE_START,
    WEEK_TWO_END,
    WEEK_TWO_START,
    calendar_week_bounds,
    require_weekly_focus_service,
    seed_weekly_focus_block,
)

FOCUS_SERIES_ID = "fs-return-walk"
FOCUS_TITLE = "Return to walking"


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


def _seed_week_one_focus_graph(
    app_with_test_database: FastAPI,
    *,
    block_id: str = "blk-wf-week-1",
    include_disabled_rule: bool = True,
    include_weekly_target: bool = True,
) -> None:
    seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-wf",
        name="Foot Load",
    )
    seed_activity(
        app_with_test_database,
        activity_id="act-walk-wf",
        activity_class_id="cls-foot-wf",
        name="Morning Walk",
        default_volume_unit="km",
    )
    seed_weekly_focus_block(
        app_with_test_database,
        block_id=block_id,
        focus_series_id=FOCUS_SERIES_ID,
        focus_title=FOCUS_TITLE,
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )
    seed_rule(
        app_with_test_database,
        rule_id="rule-wf-enabled",
        training_block_id=block_id,
        activity_class_id="cls-foot-wf",
        rule_type="weekly_load_cap",
        threshold_value=120.0,
        window_days=7,
        enabled=True,
    )
    if include_disabled_rule:
        seed_rule(
            app_with_test_database,
            rule_id="rule-wf-disabled",
            training_block_id=block_id,
            activity_class_id="cls-foot-wf",
            rule_type="frequency_limit",
            threshold_value=3.0,
            window_days=7,
            enabled=False,
        )
    if include_weekly_target:
        seed_weekly_target(
            app_with_test_database,
            target_id="wt-wf-walk",
            training_block_id=block_id,
            activity_class_id="cls-foot-wf",
            activity_id="act-walk-wf",
            target_value=3.0,
            target_unit="sessions",
        )


def test_calendar_week_bounds_sunday_and_monday() -> None:
    sunday_start, sunday_end = calendar_week_bounds(SUNDAY_AS_OF)
    monday_start, monday_end = calendar_week_bounds(MONDAY_AS_OF)

    assert sunday_start == WEEK_ONE_START
    assert sunday_end == WEEK_ONE_END
    assert monday_start == WEEK_TWO_START
    assert monday_end == WEEK_TWO_END


def test_ensure_active_weekly_focus_auto_creates_week_one_when_no_focus_exists(
    app_with_test_database: FastAPI,
) -> None:
    from app.tests.helpers.wru_b2_fixtures import assert_auto_created_weekly_block

    service = require_weekly_focus_service()
    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, SUNDAY_AS_OF)

    assert active is not None
    assert_auto_created_weekly_block(active, as_of=SUNDAY_AS_OF, week_number=1)


def test_ensure_active_weekly_focus_returns_current_week_when_already_active(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, SUNDAY_AS_OF)

    assert active is not None
    assert active.id == "blk-wf-week-1"
    assert active.start_date == WEEK_ONE_START
    assert active.end_date == WEEK_ONE_END
    assert active.week_number == 1


def test_rollover_copies_enabled_rules_and_weekly_targets(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        source_rules = list_rules(session, "blk-wf-week-1")
        source_targets = list_weekly_targets(session, "blk-wf-week-1")
        active = service.ensure_active_weekly_focus(session, MONDAY_AS_OF)
        assert active is not None
        week_two_rules = list_rules(session, active.id)
        week_two_targets = list_weekly_targets(session, active.id)
        week_one = session.get(TrainingBlock, "blk-wf-week-1")

    assert week_one is not None
    assert week_one.status == "completed"
    assert week_one.end_date == WEEK_ONE_END

    enabled_source_rules = [rule for rule in source_rules if rule.enabled]
    assert len(week_two_rules) == len(enabled_source_rules)
    assert Counter(_rule_signature(rule) for rule in week_two_rules) == Counter(
        _rule_signature(rule) for rule in enabled_source_rules
    )
    assert {rule.id for rule in week_two_rules}.isdisjoint({rule.id for rule in source_rules})

    assert len(week_two_targets) == len(source_targets)
    assert Counter(_target_signature(target) for target in week_two_targets) == Counter(
        _target_signature(target) for target in source_targets
    )
    assert {target.id for target in week_two_targets}.isdisjoint(
        {target.id for target in source_targets}
    )


def test_rollover_increments_week_number_same_series(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, MONDAY_AS_OF)

    assert active is not None
    assert active.week_number == 2
    assert active.focus_series_id == FOCUS_SERIES_ID
    assert active.focus_title == FOCUS_TITLE
    assert active.start_date == WEEK_TWO_START
    assert active.end_date == WEEK_TWO_END


def test_rollover_prior_week_with_no_rules_or_targets_still_creates_valid_week(
    app_with_test_database: FastAPI,
) -> None:
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wf-empty-week-1",
        focus_series_id=FOCUS_SERIES_ID,
        focus_title=FOCUS_TITLE,
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, MONDAY_AS_OF)
        rules = list_rules(session, active.id)
        targets = list_weekly_targets(session, active.id)

    assert active is not None
    assert active.week_number == 2
    assert rules == []
    assert targets == []


def test_catch_up_multiple_missed_mondays_creates_intermediate_completed_weeks(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(
        app_with_test_database,
        include_disabled_rule=False,
        include_weekly_target=False,
    )
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        active = service.ensure_active_weekly_focus(session, WEEK_FIVE_START)
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
    assert active.status == "active"

    completed_weeks = [block for block in weekly_focus_blocks if block.status == "completed"]
    assert len(completed_weeks) == 4
    assert [block.week_number for block in completed_weeks] == [1, 2, 3, 4]
    assert all(block.focus_series_id == FOCUS_SERIES_ID for block in weekly_focus_blocks)


def test_mid_week_rule_edit_does_not_change_prior_week_rules(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        week_two = service.ensure_active_weekly_focus(session, MONDAY_AS_OF)
        assert week_two is not None
        week_two_rules = list_rules(session, week_two.id)
        week_two_rule_id = week_two_rules[0].id
        update_rule(
            session,
            week_two_rule_id,
            RulePatch(threshold_value=200.0),
        )
        week_one_rules = list_rules(session, "blk-wf-week-1")
        week_two_rules_after = list_rules(session, week_two.id)

    assert week_one_rules[0].threshold_value == 120.0
    assert week_two_rules_after[0].threshold_value == 200.0


def test_historical_week_rules_remain_readable_for_review(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        service.ensure_active_weekly_focus(session, MONDAY_AS_OF)
        historical_rules = list_rules(session, "blk-wf-week-1")
        historical_targets = list_weekly_targets(session, "blk-wf-week-1")

    assert len(historical_rules) == 2
    assert len(historical_targets) == 1
    assert {rule.id for rule in historical_rules} == {
        "rule-wf-enabled",
        "rule-wf-disabled",
    }


def test_completed_weekly_focus_periods_listed_for_history(
    app_with_test_database: FastAPI,
) -> None:
    _seed_week_one_focus_graph(app_with_test_database)
    service = require_weekly_focus_service()

    for session in with_session(app_with_test_database):
        service.ensure_active_weekly_focus(session, MONDAY_AS_OF)
        blocks = list(
            session.exec(
                select(TrainingBlock)
                .where(TrainingBlock.period_kind == "weekly_focus")
                .order_by(col(TrainingBlock.start_date).desc())
            ).all()
        )

    assert len(blocks) == 2
    completed = next(block for block in blocks if block.status == "completed")
    active = next(block for block in blocks if block.status == "active")
    assert completed.id == "blk-wf-week-1"
    assert completed.focus_title == FOCUS_TITLE
    assert active.week_number == 2
