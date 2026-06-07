"""Unit tests for the pure load engine module (B4.1).

Fixtures mirror export/src/lib/mockData.ts at as_of=2026-05-25.
"""

from __future__ import annotations

import importlib
import inspect
from datetime import date
from typing import Any, cast

import pytest

from app.schemas.load_engine import Suggestion
from app.services import load_engine
from app.services.load_engine import (
    DEFAULT_RPE,
    add_days,
    check_violations,
    compute_class_statuses,
    compute_clean_streak,
    compute_daily_safety_scores,
    compute_load_series,
    compute_suggestion_buckets,
    compute_suggestions,
    compute_weekly_progress,
    daily_load,
    detect_delayed_tax,
    diff_days,
    each_day,
    format_iso_date,
    log_load,
    parse_iso_date,
    rolling_load,
)
from app.tests.helpers.wtl_b5_fixtures import (
    WTL_B5_ACTIVITIES,
    WTL_B5_ACTIVITY_CLASSES,
    WTL_B5_AS_OF,
    WTL_B5_CLASS_ID,
    WTL_B5_STRETCH_ID,
    WTL_B5_WALK_ID,
    wtl_b5_log,
    wtl_b5_rule,
)
from app.tests.helpers.load_engine_fixtures import (
    ACTIVITIES,
    ACTIVITY_CLASSES,
    AS_OF,
    CHECK_INS,
    INCIDENTS,
    LOGS,
    PERIOD_START,
    RULES,
    WEEKLY_TARGETS,
)

# ---------------------------------------------------------------------------
# Module purity
# ---------------------------------------------------------------------------


def test_load_engine_module_has_no_fastapi_or_sqlmodel_imports() -> None:
    source = inspect.getsource(load_engine)
    assert "fastapi" not in source.lower()
    assert "sqlmodel" not in source.lower()


# ---------------------------------------------------------------------------
# ISO date helpers (load.ts parity)
# ---------------------------------------------------------------------------


def test_parse_iso_date_returns_utc_calendar_date() -> None:
    parsed = parse_iso_date("2026-05-25")
    assert parsed == date(2026, 5, 25)


def test_format_iso_date_round_trips_parse() -> None:
    iso = "2026-05-25"
    assert format_iso_date(parse_iso_date(iso)) == iso


def test_add_days_shifts_calendar_dates() -> None:
    assert add_days("2026-05-25", 1) == "2026-05-26"
    assert add_days("2026-05-25", -7) == "2026-05-18"


def test_diff_days_is_inclusive_day_count() -> None:
    assert diff_days("2026-05-25", "2026-05-25") == 1
    assert diff_days("2026-05-19", "2026-05-25") == 7


def test_each_day_enumerates_inclusive_range() -> None:
    assert each_day("2026-05-23", "2026-05-25") == [
        "2026-05-23",
        "2026-05-24",
        "2026-05-25",
    ]


def test_each_day_returns_empty_for_reversed_range() -> None:
    assert each_day("2026-05-25", "2026-05-23") == []


# ---------------------------------------------------------------------------
# Load primitives (load.ts parity)
# ---------------------------------------------------------------------------


def test_default_rpe_is_neutral_midpoint() -> None:
    assert DEFAULT_RPE == 5


def test_log_load_multiplies_volume_by_rpe() -> None:
    assert log_load({"volume_value": 2.0, "rpe": 4}) == 8.0


def test_log_load_uses_default_rpe_when_missing() -> None:
    assert log_load({"volume_value": 2.0, "rpe": None}) == 10.0


def test_daily_load_sums_all_logs_on_date() -> None:
    logs = [
        {"logged_date": "2026-05-25", "volume_value": 1.0, "rpe": 5},
        {"logged_date": "2026-05-25", "volume_value": 2.0, "rpe": 3},
        {"logged_date": "2026-05-24", "volume_value": 99.0, "rpe": 9},
    ]
    assert daily_load(logs, "2026-05-25") == 11.0


def test_rolling_load_sums_inclusive_window_ending_on_as_of() -> None:
    # log-25: 2026-05-22 walk 1.5 km @ RPE 3 => 4.5 load (only foot log in 7-day window)
    foot_logs = [log for log in LOGS if log["activity_id"] in {"act-walk", "act-bike"}]
    assert rolling_load(foot_logs, AS_OF, 7) == pytest.approx(4.5)


def test_rolling_load_returns_zero_when_window_days_not_positive() -> None:
    assert rolling_load(LOGS, AS_OF, 0) == 0.0
    assert rolling_load(LOGS, AS_OF, -3) == 0.0


def test_rolling_load_with_empty_logs_returns_zero() -> None:
    assert rolling_load([], AS_OF, 7) == 0.0


# ---------------------------------------------------------------------------
# compute_class_statuses (engine.ts parity)
# ---------------------------------------------------------------------------


def test_compute_class_statuses_marks_foot_class_caution_at_mock_as_of() -> None:
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "caution"
    assert foot["last_done_date"] == "2026-05-22"
    assert "rest" in foot["reason"].lower()


def test_compute_class_statuses_marks_upper_body_danger_one_day_after_session() -> None:
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES
    )
    upper = next(s for s in statuses if s["activity_class_id"] == "cls-upper")
    assert upper["state"] == "danger"
    assert upper["last_done_date"] == "2026-05-24"


def test_compute_class_statuses_returns_safe_when_class_has_no_history() -> None:
    empty_logs: list[dict[str, Any]] = []
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, empty_logs, RULES
    )
    for status in statuses:
        assert status["state"] == "safe"
        assert "no prior" in status["reason"].lower()


def test_compute_class_statuses_ignores_logs_after_as_of() -> None:
    future_log = {
        "id": "log-future",
        "activity_id": "act-walk",
        "logged_date": "2026-05-26",
        "volume_value": 5.0,
        "rpe": 10,
    }
    statuses = compute_class_statuses(
        AS_OF,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        [*LOGS, future_log],
        RULES,
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["last_done_date"] == "2026-05-22"


# ---------------------------------------------------------------------------
# S25.B4 — effective_rules_for_activity + extended compute_class_statuses
# ---------------------------------------------------------------------------


def _make_rule(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "training_block_id": "blk-1",
        "window_days": 7,
        "enabled": True,
        "created_at": "2026-04-07T06:00:00Z",
    }
    return {**base, **overrides}


def _effective_rules_for_activity() -> Any:
    assert hasattr(load_engine, "effective_rules_for_activity"), (
        "effective_rules_for_activity not implemented"
    )
    return load_engine.effective_rules_for_activity


def test_effective_rules_for_activity_prefers_exercise_cap_over_class_cap() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="class-cap",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
        ),
        _make_rule(
            id="exercise-cap",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=40,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rules = [rule for rule in effective if rule["rule_type"] == "weekly_load_cap"]
    assert len(cap_rules) == 1
    assert cap_rules[0]["id"] == "exercise-cap"
    assert cap_rules[0]["threshold_value"] == 40


def test_effective_rules_for_activity_falls_back_to_class_cap_without_exercise_rule() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="class-cap",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rules = [rule for rule in effective if rule["rule_type"] == "weekly_load_cap"]
    assert len(cap_rules) == 1
    assert cap_rules[0]["id"] == "class-cap"


def test_effective_rules_for_activity_no_cap_means_unlimited() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="rest-only",
            activity_class_id="cls-foot",
            rule_type="rest_between_class",
            threshold_value=3,
            window_days=3,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rule_types = {"weekly_load_cap", "daily_volume_cap", "weekly_volume_cap"}
    assert not any(rule["rule_type"] in cap_rule_types for rule in effective)


def test_effective_rules_for_activity_picks_strictest_exercise_cap_when_multiple() -> None:
    """Strictest cap = lowest threshold for load-cap rules."""
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="class-cap",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
        ),
        _make_rule(
            id="exercise-cap-loose",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=80,
        ),
        _make_rule(
            id="exercise-cap-strict",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=40,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rules = [rule for rule in effective if rule["rule_type"] == "weekly_load_cap"]
    assert len(cap_rules) == 1
    assert cap_rules[0]["id"] == "exercise-cap-strict"
    assert cap_rules[0]["threshold_value"] == 40


def test_effective_rules_for_activity_picks_strictest_exercise_rest_when_multiple() -> None:
    """Strictest rest = highest threshold (more rest days required)."""
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="rest-loose",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="rest_between_class",
            threshold_value=2,
            window_days=2,
        ),
        _make_rule(
            id="rest-strict",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="rest_between_class",
            threshold_value=5,
            window_days=5,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    rest_rules = [
        rule for rule in effective if rule["rule_type"] == "rest_between_class"
    ]
    assert len(rest_rules) == 1
    assert rest_rules[0]["id"] == "rest-strict"
    assert rest_rules[0]["threshold_value"] == 5


def test_effective_rules_for_activity_ignores_disabled_rules() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="class-cap",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
            enabled=False,
        ),
        _make_rule(
            id="exercise-cap",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=40,
            enabled=False,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rules = [rule for rule in effective if rule["rule_type"] == "weekly_load_cap"]
    assert cap_rules == []


def test_effective_rules_for_activity_ignores_exercise_rules_for_other_activities() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="bike-cap",
            activity_class_id="cls-foot",
            activity_id="act-bike",
            rule_type="weekly_load_cap",
            threshold_value=30,
        ),
        _make_rule(
            id="class-cap",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    cap_rules = [rule for rule in effective if rule["rule_type"] == "weekly_load_cap"]
    assert len(cap_rules) == 1
    assert cap_rules[0]["id"] == "class-cap"


def test_effective_rules_for_activity_separates_volume_caps_by_limit_unit() -> None:
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="class-km",
            activity_class_id="cls-foot",
            rule_type="daily_volume_cap",
            threshold_value=5,
            limit_unit="km",
            window_days=1,
        ),
        _make_rule(
            id="exercise-km",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="daily_volume_cap",
            threshold_value=2,
            limit_unit="km",
            window_days=1,
        ),
        _make_rule(
            id="exercise-min",
            activity_class_id="cls-foot",
            activity_id="act-bike",
            rule_type="daily_volume_cap",
            threshold_value=30,
            limit_unit="minutes",
            window_days=1,
        ),
    ]
    walk_effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    walk_km = [
        rule
        for rule in walk_effective
        if rule["rule_type"] == "daily_volume_cap" and rule.get("limit_unit") == "km"
    ]
    assert len(walk_km) == 1
    assert walk_km[0]["id"] == "exercise-km"


def test_compute_class_statuses_does_not_elevate_exercise_load_cap_to_class() -> None:
    """Exercise-specific caps do not make the whole class look capped."""
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"] not in {"weekly_load_cap", "frequency_limit"}
    ] + [
        _make_rule(
            id="rule-cap-foot-class",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=120,
        ),
        _make_rule(
            id="rule-cap-walk",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=4,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["label"] != "Load Cap Hit"


def test_compute_class_statuses_uses_class_cap_when_no_exercise_rule() -> None:
    rules = [
        rule for rule in RULES if rule["rule_type"] != "weekly_load_cap"
    ] + [
        _make_rule(
            id="rule-cap-foot-low",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=4,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "danger"
    assert foot["label"] == "Load Cap Hit"


def test_compute_class_statuses_no_cap_means_no_cap_violation() -> None:
    rules = [rule for rule in RULES if rule["rule_type"] != "weekly_load_cap"]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["label"] != "Load Cap Hit"


def test_compute_class_statuses_does_not_elevate_exercise_frequency_to_class() -> None:
    rules = [
        rule for rule in RULES if rule["rule_type"] != "frequency_limit"
    ] + [
        _make_rule(
            id="rule-freq-walk",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="frequency_limit",
            threshold_value=1,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["label"] != "Frequency Limit"


def test_compute_class_statuses_recovery_without_enabled_cap_rules_stays_safe() -> None:
    recovery_classes = [
        cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-recovery"
    ]
    recovery_activities = [
        activity
        for activity in ACTIVITIES
        if activity["activity_class_id"] == "cls-recovery"
    ]
    recovery_logs = [
        log
        for log in LOGS
        if log["activity_id"] in {"act-stretch", "act-pool"}
    ]
    rules = [rule for rule in RULES if rule.get("activity_class_id") != "cls-recovery"]
    statuses = compute_class_statuses(
        AS_OF,
        recovery_classes,
        recovery_activities,
        recovery_logs,
        rules,
    )
    recovery = statuses[0]
    assert recovery["state"] == "safe"
    assert recovery["label"] != "Load Cap Hit"
    assert "load cap" not in recovery.get("reason", "").lower()


def test_compute_class_statuses_excludes_inactive_activities_from_history() -> None:
    inactive_walk = {**ACTIVITIES[0], "is_active": False}
    activities = [inactive_walk, ACTIVITIES[1]]
    walk_only_logs = [log for log in LOGS if log["activity_id"] == "act-walk"]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, activities, walk_only_logs, RULES
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "safe"
    assert "no prior" in foot["reason"].lower()


def test_effective_rules_for_activity_picks_strictest_frequency_min_threshold() -> None:
    """Strictest frequency = lowest session threshold."""
    effective_rules_for_activity = _effective_rules_for_activity()

    rules = [
        _make_rule(
            id="freq-loose",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="frequency_limit",
            threshold_value=3,
        ),
        _make_rule(
            id="freq-strict",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="frequency_limit",
            threshold_value=1,
        ),
    ]
    effective = effective_rules_for_activity("act-walk", "cls-foot", rules)
    freq_rules = [
        rule for rule in effective if rule["rule_type"] == "frequency_limit"
    ]
    assert len(freq_rules) == 1
    assert freq_rules[0]["id"] == "freq-strict"
    assert freq_rules[0]["threshold_value"] == 1


def test_compute_class_statuses_class_load_cap_uses_aggregate_across_activities() -> None:
    """Class cap must sum load from walk + bike, not per-activity only."""
    logs = [
        {
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-22",
            "volume_value": 1.5,
            "rpe": 3,
        },
        {
            "id": "log-bike",
            "activity_id": "act-bike",
            "logged_date": "2026-05-24",
            "volume_value": 20,
            "rpe": 5,
        },
    ]
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"] not in {"weekly_load_cap", "frequency_limit"}
    ] + [
        _make_rule(
            id="rule-cap-foot-aggregate",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=50,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, logs, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "danger"
    assert foot["label"] == "Load Cap Hit"
    # walk 4.5 + bike 100 = 104.5 aggregate in 7-day window
    assert "104" in foot["reason"] or "105" in foot["reason"]


def test_compute_class_statuses_exercise_load_cap_does_not_mark_class() -> None:
    """Exercise caps are evaluated per activity, not promoted to the class."""
    logs = [
        {
            "id": "log-walk-only",
            "activity_id": "act-walk",
            "logged_date": "2026-05-22",
            "volume_value": 1.5,
            "rpe": 3,
        },
        {
            "id": "log-bike-heavy",
            "activity_id": "act-bike",
            "logged_date": "2026-05-23",
            "volume_value": 50,
            "rpe": 10,
        },
    ]
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"] not in {"weekly_load_cap", "frequency_limit"}
    ] + [
        _make_rule(
            id="rule-cap-foot-high",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=600,
        ),
        _make_rule(
            id="rule-cap-walk-low",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=4,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, logs, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["label"] != "Load Cap Hit"


def test_compute_class_statuses_class_frequency_counts_all_activities() -> None:
    """Class frequency limit counts sessions from every activity in the class."""
    logs = [
        {
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-20",
            "volume_value": 1.0,
            "rpe": 3,
        },
        {
            "id": "log-bike",
            "activity_id": "act-bike",
            "logged_date": "2026-05-23",
            "volume_value": 10.0,
            "rpe": 3,
        },
    ]
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"] not in {"weekly_load_cap", "frequency_limit"}
    ] + [
        _make_rule(
            id="rule-freq-foot-class",
            activity_class_id="cls-foot",
            rule_type="frequency_limit",
            threshold_value=2,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, logs, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "danger"
    assert "frequen" in foot["reason"].lower()


def test_compute_class_statuses_exercise_frequency_does_not_mark_class() -> None:
    """Exercise frequency counts only that activity and does not cap siblings."""
    logs = [
        {
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-22",
            "volume_value": 1.5,
            "rpe": 3,
        },
        {
            "id": "log-bike",
            "activity_id": "act-bike",
            "logged_date": "2026-05-23",
            "volume_value": 10.0,
            "rpe": 3,
        },
    ]
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"] not in {"weekly_load_cap", "frequency_limit"}
    ] + [
        _make_rule(
            id="rule-freq-foot-class-loose",
            activity_class_id="cls-foot",
            rule_type="frequency_limit",
            threshold_value=5,
        ),
        _make_rule(
            id="rule-freq-walk-strict",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="frequency_limit",
            threshold_value=1,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, logs, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["label"] != "Frequency Limit"


def test_compute_class_statuses_class_consecutive_across_activities() -> None:
    """Class consecutive limit spans any activity on consecutive days."""
    logs = [
        {
            "id": "log-walk",
            "activity_id": "act-walk",
            "logged_date": "2026-05-24",
            "volume_value": 1.0,
            "rpe": 3,
        },
        {
            "id": "log-bike",
            "activity_id": "act-bike",
            "logged_date": AS_OF,
            "volume_value": 10.0,
            "rpe": 3,
        },
    ]
    rules = [
        rule
        for rule in RULES
        if rule["rule_type"]
        not in {"weekly_load_cap", "frequency_limit", "consecutive_day_limit"}
    ] + [
        _make_rule(
            id="rule-consecutive-foot-class",
            activity_class_id="cls-foot",
            rule_type="consecutive_day_limit",
            threshold_value=2,
        ),
    ]
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, logs, rules
    )
    foot = next(s for s in statuses if s["activity_class_id"] == "cls-foot")
    assert foot["state"] == "danger"
    assert "consecutive" in foot["reason"].lower()


def test_check_violations_no_cap_rule_means_no_load_cap_violation() -> None:
    rules = [rule for rule in RULES if rule["rule_type"] != "weekly_load_cap"]
    violations = check_violations(
        "act-walk",
        volume_value=100.0,
        rpe=10,
        activities=ACTIVITIES,
        logs=LOGS,
        rules=rules,
        as_of=AS_OF,
    )
    assert all(v["rule_type"] != "weekly_load_cap" for v in violations)


# ---------------------------------------------------------------------------
# compute_daily_safety_scores
# ---------------------------------------------------------------------------


def test_compute_daily_safety_scores_marks_neutral_rest_days() -> None:
    scores = compute_daily_safety_scores(
        "2026-05-20", "2026-05-22", [], [], []
    )
    assert all(score["state"] == "neutral" for score in scores)
    assert len(scores) == 3


def test_compute_daily_safety_scores_marks_flare_day_danger() -> None:
    scores = compute_daily_safety_scores(
        "2026-05-16",
        "2026-05-16",
        LOGS,
        CHECK_INS,
        INCIDENTS,
    )
    assert scores[0]["state"] == "danger"
    assert scores[0]["had_flare_up"] is True


def test_compute_daily_safety_scores_marks_mild_discomfort_caution() -> None:
    scores = compute_daily_safety_scores(
        "2026-05-15",
        "2026-05-15",
        LOGS,
        [],
        [],
    )
    assert scores[0]["state"] == "caution"


# ---------------------------------------------------------------------------
# compute_suggestions
# ---------------------------------------------------------------------------


def test_compute_suggestions_maps_active_activities_to_class_status() -> None:
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES
    )
    suggestions = compute_suggestions(statuses, ACTIVITIES, ACTIVITY_CLASSES)
    walk = next(s for s in suggestions if s["id"] == "act-walk")
    assert walk["state"] == "caution"
    assert walk["label"] == "Morning Walk"


def test_compute_suggestions_excludes_inactive_activities() -> None:
    inactive = {
        **ACTIVITIES[0],
        "id": "act-retired",
        "name": "Retired Walk",
        "is_active": False,
    }
    statuses = compute_class_statuses(
        AS_OF, ACTIVITY_CLASSES, [inactive], LOGS, RULES
    )
    suggestions = compute_suggestions(statuses, [inactive], ACTIVITY_CLASSES)
    assert suggestions == []


# ---------------------------------------------------------------------------
# S25.B5 — compute_suggestion_buckets
# ---------------------------------------------------------------------------


def _make_log(
    activity_id: str,
    logged_date: str,
    *,
    log_id: str | None = None,
    volume_value: float = 1.0,
    rpe: int = 3,
) -> dict[str, Any]:
    return {
        "id": log_id or f"log-{activity_id}-{logged_date}",
        "activity_id": activity_id,
        "logged_date": logged_date,
        "volume_value": volume_value,
        "rpe": rpe,
    }


def _make_goal(
    activity_id: str,
    *,
    goal_id: str = "goal-1",
    status: str = "achieved",
    progress_value: float = 10.0,
    progress_target: float = 10.0,
) -> dict[str, Any]:
    return {
        "id": goal_id,
        "activity_id": activity_id,
        "status": status,
        "progress_value": progress_value,
        "progress_target": progress_target,
        "timeframe": "monthly",
        "target_date": "2026-06-30",
    }


def _make_recovery_target(
    activity_id: str,
    *,
    target_id: str | None = None,
    target_frequency: int = 3,
    frequency_unit: str = "daily",
) -> dict[str, Any]:
    return {
        "id": target_id or f"rt-{activity_id}",
        "training_block_id": "blk-1",
        "activity_id": activity_id,
        "target_frequency": target_frequency,
        "frequency_unit": frequency_unit,
        "current_streak_days": 0,
    }


def _bucket_ids(
    buckets: list[Suggestion],
    bucket: str,
) -> set[str]:
    return {row["id"] for row in buckets if row.get("bucket") == bucket}


def _call_suggestion_buckets(
    *,
    as_of: str = AS_OF,
    classes: list[dict[str, Any]] | None = None,
    activities: list[dict[str, Any]] | None = None,
    logs: list[dict[str, Any]] | None = None,
    rules: list[dict[str, Any]] | None = None,
    recovery_targets: list[dict[str, Any]] | None = None,
    goals: list[dict[str, Any]] | None = None,
    weekly_targets: list[dict[str, Any]] | None = None,
) -> list[Suggestion]:
    return compute_suggestion_buckets(
        as_of,
        classes or ACTIVITY_CLASSES,
        activities or ACTIVITIES,
        logs if logs is not None else LOGS,
        rules if rules is not None else RULES,
        recovery_targets or [],
        goals or [],
        weekly_targets if weekly_targets is not None else WEEKLY_TARGETS,
    )


def test_compute_suggestion_buckets_walk_logged_today_not_in_do() -> None:
    """Activities logged on as_of belong in done, not do."""
    as_of = "2026-05-25"
    walk = next(activity for activity in ACTIVITIES if activity["id"] == "act-walk")
    foot_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-foot")
    logs = [_make_log("act-walk", as_of)]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=[foot_class],
        activities=[walk],
        logs=logs,
        rules=[],
        weekly_targets=[],
    )

    assert "act-walk" in _bucket_ids(buckets, "done")
    assert "act-walk" not in _bucket_ids(buckets, "do")
    done_row = next(row for row in buckets if row["id"] == "act-walk")
    assert done_row["bucket"] == "done"
    assert done_row["scope"] == "activity"
    assert done_row["activity_class_id"] == "cls-foot"


def test_compute_suggestion_buckets_class_rest_blacklists_class() -> None:
    """Class rest violation puts activities in rest, not do."""
    as_of = "2026-05-25"
    foot_activities = [
        activity for activity in ACTIVITIES if activity["activity_class_id"] == "cls-foot"
    ]
    foot_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-foot")
    logs = [_make_log("act-walk", "2026-05-24")]
    rules = [
        _make_rule(
            id="rule-rest-foot",
            activity_class_id="cls-foot",
            rule_type="rest_between_class",
            threshold_value=3,
            window_days=3,
        ),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=[foot_class],
        activities=foot_activities,
        logs=logs,
        rules=rules,
        weekly_targets=[],
    )

    do_ids = _bucket_ids(buckets, "do")
    rest_ids = _bucket_ids(buckets, "rest")
    assert "act-walk" not in do_ids
    assert "act-bike" not in do_ids
    assert {"act-walk", "act-bike"} & rest_ids
    rest_rows = [row for row in buckets if row.get("bucket") == "rest"]
    assert all(row.get("scope") in {"activity", "class"} for row in rest_rows)
    assert all(row.get("activity_class_id") == "cls-foot" for row in rest_rows)
    class_rows = [row for row in rest_rows if row.get("scope") == "class"]
    if class_rows:
        description = class_rows[0].get("description")
        assert description
        assert len(description) <= 80


def test_compute_suggestion_buckets_exercise_rule_does_not_blacklist_sibling_activity() -> None:
    """A capped exercise belongs in rest without moving unrestricted siblings there."""
    as_of = "2026-05-25"
    no_impact_class = {
        "id": "cls-no-impact",
        "name": "No impact",
        "type": "performance",
    }
    swim = {
        "id": "act-swim",
        "activity_class_id": no_impact_class["id"],
        "name": "Swimming",
        "type": "performance",
        "is_active": True,
    }
    cross_trainer = {
        "id": "act-cross-trainer",
        "activity_class_id": no_impact_class["id"],
        "name": "Cross trainer",
        "type": "performance",
        "is_active": True,
    }
    logs = [
        _make_log("act-cross-trainer", f"2026-05-{19 + index}")
        for index in range(0, 6)
    ]
    rules = [
        _make_rule(
            id="rule-cross-frequency",
            activity_class_id=no_impact_class["id"],
            activity_id="act-cross-trainer",
            rule_type="frequency_limit",
            threshold_value=6,
            window_days=7,
        )
    ]
    weekly_targets = [
        {
            "id": "wt-swim",
            "training_block_id": "blk-1",
            "activity_class_id": no_impact_class["id"],
            "activity_id": "act-swim",
            "target_value": 3,
            "target_unit": "sessions",
        },
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=[no_impact_class],
        activities=[swim, cross_trainer],
        logs=logs,
        rules=rules,
        weekly_targets=weekly_targets,
    )

    assert "act-cross-trainer" in _bucket_ids(buckets, "rest")
    assert "act-swim" in _bucket_ids(buckets, "do")
    assert "act-swim" not in _bucket_ids(buckets, "rest")


def test_compute_suggestion_buckets_achieved_goal_activity_skipped_from_do() -> None:
    """Linked goal achieved in live period excludes activity from do."""
    as_of = "2026-05-25"
    bike = next(activity for activity in ACTIVITIES if activity["id"] == "act-bike")
    foot_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-foot")
    goals = [_make_goal("act-bike", status="achieved")]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=[foot_class],
        activities=[bike],
        logs=[],
        rules=[],
        goals=goals,
        weekly_targets=[],
    )

    assert "act-bike" not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_recovery_daily_target_alone_not_in_do() -> None:
    """WTL.B4: daily recovery targets no longer drive Do; weekly targets do."""
    as_of = "2026-05-25"
    stretch = next(activity for activity in ACTIVITIES if activity["id"] == "act-stretch")
    recovery_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-recovery")
    recovery_targets = [_make_recovery_target("act-stretch", target_frequency=3)]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=[recovery_class],
        activities=[stretch],
        logs=[],
        rules=[],
        recovery_targets=recovery_targets,
        weekly_targets=[],
    )

    assert "act-stretch" not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_rows_include_bucket_scope_and_description_fields() -> None:
    """Each suggestion row exposes bucket, scope, activity_class_id, and description."""
    buckets = _call_suggestion_buckets()

    assert buckets, "expected at least one suggestion bucket row"
    for row in buckets:
        assert row.get("bucket") in {"do", "rest", "done"}
        assert row.get("scope") in {"activity", "class"}
        assert "activity_class_id" in row
        assert "description" in row


# ---------------------------------------------------------------------------
# WTL.B4 — compute_suggestion_buckets use weekly target completion
# ---------------------------------------------------------------------------


def _wtl_b4_target(
    target_id: str,
    *,
    activity_id: str | None = None,
    target_value: float = 3.0,
    target_unit: str = "sessions",
) -> dict[str, Any]:
    return _wtl_b3_target(
        target_id,
        activity_id=activity_id,
        target_value=target_value,
        target_unit=target_unit,
    )


def _wtl_b4_row(buckets: list[Suggestion], activity_id: str, bucket: str) -> Suggestion | None:
    return next(
        (row for row in buckets if row["id"] == activity_id and row.get("bucket") == bucket),
        None,
    )


def test_compute_suggestion_buckets_incomplete_weekly_target_in_do_with_sessions_reason() -> None:
    """Incomplete activity-scoped weekly target appears in Do with remaining sessions."""
    as_of = "2026-06-07"
    logs = [
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01"),
        _wtl_b3_log("log-wednesday", WTL_B3_WALK, "2026-06-03"),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=4, target_unit="sessions"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    do_row = _wtl_b4_row(buckets, WTL_B3_WALK, "do")
    assert do_row is not None
    assert "2 sessions left this week" in do_row["reason"]


def test_compute_suggestion_buckets_incomplete_weekly_target_reason_km_remaining() -> None:
    """Incomplete km weekly target reason names remaining distance."""
    as_of = "2026-06-07"
    logs = [
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=3.0),
        _wtl_b3_log("log-saturday", WTL_B3_WALK, "2026-06-06", volume_value=1.5),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=8, target_unit="km"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    do_row = _wtl_b4_row(buckets, WTL_B3_WALK, "do")
    assert do_row is not None
    assert "3.5 km left this week" in do_row["reason"]


def test_compute_suggestion_buckets_completed_weekly_target_not_in_do() -> None:
    """Exactly complete weekly target is absent from Do until next Monday."""
    as_of = "2026-06-07"
    logs = [
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=4.0),
        _wtl_b3_log("log-saturday", WTL_B3_WALK, "2026-06-06", volume_value=4.0),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=8, target_unit="km"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_over_complete_weekly_target_not_in_do() -> None:
    """Over-complete weekly target is absent from Do."""
    as_of = "2026-06-07"
    logs = [
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=6.0),
        _wtl_b3_log("log-saturday", WTL_B3_WALK, "2026-06-06", volume_value=5.0),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=8, target_unit="km"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_completed_target_reappears_in_do_on_monday() -> None:
    """Completed target on Sunday is absent; new week on Tuesday returns incomplete target to Do."""
    sunday_logs = [
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=4.0),
        _wtl_b3_log("log-saturday", WTL_B3_WALK, "2026-06-06", volume_value=4.0),
    ]
    tuesday_logs = sunday_logs + [
        _wtl_b3_log("log-new-monday", WTL_B3_WALK, "2026-06-08", volume_value=2.0),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=8, target_unit="km"),
    ]

    sunday_buckets = _call_suggestion_buckets(
        as_of="2026-06-07",
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=sunday_logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )
    tuesday_buckets = _call_suggestion_buckets(
        as_of="2026-06-09",
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=tuesday_logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK not in _bucket_ids(sunday_buckets, "do")
    tuesday_do = _wtl_b4_row(tuesday_buckets, WTL_B3_WALK, "do")
    assert tuesday_do is not None
    assert "6 km left this week" in tuesday_do["reason"]


def test_compute_suggestion_buckets_sunday_uses_monday_through_sunday_week() -> None:
    """Prior-Sunday logs do not count toward the current week's target completion."""
    as_of = "2026-06-07"
    logs = [
        _wtl_b3_log("log-prior-sunday", WTL_B3_WALK, "2026-05-31", volume_value=9.0),
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=1.0),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=4, target_unit="sessions"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    do_row = _wtl_b4_row(buckets, WTL_B3_WALK, "do")
    assert do_row is not None
    assert "3 sessions left this week" in do_row["reason"]


def test_compute_suggestion_buckets_rest_overrides_incomplete_weekly_target() -> None:
    """Rest rules win over incomplete weekly targets."""
    as_of = "2026-06-07"
    logs = [_wtl_b3_log("log-saturday", WTL_B3_WALK, "2026-06-06")]
    rules = [
        _make_rule(
            id="rule-rest-foot",
            activity_class_id=WTL_B3_CLASS,
            rule_type="rest_between_class",
            threshold_value=3,
            window_days=3,
        ),
    ]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=4, target_unit="sessions"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=rules,
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK not in _bucket_ids(buckets, "do")
    assert WTL_B3_WALK in _bucket_ids(buckets, "rest")


def test_compute_suggestion_buckets_big_goal_excludes_from_do_with_weekly_target() -> None:
    """Achieved Big goal exclusions continue when a weekly target exists."""
    as_of = "2026-06-07"
    bike = next(activity for activity in WTL_B3_ACTIVITIES if activity["id"] == WTL_B3_BIKE)
    goals = [_make_goal(WTL_B3_BIKE, status="achieved")]
    weekly_targets = [
        _wtl_b4_target("wt-bike", activity_id=WTL_B3_BIKE, target_value=60, target_unit="minutes"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=[bike],
        logs=[],
        rules=[],
        recovery_targets=[],
        goals=goals,
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_BIKE not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_inactive_activity_not_suggested() -> None:
    """Inactive activities are not suggested even with an incomplete weekly target."""
    as_of = "2026-06-07"
    stretch = next(activity for activity in WTL_B3_ACTIVITIES if activity["id"] == WTL_B3_STRETCH)
    weekly_targets = [
        _wtl_b4_target(
            "wt-stretch",
            activity_id=WTL_B3_STRETCH,
            target_value=4,
            target_unit="sessions",
        ),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=[stretch],
        logs=[],
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_STRETCH not in _bucket_ids(buckets, "do")
    assert WTL_B3_STRETCH not in _bucket_ids(buckets, "rest")
    assert WTL_B3_STRETCH not in _bucket_ids(buckets, "done")


def test_compute_suggestion_buckets_logged_today_in_done_with_incomplete_weekly_target() -> None:
    """Activity logged today appears in Done, not Do, even when the weekly target is incomplete."""
    as_of = "2026-06-07"
    logs = [_wtl_b3_log("log-today", WTL_B3_WALK, as_of, volume_value=1.0)]
    weekly_targets = [
        _wtl_b4_target("wt-walk", activity_id=WTL_B3_WALK, target_value=8, target_unit="km"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK in _bucket_ids(buckets, "done")
    assert WTL_B3_WALK not in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_no_weekly_target_activity_not_in_do() -> None:
    """Activities without a weekly target are not suggested in Do."""
    as_of = "2026-06-07"
    walk = next(activity for activity in WTL_B3_ACTIVITIES if activity["id"] == WTL_B3_WALK)
    bike = next(activity for activity in WTL_B3_ACTIVITIES if activity["id"] == WTL_B3_BIKE)
    weekly_targets = [
        _wtl_b4_target("wt-bike", activity_id=WTL_B3_BIKE, target_value=60, target_unit="minutes"),
    ]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=[walk, bike],
        logs=[],
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK not in _bucket_ids(buckets, "do")
    assert WTL_B3_BIKE in _bucket_ids(buckets, "do")


def test_compute_suggestion_buckets_legacy_class_weekly_target_in_do_when_incomplete() -> None:
    """Legacy class-scoped weekly targets can drive Do for active class activities."""
    as_of = "2026-06-07"
    logs = [_wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01")]
    weekly_targets = [_wtl_b4_target("wt-class", target_value=4, target_unit="sessions")]

    buckets = _call_suggestion_buckets(
        as_of=as_of,
        classes=WTL_B3_CLASSES,
        activities=WTL_B3_ACTIVITIES,
        logs=logs,
        rules=[],
        recovery_targets=[],
        goals=[],
        weekly_targets=weekly_targets,
    )

    assert WTL_B3_WALK in _bucket_ids(buckets, "do")
    do_row = _wtl_b4_row(buckets, WTL_B3_WALK, "do")
    assert do_row is not None
    assert "3 sessions left this week" in do_row["reason"]


# ---------------------------------------------------------------------------
# S25.B6 — compute_load_risk_summary
# ---------------------------------------------------------------------------


def _compute_load_risk_summary() -> Any:
    assert hasattr(load_engine, "compute_load_risk_summary"), (
        "compute_load_risk_summary not implemented"
    )
    return load_engine.compute_load_risk_summary


def _call_load_risk_summary(
    *,
    as_of: str = AS_OF,
    classes: list[dict[str, Any]] | None = None,
    activities: list[dict[str, Any]] | None = None,
    logs: list[dict[str, Any]] | None = None,
    rules: list[dict[str, Any]] | None = None,
    delayed_tax_hits: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        _compute_load_risk_summary()(
            as_of,
            classes or ACTIVITY_CLASSES,
            activities or ACTIVITIES,
            logs if logs is not None else LOGS,
            rules if rules is not None else RULES,
            delayed_tax_hits or [],
        ),
    )


def _foot_load_cap_rules_only(*, threshold: float = 120.0) -> list[dict[str, Any]]:
    """Foot class capped by weekly load only — no volume or frequency rules."""
    return [
        _make_rule(
            id="rule-cap-foot",
            activity_class_id="cls-foot",
            rule_type="weekly_load_cap",
            threshold_value=threshold,
        ),
    ]


def _week_day_flags(summary: dict[str, Any]) -> dict[str, bool]:
    return {row["date"]: row["flagged"] for row in summary["week_days"]}


def _rule_limit_row(summary: dict[str, Any], rule_id: str) -> dict[str, Any]:
    return next(
        row for row in summary["rule_limit_rows"] if row["rule_id"] == rule_id
    )


def test_compute_load_risk_summary_week_days_span_seven_days_ending_as_of() -> None:
    """week_days lists the last 7 calendar days ending as_of, oldest first."""
    summary = _call_load_risk_summary(
        rules=_foot_load_cap_rules_only(),
        delayed_tax_hits=[],
    )

    assert [row["date"] for row in summary["week_days"]] == each_day(
        "2026-05-19",
        AS_OF,
    )
    assert all("flagged" in row for row in summary["week_days"])


def test_compute_load_risk_summary_omits_uncapped_recovery_class() -> None:
    """Recovery classes with zero enabled cap rules are excluded from rule_limit_rows."""
    rules = _foot_load_cap_rules_only()
    summary = _call_load_risk_summary(rules=rules, delayed_tax_hits=[])

    class_ids = {row["activity_class_id"] for row in summary["rule_limit_rows"]}
    assert "cls-foot" in class_ids
    assert "cls-recovery" not in class_ids


def test_compute_load_risk_summary_class_bar_actual_and_limit_for_load_cap() -> None:
    """Weekly load cap rule row reports rolling load actual vs limit."""
    as_of = "2026-05-25"
    logs = [_make_log("act-walk", "2026-05-22", volume_value=1.5, rpe=3)]
    rules = _foot_load_cap_rules_only(threshold=120.0)

    summary = _call_load_risk_summary(
        as_of=as_of,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    row = _rule_limit_row(summary, "rule-cap-foot")

    assert row["class_name"] == "High-Intensity Foot Load"
    assert row["actual"] == pytest.approx(4.5)
    assert row["limit"] == pytest.approx(120.0)
    assert row["unit"] == "load"


def test_compute_load_risk_summary_exercise_bar_uses_exercise_cap_override() -> None:
    """Exercise-scoped load cap rows stay separate from class load cap rows."""
    as_of = "2026-05-25"
    walk = next(activity for activity in ACTIVITIES if activity["id"] == "act-walk")
    foot_class = next(cls for cls in ACTIVITY_CLASSES if cls["id"] == "cls-foot")
    logs = [_make_log("act-walk", "2026-05-22", volume_value=1.5, rpe=3)]
    rules = _foot_load_cap_rules_only(threshold=120.0) + [
        _make_rule(
            id="rule-cap-walk",
            activity_class_id="cls-foot",
            activity_id="act-walk",
            rule_type="weekly_load_cap",
            threshold_value=40,
        ),
    ]

    summary = _call_load_risk_summary(
        as_of=as_of,
        classes=[foot_class],
        activities=[walk],
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    walk_row = _rule_limit_row(summary, "rule-cap-walk")

    assert walk_row["scope"] == "activity"
    assert walk_row["activity_name"] == "Morning Walk"
    assert walk_row["actual"] == pytest.approx(4.5)
    assert walk_row["limit"] == pytest.approx(40.0)
    assert walk_row["unit"] == "load"


def test_compute_load_risk_summary_flags_day_on_cap_breach() -> None:
    """week_days.flagged is true when rolling cap is breached as of that day."""
    as_of = "2026-05-25"
    logs = [_make_log("act-walk", "2026-05-22", volume_value=1.5, rpe=3)]
    rules = _foot_load_cap_rules_only(threshold=4.0)

    summary = _call_load_risk_summary(
        as_of=as_of,
        logs=logs,
        rules=rules,
        delayed_tax_hits=[],
    )
    flags = _week_day_flags(summary)

    assert flags["2026-05-22"] is True
    assert flags["2026-05-19"] is False


def test_compute_load_risk_summary_flags_day_on_delayed_tax_elevated_load() -> None:
    """Delayed-tax elevated_load contributing_date flags day even without cap breach."""
    as_of = "2026-05-25"
    rules = [rule for rule in RULES if rule["rule_type"] != "weekly_load_cap"]
    delayed_tax_hits = [
        {
            "hit_type": "elevated_load",
            "activity_class_id": "cls-foot",
            "contributing_date": "2026-05-22",
            "daily_load": 4.5,
            "baseline_median_daily_load": 0.0,
            "message": "Elevated load on 2026-05-22: 4.5 (baseline median 0.0)",
        }
    ]

    summary = _call_load_risk_summary(
        as_of=as_of,
        logs=[],
        rules=rules,
        delayed_tax_hits=delayed_tax_hits,
    )
    flags = _week_day_flags(summary)

    assert flags["2026-05-22"] is True
    assert flags["2026-05-19"] is False


# ---------------------------------------------------------------------------
# compute_weekly_progress
# ---------------------------------------------------------------------------


def test_compute_weekly_progress_counts_km_for_foot_target() -> None:
    progress = compute_weekly_progress(
        WEEKLY_TARGETS,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        LOGS,
        PERIOD_START,
        AS_OF,
    )
    foot = next(p for p in progress if p["activity_class_id"] == "cls-foot")
    # log-25 only in period: 1.5 km
    assert foot["value"] == pytest.approx(1.5)
    assert foot["target"] == 8
    assert foot["unit"] == "km"
    assert foot["state"] == "safe"


def test_compute_weekly_progress_counts_sessions_not_volume() -> None:
    progress = compute_weekly_progress(
        WEEKLY_TARGETS,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        LOGS,
        PERIOD_START,
        AS_OF,
    )
    recovery = next(p for p in progress if p["activity_class_id"] == "cls-recovery")
    # log-23 stretch + log-24 pool in period
    assert recovery["value"] == pytest.approx(2)
    assert recovery["unit"] == "sessions"


def test_compute_weekly_progress_uses_neutral_state_when_rounded_value_is_zero() -> None:
    progress = compute_weekly_progress(
        WEEKLY_TARGETS,
        ACTIVITY_CLASSES,
        ACTIVITIES,
        [],
        PERIOD_START,
        AS_OF,
    )
    foot = next(p for p in progress if p["activity_class_id"] == "cls-foot")
    assert foot["value"] == 0
    assert foot["state"] == "neutral"


# ---------------------------------------------------------------------------
# WTL.B3 — compute_weekly_progress as This Week (Monday–Sunday)
# ---------------------------------------------------------------------------

WTL_B3_CLASS = "cls-wtl-b3"
WTL_B3_WALK = "act-wtl-walk"
WTL_B3_BIKE = "act-wtl-bike"
WTL_B3_STRETCH = "act-wtl-stretch"

WTL_B3_ACTIVITIES: list[dict[str, Any]] = [
    {
        "id": WTL_B3_WALK,
        "user_id": "local",
        "activity_class_id": WTL_B3_CLASS,
        "name": "Morning Walk",
        "type": "performance",
        "default_volume_unit": "km",
        "is_active": True,
        "created_at": "2026-04-07T06:00:00Z",
    },
    {
        "id": WTL_B3_BIKE,
        "user_id": "local",
        "activity_class_id": WTL_B3_CLASS,
        "name": "Stationary Bike",
        "type": "performance",
        "default_volume_unit": "minutes",
        "is_active": True,
        "created_at": "2026-04-07T06:00:00Z",
    },
    {
        "id": WTL_B3_STRETCH,
        "user_id": "local",
        "activity_class_id": WTL_B3_CLASS,
        "name": "Light Stretching",
        "type": "recovery",
        "default_volume_unit": "minutes",
        "is_active": False,
        "created_at": "2026-04-07T06:00:00Z",
    },
]

WTL_B3_CLASSES: list[dict[str, Any]] = [
    {
        "id": WTL_B3_CLASS,
        "user_id": "local",
        "name": "WTL Foot Load",
        "type": "performance",
        "default_recovery_window_days": 3,
        "created_at": "2026-04-07T06:00:00Z",
    },
]


def _wtl_b3_log(
    log_id: str,
    activity_id: str,
    logged_date: str,
    *,
    duration_minutes: int = 30,
    volume_value: float = 1.0,
    volume_unit: str = "km",
) -> dict[str, Any]:
    return {
        "id": log_id,
        "user_id": "local",
        "activity_id": activity_id,
        "logged_date": logged_date,
        "duration_minutes": duration_minutes,
        "volume_value": volume_value,
        "volume_unit": volume_unit,
        "rpe": 5,
        "post_activity_feel": "fine",
        "created_at": "2026-04-07T06:00:00Z",
    }


def _wtl_b3_target(
    target_id: str,
    *,
    activity_id: str | None = None,
    target_value: float = 3.0,
    target_unit: str = "sessions",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": target_id,
        "training_block_id": "blk-wtl-b3",
        "activity_class_id": WTL_B3_CLASS,
        "target_value": target_value,
        "target_unit": target_unit,
        "created_at": "2026-04-07T06:00:00Z",
    }
    if activity_id is not None:
        payload["activity_id"] = activity_id
    return payload


def test_compute_weekly_progress_sunday_as_of_uses_monday_through_sunday_window() -> None:
    """as_of Sunday 2026-06-07 → period 2026-06-01..2026-06-07."""
    logs = [
        _wtl_b3_log("log-prior-sunday", WTL_B3_WALK, "2026-05-31", volume_value=9.0),
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-01", volume_value=1.0),
        _wtl_b3_log("log-sunday", WTL_B3_WALK, "2026-06-07", volume_value=2.0),
        _wtl_b3_log("log-next-monday", WTL_B3_WALK, "2026-06-08", volume_value=99.0),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-sessions", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-07",
    )

    row = progress[0]
    assert row["value"] == pytest.approx(2)
    assert row["period_start"] == "2026-06-01"
    assert row["period_end"] == "2026-06-07"


def test_compute_weekly_progress_monday_as_of_uses_new_week_window() -> None:
    """as_of Monday 2026-06-08 → period 2026-06-08..2026-06-14."""
    logs = [
        _wtl_b3_log("log-prior-sunday", WTL_B3_WALK, "2026-06-07", volume_value=5.0),
        _wtl_b3_log("log-monday", WTL_B3_WALK, "2026-06-08", volume_value=1.0),
        _wtl_b3_log("log-tuesday", WTL_B3_WALK, "2026-06-09", volume_value=1.0),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-sessions", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-08",
        "2026-06-14",
    )

    row = progress[0]
    assert row["value"] == pytest.approx(2)
    assert row["period_start"] == "2026-06-08"
    assert row["period_end"] == "2026-06-14"


def test_compute_weekly_progress_activity_scoped_counts_only_that_activity() -> None:
    logs = [
        _wtl_b3_log("log-walk", WTL_B3_WALK, "2026-06-03", volume_value=3.0),
        _wtl_b3_log("log-bike", WTL_B3_BIKE, "2026-06-04", volume_value=20.0, volume_unit="minutes"),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-walk", activity_id=WTL_B3_WALK, target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-07",
    )

    assert progress[0]["value"] == pytest.approx(1)


def test_compute_weekly_progress_activity_scoped_includes_activity_id_and_name() -> None:
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-walk", activity_id=WTL_B3_WALK, target_unit="km")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        [],
        "2026-06-01",
        "2026-06-07",
    )

    row = progress[0]
    assert row["activity_id"] == WTL_B3_WALK
    assert row["activity_name"] == "Morning Walk"


def test_compute_weekly_progress_legacy_class_target_has_null_activity_fields() -> None:
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-class", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        [],
        "2026-06-01",
        "2026-06-07",
    )

    row = progress[0]
    assert row["activity_id"] is None
    assert row["activity_name"] is None


def test_compute_weekly_progress_legacy_class_target_counts_active_class_activities() -> None:
    logs = [
        _wtl_b3_log("log-walk", WTL_B3_WALK, "2026-06-03", volume_value=3.0),
        _wtl_b3_log("log-bike", WTL_B3_BIKE, "2026-06-04", volume_value=20.0, volume_unit="minutes"),
        _wtl_b3_log("log-stretch", WTL_B3_STRETCH, "2026-06-05", volume_value=15.0, volume_unit="minutes"),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-class", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-07",
    )

    assert progress[0]["value"] == pytest.approx(2)


def test_compute_weekly_progress_minutes_target_sums_duration_minutes() -> None:
    logs = [
        _wtl_b3_log(
            "log-bike-a",
            WTL_B3_BIKE,
            "2026-06-03",
            duration_minutes=25,
            volume_value=999.0,
            volume_unit="km",
        ),
        _wtl_b3_log(
            "log-bike-b",
            WTL_B3_BIKE,
            "2026-06-05",
            duration_minutes=20,
            volume_value=20.0,
            volume_unit="minutes",
        ),
    ]
    progress = compute_weekly_progress(
        [
            _wtl_b3_target(
                "wt-bike-minutes",
                activity_id=WTL_B3_BIKE,
                target_value=60.0,
                target_unit="minutes",
            )
        ],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-07",
    )

    assert progress[0]["value"] == pytest.approx(45.0)
    assert progress[0]["unit"] == "minutes"


def test_compute_weekly_progress_volume_target_sums_matching_volume_unit_only() -> None:
    logs = [
        _wtl_b3_log("log-km", WTL_B3_WALK, "2026-06-03", volume_value=3.0, volume_unit="km"),
        _wtl_b3_log("log-miles", WTL_B3_WALK, "2026-06-04", volume_value=5.0, volume_unit="miles"),
    ]
    progress = compute_weekly_progress(
        [
            _wtl_b3_target(
                "wt-walk-km",
                activity_id=WTL_B3_WALK,
                target_value=8.0,
                target_unit="km",
            )
        ],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-07",
    )

    assert progress[0]["value"] == pytest.approx(3.0)


def test_compute_weekly_progress_excludes_logs_before_week_monday_even_in_rolling_window() -> None:
    """Sunday prior week is inside rolling last-7 from Wednesday but outside This Week."""
    logs = [
        _wtl_b3_log("log-prior-sunday", WTL_B3_WALK, "2026-05-31", volume_value=1.0),
        _wtl_b3_log("log-wednesday", WTL_B3_WALK, "2026-06-03", volume_value=1.0),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-sessions", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-03",
    )

    assert progress[0]["value"] == pytest.approx(1)


def test_compute_weekly_progress_excludes_logs_after_as_of_in_same_week() -> None:
    logs = [
        _wtl_b3_log("log-wednesday", WTL_B3_WALK, "2026-06-03", volume_value=1.0),
        _wtl_b3_log("log-friday", WTL_B3_WALK, "2026-06-05", volume_value=1.0),
    ]
    progress = compute_weekly_progress(
        [_wtl_b3_target("wt-sessions", target_unit="sessions")],
        WTL_B3_CLASSES,
        WTL_B3_ACTIVITIES,
        logs,
        "2026-06-01",
        "2026-06-03",
    )

    assert progress[0]["value"] == pytest.approx(1)


# ---------------------------------------------------------------------------
# compute_clean_streak
# ---------------------------------------------------------------------------


def test_compute_clean_streak_counts_recent_clean_sessions() -> None:
    # log-26, log-25, log-24, log-23 are clean; log-22 breaks streak (bad feel + danger)
    assert compute_clean_streak(LOGS) == 4


def test_compute_clean_streak_returns_zero_for_empty_logs() -> None:
    assert compute_clean_streak([]) == 0


# ---------------------------------------------------------------------------
# compute_load_series
# ---------------------------------------------------------------------------


def test_compute_load_series_returns_daily_and_rolling_points() -> None:
    series = compute_load_series(
        "cls-foot",
        ACTIVITIES,
        LOGS,
        "2026-05-20",
        "2026-05-25",
        window_days=7,
    )
    assert len(series) == 6
    by_date = {point["date"]: point for point in series}
    assert by_date["2026-05-22"]["daily_load"] == pytest.approx(4.5)
    assert by_date["2026-05-22"]["load"] == pytest.approx(4.5)


# ---------------------------------------------------------------------------
# check_violations — dry-run, all five rule types
# ---------------------------------------------------------------------------


def test_check_violations_returns_empty_for_unknown_activity() -> None:
    assert (
        check_violations(
            "act-missing",
            volume_value=3.0,
            rpe=5,
            activities=ACTIVITIES,
            logs=LOGS,
            rules=RULES,
            as_of=AS_OF,
        )
        == []
    )


def test_check_violations_flags_rest_between_class_caution() -> None:
    violations = check_violations(
        "act-walk",
        volume_value=1.5,
        rpe=3,
        activities=ACTIVITIES,
        logs=LOGS,
        rules=RULES,
        as_of=AS_OF,
    )
    rest = next(v for v in violations if v["rule_type"] == "rest_between_class")
    assert rest["rule_id"] == "rule-rest-foot"
    assert rest["severity"] == "caution"


def test_check_violations_flags_rest_between_class_danger_when_one_day_since() -> None:
    foot_ids = {"act-walk", "act-bike"}
    logs = [
        log
        for log in LOGS
        if not (log["activity_id"] in foot_ids and log["logged_date"] >= "2026-05-22")
    ]
    logs.append(
        {
            "id": "log-yesterday",
            "activity_id": "act-walk",
            "logged_date": "2026-05-24",
            "volume_value": 1.0,
            "rpe": 3,
        }
    )
    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=RULES,
        as_of=AS_OF,
    )
    rest = next(v for v in violations if v["rule_type"] == "rest_between_class")
    assert rest["severity"] == "danger"


def test_check_violations_flags_weekly_load_cap_danger_when_projected_over_cap() -> None:
    heavy_logs = [
        *LOGS,
        {
            "id": "log-heavy",
            "activity_id": "act-bike",
            "logged_date": "2026-05-24",
            "volume_value": 20,
            "rpe": 5,
        },
    ]
    violations = check_violations(
        "act-walk",
        volume_value=10.0,
        rpe=10,
        activities=ACTIVITIES,
        logs=heavy_logs,
        rules=RULES,
        as_of=AS_OF,
    )
    cap = next(v for v in violations if v["rule_type"] == "weekly_load_cap")
    assert cap["severity"] == "danger"


def test_check_violations_skips_load_cap_when_volume_or_rpe_is_zero() -> None:
    violations = check_violations(
        "act-walk",
        volume_value=0,
        rpe=8,
        activities=ACTIVITIES,
        logs=LOGS,
        rules=RULES,
        as_of=AS_OF,
    )
    assert all(v["rule_type"] != "weekly_load_cap" for v in violations)

    violations_zero_rpe = check_violations(
        "act-walk",
        volume_value=5.0,
        rpe=0,
        activities=ACTIVITIES,
        logs=LOGS,
        rules=RULES,
        as_of=AS_OF,
    )
    assert all(v["rule_type"] != "weekly_load_cap" for v in violations_zero_rpe)


def test_check_violations_flags_frequency_limit_at_threshold() -> None:
    freq_rule = {
        "id": "rule-freq-test",
        "activity_class_id": "cls-foot",
        "rule_type": "frequency_limit",
        "threshold_value": 2,
        "window_days": 7,
        "enabled": True,
    }
    logs = [
        {
            "id": "log-a",
            "activity_id": "act-walk",
            "logged_date": "2026-05-20",
            "volume_value": 1.0,
            "rpe": 3,
        },
        {
            "id": "log-b",
            "activity_id": "act-bike",
            "logged_date": "2026-05-23",
            "volume_value": 10.0,
            "rpe": 3,
        },
    ]
    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=[*RULES, freq_rule],
        as_of=AS_OF,
    )
    freq = next(v for v in violations if v["rule_type"] == "frequency_limit")
    assert freq["severity"] == "danger"


def test_check_violations_exercise_frequency_does_not_apply_to_sibling_activity() -> None:
    """An exercise-only frequency rule must not block other activities in the class."""
    no_impact_class = {
        "id": "cls-no-impact",
        "name": "No impact",
        "type": "performance",
    }
    swim = {
        "id": "act-swim",
        "activity_class_id": no_impact_class["id"],
        "name": "Swimming",
        "type": "performance",
        "is_active": True,
    }
    cross_trainer = {
        "id": "act-cross-trainer",
        "activity_class_id": no_impact_class["id"],
        "name": "Cross trainer",
        "type": "performance",
        "is_active": True,
    }
    logs = [
        {
            "id": f"log-cross-{index}",
            "activity_id": "act-cross-trainer",
            "logged_date": f"2026-05-2{index}",
            "volume_value": 20.0,
            "rpe": 5,
        }
        for index in range(0, 6)
    ]
    rules = [
        {
            "id": "rule-cross-frequency",
            "activity_class_id": no_impact_class["id"],
            "activity_id": "act-cross-trainer",
            "rule_type": "frequency_limit",
            "threshold_value": 6,
            "window_days": 7,
            "enabled": True,
        }
    ]

    swim_violations = check_violations(
        "act-swim",
        volume_value=20.0,
        rpe=3,
        activities=[swim, cross_trainer],
        logs=logs,
        rules=rules,
        as_of=AS_OF,
    )
    cross_violations = check_violations(
        "act-cross-trainer",
        volume_value=20.0,
        rpe=3,
        activities=[swim, cross_trainer],
        logs=logs,
        rules=rules,
        as_of=AS_OF,
    )

    assert all(v["rule_type"] != "frequency_limit" for v in swim_violations)
    cross_freq = next(
        v for v in cross_violations if v["rule_type"] == "frequency_limit"
    )
    assert cross_freq["severity"] == "danger"


def test_check_violations_flags_consecutive_day_limit_danger() -> None:
    consecutive_rule = {
        "id": "rule-consecutive",
        "activity_class_id": "cls-foot",
        "rule_type": "consecutive_day_limit",
        "threshold_value": 2,
        "window_days": 7,
        "enabled": True,
    }
    logs = [
        {
            "id": "log-prev",
            "activity_id": "act-walk",
            "logged_date": "2026-05-24",
            "volume_value": 1.0,
            "rpe": 3,
        }
    ]
    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs,
        rules=[*RULES, consecutive_rule],
        as_of=AS_OF,
    )
    consecutive = next(
        v for v in violations if v["rule_type"] == "consecutive_day_limit"
    )
    assert consecutive["severity"] == "danger"


def test_check_violations_ignores_disabled_legacy_weekly_activity_count_rule() -> None:
    cross_class_rule = {
        "id": "rule-perf-count",
        "activity_class_id": None,
        "rule_type": "weekly_activity_count",
        "threshold_value": 3,
        "window_days": 7,
        "enabled": False,
    }
    perf_logs = [
        log
        for log in LOGS
        if log["logged_date"] >= "2026-05-19" and log["logged_date"] <= AS_OF
    ]
    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=perf_logs,
        rules=[cross_class_rule],
        as_of=AS_OF,
    )
    assert all(v["rule_type"] != "weekly_activity_count" for v in violations)


def test_check_violations_ignores_enabled_legacy_weekly_activity_count_rule() -> None:
    cross_class_rule = {
        "id": "rule-perf-count",
        "activity_class_id": None,
        "rule_type": "weekly_activity_count",
        "threshold_value": 3,
        "window_days": 7,
        "enabled": True,
    }
    perf_logs = [
        log
        for log in LOGS
        if log["logged_date"] >= "2026-05-19" and log["logged_date"] <= AS_OF
    ]
    violations = check_violations(
        "act-walk",
        volume_value=1.0,
        rpe=3,
        activities=ACTIVITIES,
        logs=perf_logs,
        rules=[cross_class_rule],
        as_of=AS_OF,
    )
    assert all(v["rule_type"] != "weekly_activity_count" for v in violations)


def test_check_violations_ignores_disabled_rules() -> None:
    disabled_rules = [{**rule, "enabled": False} for rule in RULES]
    violations = check_violations(
        "act-walk",
        volume_value=50.0,
        rpe=10,
        activities=ACTIVITIES,
        logs=LOGS,
        rules=disabled_rules,
        as_of=AS_OF,
    )
    assert violations == []


def test_check_violations_does_not_mutate_logs() -> None:
    logs_copy = [dict(log) for log in LOGS]
    check_violations(
        "act-walk",
        volume_value=1.5,
        rpe=3,
        activities=ACTIVITIES,
        logs=logs_copy,
        rules=RULES,
        as_of=AS_OF,
    )
    assert logs_copy == [dict(log) for log in LOGS]


# ---------------------------------------------------------------------------
# detect_delayed_tax — proactive + symptom-linked layers
# ---------------------------------------------------------------------------


def test_detect_delayed_tax_emits_elevated_load_in_risk_window() -> None:
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=CHECK_INS,
        incidents=INCIDENTS,
        as_of=AS_OF,
    )
    elevated = [
        h
        for h in hits
        if h["hit_type"] == "elevated_load" and h["activity_class_id"] == "cls-foot"
    ]
    assert elevated, "Expected elevated_load for foot class in 7-day risk window"
    assert any(h["contributing_date"] == "2026-05-22" for h in elevated)
    sample = elevated[0]
    assert sample["daily_load"] == pytest.approx(4.5)
    assert sample["baseline_median_daily_load"] == pytest.approx(0.0)


def test_detect_delayed_tax_emits_rest_debt_for_back_to_back_sessions() -> None:
    back_to_back_logs = [
        *LOGS,
        {
            "id": "log-back",
            "activity_id": "act-walk",
            "logged_date": "2026-05-24",
            "volume_value": 1.0,
            "rpe": 3,
        },
    ]
    hits = detect_delayed_tax(
        logs=back_to_back_logs,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[],
        incidents=[],
        as_of=AS_OF,
    )
    rest_debt = [h for h in hits if h["hit_type"] == "rest_debt"]
    assert rest_debt, "Expected rest_debt when sessions break rest_between_class"
    sample = rest_debt[0]
    assert sample["activity_class_id"] == "cls-foot"
    assert sample["required_rest_days"] == 3
    assert sample["days_since_last_session"] <= 3


def test_detect_delayed_tax_skips_rest_debt_without_enabled_rest_rule() -> None:
    rules_no_rest = [r for r in RULES if r["rule_type"] != "rest_between_class"]
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=rules_no_rest,
        check_ins=[],
        incidents=[],
        as_of=AS_OF,
    )
    assert all(h["hit_type"] != "rest_debt" for h in hits)


def test_detect_delayed_tax_emits_symptom_marker_for_high_pain_check_in() -> None:
    check_in = {
        "id": "ci-pain",
        "check_in_date": "2026-05-23",
        "pain_level": 8,
        "has_flare_up": False,
    }
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[check_in],
        incidents=[],
        as_of=AS_OF,
    )
    markers = [h for h in hits if h["hit_type"] == "symptom_marker"]
    assert len(markers) == 1
    assert markers[0]["symptom_date"] == "2026-05-23"
    assert markers[0]["symptom_source"] == "check_in_pain"
    assert markers[0]["pain_level"] == 8


def test_detect_delayed_tax_does_not_mark_pain_level_exactly_at_threshold() -> None:
    check_in = {
        "id": "ci-borderline",
        "check_in_date": "2026-05-23",
        "pain_level": 3,
        "has_flare_up": False,
    }
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[check_in],
        incidents=[],
        as_of=AS_OF,
        pain_threshold=3,
    )
    assert all(h["hit_type"] != "symptom_marker" for h in hits)


def test_detect_delayed_tax_prefers_check_in_over_incident_on_same_date() -> None:
    check_in = {
        "id": "ci-dup",
        "check_in_date": "2026-05-23",
        "pain_level": 6,
        "has_flare_up": True,
    }
    incident = {
        "id": "inc-dup",
        "incident_date": "2026-05-23",
        "severity": 7,
        "activity_class_id": "cls-foot",
        "daily_check_in_id": "ci-dup",
    }
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[check_in],
        incidents=[incident],
        as_of=AS_OF,
    )
    markers = [h for h in hits if h["hit_type"] == "symptom_marker"]
    assert len(markers) == 1
    assert markers[0]["symptom_source"] in {"check_in_pain", "check_in_flare"}


def test_detect_delayed_tax_emits_acute_attribution_after_extended_rest() -> None:
    acute_logs = [
        {
            "id": "log-return",
            "activity_id": "act-walk",
            "logged_date": "2026-05-20",
            "volume_value": 1.5,
            "rpe": 4,
        }
    ]
    check_in = {
        "id": "ci-acute",
        "check_in_date": "2026-05-22",
        "pain_level": 8,
        "has_flare_up": True,
    }
    hits = detect_delayed_tax(
        logs=acute_logs,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[check_in],
        incidents=[],
        as_of=AS_OF,
        acute_rest_days=14,
        acute_symptom_lag_days=3,
    )
    acute = [h for h in hits if h["hit_type"] == "acute_attribution"]
    assert acute, "Expected acute attribution after 14+ day rest then return"
    assert acute[0]["primary"] is True
    assert acute[0]["activity_class_id"] == "cls-foot"
    assert acute[0]["contributing_date"] == "2026-05-20"
    assert acute[0]["symptom_date"] == "2026-05-22"


def test_detect_delayed_tax_emits_symptom_contributor_for_stacked_load() -> None:
    stacked_logs = [
        {
            "id": "log-heavy-1",
            "activity_id": "act-bike",
            "logged_date": "2026-05-18",
            "volume_value": 25,
            "rpe": 6,
        },
        {
            "id": "log-heavy-2",
            "activity_id": "act-walk",
            "logged_date": "2026-05-20",
            "volume_value": 3.0,
            "rpe": 6,
        },
        {
            "id": "log-heavy-3",
            "activity_id": "act-bike",
            "logged_date": "2026-05-21",
            "volume_value": 20,
            "rpe": 5,
        },
    ]
    check_in = {
        "id": "ci-stack",
        "check_in_date": "2026-05-23",
        "pain_level": 7,
        "has_flare_up": True,
    }
    hits = detect_delayed_tax(
        logs=stacked_logs,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[check_in],
        incidents=[],
        as_of=AS_OF,
    )
    contributors = [h for h in hits if h["hit_type"] == "symptom_contributor"]
    assert contributors, "Expected symptom_contributor linking prior elevated load"
    assert all(h["symptom_date"] == "2026-05-23" for h in contributors)


def test_detect_delayed_tax_returns_empty_without_logs_or_symptoms() -> None:
    hits = detect_delayed_tax(
        logs=[],
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[],
        incidents=[],
        as_of=AS_OF,
    )
    assert hits == []


def test_detect_delayed_tax_deduplicates_proactive_hits_per_class_date_type() -> None:
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[],
        incidents=[],
        as_of=AS_OF,
    )
    proactive = [
        h
        for h in hits
        if h["hit_type"] in {"elevated_load", "rest_debt"} and h.get("symptom_date") is None
    ]
    keys = {
        (h["activity_class_id"], h["contributing_date"], h["hit_type"]) for h in proactive
    }
    assert len(keys) == len(proactive)


def test_detect_delayed_tax_sorts_symptom_date_then_contributing_date_desc() -> None:
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=CHECK_INS,
        incidents=INCIDENTS,
        as_of=AS_OF,
    )
    dated_indices = [
        i for i, h in enumerate(hits) if h.get("symptom_date") is not None
    ]
    proactive_indices = [
        i for i, h in enumerate(hits) if h.get("symptom_date") is None
    ]
    if dated_indices and proactive_indices:
        assert max(dated_indices) < min(proactive_indices)

    symptom_dates: list[str] = [
        sd for h in hits if (sd := h.get("symptom_date")) is not None
    ]
    if len(symptom_dates) >= 2:
        assert symptom_dates == sorted(symptom_dates, reverse=True)


def test_detect_delayed_tax_scopes_to_performance_classes_only() -> None:
    recovery_only_logs = [
        log for log in LOGS if log["activity_id"] in {"act-stretch", "act-pool"}
    ]
    hits = detect_delayed_tax(
        logs=recovery_only_logs,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[],
        incidents=[],
        as_of=AS_OF,
    )
    assert all(h["activity_class_id"] != "cls-recovery" for h in hits)


def test_detect_delayed_tax_emits_flare_incident_symptom_marker() -> None:
    incident = {
        "id": "inc-window",
        "incident_date": "2026-05-21",
        "severity": 6,
        "activity_class_id": "cls-foot",
    }
    hits = detect_delayed_tax(
        logs=LOGS,
        activities=ACTIVITIES,
        activity_classes=ACTIVITY_CLASSES,
        rules=RULES,
        check_ins=[],
        incidents=[incident],
        as_of=AS_OF,
    )
    markers = [h for h in hits if h["hit_type"] == "symptom_marker"]
    assert any(m["symptom_source"] == "flare_incident" for m in markers)


# ---------------------------------------------------------------------------
# WTL.B5 — load-tax formula and recency-weighted load series
# ---------------------------------------------------------------------------


def _require_wtl_b5_load_tax_symbols() -> tuple[list[float], Any, Any]:
    module = importlib.import_module("app.services.load_engine")
    missing = [
        name
        for name in ("LOAD_TAX_RECENCY_WEIGHTS", "compute_log_load_tax")
        if not hasattr(module, name)
    ]
    if missing:
        pytest.fail(
            "app.services.load_engine must export "
            + ", ".join(missing)
            + " (WTL.B5)"
        )
    return (
        module.LOAD_TAX_RECENCY_WEIGHTS,
        module.compute_log_load_tax,
        module.compute_load_series,
    )


def test_load_tax_recency_weights_match_ticket_constants() -> None:
    weights, _, _ = _require_wtl_b5_load_tax_symbols()
    assert weights == [
        1.0,
        0.85,
        0.7,
        0.55,
        0.4,
        0.25,
        0.15,
    ]


def _wtl_b5_walk() -> dict[str, Any]:
    return next(a for a in WTL_B5_ACTIVITIES if a["id"] == WTL_B5_WALK_ID)


def _wtl_b5_stretch() -> dict[str, Any]:
    return next(a for a in WTL_B5_ACTIVITIES if a["id"] == WTL_B5_STRETCH_ID)


def test_compute_log_load_tax_recovery_activity_returns_zero() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    log = wtl_b5_log(
        log_id="log-recovery",
        activity_id=WTL_B5_STRETCH_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=30.0,
        rpe=8,
        volume_unit="minutes",
        duration_minutes=30,
    )
    assert (
        compute_log_load_tax(
            log,
            _wtl_b5_stretch(),
            WTL_B5_ACTIVITIES,
            WTL_B5_ACTIVITY_CLASSES,
            [log],
            [],
            as_of=WTL_B5_AS_OF,
        )
        == 0.0
    )


def test_compute_log_load_tax_base_performance_session_minimum_one() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    log = wtl_b5_log(
        log_id="log-base",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=0.5,
        rpe=3,
    )
    tax = compute_log_load_tax(
        log,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [log],
        [],
        as_of=WTL_B5_AS_OF,
    )
    assert tax >= 1.0


@pytest.mark.parametrize(
    ("rpe", "expected_rpe_tax"),
    [
        (3, 0.0),
        (5, 0.5),
        (6, 0.5),
        (7, 1.0),
        (8, 1.0),
        (9, 2.0),
        (10, 2.0),
    ],
)
def test_compute_log_load_tax_rpe_tiers(rpe: int, expected_rpe_tax: float) -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    log = wtl_b5_log(
        log_id=f"log-rpe-{rpe}",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=rpe,
    )
    tax = compute_log_load_tax(
        log,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [log],
        [],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0 + expected_rpe_tax)


def test_compute_log_load_tax_no_rules_still_contributes_base_and_rpe() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    log = wtl_b5_log(
        log_id="log-no-rules",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=10.0,
        rpe=7,
    )
    tax = compute_log_load_tax(
        log,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [log],
        [],
        as_of=WTL_B5_AS_OF,
    )
    raw_volume_rpe = log["volume_value"] * log["rpe"]
    assert tax == pytest.approx(2.0)
    assert tax < raw_volume_rpe


@pytest.mark.parametrize(
    ("prior_load", "expected_proximity_tax"),
    [
        (4.0, 0.0),
        (5.0, 1.0),
        (8.0, 2.0),
        (10.0, 4.0),
    ],
)
def test_compute_log_load_tax_rule_proximity_tiers_for_weekly_load_cap(
    prior_load: float,
    expected_proximity_tax: float,
) -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    cap_rule = wtl_b5_rule(
        id="rule-cap-proximity",
        rule_type="weekly_load_cap",
        threshold_value=10.0,
    )
    prior = wtl_b5_log(
        log_id="log-prior-cap",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -1),
        volume_value=prior_load,
        rpe=1,
    )
    current = wtl_b5_log(
        log_id="log-current-cap",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    tax = compute_log_load_tax(
        current,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [prior, current],
        [cap_rule],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0 + expected_proximity_tax)


def test_compute_log_load_tax_rest_rule_broken_adds_four() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    rest_rule = wtl_b5_rule(
        id="rule-rest",
        rule_type="rest_between_class",
        threshold_value=3,
        window_days=3,
    )
    prior = wtl_b5_log(
        log_id="log-prior-rest",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -1),
        volume_value=1.0,
        rpe=3,
    )
    current = wtl_b5_log(
        log_id="log-current-rest",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    tax = compute_log_load_tax(
        current,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [prior, current],
        [rest_rule],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0 + 4.0)


def test_compute_log_load_tax_consecutive_day_limit_adds_three() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    consecutive_rule = wtl_b5_rule(
        id="rule-consecutive",
        rule_type="consecutive_day_limit",
        threshold_value=2,
        window_days=7,
    )
    prior = wtl_b5_log(
        log_id="log-prior-consecutive",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -1),
        volume_value=1.0,
        rpe=3,
    )
    current = wtl_b5_log(
        log_id="log-current-consecutive",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    tax = compute_log_load_tax(
        current,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [prior, current],
        [consecutive_rule],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0 + 3.0)


def test_compute_log_load_tax_category_cap_stacks_same_rule_type_once() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    loose_cap = wtl_b5_rule(
        id="rule-cap-loose",
        rule_type="weekly_load_cap",
        threshold_value=20.0,
    )
    strict_cap = wtl_b5_rule(
        id="rule-cap-strict",
        rule_type="weekly_load_cap",
        threshold_value=10.0,
    )
    prior = wtl_b5_log(
        log_id="log-prior-double-cap",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -1),
        volume_value=8.0,
        rpe=1,
    )
    current = wtl_b5_log(
        log_id="log-current-double-cap",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    tax = compute_log_load_tax(
        current,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [prior, current],
        [loose_cap, strict_cap],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0 + 2.0)


def test_compute_log_load_tax_ignores_disabled_rules() -> None:
    _, compute_log_load_tax, _ = _require_wtl_b5_load_tax_symbols()
    disabled_cap = wtl_b5_rule(
        id="rule-cap-disabled",
        rule_type="weekly_load_cap",
        threshold_value=10.0,
        enabled=False,
    )
    prior = wtl_b5_log(
        log_id="log-prior-disabled",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -1),
        volume_value=9.0,
        rpe=1,
    )
    current = wtl_b5_log(
        log_id="log-current-disabled",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    tax = compute_log_load_tax(
        current,
        _wtl_b5_walk(),
        WTL_B5_ACTIVITIES,
        WTL_B5_ACTIVITY_CLASSES,
        [prior, current],
        [disabled_cap],
        as_of=WTL_B5_AS_OF,
    )
    assert tax == pytest.approx(1.0)


def test_compute_load_series_daily_load_uses_load_tax_not_raw_volume_rpe() -> None:
    _, _, compute_load_series_wtl = _require_wtl_b5_load_tax_symbols()
    log = wtl_b5_log(
        log_id="log-series-daily",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=10.0,
        rpe=7,
    )
    series = compute_load_series_wtl(
        WTL_B5_CLASS_ID,
        WTL_B5_ACTIVITIES,
        [log],
        WTL_B5_AS_OF,
        WTL_B5_AS_OF,
        activity_classes=WTL_B5_ACTIVITY_CLASSES,
        rules=[],
    )
    point = series[0]
    assert point["daily_load"] == pytest.approx(2.0)
    assert point["daily_load"] != pytest.approx(log["volume_value"] * log["rpe"])


def test_compute_load_series_excludes_recovery_logs_from_tax() -> None:
    _, _, compute_load_series_wtl = _require_wtl_b5_load_tax_symbols()
    performance = wtl_b5_log(
        log_id="log-series-perf",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=2.0,
        rpe=5,
    )
    recovery = wtl_b5_log(
        log_id="log-series-recovery",
        activity_id=WTL_B5_STRETCH_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=30.0,
        rpe=8,
        volume_unit="minutes",
        duration_minutes=30,
    )
    series = compute_load_series_wtl(
        WTL_B5_CLASS_ID,
        WTL_B5_ACTIVITIES,
        [performance, recovery],
        WTL_B5_AS_OF,
        WTL_B5_AS_OF,
        activity_classes=WTL_B5_ACTIVITY_CLASSES,
        rules=[],
    )
    assert series[0]["daily_load"] == pytest.approx(1.5)


def test_compute_load_series_rolling_load_applies_recency_weights() -> None:
    weights, _, compute_load_series_wtl = _require_wtl_b5_load_tax_symbols()
    older = wtl_b5_log(
        log_id="log-series-older",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -6),
        volume_value=1.0,
        rpe=3,
    )
    today = wtl_b5_log(
        log_id="log-series-today",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=7,
    )
    series = compute_load_series_wtl(
        WTL_B5_CLASS_ID,
        WTL_B5_ACTIVITIES,
        [older, today],
        WTL_B5_AS_OF,
        WTL_B5_AS_OF,
        activity_classes=WTL_B5_ACTIVITY_CLASSES,
        rules=[],
    )
    expected = (2.0 * weights[0]) + (1.0 * weights[6])
    assert series[0]["load"] == pytest.approx(expected)


def test_compute_load_series_logs_outside_seven_day_window_do_not_affect_point() -> None:
    weights, _, compute_load_series_wtl = _require_wtl_b5_load_tax_symbols()
    outside_window = wtl_b5_log(
        log_id="log-series-outside",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(WTL_B5_AS_OF, -7),
        volume_value=99.0,
        rpe=10,
    )
    inside_window = wtl_b5_log(
        log_id="log-series-inside",
        activity_id=WTL_B5_WALK_ID,
        logged_date=WTL_B5_AS_OF,
        volume_value=1.0,
        rpe=3,
    )
    series = compute_load_series_wtl(
        WTL_B5_CLASS_ID,
        WTL_B5_ACTIVITIES,
        [outside_window, inside_window],
        WTL_B5_AS_OF,
        WTL_B5_AS_OF,
        activity_classes=WTL_B5_ACTIVITY_CLASSES,
        rules=[],
    )
    assert series[0]["load"] == pytest.approx(1.0 * weights[0])


def test_compute_load_series_early_point_uses_logs_before_series_start_in_window() -> None:
    """A log before the 30-day graph start still affects an early point's 7-day window."""
    weights, _, compute_load_series_wtl = _require_wtl_b5_load_tax_symbols()
    graph_start = add_days(WTL_B5_AS_OF, -29)
    prior = wtl_b5_log(
        log_id="log-series-prior",
        activity_id=WTL_B5_WALK_ID,
        logged_date=add_days(graph_start, -1),
        volume_value=1.0,
        rpe=7,
    )
    series = compute_load_series_wtl(
        WTL_B5_CLASS_ID,
        WTL_B5_ACTIVITIES,
        [prior],
        graph_start,
        graph_start,
        activity_classes=WTL_B5_ACTIVITY_CLASSES,
        rules=[],
    )
    assert series[0]["load"] == pytest.approx(2.0 * weights[1])


# ---------------------------------------------------------------------------
# Import surface — module must export all planned functions
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name",
    [
        "DEFAULT_RPE",
        "parse_iso_date",
        "format_iso_date",
        "add_days",
        "diff_days",
        "each_day",
        "LOAD_TAX_RECENCY_WEIGHTS",
        "log_load",
        "daily_load",
        "rolling_load",
        "compute_log_load_tax",
        "compute_class_statuses",
        "compute_daily_safety_scores",
        "compute_suggestions",
        "compute_suggestion_buckets",
        "compute_load_risk_summary",
        "compute_weekly_progress",
        "compute_clean_streak",
        "compute_load_series",
        "check_violations",
        "detect_delayed_tax",
        "effective_rules_for_activity",
    ],
)
def test_load_engine_exports_planned_symbols(name: str) -> None:
    module = importlib.import_module("app.services.load_engine")
    assert hasattr(module, name), f"app.services.load_engine must export {name}"
