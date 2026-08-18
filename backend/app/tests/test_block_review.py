"""Service-level tests for block-review combined load series."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi import FastAPI
from sqlmodel import Session

from app.schemas.load_engine import LoadPoint
from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.activity_logs import list_activity_logs
from app.services.block_review import get_block_review
from app.services.load_engine import compute_combined_load_series, format_iso_date
from app.services.load_queries import (
    activity_class_dict,
    activity_dict,
    log_dict,
    rule_dict,
)
from app.services.rules import list_rules
from app.tests.helpers.seed import (
    seed_activity,
    seed_activity_class,
    seed_activity_log,
    seed_rule,
    seed_training_block,
    with_session,
)

BLOCK_ID = "blk-review-combined-service"
BLOCK_START = date(2026, 4, 7)
BLOCK_END = date(2026, 4, 10)
LOG_DAY = date(2026, 4, 8)


@pytest.fixture
def session(app_with_test_database: FastAPI) -> Iterator[Session]:
    for db_session in with_session(app_with_test_database):
        yield db_session


def _seed_two_class_review_block(
    app_with_test_database: FastAPI,
    *,
    foot_weight: float = 1.0,
) -> None:
    seed_training_block(
        app_with_test_database,
        block_id=BLOCK_ID,
        name="Review Combined",
        start_date=BLOCK_START,
        end_date=BLOCK_END,
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
        load_weight=foot_weight,
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
        training_block_id=BLOCK_ID,
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
        logged_date=LOG_DAY,
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )
    seed_activity_log(
        app_with_test_database,
        log_id="log-foot-review-combined",
        activity_id="act-walk-review-combined",
        logged_date=LOG_DAY,
        volume_value=2.0,
        volume_unit="km",
        rpe=5,
    )


def _expected_combined_series(session: Session) -> list[LoadPoint]:
    activity_classes = [activity_class_dict(cls) for cls in list_activity_classes(session)]
    activities = [activity_dict(activity) for activity in list_activities(session)]
    logs = [
        log_dict(log)
        for log in list_activity_logs(session, start_date=BLOCK_START, end_date=BLOCK_END)
    ]
    rules = [rule_dict(rule) for rule in list_rules(session, BLOCK_ID)]
    return compute_combined_load_series(
        activities,
        logs,
        format_iso_date(BLOCK_START),
        format_iso_date(BLOCK_END),
        activity_classes=activity_classes,
        rules=rules,
    )


def test_get_block_review_load_series_matches_combined_weighted_helper(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    _seed_two_class_review_block(app_with_test_database)
    expected = _expected_combined_series(session)

    review = get_block_review(session, BLOCK_ID)

    assert len(review.load_series) == len(expected)
    for actual, engine_point in zip(review.load_series, expected, strict=True):
        assert actual.date.isoformat() == engine_point["date"]
        assert actual.load == pytest.approx(engine_point["load"])
        assert actual.daily_load == pytest.approx(engine_point["daily_load"])

    log_point = next(point for point in review.load_series if point.date == LOG_DAY)
    assert log_point.daily_load == pytest.approx(3.0)
    assert log_point.daily_load != pytest.approx(10.0)
    assert log_point.daily_load != pytest.approx(1.5)


def test_get_block_review_load_series_includes_second_class_and_weight(
    app_with_test_database: FastAPI,
    session: Session,
) -> None:
    _seed_two_class_review_block(app_with_test_database, foot_weight=2.0)
    expected = _expected_combined_series(session)

    review = get_block_review(session, BLOCK_ID)

    log_point = next(point for point in review.load_series if point.date == LOG_DAY)
    # Arm tax 1.5 at weight 1 + foot tax 1.5 at weight 2 → 4.5 combined.
    assert log_point.daily_load == pytest.approx(4.5)
    later_point = next(point for point in review.load_series if point.date == BLOCK_END)
    assert later_point.load > 0
    for actual, engine_point in zip(review.load_series, expected, strict=True):
        assert actual.daily_load == pytest.approx(engine_point["daily_load"])
        assert actual.load == pytest.approx(engine_point["load"])
