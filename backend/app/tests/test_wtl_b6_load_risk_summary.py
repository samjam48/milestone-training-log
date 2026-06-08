"""WTL.B6 — Load risk rule-limit summary contract (failing tests until implemented).

Replaces class_bars with per-rule limit rows and adds load-tax day state on week_days.
"""

from __future__ import annotations

from typing import Any, Literal

import pytest

from app.services.load_engine import add_days, each_day
from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    LOGS,
)
from app.tests.helpers.wtl_b6_fixtures import (
    LOAD_RISK_STRIP_CAUTION_AT,
    LOAD_RISK_STRIP_DANGER_AT,
    WTL_B6_BIKE_ID,
    WTL_B6_CLASS_ID,
    WTL_B6_RULES,
    WTL_B6_WALK_ID,
    wtl_b6_log,
    wtl_b6_rule,
)
from app.tests.test_load_engine import _call_load_risk_summary, _make_log, _make_rule

SafetyState = Literal["safe", "caution", "danger"]

RULE_LIMIT_ROW_REQUIRED_KEYS = frozenset(
    {
        "id",
        "scope",
        "rule_id",
        "rule_type",
        "activity_class_id",
        "class_name",
        "actual",
        "limit",
        "unit",
        "state",
        "label",
    }
)


def _require_rule_limit_rows(summary: dict[str, Any]) -> list[dict[str, Any]]:
    assert "rule_limit_rows" in summary, (
        "load_risk_summary must expose rule_limit_rows (WTL.B6)"
    )
    rows = summary["rule_limit_rows"]
    assert isinstance(rows, list)
    return rows


def _row_by_rule_id(summary: dict[str, Any], rule_id: str) -> dict[str, Any]:
    rows = _require_rule_limit_rows(summary)
    matches = [row for row in rows if row.get("rule_id") == rule_id]
    assert len(matches) == 1, f"expected one row for rule {rule_id}, got {matches!r}"
    return matches[0]


def _assert_rule_limit_row_shape(row: dict[str, Any]) -> None:
    missing = RULE_LIMIT_ROW_REQUIRED_KEYS - set(row.keys())
    assert not missing, f"rule_limit_rows entry missing keys: {sorted(missing)}"
    assert row["scope"] in {"class", "activity"}
    assert row["state"] in {"safe", "caution", "danger"}


def _week_day_states(summary: dict[str, Any]) -> dict[str, SafetyState]:
    states: dict[str, SafetyState] = {}
    for day in summary["week_days"]:
        assert "state" in day, "week_days must include load-tax state (WTL.B6)"
        assert day["state"] in {"safe", "caution", "danger"}
        states[day["date"]] = day["state"]
    return states


def _foot_class() -> dict[str, Any]:
    return next(cls for cls in ACTIVITY_CLASSES if cls["id"] == WTL_B6_CLASS_ID)


def _foot_activities() -> list[dict[str, Any]]:
    return [a for a in ACTIVITIES if a["activity_class_id"] == WTL_B6_CLASS_ID]


# ---------------------------------------------------------------------------
# week_days — rolling strip + load-tax state (WTL.B5)
# ---------------------------------------------------------------------------


def test_compute_load_risk_summary_week_days_span_seven_days_ending_as_of() -> None:
    summary = _call_load_risk_summary(rules=WTL_B6_RULES, delayed_tax_hits=[])

    assert [row["date"] for row in summary["week_days"]] == each_day(
        add_days(AS_OF, -6),
        AS_OF,
    )


def test_compute_load_risk_summary_week_days_include_load_tax_state() -> None:
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        classes=[_foot_class()],
        activities=_foot_activities(),
        logs=[_make_log("act-walk", AS_OF, volume_value=1.0, rpe=3)],
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )

    states = _week_day_states(summary)
    assert states[AS_OF] == "safe"


def test_compute_load_risk_summary_week_days_load_tax_state_tiers() -> None:
    """Strip state tiers use rolling load-tax totals (WTL.B6 tested constants)."""
    quiet = _call_load_risk_summary(
        as_of=AS_OF,
        classes=[_foot_class()],
        activities=_foot_activities(),
        logs=[_make_log("act-walk", AS_OF, volume_value=0.5, rpe=3)],
        rules=[],
        delayed_tax_hits=[],
    )
    caution_logs = [
        _make_log("act-walk", add_days(AS_OF, -offset), volume_value=2.0, rpe=7)
        for offset in range(3)
    ]
    caution = _call_load_risk_summary(
        as_of=AS_OF,
        classes=[_foot_class()],
        activities=_foot_activities(),
        logs=caution_logs,
        rules=[],
        delayed_tax_hits=[],
    )
    danger_logs = [
        _make_log("act-walk", add_days(AS_OF, -offset), volume_value=3.0, rpe=9)
        for offset in range(5)
    ]
    danger = _call_load_risk_summary(
        as_of=AS_OF,
        classes=[_foot_class()],
        activities=_foot_activities(),
        logs=danger_logs,
        rules=[],
        delayed_tax_hits=[],
    )

    quiet_state = _week_day_states(quiet)[AS_OF]
    caution_state = _week_day_states(caution)[AS_OF]
    danger_state = _week_day_states(danger)[AS_OF]

    assert quiet_state == "safe"
    assert caution_state == "caution"
    assert danger_state == "danger"
    assert LOAD_RISK_STRIP_CAUTION_AT < LOAD_RISK_STRIP_DANGER_AT


# ---------------------------------------------------------------------------
# rule_limit_rows contract — class-scoped limits
# ---------------------------------------------------------------------------


def test_compute_load_risk_summary_class_frequency_counts_volume_logged_sessions() -> None:
    """Walk logs with volume_unit must count toward class frequency (not 0/3)."""
    logs = [
        wtl_b6_log(
            log_id="log-walk-only",
            activity_id=WTL_B6_WALK_ID,
            logged_date=AS_OF,
            volume_value=1.0,
            volume_unit="km",
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-freq-foot")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "class"
    assert row["rule_type"] == "frequency_limit"
    assert row["actual"] == pytest.approx(1)
    assert row["limit"] == pytest.approx(3)
    assert row["unit"] == "sessions"
    assert row["state"] == "safe"


def test_compute_load_risk_summary_class_frequency_limit_row() -> None:
    logs = [
        _make_log("act-walk", "2026-05-23"),
        _make_log("act-bike", "2026-05-24", volume_value=20, rpe=5),
        _make_log("act-walk", AS_OF),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-freq-foot")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "class"
    assert row["rule_type"] == "frequency_limit"
    assert row["activity_class_id"] == WTL_B6_CLASS_ID
    assert row["class_name"] == "High-Intensity Foot Load"
    assert row["activity_id"] is None
    assert row["actual"] == pytest.approx(3)
    assert row["limit"] == pytest.approx(3)
    assert row["unit"] == "sessions"
    assert row["state"] == "danger"


def test_compute_load_risk_summary_class_consecutive_day_limit_row() -> None:
    logs = [
        _make_log("act-walk", add_days(AS_OF, -1)),
        _make_log("act-bike", AS_OF, volume_value=20, rpe=5),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-consec-foot")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "class"
    assert row["rule_type"] == "consecutive_day_limit"
    assert row["actual"] == pytest.approx(2)
    assert row["limit"] == pytest.approx(2)
    assert row["unit"] == "days"
    assert row["state"] == "danger"


def test_compute_load_risk_summary_class_rest_between_row_is_status_not_fill() -> None:
    logs = [_make_log("act-walk", add_days(AS_OF, -1))]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-rest-foot")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "class"
    assert row["rule_type"] == "rest_between_class"
    assert row["actual"] == pytest.approx(1)
    assert row["limit"] == pytest.approx(3)
    assert row["unit"] == "days"
    assert row["state"] == "danger"
    assert row.get("display_mode") == "status"


def test_compute_load_risk_summary_rest_row_safe_when_no_prior_session() -> None:
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=[],
        rules=[
            wtl_b6_rule(
                id="rule-rest-only",
                rule_type="rest_between_class",
                threshold_value=3,
                window_days=3,
            )
        ],
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-rest-only")

    assert row["state"] == "safe"
    assert "no prior" in row["label"].lower()


def test_compute_load_risk_summary_legacy_weekly_load_cap_class_row() -> None:
    logs = [_make_log("act-walk", "2026-05-22", volume_value=1.5, rpe=3)]
    rules = [
        _make_rule(
            id="rule-cap-foot",
            activity_class_id=WTL_B6_CLASS_ID,
            rule_type="weekly_load_cap",
            threshold_value=120.0,
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-cap-foot")

    assert row["scope"] == "class"
    assert row["rule_type"] == "weekly_load_cap"
    assert row["actual"] == pytest.approx(4.5)
    assert row["limit"] == pytest.approx(120.0)
    assert row["unit"] == "load"
    assert row["state"] == "safe"


# ---------------------------------------------------------------------------
# rule_limit_rows contract — exercise-scoped limits
# ---------------------------------------------------------------------------


def test_compute_load_risk_summary_exercise_weekly_volume_cap_row() -> None:
    logs = [
        wtl_b6_log(
            log_id="log-walk-a",
            activity_id=WTL_B6_WALK_ID,
            logged_date="2026-05-22",
            volume_value=4.0,
            volume_unit="km",
        ),
        wtl_b6_log(
            log_id="log-walk-b",
            activity_id=WTL_B6_WALK_ID,
            logged_date="2026-05-24",
            volume_value=3.5,
            volume_unit="km",
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-vol-walk-weekly")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "activity"
    assert row["rule_type"] == "weekly_volume_cap"
    assert row["activity_id"] == WTL_B6_WALK_ID
    assert row["activity_name"] == "Morning Walk"
    assert row["actual"] == pytest.approx(7.5)
    assert row["limit"] == pytest.approx(8.0)
    assert row["unit"] == "km"
    assert row["state"] == "caution"


def test_compute_load_risk_summary_exercise_daily_volume_cap_row() -> None:
    logs = [
        wtl_b6_log(
            log_id="log-bike-today",
            activity_id=WTL_B6_BIKE_ID,
            logged_date=AS_OF,
            volume_value=30,
            volume_unit="minutes",
            duration_minutes=30,
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-vol-bike-daily")
    _assert_rule_limit_row_shape(row)

    assert row["scope"] == "activity"
    assert row["rule_type"] == "daily_volume_cap"
    assert row["activity_id"] == WTL_B6_BIKE_ID
    assert row["activity_name"] == "Stationary Bike"
    assert row["actual"] == pytest.approx(30)
    assert row["limit"] == pytest.approx(45)
    assert row["unit"] == "minutes"
    assert row["state"] == "safe"


def test_compute_load_risk_summary_exercise_frequency_never_becomes_class_row() -> None:
    rules = WTL_B6_RULES + [
        wtl_b6_rule(
            id="rule-freq-walk",
            activity_id=WTL_B6_WALK_ID,
            rule_type="frequency_limit",
            threshold_value=2,
        ),
    ]
    logs = [
        _make_log(WTL_B6_WALK_ID, "2026-05-23"),
        _make_log(WTL_B6_WALK_ID, AS_OF),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-freq-walk")

    assert row["scope"] == "activity"
    assert row["activity_id"] == WTL_B6_WALK_ID
    class_rows = [
        r
        for r in _require_rule_limit_rows(summary)
        if r["scope"] == "class" and r["rule_type"] == "frequency_limit"
    ]
    assert len(class_rows) == 1
    assert class_rows[0]["rule_id"] == "rule-freq-foot"


# ---------------------------------------------------------------------------
# High-Intensity Foot Load regression
# ---------------------------------------------------------------------------


def test_compute_load_risk_summary_foot_load_owner_scenario_separate_rows() -> None:
    """Owner-style rules: class sessions, walk weekly km, bike daily minutes stay separate."""
    logs = [
        wtl_b6_log(
            log_id="log-walk-km-a",
            activity_id=WTL_B6_WALK_ID,
            logged_date=add_days(AS_OF, -5),
            volume_value=3.0,
            volume_unit="km",
        ),
        wtl_b6_log(
            log_id="log-walk-km-b",
            activity_id=WTL_B6_WALK_ID,
            logged_date=add_days(AS_OF, -2),
            volume_value=2.5,
            volume_unit="km",
        ),
        wtl_b6_log(
            log_id="log-walk-km-c",
            activity_id=WTL_B6_WALK_ID,
            logged_date=add_days(AS_OF, -1),
            volume_value=1.5,
            volume_unit="km",
        ),
        wtl_b6_log(
            log_id="log-bike-today",
            activity_id=WTL_B6_BIKE_ID,
            logged_date=AS_OF,
            volume_value=20,
            volume_unit="minutes",
            duration_minutes=20,
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )

    class_freq = _row_by_rule_id(summary, "rule-freq-foot")
    assert class_freq["scope"] == "class"
    assert class_freq["actual"] == pytest.approx(4)
    assert class_freq["limit"] == pytest.approx(3)
    assert class_freq["unit"] == "sessions"
    assert class_freq["state"] == "danger"

    walk_row = _row_by_rule_id(summary, "rule-vol-walk-weekly")
    assert walk_row["scope"] == "activity"
    assert walk_row["activity_name"] == "Morning Walk"
    assert walk_row["actual"] == pytest.approx(7.0)
    assert walk_row["limit"] == pytest.approx(8.0)
    assert walk_row["unit"] == "km"

    bike_row = _row_by_rule_id(summary, "rule-vol-bike-daily")
    assert bike_row["scope"] == "activity"
    assert bike_row["activity_name"] == "Stationary Bike"
    assert bike_row["actual"] == pytest.approx(20)
    assert bike_row["limit"] == pytest.approx(45)
    assert bike_row["unit"] == "minutes"

    misleading = [
        row
        for row in _require_rule_limit_rows(summary)
        if row["scope"] == "class"
        and row["rule_type"] == "weekly_volume_cap"
        and row["unit"] == "km"
    ]
    assert misleading == []


def test_compute_load_risk_summary_foot_load_regression_no_class_km_from_walk_rule() -> None:
    """Full mock logs must not promote the walk weekly km cap into a class-wide bar."""
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=LOGS,
        rules=WTL_B6_RULES,
        delayed_tax_hits=[],
    )

    walk_row = _row_by_rule_id(summary, "rule-vol-walk-weekly")
    assert walk_row["scope"] == "activity"
    assert walk_row["actual"] == pytest.approx(1.5)
    assert walk_row["limit"] == pytest.approx(8.0)

    misleading = [
        row
        for row in _require_rule_limit_rows(summary)
        if row["scope"] == "class"
        and row["rule_type"] in {"weekly_volume_cap", "daily_volume_cap"}
    ]
    assert misleading == []


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_compute_load_risk_summary_ignores_disabled_rules() -> None:
    rules = [
        wtl_b6_rule(
            id="rule-disabled-freq",
            rule_type="frequency_limit",
            threshold_value=1,
            enabled=False,
        ),
        wtl_b6_rule(
            id="rule-enabled-freq",
            rule_type="frequency_limit",
            threshold_value=5,
            enabled=True,
        ),
    ]
    logs = [
        _make_log("act-walk", AS_OF),
        _make_log("act-bike", add_days(AS_OF, -1), volume_value=20, rpe=5),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    rows = _require_rule_limit_rows(summary)
    rule_ids = {row["rule_id"] for row in rows}

    assert "rule-disabled-freq" not in rule_ids
    assert "rule-enabled-freq" in rule_ids


def test_compute_load_risk_summary_volume_cap_ignores_mismatched_units() -> None:
    rules = [
        wtl_b6_rule(
            id="rule-vol-km",
            activity_id=WTL_B6_WALK_ID,
            rule_type="weekly_volume_cap",
            threshold_value=10,
            limit_unit="km",
        ),
    ]
    logs = [
        wtl_b6_log(
            log_id="log-minutes-only",
            activity_id=WTL_B6_WALK_ID,
            logged_date=AS_OF,
            volume_value=60,
            volume_unit="minutes",
            duration_minutes=60,
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-vol-km")

    assert row["actual"] == pytest.approx(0)
    assert row["state"] == "safe"


def test_compute_load_risk_summary_excludes_logs_outside_rolling_window() -> None:
    rules = [
        wtl_b6_rule(
            id="rule-vol-walk",
            activity_id=WTL_B6_WALK_ID,
            rule_type="weekly_volume_cap",
            threshold_value=5,
            limit_unit="km",
        ),
    ]
    logs = [
        wtl_b6_log(
            log_id="log-outside",
            activity_id=WTL_B6_WALK_ID,
            logged_date=add_days(AS_OF, -7),
            volume_value=99,
            volume_unit="km",
        ),
        wtl_b6_log(
            log_id="log-inside",
            activity_id=WTL_B6_WALK_ID,
            logged_date=AS_OF,
            volume_value=2,
            volume_unit="km",
        ),
    ]
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = _row_by_rule_id(summary, "rule-vol-walk")

    assert row["actual"] == pytest.approx(2)


def test_compute_load_risk_summary_empty_rows_when_no_enabled_limits() -> None:
    summary = _call_load_risk_summary(
        as_of=AS_OF,
        rules=[],
        delayed_tax_hits=[],
    )

    assert len(summary["week_days"]) == 7
    assert _require_rule_limit_rows(summary) == []
    assert "class_bars" not in summary or summary.get("class_bars") == []
