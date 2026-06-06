"""Unit tests for the pure load engine module (B4.1).

Fixtures mirror export/src/lib/mockData.ts at as_of=2026-05-25.
"""

from __future__ import annotations

import importlib
import inspect
from datetime import date
from typing import Any

import pytest

from app.services import load_engine
from app.services.load_engine import (
    DEFAULT_RPE,
    add_days,
    check_violations,
    compute_class_statuses,
    compute_clean_streak,
    compute_daily_safety_scores,
    compute_load_series,
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
        "log_load",
        "daily_load",
        "rolling_load",
        "compute_class_statuses",
        "compute_daily_safety_scores",
        "compute_suggestions",
        "compute_weekly_progress",
        "compute_clean_streak",
        "compute_load_series",
        "check_violations",
        "detect_delayed_tax",
    ],
)
def test_load_engine_exports_planned_symbols(name: str) -> None:
    module = importlib.import_module("app.services.load_engine")
    assert hasattr(module, name), f"app.services.load_engine must export {name}"
