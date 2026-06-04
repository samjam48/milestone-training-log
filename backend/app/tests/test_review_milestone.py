"""Unit tests for review milestone pure evaluator (B10.1)."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.tests.helpers.review_milestone_test_utils import (
    AS_OF,
    DAY_BEFORE_AS_OF,
    get_evaluate_review_milestone,
)

evaluate_review_milestone = get_evaluate_review_milestone()


def _foot_progress(*, value: float, target: float = 8.0) -> dict[str, Any]:
    return {
        "weekly_target_id": "wt-foot",
        "activity_class_id": "cls-foot",
        "class_name": "Foot",
        "value": value,
        "target": target,
        "unit": "km",
        "state": "safe",
    }


def _recovery_progress(*, value: float, target: float = 4.0) -> dict[str, Any]:
    return {
        "weekly_target_id": "wt-recovery",
        "activity_class_id": "cls-recovery",
        "class_name": "Recovery",
        "value": value,
        "target": target,
        "unit": "sessions",
        "state": "safe",
    }


def _log(
    logged_date: str,
    *,
    violations: list[dict[str, Any]] | None = None,
    post_activity_feel: str | None = "steady",
) -> dict[str, Any]:
    return {
        "id": f"log-{logged_date}",
        "logged_date": logged_date,
        "rule_violations_at_log": violations if violations is not None else [],
        "post_activity_feel": post_activity_feel,
    }


def _check_in(check_in_date: str, *, has_flare_up: bool) -> dict[str, Any]:
    return {
        "id": f"ci-{check_in_date}",
        "check_in_date": check_in_date,
        "has_flare_up": has_flare_up,
    }


def _incident(incident_date: str) -> dict[str, Any]:
    return {"id": f"inc-{incident_date}", "incident_date": incident_date}


def test_evaluate_review_milestone_true_when_target_met_and_last_two_days_clean() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=8.0)],
            daily_check_ins=[
                _check_in(DAY_BEFORE_AS_OF.isoformat(), has_flare_up=False),
            ],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat()),
            ],
        )
        is True
    )


def test_evaluate_review_milestone_false_when_weekly_target_not_met() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=7.9)],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat()),
            ],
        )
        is False
    )


def test_evaluate_review_milestone_true_when_any_weekly_target_met() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[
                _foot_progress(value=2.0, target=8.0),
                _recovery_progress(value=4.0, target=4.0),
            ],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat()),
            ],
        )
        is True
    )


def test_evaluate_review_milestone_false_when_day_before_as_of_has_flare_check_in() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=10.0)],
            daily_check_ins=[
                _check_in(DAY_BEFORE_AS_OF.isoformat(), has_flare_up=True),
            ],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat()),
            ],
        )
        is False
    )


def test_evaluate_review_milestone_false_when_day_before_as_of_has_flare_incident() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=10.0)],
            daily_check_ins=[],
            flare_up_incidents=[_incident(DAY_BEFORE_AS_OF.isoformat())],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat()),
            ],
        )
        is False
    )


def test_evaluate_review_milestone_false_when_as_of_has_rule_violations_on_log() -> None:
    caution_violation = [
        {
            "rule_id": "rule-cap",
            "severity": "caution",
            "message": "Near weekly cap",
        }
    ]
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=10.0)],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat()),
                _log(AS_OF.isoformat(), violations=caution_violation),
            ],
        )
        is False
    )


def test_evaluate_review_milestone_true_when_bad_feel_without_violations() -> None:
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=9.0)],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log(DAY_BEFORE_AS_OF.isoformat(), post_activity_feel="bad"),
                _log(AS_OF.isoformat(), post_activity_feel="bad"),
            ],
        )
        is True
    )


def test_evaluate_review_milestone_false_when_only_as_of_is_clean() -> None:
    """Requires both as_of and the prior calendar day; older clean days are insufficient."""
    assert (
        evaluate_review_milestone(
            as_of=AS_OF,
            weekly_progress=[_foot_progress(value=9.0)],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log("2026-05-23", violations=[]),
                _log(AS_OF.isoformat()),
            ],
        )
        is False
    )


def test_evaluate_review_milestone_uses_date_objects_for_as_of() -> None:
    assert (
        evaluate_review_milestone(
            as_of=date(2026, 5, 25),
            weekly_progress=[_foot_progress(value=8.0)],
            daily_check_ins=[],
            flare_up_incidents=[],
            activity_logs=[
                _log("2026-05-24"),
                _log("2026-05-25"),
            ],
        )
        is True
    )
