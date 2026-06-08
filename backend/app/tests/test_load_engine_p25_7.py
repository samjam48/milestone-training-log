"""P25.7 — Exercise-only volume caps with units (engine tests).

plans/tickets-stage-2-5-polish-followup-2026-06-06.md
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.load_engine import check_violations
from app.tests.helpers.load_engine_fixtures import ACTIVITIES, ACTIVITY_CLASSES
from app.tests.test_load_engine import _call_load_risk_summary, _make_rule


def _make_volume_log(
    activity_id: str,
    logged_date: str,
    *,
    volume_value: float,
    volume_unit: str,
    duration_minutes: int | None = None,
    rpe: int = 3,
) -> dict[str, Any]:
    log: dict[str, Any] = {
        "id": f"log-{activity_id}-{logged_date}",
        "activity_id": activity_id,
        "logged_date": logged_date,
        "volume_value": volume_value,
        "volume_unit": volume_unit,
        "rpe": rpe,
    }
    if duration_minutes is not None:
        log["duration_minutes"] = duration_minutes
    return log


def _walk_only_context() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    walk = next(activity for activity in ACTIVITIES if activity["id"] == "act-walk")
    foot_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-foot")
    return [foot_class], [walk]


def test_check_violations_flags_weekly_volume_cap_km_when_projected_over_cap() -> None:
    """Km cap sums volume_value where volume_unit matches limit_unit."""
    as_of = "2026-05-25"
    rules = [
        _make_rule(
            id="rule-walk-weekly-km",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=5.0,
            limit_unit="km",
        ),
    ]
    logs = [
        _make_volume_log("act-walk", "2026-05-22", volume_value=4.0, volume_unit="km"),
    ]

    violations = check_violations(
        "act-walk",
        volume_value=2.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=rules,
        as_of=as_of,
    )

    cap = next(v for v in violations if v["rule_type"] == "weekly_volume_cap")
    assert cap["severity"] == "danger"
    assert "km" in cap["message"].lower()


def test_check_violations_weekly_volume_cap_hours_dry_run_uses_duration_minutes() -> None:
    """Hours cap dry-run converts duration_minutes to hours (÷ 60), not volume_value."""
    as_of = "2026-05-25"
    rules = [
        _make_rule(
            id="rule-walk-weekly-hours",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=2.0,
            limit_unit="hours",
        ),
    ]
    logs = [
        _make_volume_log(
            "act-walk",
            "2026-05-22",
            volume_value=90.0,
            volume_unit="minutes",
            duration_minutes=90,
        ),
    ]

    violations = check_violations(
        "act-walk",
        volume_value=30.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=rules,
        as_of=as_of,
        duration_minutes=30,
        volume_unit="minutes",
    )

    cap = next(v for v in violations if v["rule_type"] == "weekly_volume_cap")
    assert cap["severity"] == "danger"
    assert "hour" in cap["message"].lower()


def test_check_violations_hours_dry_run_without_duration_ignores_volume_value() -> None:
    """Without duration_minutes/volume_unit, hours dry-run does not project volume_value."""
    as_of = "2026-05-25"
    rules = [
        _make_rule(
            id="rule-walk-weekly-hours",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=2.0,
            limit_unit="hours",
        ),
    ]
    logs = [
        _make_volume_log(
            "act-walk",
            "2026-05-22",
            volume_value=90.0,
            volume_unit="minutes",
            duration_minutes=90,
        ),
    ]

    violations = check_violations(
        "act-walk",
        volume_value=30.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=rules,
        as_of=as_of,
    )

    assert all(v["rule_type"] != "weekly_volume_cap" for v in violations)


def test_check_violations_hours_dry_run_duration_only_without_volume_value() -> None:
    """Hours cap dry-run works when only duration_minutes is provided."""
    as_of = "2026-05-25"
    rules = [
        _make_rule(
            id="rule-walk-weekly-hours",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=2.0,
            limit_unit="hours",
        ),
    ]
    logs = [
        _make_volume_log(
            "act-walk",
            "2026-05-22",
            volume_value=90.0,
            volume_unit="minutes",
            duration_minutes=90,
        ),
    ]

    violations = check_violations(
        "act-walk",
        volume_value=0.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=rules,
        as_of=as_of,
        duration_minutes=30,
        volume_unit="minutes",
    )

    cap = next(v for v in violations if v["rule_type"] == "weekly_volume_cap")
    assert cap["severity"] == "danger"


def test_check_violations_ignores_volume_cap_when_unit_mismatch() -> None:
    """Logs in a different unit do not count toward the cap."""
    as_of = "2026-05-25"
    rules = [
        _make_rule(
            id="rule-walk-weekly-km",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=5.0,
            limit_unit="km",
        ),
    ]
    logs = [
        _make_volume_log(
            "act-walk",
            "2026-05-22",
            volume_value=60.0,
            volume_unit="minutes",
            duration_minutes=60,
        ),
    ]

    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=rules,
        as_of=as_of,
    )

    assert all(v["rule_type"] != "weekly_volume_cap" for v in violations)


def test_compute_load_risk_summary_exercise_bar_shows_volume_cap_unit_km() -> None:
    """Dashboard load-risk exercise rows display the cap limit_unit."""
    as_of = "2026-05-25"
    foot_class, walk = _walk_only_context()
    logs = [
        _make_volume_log("act-walk", "2026-05-22", volume_value=3.0, volume_unit="km"),
    ]
    rules = [
        _make_rule(
            id="rule-walk-weekly-km",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=10.0,
            limit_unit="km",
        ),
    ]

    summary = _call_load_risk_summary(
        as_of=as_of,
        classes=foot_class,
        activities=walk,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = next(
        item
        for item in summary["rule_limit_rows"]
        if item["rule_id"] == "rule-walk-weekly-km"
    )

    assert row["scope"] == "activity"
    assert row["actual"] == pytest.approx(3.0)
    assert row["limit"] == pytest.approx(10.0)
    assert row["unit"] == "km"


def test_compute_load_risk_summary_exercise_bar_hours_from_duration_minutes() -> None:
    """Hours caps aggregate duration_minutes / 60 for load-risk bars."""
    as_of = "2026-05-25"
    foot_class, walk = _walk_only_context()
    logs = [
        _make_volume_log(
            "act-walk",
            "2026-05-22",
            volume_value=90.0,
            volume_unit="minutes",
            duration_minutes=90,
        ),
    ]
    rules = [
        _make_rule(
            id="rule-walk-weekly-hours",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_volume_cap",
            threshold_value=3.0,
            limit_unit="hours",
        ),
    ]

    summary = _call_load_risk_summary(
        as_of=as_of,
        classes=foot_class,
        activities=walk,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = next(
        item
        for item in summary["rule_limit_rows"]
        if item["rule_id"] == "rule-walk-weekly-hours"
    )

    assert row["scope"] == "activity"
    assert row["actual"] == pytest.approx(1.5)
    assert row["limit"] == pytest.approx(3.0)
    assert row["unit"] == "hours"
