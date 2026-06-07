"""Pure load-engine functions — parity with export/src/lib/load.ts and engine.ts."""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any, Literal

from app.schemas.load_engine import (
    ActivityClassDict,
    ActivityClassStatus,
    ActivityDict,
    CheckInDict,
    DailySafetyScore,
    DelayedTaxHit,
    GoalDict,
    IncidentDict,
    LoadPoint,
    LoadRiskClassBar,
    LoadRiskDay,
    LoadRiskExerciseBar,
    LoadRiskSummary,
    LogDict,
    RecoveryTargetDict,
    RuleDict,
    RuleViolationSnapshot,
    SafetyState,
    Suggestion,
    SuggestionBucket,
    ViolationSeverity,
    WeeklyProgress,
    WeeklyTargetDict,
)

DEFAULT_RPE = 5


# ---------------------------------------------------------------------------
# ISO date helpers (load.ts parity)
# ---------------------------------------------------------------------------


def parse_iso_date(iso: str) -> date:
    year, month, day = (int(part) for part in iso.split("-"))
    return date(year, month, day)


def format_iso_date(value: date) -> str:
    return value.strftime("%Y-%m-%d")


def add_days(iso: str, n: int) -> str:
    return format_iso_date(parse_iso_date(iso) + timedelta(days=n))


def this_week_bounds(as_of: str) -> tuple[str, str]:
    """Monday through Sunday of the ISO week containing ``as_of``."""
    as_of_date = parse_iso_date(as_of)
    week_start = as_of_date - timedelta(days=as_of_date.weekday())
    week_end = week_start + timedelta(days=6)
    return format_iso_date(week_start), format_iso_date(week_end)


def diff_days(from_iso: str, to_iso: str) -> int:
    delta = parse_iso_date(to_iso) - parse_iso_date(from_iso)
    return delta.days + 1


def each_day(start: str, end: str) -> list[str]:
    if parse_iso_date(end) < parse_iso_date(start):
        return []
    out: list[str] = []
    cursor = start
    while cursor <= end:
        out.append(cursor)
        cursor = add_days(cursor, 1)
    return out


def _days_between(from_iso: str, to_iso: str) -> int:
    delta = parse_iso_date(to_iso) - parse_iso_date(from_iso)
    return delta.days


# ---------------------------------------------------------------------------
# Load primitives (load.ts parity)
# ---------------------------------------------------------------------------


def log_load(log: LogDict) -> float:
    rpe = log.get("rpe")
    if rpe is None:
        rpe = DEFAULT_RPE
    return float(log["volume_value"]) * float(rpe)


def daily_load(logs: list[LogDict], day: str) -> float:
    return sum(log_load(log) for log in logs if log["logged_date"] == day)


def rolling_load(logs: list[LogDict], as_of: str, window_days: int) -> float:
    if window_days <= 0:
        return 0.0
    start = add_days(as_of, -(window_days - 1))
    total = 0.0
    for log in logs:
        logged_date = log["logged_date"]
        if start <= logged_date <= as_of:
            total += log_load(log)
    return total


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _activity_ids_for_class(
    class_id: str, activities: list[ActivityDict]
) -> list[str]:
    return [
        activity["id"]
        for activity in activities
        if activity["activity_class_id"] == class_id and activity.get("is_active", True)
    ]


def _logs_for_class(
    class_id: str, activities: list[ActivityDict], logs: list[LogDict]
) -> list[LogDict]:
    ids = set(_activity_ids_for_class(class_id, activities))
    return [log for log in logs if log["activity_id"] in ids]


def _performance_class_ids(activity_classes: list[ActivityClassDict]) -> set[str]:
    return {
        cls["id"]
        for cls in activity_classes
        if cls.get("type") == "performance"
    }


def _is_performance_activity(activity: ActivityDict) -> bool:
    return activity.get("type") == "performance"


def _class_daily_load(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    day: str,
) -> float:
    class_logs = _logs_for_class(class_id, activities, logs)
    return daily_load(class_logs, day)


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


# ---------------------------------------------------------------------------
# Rule precedence (S25.B4)
# ---------------------------------------------------------------------------

_CAP_RULE_TYPES = frozenset(
    {"weekly_load_cap", "daily_volume_cap", "weekly_volume_cap"}
)
_VOLUME_CAP_RULE_TYPES = frozenset({"daily_volume_cap", "weekly_volume_cap"})
_MIN_THRESHOLD_RULE_TYPES = _CAP_RULE_TYPES | frozenset(
    {"frequency_limit", "consecutive_day_limit"}
)


def _rule_metric_key(rule: RuleDict) -> tuple[str, str | None]:
    rule_type = rule["rule_type"]
    if rule_type in ("daily_volume_cap", "weekly_volume_cap"):
        return (rule_type, rule.get("limit_unit"))
    return (rule_type, None)


def _pick_strictest_rule(rules: list[RuleDict]) -> RuleDict:
    if len(rules) == 1:
        return rules[0]
    rule_type = rules[0]["rule_type"]
    if rule_type in _MIN_THRESHOLD_RULE_TYPES:
        return min(rules, key=lambda rule: float(rule["threshold_value"]))
    return max(rules, key=lambda rule: float(rule["threshold_value"]))


def effective_rules_for_activity(
    activity_id: str,
    class_id: str,
    rules: list[RuleDict],
) -> list[RuleDict]:
    """Merge class rules with exercise rules; exercise overrides class per rule_type."""
    enabled = [
        rule
        for rule in rules
        if rule.get("enabled", True) and rule.get("activity_class_id") == class_id
    ]

    class_rules: dict[tuple[str, str | None], list[RuleDict]] = {}
    exercise_rules: dict[tuple[str, str | None], list[RuleDict]] = {}

    for rule in enabled:
        rule_activity_id = rule.get("activity_id")
        if rule_activity_id and rule_activity_id != activity_id:
            continue
        key = _rule_metric_key(rule)
        if rule_activity_id == activity_id:
            exercise_rules.setdefault(key, []).append(rule)
        elif not rule_activity_id:
            class_rules.setdefault(key, []).append(rule)

    effective: list[RuleDict] = []
    for key in class_rules.keys() | exercise_rules.keys():
        if key in exercise_rules:
            effective.append(_pick_strictest_rule(exercise_rules[key]))
        else:
            effective.append(_pick_strictest_rule(class_rules[key]))
    return effective


def _class_effective_rest_rule(
    class_id: str,
    activities: list[ActivityDict],
    rules: list[RuleDict],
) -> RuleDict | None:
    del activities
    rest_rules = _enabled_class_scoped_rules(class_id, rules, "rest_between_class")
    if not rest_rules:
        return None
    return _pick_strictest_rule(rest_rules)


def _activity_logs_up_to(
    activity_id: str, logs: list[LogDict], as_of: str
) -> list[LogDict]:
    return [
        log
        for log in logs
        if log["activity_id"] == activity_id and log["logged_date"] <= as_of
    ]


def _class_logs_up_to(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    as_of: str,
) -> list[LogDict]:
    return [
        log
        for log in _logs_for_class(class_id, activities, logs)
        if log["logged_date"] <= as_of
    ]


def _enabled_class_scoped_rules(
    class_id: str,
    rules: list[RuleDict],
    rule_type: str,
) -> list[RuleDict]:
    return [
        rule
        for rule in rules
        if rule.get("enabled", True)
        and rule.get("activity_class_id") == class_id
        and rule["rule_type"] == rule_type
        and not rule.get("activity_id")
    ]


def _enabled_exercise_scoped_rules(
    class_id: str,
    activity_id: str,
    rules: list[RuleDict],
    rule_type: str,
) -> list[RuleDict]:
    return [
        rule
        for rule in rules
        if rule.get("enabled", True)
        and rule.get("activity_class_id") == class_id
        and rule.get("activity_id") == activity_id
        and rule["rule_type"] == rule_type
    ]


def _class_load_cap_violation(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
) -> tuple[RuleDict, float] | None:
    class_logs = _class_logs_up_to(class_id, activities, logs, as_of)

    class_caps = _enabled_class_scoped_rules(class_id, rules, "weekly_load_cap")
    if not class_caps:
        return None
    cap_rule = _pick_strictest_rule(class_caps)
    window = int(cap_rule["window_days"])
    cur_load = rolling_load(class_logs, as_of, window)
    if cur_load >= float(cap_rule["threshold_value"]):
        return cap_rule, cur_load
    return None


def _class_frequency_violation(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
) -> tuple[ViolationSeverity, RuleDict] | None:
    class_activity_ids = set(_activity_ids_for_class(class_id, activities))

    class_freq_rules = _enabled_class_scoped_rules(
        class_id, rules, "frequency_limit"
    )
    if not class_freq_rules:
        return None
    freq_rule = _pick_strictest_rule(class_freq_rules)
    window = int(freq_rule["window_days"])
    win_start = add_days(as_of, -(window - 1))
    count = float(
        sum(
            1
            for log in logs
            if log["activity_id"] in class_activity_ids
            and win_start <= log["logged_date"] <= as_of
        )
    )
    severity = _severity_from_ratio(count, float(freq_rule["threshold_value"]))
    if severity is None:
        return None
    return severity, freq_rule


def _class_consecutive_violation(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
) -> RuleDict | None:
    class_activity_ids = set(_activity_ids_for_class(class_id, activities))

    class_rules = _enabled_class_scoped_rules(
        class_id, rules, "consecutive_day_limit"
    )
    if class_rules:
        rule = _pick_strictest_rule(class_rules)
        if _violations_consecutive_day_limit(
            rule, class_activity_ids, logs, as_of
        ):
            return rule
    return None


def _log_volume_for_cap(log: LogDict, limit_unit: str) -> float | None:
    if limit_unit == "hours":
        duration = log.get("duration_minutes")
        if duration is not None:
            return float(duration) / 60.0
        volume_unit = log.get("volume_unit")
        if volume_unit == "hours":
            return float(log["volume_value"])
        if volume_unit == "minutes":
            return float(log["volume_value"]) / 60.0
        return None
    if log.get("volume_unit") == limit_unit:
        return float(log["volume_value"])
    return None


def _projected_volume_for_cap(
    volume_value: float,
    limit_unit: str,
    *,
    duration_minutes: int | None = None,
    volume_unit: str | None = None,
) -> float | None:
    if limit_unit == "hours":
        if duration_minutes is not None:
            return float(duration_minutes) / 60.0
        if volume_unit == "hours":
            return volume_value
        if volume_unit == "minutes":
            return volume_value / 60.0
        return None
    if volume_unit is None or volume_unit == limit_unit:
        return volume_value
    return None


def _sum_volume_for_cap(
    logs: list[LogDict],
    limit_unit: str,
) -> float:
    total = 0.0
    for log in logs:
        volume = _log_volume_for_cap(log, limit_unit)
        if volume is not None:
            total += volume
    return total


def _class_volume_cap_violation(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
) -> tuple[ViolationSeverity, RuleDict, str] | None:
    worst: tuple[ViolationSeverity, RuleDict, str] | None = None
    class_activity_ids = set(_activity_ids_for_class(class_id, activities))
    for rule_type in _VOLUME_CAP_RULE_TYPES:
        for rule in _enabled_class_scoped_rules(class_id, rules, rule_type):
            limit_unit = rule.get("limit_unit")
            if not limit_unit:
                continue
            window = int(rule["window_days"])
            win_start = add_days(as_of, -(window - 1))
            activity_logs = [
                log
                for log in logs
                if log["activity_id"] in class_activity_ids
                and win_start <= log["logged_date"] <= as_of
            ]
            if rule_type == "daily_volume_cap":
                activity_logs = [
                    log for log in activity_logs if log["logged_date"] == as_of
                ]
                window_label = "daily"
            else:
                window_label = f"{window}-day"
            current = _sum_volume_for_cap(activity_logs, limit_unit)
            threshold = float(rule["threshold_value"])
            severity = _severity_from_ratio(current, threshold)
            if severity is None:
                continue
            candidate = (
                severity,
                rule,
                (
                    f"{window_label} {limit_unit} volume {round(current, 1)} "
                    f"of {int(threshold)} cap"
                ),
            )
            if worst is None or severity == "danger" and worst[0] != "danger":
                worst = candidate
    return worst


# ---------------------------------------------------------------------------
# compute_class_statuses (engine.ts parity)
# ---------------------------------------------------------------------------


def compute_class_statuses(
    as_of: str,
    activity_classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
) -> list[ActivityClassStatus]:
    statuses: list[ActivityClassStatus] = []
    for cls in activity_classes:
        class_id = cls["id"]
        class_logs = [
            log
            for log in _logs_for_class(class_id, activities, logs)
            if log["logged_date"] <= as_of
        ]
        class_logs.sort(key=lambda log: log["logged_date"], reverse=True)

        last_log = class_logs[0] if class_logs else None
        last_done_date = last_log["logged_date"] if last_log else None

        if last_done_date is None:
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "safe",
                    "label": "Safe",
                    "reason": "No prior sessions — safe to begin.",
                }
            )
            continue

        load_cap_hit = _class_load_cap_violation(
            class_id, activities, logs, rules, as_of
        )
        if load_cap_hit is not None:
            load_cap_rule, cur_load = load_cap_hit
            threshold = float(load_cap_rule["threshold_value"])
            window = int(load_cap_rule["window_days"])
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "danger",
                    "label": "Load Cap Hit",
                    "last_done_date": last_done_date,
                    "reason": (
                        f"{window}-day load {round(cur_load)} of {int(threshold)} cap "
                        "— rest this class."
                    ),
                }
            )
            continue

        freq_violation = _class_frequency_violation(
            class_id, activities, logs, rules, as_of
        )
        if freq_violation is not None:
            severity, freq_rule = freq_violation
            window = int(freq_rule["window_days"])
            threshold = int(freq_rule["threshold_value"])
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": severity,
                    "label": "Frequency Limit" if severity == "danger" else "Pushing it",
                    "last_done_date": last_done_date,
                    "reason": (
                        f"Frequency limit reached — {threshold} session"
                        f"{'' if threshold == 1 else 's'} "
                        f"in {window}-day window."
                    ),
                }
            )
            continue

        consecutive_rule = _class_consecutive_violation(
            class_id, activities, logs, rules, as_of
        )
        if consecutive_rule is not None:
            threshold = int(consecutive_rule["threshold_value"])
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "danger",
                    "label": "Resting",
                    "last_done_date": last_done_date,
                    "reason": (
                        f"Consecutive day limit hit — {threshold} days in a row."
                    ),
                }
            )
            continue

        volume_violation = _class_volume_cap_violation(
            class_id, activities, logs, rules, as_of
        )
        if volume_violation is not None:
            severity, _volume_rule, reason = volume_violation
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": severity,
                    "label": "Volume Cap Hit" if severity == "danger" else "Pushing it",
                    "last_done_date": last_done_date,
                    "reason": reason,
                }
            )
            continue

        rest_rule = _class_effective_rest_rule(class_id, activities, rules)
        days_since = _days_between(last_done_date, as_of)

        if rest_rule is None:
            if days_since == 1:
                reason = "Last done yesterday — no rest rule for this class."
            else:
                reason = f"Last done {days_since} days ago."
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "safe",
                    "label": "Safe",
                    "last_done_date": last_done_date,
                    "reason": reason,
                }
            )
            continue

        threshold = int(rest_rule["threshold_value"])
        next_safe_date = add_days(last_done_date, threshold + 1)
        days_left = threshold - days_since

        if days_since > threshold:
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "safe",
                    "label": "Safe",
                    "last_done_date": last_done_date,
                    "reason": (
                        f"Fully rested — {days_since} days since last session."
                    ),
                }
            )
        elif days_since <= 1:
            extra = days_left + 1
            suffix = "" if extra == 1 else "s"
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "danger",
                    "label": "Resting",
                    "last_done_date": last_done_date,
                    "next_safe_date": next_safe_date,
                    "reason": (
                        f"Too soon — {extra} more rest day{suffix} needed. "
                        f"Safe from {next_safe_date}."
                    ),
                }
            )
        else:
            suffix = "" if days_left == 1 else "s"
            statuses.append(
                {
                    "activity_class_id": class_id,
                    "state": "caution",
                    "label": "Pushing it",
                    "last_done_date": last_done_date,
                    "next_safe_date": next_safe_date,
                    "reason": (
                        f"{days_left} more rest day{suffix} recommended. "
                        f"Safe from {next_safe_date}."
                    ),
                }
            )
    return statuses


# ---------------------------------------------------------------------------
# compute_daily_safety_scores
# ---------------------------------------------------------------------------


def compute_daily_safety_scores(
    start_date: str,
    end_date: str,
    logs: list[LogDict],
    check_ins: list[CheckInDict],
    incidents: list[IncidentDict],
) -> list[DailySafetyScore]:
    logs_by_date: dict[str, list[LogDict]] = {}
    for log in logs:
        logs_by_date.setdefault(log["logged_date"], []).append(log)

    check_in_by_date = {ci["check_in_date"]: ci for ci in check_ins}
    incident_by_date = {inc["incident_date"]: inc for inc in incidents}

    scores: list[DailySafetyScore] = []
    for day in each_day(start_date, end_date):
        day_logs = logs_by_date.get(day, [])
        check_in = check_in_by_date.get(day)
        incident = incident_by_date.get(day)

        had_flare_up = bool(incident or (check_in and check_in.get("has_flare_up")))
        violations: list[RuleViolationSnapshot] = []
        for log in day_logs:
            raw = log.get("rule_violations_at_log")
            if raw:
                violations.extend(raw)

        state: SafetyState | Literal["neutral"]
        if not day_logs and check_in is None and incident is None:
            state = "neutral"
        elif (
            had_flare_up
            or any(log.get("post_activity_feel") == "bad" for log in day_logs)
            or any(v.get("severity") == "danger" for v in violations)
        ):
            state = "danger"
        elif (
            any(log.get("post_activity_feel") == "mild_discomfort" for log in day_logs)
            or any(v.get("severity") == "caution" for v in violations)
        ):
            state = "caution"
        else:
            state = "safe"

        score: DailySafetyScore = {
            "date": day,
            "state": state,
            "violations": violations,
            "had_flare_up": had_flare_up,
        }
        if check_in is not None:
            score["pain_level"] = check_in.get("pain_level")
        scores.append(score)
    return scores


# ---------------------------------------------------------------------------
# compute_suggestions
# ---------------------------------------------------------------------------


def compute_suggestions(
    class_statuses: list[ActivityClassStatus],
    activities: list[ActivityDict],
    activity_classes: list[ActivityClassDict],
) -> list[Suggestion]:
    status_map = {status["activity_class_id"]: status for status in class_statuses}
    class_map = {cls["id"]: cls for cls in activity_classes}

    suggestions: list[Suggestion] = []
    for activity in activities:
        if not activity.get("is_active", True):
            continue
        class_id = activity["activity_class_id"]
        status = status_map.get(class_id)
        cls = class_map.get(class_id)
        suggestion: Suggestion = {
            "id": activity["id"],
            "label": activity["name"],
            "state": status["state"] if status else "safe",
            "reason": (
                status["reason"]
                if status
                else f"Ready — {cls['name'] if cls else 'this class'} has no active restrictions."
            ),
        }
        if status:
            if "next_safe_date" in status:
                suggestion["next_safe_date"] = status["next_safe_date"]
            if "last_done_date" in status:
                suggestion["last_done_date"] = status["last_done_date"]
        suggestions.append(suggestion)
    return suggestions


# ---------------------------------------------------------------------------
# compute_suggestion_buckets (S25.B5)
# ---------------------------------------------------------------------------

_STATE_SAFE_ORDER = {"safe": 0, "caution": 1, "danger": 2}
_DESCRIPTION_MAX_LEN = 80


def _goal_achieved_in_live_period(
    goals: list[GoalDict],
    activity_id: str,
    as_of: str,
) -> bool:
    for goal in goals:
        if goal.get("activity_id") != activity_id:
            continue
        if goal.get("status") != "achieved":
            continue
        target_date = goal.get("target_date")
        if not target_date:
            continue
        if as_of <= target_date:
            return True
    return False


def _recovery_target_met_on_day(
    target: RecoveryTargetDict,
    logs: list[LogDict],
    as_of: str,
) -> bool:
    activity_id = target["activity_id"]
    target_frequency = int(target["target_frequency"])
    if target.get("frequency_unit") == "weekly":
        week_start = add_days(as_of, -(parse_iso_date(as_of).weekday()))
        count = sum(
            1
            for log in logs
            if log["activity_id"] == activity_id
            and week_start <= log["logged_date"] <= as_of
        )
        return count >= target_frequency

    count = sum(
        1
        for log in logs
        if log["activity_id"] == activity_id and log["logged_date"] == as_of
    )
    return count >= target_frequency


def _recovery_daily_target_met(
    activity_id: str,
    class_id: str,
    activity_classes: list[ActivityClassDict],
    recovery_targets: list[RecoveryTargetDict],
    logs: list[LogDict],
    as_of: str,
) -> bool:
    class_map = {cls["id"]: cls for cls in activity_classes}
    cls = class_map.get(class_id)
    if cls is None or cls.get("type") != "recovery":
        return False
    for target in recovery_targets:
        if target.get("activity_id") != activity_id:
            continue
        if _recovery_target_met_on_day(target, logs, as_of):
            return True
    return False


def _truncate_description(text: str, max_len: int = _DESCRIPTION_MAX_LEN) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _build_suggestion_row(
    *,
    activity: ActivityDict,
    bucket: SuggestionBucket,
    status: ActivityClassStatus | None,
    cls: ActivityClassDict | None,
    description: str | None = None,
) -> Suggestion:
    class_id = activity["activity_class_id"]
    row: Suggestion = {
        "id": activity["id"],
        "label": activity["name"],
        "state": status["state"] if status else "safe",
        "reason": (
            status["reason"]
            if status
            else (
                f"Ready — {cls['name'] if cls else 'this class'} "
                "has no active restrictions."
            )
        ),
        "bucket": bucket,
        "scope": "activity",
        "activity_class_id": class_id,
        "description": description,
    }
    if status:
        if "next_safe_date" in status:
            row["next_safe_date"] = status["next_safe_date"]
        if "last_done_date" in status:
            row["last_done_date"] = status["last_done_date"]
    return row


def _build_class_rest_row(
    *,
    class_id: str,
    cls: ActivityClassDict,
    status: ActivityClassStatus,
    activity_names: list[str],
) -> Suggestion:
    names = ", ".join(activity_names)
    row: Suggestion = {
        "id": class_id,
        "label": cls["name"],
        "state": status["state"],
        "reason": status["reason"],
        "bucket": "rest",
        "scope": "class",
        "activity_class_id": class_id,
        "description": _truncate_description(names),
    }
    if "next_safe_date" in status:
        row["next_safe_date"] = status["next_safe_date"]
    if "last_done_date" in status:
        row["last_done_date"] = status["last_done_date"]
    return row


def _worst_violation(
    violations: list[RuleViolationSnapshot],
) -> RuleViolationSnapshot | None:
    if not violations:
        return None
    return max(
        violations,
        key=lambda violation: _STATE_SAFE_ORDER.get(violation["severity"], 0),
    )


def _status_from_violation(
    class_id: str,
    violation: RuleViolationSnapshot,
) -> ActivityClassStatus:
    return {
        "activity_class_id": class_id,
        "state": violation["severity"],
        "label": "Rest" if violation["severity"] == "danger" else "Pushing it",
        "reason": violation["message"],
    }


def compute_suggestion_buckets(
    as_of: str,
    activity_classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    recovery_targets: list[RecoveryTargetDict],
    goals: list[GoalDict],
    weekly_targets: list[WeeklyTargetDict],
) -> list[Suggestion]:
    del weekly_targets  # context only for callers; bucket logic does not use it

    class_statuses = compute_class_statuses(
        as_of, activity_classes, activities, logs, rules
    )
    status_map = {status["activity_class_id"]: status for status in class_statuses}
    class_wide_statuses = compute_class_statuses(
        as_of,
        activity_classes,
        activities,
        logs,
        [rule for rule in rules if not rule.get("activity_id")],
    )
    class_wide_status_map = {
        status["activity_class_id"]: status for status in class_wide_statuses
    }
    class_map = {cls["id"]: cls for cls in activity_classes}

    done_rows: list[Suggestion] = []
    do_rows: list[Suggestion] = []
    rest_rows: list[Suggestion] = []
    rest_by_class: dict[str, list[str]] = {}

    for activity in activities:
        if not activity.get("is_active", True):
            continue

        activity_id = activity["id"]
        class_id = activity["activity_class_id"]
        class_wide_status = class_wide_status_map.get(class_id)
        activity_violations = check_violations(
            activity_id,
            volume_value=0,
            rpe=5,
            activities=activities,
            logs=logs,
            rules=rules,
            as_of=as_of,
            duration_minutes=1,
        )
        activity_status = None
        worst_violation = _worst_violation(activity_violations)
        if worst_violation is not None:
            activity_status = _status_from_violation(class_id, worst_violation)
        status = activity_status or class_wide_status or status_map.get(class_id)
        cls = class_map.get(class_id)

        logged_today = any(
            log["activity_id"] == activity_id and log["logged_date"] == as_of
            for log in logs
        )
        if logged_today:
            done_rows.append(
                _build_suggestion_row(
                    activity=activity,
                    bucket="done",
                    status=status,
                    cls=cls,
                    description="Logged today.",
                )
            )
            continue

        if _goal_achieved_in_live_period(goals, activity_id, as_of):
            continue

        if _recovery_daily_target_met(
            activity_id,
            class_id,
            activity_classes,
            recovery_targets,
            logs,
            as_of,
        ):
            continue

        rest_status = activity_status
        if (
            rest_status is None
            and class_wide_status is not None
            and class_wide_status["state"] in {"caution", "danger"}
        ):
            rest_status = class_wide_status

        if rest_status is not None and rest_status["state"] in {"caution", "danger"}:
            rest_rows.append(
                _build_suggestion_row(
                    activity=activity,
                    bucket="rest",
                    status=rest_status,
                    cls=cls,
                    description=rest_status["reason"],
                )
            )
            rest_by_class.setdefault(class_id, []).append(activity["name"])
            continue

        do_rows.append(
            _build_suggestion_row(
                activity=activity,
                bucket="do",
                status=status,
                cls=cls,
                description=None,
            )
        )

    for class_id, names in rest_by_class.items():
        if len(names) < 2:
            continue
        cls = class_map.get(class_id)
        status = status_map.get(class_id)
        if cls is None or status is None:
            continue
        rest_rows.append(
            _build_class_rest_row(
                class_id=class_id,
                cls=cls,
                status=status,
                activity_names=names,
            )
        )

    done_rows.sort(
        key=lambda row: row.get("last_done_date") or "",
        reverse=True,
    )
    do_rows.sort(key=lambda row: _STATE_SAFE_ORDER.get(row["state"], 99))
    rest_rows.sort(
        key=lambda row: (
            -_STATE_SAFE_ORDER.get(row["state"], 0),
            row.get("scope") != "class",
        )
    )

    return done_rows + do_rows + rest_rows


# ---------------------------------------------------------------------------
# compute_weekly_progress
# ---------------------------------------------------------------------------


def compute_weekly_progress(
    weekly_targets: list[WeeklyTargetDict],
    activity_classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    period_start: str,
    period_end: str,
) -> list[WeeklyProgress]:
    class_map = {cls["id"]: cls for cls in activity_classes}
    activity_map = {activity["id"]: activity for activity in activities}
    _, week_label_end = this_week_bounds(period_start)
    progress: list[WeeklyProgress] = []

    for target in weekly_targets:
        class_id = target["activity_class_id"]
        target_activity_id = target.get("activity_id")
        activity_name = (
            activity_map.get(target_activity_id, {}).get("name")
            if target_activity_id is not None
            else None
        )
        if target_activity_id is not None:
            scope_activity_ids = {target_activity_id}
        else:
            scope_activity_ids = set(_activity_ids_for_class(class_id, activities))

        period_logs = [
            log
            for log in logs
            if log["activity_id"] in scope_activity_ids
            and period_start <= log["logged_date"] <= period_end
        ]

        target_unit = target["target_unit"]
        if target_unit == "sessions":
            value = float(len(period_logs))
        elif target_unit == "minutes":
            value = float(
                sum(log.get("duration_minutes") or 0 for log in period_logs)
            )
        else:
            value = sum(
                log["volume_value"]
                for log in period_logs
                if log.get("volume_unit") == target_unit
            )

        rounded = round(value * 10) / 10
        target_value = float(target["target_value"])
        ratio = rounded / target_value if target_value > 0 else 0.0

        if rounded == 0:
            state: str = "neutral"
        elif ratio >= 1.5:
            state = "danger"
        elif ratio >= 1.2:
            state = "caution"
        else:
            state = "safe"

        progress.append(
            {
                "weekly_target_id": target["id"],
                "activity_class_id": class_id,
                "class_name": class_map.get(class_id, {}).get("name", "Unknown"),
                "activity_id": target_activity_id,
                "activity_name": activity_name,
                "value": rounded,
                "target": target_value,
                "unit": target_unit,
                "state": state,  # type: ignore[typeddict-item]
                "period_start": period_start,
                "period_end": week_label_end,
            }
        )
    return progress


# ---------------------------------------------------------------------------
# compute_clean_streak
# ---------------------------------------------------------------------------


def compute_clean_streak(logs: list[LogDict]) -> int:
    sorted_logs = sorted(logs, key=lambda log: log["logged_date"], reverse=True)
    streak = 0
    for log in sorted_logs:
        violations = log.get("rule_violations_at_log") or []
        is_dirty = log.get("post_activity_feel") == "bad" or any(
            v.get("severity") == "danger" for v in violations
        )
        if is_dirty:
            break
        streak += 1
    return streak


# ---------------------------------------------------------------------------
# compute_load_series
# ---------------------------------------------------------------------------


def compute_load_series(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    start_date: str,
    end_date: str,
    window_days: int = 7,
) -> list[LoadPoint]:
    ids = set(_activity_ids_for_class(class_id, activities))
    scoped = [
        log
        for log in logs
        if log["activity_id"] in ids
        and start_date <= log["logged_date"] <= end_date
    ]
    series: list[LoadPoint] = []
    for day in each_day(start_date, end_date):
        series.append(
            {
                "date": day,
                "load": rolling_load(scoped, day, window_days),
                "daily_load": daily_load(scoped, day),
            }
        )
    return series


# ---------------------------------------------------------------------------
# check_violations — dry-run, all five rule types
# ---------------------------------------------------------------------------


def _severity_from_ratio(count: float, threshold: float) -> ViolationSeverity | None:
    if count >= threshold:
        return "danger"
    if count >= threshold * 0.8:
        return "caution"
    return None


def _violations_rest_between_class(
    rest_rule: RuleDict,
    class_activity_ids: set[str],
    logs: list[LogDict],
    as_of: str,
) -> list[RuleViolationSnapshot]:
    prior_logs = [
        log
        for log in logs
        if log["activity_id"] in class_activity_ids and log["logged_date"] < as_of
    ]
    prior_logs.sort(key=lambda log: log["logged_date"], reverse=True)
    last = prior_logs[0] if prior_logs else None
    if last is None:
        return []

    days_since = _days_between(last["logged_date"], as_of)
    threshold = int(rest_rule["threshold_value"])
    if days_since > threshold:
        return []

    day_label = "day" if days_since == 1 else "days"
    return [
        {
            "rule_id": rest_rule["id"],
            "rule_type": "rest_between_class",
            "message": (
                f"Breaks {threshold}-day rest rule — "
                f"{days_since} {day_label} since last session"
            ),
            "severity": "danger" if days_since <= 1 else "caution",
        }
    ]


def _violations_volume_cap(
    rule: RuleDict,
    activity_id: str,
    logs: list[LogDict],
    as_of: str,
    volume_value: float,
    *,
    duration_minutes: int | None = None,
    volume_unit: str | None = None,
) -> list[RuleViolationSnapshot]:
    limit_unit = rule.get("limit_unit")
    if not limit_unit:
        return []

    rule_type = rule["rule_type"]
    window = int(rule["window_days"])
    win_start = add_days(as_of, -(window - 1))
    activity_logs = [
        log
        for log in logs
        if log["activity_id"] == activity_id
        and win_start <= log["logged_date"] <= as_of
    ]
    if rule_type == "daily_volume_cap":
        activity_logs = [log for log in activity_logs if log["logged_date"] == as_of]
        window_label = "daily"
    else:
        window_label = f"{window}-day"

    current = _sum_volume_for_cap(activity_logs, limit_unit)
    projected_delta = _projected_volume_for_cap(
        volume_value,
        limit_unit,
        duration_minutes=duration_minutes,
        volume_unit=volume_unit,
    )
    projected = current if projected_delta is None else current + projected_delta
    threshold = float(rule["threshold_value"])
    if projected >= threshold:
        return [
            {
                "rule_id": rule["id"],
                "rule_type": rule_type,
                "severity": "danger",
                "message": (
                    f"Projected {window_label} {limit_unit} volume "
                    f"{round(projected, 1)} of {int(threshold)} cap"
                ),
            }
        ]
    if projected >= threshold * 0.8:
        return [
            {
                "rule_id": rule["id"],
                "rule_type": rule_type,
                "severity": "caution",
                "message": (
                    f"Approaching {limit_unit} cap — "
                    f"{round(projected, 1)} / {int(threshold)}"
                ),
            }
        ]
    return []


def _violations_weekly_load_cap(
    cap_rule: RuleDict,
    class_activity_ids: set[str],
    logs: list[LogDict],
    as_of: str,
    volume_value: float,
    rpe: int,
) -> list[RuleViolationSnapshot]:
    window = int(cap_rule["window_days"])
    win_start = add_days(as_of, -(window - 1))
    current_load = sum(
        log_load(log)
        for log in logs
        if log["activity_id"] in class_activity_ids
        and win_start <= log["logged_date"] <= as_of
    )
    projected = current_load + volume_value * rpe
    cap = float(cap_rule["threshold_value"])
    if projected >= cap:
        return [
            {
                "rule_id": cap_rule["id"],
                "rule_type": "weekly_load_cap",
                "severity": "danger",
                "message": f"Projected load {round(projected)} / {int(cap)} cap",
            }
        ]
    if projected >= cap * 0.8:
        return [
            {
                "rule_id": cap_rule["id"],
                "rule_type": "weekly_load_cap",
                "severity": "caution",
                "message": f"Approaching cap — {round(projected)} / {int(cap)}",
            }
        ]
    return []


def _violations_frequency_limit(
    rule: RuleDict,
    class_activity_ids: set[str],
    logs: list[LogDict],
    as_of: str,
) -> list[RuleViolationSnapshot]:
    window = int(rule["window_days"])
    win_start = add_days(as_of, -(window - 1))
    freq_count = float(
        sum(
            1
            for log in logs
            if log["activity_id"] in class_activity_ids
            and win_start <= log["logged_date"] <= as_of
        )
        + 1
    )
    freq_threshold = float(rule["threshold_value"])
    severity = _severity_from_ratio(freq_count, freq_threshold)
    if severity is None:
        return []
    return [
        {
            "rule_id": rule["id"],
            "rule_type": "frequency_limit",
            "severity": severity,
            "message": (
                f"Frequency {int(freq_count)} / {int(freq_threshold)} "
                f"in {window}-day window"
            ),
        }
    ]


def _violations_consecutive_day_limit(
    rule: RuleDict,
    class_activity_ids: set[str],
    logs: list[LogDict],
    as_of: str,
) -> list[RuleViolationSnapshot]:
    threshold = int(rule["threshold_value"])
    consecutive = 0
    cursor = as_of
    while True:
        if cursor == as_of:
            has_log = True
        else:
            has_log = any(
                log["activity_id"] in class_activity_ids
                and log["logged_date"] == cursor
                for log in logs
            )
        if not has_log:
            break
        consecutive += 1
        cursor = add_days(cursor, -1)
    if consecutive < threshold:
        return []
    return [
        {
            "rule_id": rule["id"],
            "rule_type": "consecutive_day_limit",
            "severity": "danger",
            "message": f"{consecutive} consecutive days (limit {threshold})",
        }
    ]


def _enabled_class_rule(
    enabled_rules: list[RuleDict],
    class_id: str,
    rule_type: str,
) -> RuleDict | None:
    return next(
        (
            rule
            for rule in enabled_rules
            if rule["activity_class_id"] == class_id and rule["rule_type"] == rule_type
        ),
        None,
    )


def _violations_loop_rules(
    class_id: str,
    class_activity_ids: set[str],
    activity: ActivityDict,
    activities: list[ActivityDict],
    logs: list[LogDict],
    as_of: str,
    enabled_rules: list[RuleDict],
) -> list[RuleViolationSnapshot]:
    violations: list[RuleViolationSnapshot] = []
    del activities
    for rule in effective_rules_for_activity(activity["id"], class_id, enabled_rules):
        scoped_activity_ids = (
            {activity["id"]} if rule.get("activity_id") == activity["id"] else class_activity_ids
        )
        if rule["rule_type"] == "frequency_limit":
            violations.extend(
                _violations_frequency_limit(rule, scoped_activity_ids, logs, as_of)
            )
        elif rule["rule_type"] == "consecutive_day_limit":
            violations.extend(
                _violations_consecutive_day_limit(
                    rule, scoped_activity_ids, logs, as_of
                )
            )
    return violations


def check_violations(
    activity_id: str,
    volume_value: float,
    rpe: int,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
    *,
    duration_minutes: int | None = None,
    volume_unit: str | None = None,
) -> list[RuleViolationSnapshot]:
    activity = next((a for a in activities if a["id"] == activity_id), None)
    if activity is None:
        return []

    class_id = activity["activity_class_id"]
    class_activity_ids = {
        a["id"] for a in activities if a["activity_class_id"] == class_id
    }
    enabled_rules = [rule for rule in rules if rule.get("enabled", True)]
    violations: list[RuleViolationSnapshot] = []

    for rule in effective_rules_for_activity(activity_id, class_id, enabled_rules):
        if rule["rule_type"] != "rest_between_class":
            continue
        scoped_activity_ids = (
            {activity_id} if rule.get("activity_id") == activity_id else class_activity_ids
        )
        violations.extend(
            _violations_rest_between_class(rule, scoped_activity_ids, logs, as_of)
        )

    if volume_value > 0 and rpe > 0:
        cap_rule = _enabled_class_rule(enabled_rules, class_id, "weekly_load_cap")
        if cap_rule is not None:
            violations.extend(
                _violations_weekly_load_cap(
                    cap_rule,
                    class_activity_ids,
                    logs,
                    as_of,
                    volume_value,
                    rpe,
                )
            )

    has_volume_projection = volume_value > 0 or (
        duration_minutes is not None and duration_minutes > 0
    )
    if has_volume_projection and rpe > 0:
        effective = effective_rules_for_activity(
            activity_id, class_id, enabled_rules
        )
        for rule in effective:
            if rule["rule_type"] in _VOLUME_CAP_RULE_TYPES:
                violations.extend(
                    _violations_volume_cap(
                        rule,
                        activity_id,
                        logs,
                        as_of,
                        volume_value,
                        duration_minutes=duration_minutes,
                        volume_unit=volume_unit,
                    )
                )

    violations.extend(
        _violations_loop_rules(
            class_id,
            class_activity_ids,
            activity,
            activities,
            logs,
            as_of,
            enabled_rules,
        )
    )
    return violations


# ---------------------------------------------------------------------------
# compute_load_risk_summary (S25.B6)
# ---------------------------------------------------------------------------

_LOAD_RISK_CAP_RULE_TYPES = frozenset(
    {"weekly_load_cap", "daily_volume_cap", "weekly_volume_cap", "frequency_limit"}
)
_LOAD_RISK_METRIC_PRIORITY: list[tuple[str, frozenset[str]]] = [
    ("volume", frozenset({"daily_volume_cap", "weekly_volume_cap"})),
    ("frequency", frozenset({"frequency_limit"})),
    ("load", frozenset({"weekly_load_cap"})),
]
_LOAD_RISK_WEEK_DAYS = 7


def _rule_has_finite_limit(rule: RuleDict) -> bool:
    threshold = rule.get("threshold_value")
    if threshold is None:
        return False
    return float(threshold) > 0


def _enabled_cap_rules_for_class(class_id: str, rules: list[RuleDict]) -> list[RuleDict]:
    return [
        rule
        for rule in rules
        if rule.get("enabled", True)
        and rule.get("activity_class_id") == class_id
        and rule["rule_type"] in _LOAD_RISK_CAP_RULE_TYPES
        and _rule_has_finite_limit(rule)
    ]


def _class_has_enabled_cap_rules(class_id: str, rules: list[RuleDict]) -> bool:
    return bool(_enabled_cap_rules_for_class(class_id, rules))


def _primary_cap_rule_for_class(
    class_id: str, rules: list[RuleDict]
) -> tuple[str, RuleDict] | None:
    enabled = _enabled_cap_rules_for_class(class_id, rules)
    if not enabled:
        return None

    for metric, rule_types in _LOAD_RISK_METRIC_PRIORITY:
        matching = [rule for rule in enabled if rule["rule_type"] in rule_types]
        if not matching:
            continue
        class_scoped = [rule for rule in matching if not rule.get("activity_id")]
        pool = class_scoped or matching
        return metric, _pick_strictest_rule(pool)
    return None


def _effective_cap_rule_for_activity(
    activity_id: str,
    class_id: str,
    rules: list[RuleDict],
    metric: str,
    class_rule: RuleDict,
) -> RuleDict:
    rule_types = next(
        types for name, types in _LOAD_RISK_METRIC_PRIORITY if name == metric
    )
    exercise_rules = [
        rule
        for rule in rules
        if rule.get("enabled", True)
        and rule.get("activity_class_id") == class_id
        and rule.get("activity_id") == activity_id
        and rule["rule_type"] in rule_types
        and _rule_has_finite_limit(rule)
    ]
    if exercise_rules:
        return _pick_strictest_rule(exercise_rules)
    return class_rule


def _metric_actual_and_limit(
    metric: str,
    rule: RuleDict,
    *,
    activities: list[ActivityDict],
    logs: list[LogDict],
    as_of: str,
    class_id: str | None = None,
    activity_id: str | None = None,
) -> tuple[float, float, str]:
    threshold = float(rule["threshold_value"])
    window = int(rule["window_days"])

    if metric == "load":
        if activity_id is not None:
            scoped_logs = _activity_logs_up_to(activity_id, logs, as_of)
        else:
            assert class_id is not None
            scoped_logs = _class_logs_up_to(class_id, activities, logs, as_of)
        actual = rolling_load(scoped_logs, as_of, window)
        return actual, threshold, "load"

    if metric == "frequency":
        win_start = add_days(as_of, -(window - 1))
        if activity_id is not None:
            actual = float(
                sum(
                    1
                    for log in logs
                    if log["activity_id"] == activity_id
                    and win_start <= log["logged_date"] <= as_of
                )
            )
        else:
            assert class_id is not None
            class_activity_ids = set(_activity_ids_for_class(class_id, activities))
            actual = float(
                sum(
                    1
                    for log in logs
                    if log["activity_id"] in class_activity_ids
                    and win_start <= log["logged_date"] <= as_of
                )
            )
        return actual, threshold, "sessions"

    limit_unit = rule.get("limit_unit") or ""
    win_start = add_days(as_of, -(window - 1))
    if activity_id is not None:
        activity_logs = [
            log
            for log in logs
            if log["activity_id"] == activity_id
            and win_start <= log["logged_date"] <= as_of
        ]
    else:
        assert class_id is not None
        class_activity_ids = set(_activity_ids_for_class(class_id, activities))
        activity_logs = [
            log
            for log in logs
            if log["activity_id"] in class_activity_ids
            and win_start <= log["logged_date"] <= as_of
        ]

    if rule["rule_type"] == "daily_volume_cap":
        activity_logs = [
            log for log in activity_logs if log["logged_date"] == as_of
        ]
    actual = _sum_volume_for_cap(activity_logs, limit_unit)
    return float(actual), threshold, str(limit_unit)


def _day_cap_breached(
    day: str,
    activity_classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
) -> bool:
    for cls in activity_classes:
        if cls.get("type") != "performance":
            continue
        class_id = cls["id"]
        if not _class_has_enabled_cap_rules(class_id, rules):
            continue

        if _class_load_cap_violation(class_id, activities, logs, rules, day) is not None:
            return True

        freq_violation = _class_frequency_violation(
            class_id, activities, logs, rules, day
        )
        if freq_violation is not None and freq_violation[0] == "danger":
            return True

        volume_violation = _class_volume_cap_violation(
            class_id, activities, logs, rules, day
        )
        if volume_violation is not None and volume_violation[0] == "danger":
            return True
    return False


def _delayed_tax_elevated_dates(
    delayed_tax_hits: list[DelayedTaxHit],
) -> set[str]:
    return {
        hit["contributing_date"]
        for hit in delayed_tax_hits
        if hit.get("hit_type") == "elevated_load" and hit.get("contributing_date")
    }


def _exercise_bars_for_class(
    class_id: str,
    metric: str,
    class_rule: RuleDict,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    as_of: str,
) -> list[LoadRiskExerciseBar]:
    win_start = add_days(as_of, -(_LOAD_RISK_WEEK_DAYS - 1))
    class_activity_ids = set(_activity_ids_for_class(class_id, activities))
    activity_ids_with_logs = {
        log["activity_id"]
        for log in logs
        if log["activity_id"] in class_activity_ids
        and win_start <= log["logged_date"] <= as_of
    }

    exercises: list[LoadRiskExerciseBar] = []
    for activity in activities:
        activity_id = activity["id"]
        if activity_id not in activity_ids_with_logs:
            continue
        rule = _effective_cap_rule_for_activity(
            activity_id, class_id, rules, metric, class_rule
        )
        actual, limit, unit = _metric_actual_and_limit(
            metric,
            rule,
            activities=activities,
            logs=logs,
            as_of=as_of,
            activity_id=activity_id,
        )
        exercises.append(
            {
                "activity_id": activity_id,
                "activity_name": activity["name"],
                "actual": actual,
                "limit": limit,
                "unit": unit,
            }
        )
    return exercises


def compute_load_risk_summary(
    as_of: str,
    classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    delayed_tax_hits: list[DelayedTaxHit],
) -> LoadRiskSummary:
    week_start = add_days(as_of, -(_LOAD_RISK_WEEK_DAYS - 1))
    elevated_dates = _delayed_tax_elevated_dates(delayed_tax_hits)

    week_days: list[LoadRiskDay] = []
    for day in each_day(week_start, as_of):
        week_days.append(
            {
                "date": day,
                "flagged": _day_cap_breached(day, classes, activities, logs, rules)
                or day in elevated_dates,
            }
        )

    class_bars: list[LoadRiskClassBar] = []
    for cls in classes:
        if cls.get("type") != "performance":
            continue
        class_id = cls["id"]
        primary = _primary_cap_rule_for_class(class_id, rules)
        if primary is None:
            continue

        metric, class_rule = primary
        actual, limit, unit = _metric_actual_and_limit(
            metric,
            class_rule,
            activities=activities,
            logs=logs,
            as_of=as_of,
            class_id=class_id,
        )
        class_bars.append(
            {
                "activity_class_id": class_id,
                "class_name": cls["name"],
                "actual": actual,
                "limit": limit,
                "unit": unit,
                "exercises": _exercise_bars_for_class(
                    class_id,
                    metric,
                    class_rule,
                    activities,
                    logs,
                    rules,
                    as_of,
                ),
            }
        )

    return {"week_days": week_days, "class_bars": class_bars}


# ---------------------------------------------------------------------------
# detect_delayed_tax
# ---------------------------------------------------------------------------


def _sort_delayed_tax_hits(hits: list[DelayedTaxHit]) -> list[DelayedTaxHit]:
    def sort_key(hit: DelayedTaxHit) -> tuple[Any, ...]:
        symptom = hit.get("symptom_date")
        symptom_sort = symptom if symptom is not None else ""
        symptom_null = 0 if symptom is None else 1
        return (
            symptom_null,
            symptom_sort,
            hit.get("contributing_date", ""),
            hit.get("activity_class_id", ""),
        )

    return sorted(hits, key=sort_key, reverse=True)


def _proactive_elevated_load(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    risk_start: str,
    risk_end: str,
    baseline_start: str,
    baseline_end: str,
) -> list[DelayedTaxHit]:
    baseline_days = each_day(baseline_start, baseline_end)
    baseline_loads = [
        _class_daily_load(class_id, activities, logs, day) for day in baseline_days
    ]
    baseline_median = _median(baseline_loads)

    hits: list[DelayedTaxHit] = []
    for day in each_day(risk_start, risk_end):
        day_load = _class_daily_load(class_id, activities, logs, day)
        if day_load > 0 and day_load >= baseline_median:
            hits.append(
                {
                    "hit_type": "elevated_load",
                    "activity_class_id": class_id,
                    "contributing_date": day,
                    "daily_load": day_load,
                    "baseline_median_daily_load": baseline_median,
                    "message": (
                        f"Elevated load on {day}: {day_load:.1f} "
                        f"(baseline median {baseline_median:.1f})"
                    ),
                }
            )
    return hits


def _proactive_rest_debt(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    rules: list[RuleDict],
    risk_start: str,
    risk_end: str,
) -> list[DelayedTaxHit]:
    rest_rule = next(
        (
            rule
            for rule in rules
            if rule.get("enabled", True)
            and rule["activity_class_id"] == class_id
            and rule["rule_type"] == "rest_between_class"
        ),
        None,
    )
    if rest_rule is None:
        return []

    threshold = int(rest_rule["threshold_value"])
    class_logs = sorted(
        [
            log
            for log in _logs_for_class(class_id, activities, logs)
            if risk_start <= log["logged_date"] <= risk_end
        ],
        key=lambda log: log["logged_date"],
    )
    all_class_logs = sorted(
        _logs_for_class(class_id, activities, logs),
        key=lambda log: log["logged_date"],
    )

    hits: list[DelayedTaxHit] = []
    seen_dates: set[str] = set()
    for log in class_logs:
        day = log["logged_date"]
        if day in seen_dates:
            continue
        seen_dates.add(day)

        prior = [
            entry
            for entry in all_class_logs
            if entry["logged_date"] < day
        ]
        if not prior:
            continue
        prev_date = prior[-1]["logged_date"]
        gap = _days_between(prev_date, day)
        if gap <= threshold:
            cumulative = sum(
                _class_daily_load(class_id, activities, logs, d)
                for d in each_day(prev_date, day)
            )
            day_load = _class_daily_load(class_id, activities, logs, day)
            hits.append(
                {
                    "hit_type": "rest_debt",
                    "activity_class_id": class_id,
                    "contributing_date": day,
                    "days_since_last_session": gap,
                    "required_rest_days": threshold,
                    "daily_load": day_load,
                    "cumulative_load": cumulative,
                    "message": (
                        f"Rest debt on {day}: only {gap} day(s) since "
                        f"{prev_date} (need {threshold})"
                    ),
                }
            )
    return hits


def _collect_symptom_dates(
    check_ins: list[CheckInDict],
    incidents: list[IncidentDict],
    risk_start: str,
    risk_end: str,
    pain_threshold: int,
) -> dict[str, dict[str, Any]]:
    symptoms: dict[str, dict[str, Any]] = {}

    for check_in in check_ins:
        day = check_in["check_in_date"]
        if not (risk_start <= day <= risk_end):
            continue
        pain = check_in.get("pain_level")
        has_flare = bool(check_in.get("has_flare_up"))
        qualifies_pain = pain is not None and pain > pain_threshold
        if qualifies_pain or has_flare:
            source = "check_in_flare" if has_flare else "check_in_pain"
            symptoms[day] = {
                "symptom_source": source,
                "pain_level": pain,
                "check_in_id": check_in.get("id"),
                "has_flare_up": has_flare,
            }

    for incident in incidents:
        day = incident["incident_date"]
        if not (risk_start <= day <= risk_end):
            continue
        if day in symptoms:
            continue
        symptoms[day] = {
            "symptom_source": "flare_incident",
            "incident_id": incident.get("id"),
            "activity_class_id": incident.get("activity_class_id"),
            "severity": incident.get("severity"),
        }

    return symptoms


def _symptom_markers(symptoms: dict[str, dict[str, Any]]) -> list[DelayedTaxHit]:
    hits: list[DelayedTaxHit] = []
    for day, info in symptoms.items():
        hit: DelayedTaxHit = {
            "hit_type": "symptom_marker",
            "symptom_date": day,
            "symptom_source": info["symptom_source"],
            "message": f"Symptom recorded on {day}",
        }
        if "activity_class_id" in info and info["activity_class_id"]:
            hit["activity_class_id"] = info["activity_class_id"]
        if info.get("pain_level") is not None:
            hit["pain_level"] = info["pain_level"]
        if info.get("check_in_id"):
            hit["check_in_id"] = info["check_in_id"]
        if info.get("incident_id"):
            hit["incident_id"] = info["incident_id"]
        hits.append(hit)
    return hits


def _has_extended_rest_before(
    class_id: str,
    activities: list[ActivityDict],
    logs: list[LogDict],
    activity_date: str,
    acute_rest_days: int,
) -> bool:
    for offset in range(1, acute_rest_days + 1):
        check_day = add_days(activity_date, -offset)
        if _class_daily_load(class_id, activities, logs, check_day) > 0:
            return False
    return True


def _acute_attributions(
    symptoms: dict[str, dict[str, Any]],
    activity_classes: list[ActivityClassDict],
    activities: list[ActivityDict],
    logs: list[LogDict],
    acute_rest_days: int,
    acute_symptom_lag_days: int,
) -> list[DelayedTaxHit]:
    perf_classes = _performance_class_ids(activity_classes)
    hits: list[DelayedTaxHit] = []

    for symptom_date, info in symptoms.items():
        preferred_class = info.get("activity_class_id")
        class_ids = (
            [preferred_class]
            if preferred_class and preferred_class in perf_classes
            else sorted(perf_classes)
        )

        for class_id in class_ids:
            class_logs = [
                log
                for log in _logs_for_class(class_id, activities, logs)
                if log["logged_date"] <= symptom_date
            ]
            if not class_logs:
                continue
            class_logs.sort(key=lambda log: log["logged_date"], reverse=True)
            last_date = class_logs[0]["logged_date"]
            gap = _days_between(last_date, symptom_date)
            if gap < 0 or gap > acute_symptom_lag_days:
                continue
            if not _has_extended_rest_before(
                class_id, activities, logs, last_date, acute_rest_days
            ):
                continue
            day_load = _class_daily_load(class_id, activities, logs, last_date)
            hits.append(
                {
                    "hit_type": "acute_attribution",
                    "activity_class_id": class_id,
                    "symptom_date": symptom_date,
                    "contributing_date": last_date,
                    "daily_load": day_load,
                    "primary": True,
                    "message": "Likely caused by returning after extended rest.",
                }
            )
            break

    return hits


def _symptom_contributors(
    symptoms: dict[str, dict[str, Any]],
    proactive_hits: list[DelayedTaxHit],
    acute_hits: list[DelayedTaxHit],
    risk_window_days: int,
) -> list[DelayedTaxHit]:
    acute_by_class = {
        hit["activity_class_id"]
        for hit in acute_hits
        if hit.get("activity_class_id")
    }
    hits: list[DelayedTaxHit] = []

    for symptom_date in symptoms:
        lookback_start = add_days(symptom_date, -(risk_window_days - 1))
        for proactive in proactive_hits:
            if proactive["hit_type"] not in {"elevated_load", "rest_debt"}:
                continue
            class_id = proactive["activity_class_id"]
            contrib = proactive["contributing_date"]
            if not (lookback_start <= contrib <= symptom_date):
                continue
            if class_id in acute_by_class:
                continue
            hit: DelayedTaxHit = {
                "hit_type": "symptom_contributor",
                "activity_class_id": class_id,
                "symptom_date": symptom_date,
                "contributing_date": contrib,
                "contributor_hit_type": proactive["hit_type"],
                "message": (
                    f"Prior {proactive['hit_type']} on {contrib} may have "
                    f"contributed to symptom on {symptom_date}"
                ),
            }
            if "daily_load" in proactive:
                hit["daily_load"] = proactive["daily_load"]
            if "cumulative_load" in proactive:
                hit["cumulative_load"] = proactive["cumulative_load"]
            hits.append(hit)

    return hits


def detect_delayed_tax(
    logs: list[LogDict],
    activities: list[ActivityDict],
    activity_classes: list[ActivityClassDict],
    rules: list[RuleDict],
    check_ins: list[CheckInDict],
    incidents: list[IncidentDict],
    as_of: str,
    risk_window_days: int = 7,
    baseline_days: int = 14,
    pain_threshold: int = 3,
    acute_rest_days: int = 14,
    acute_symptom_lag_days: int = 3,
) -> list[DelayedTaxHit]:
    if not logs and not check_ins and not incidents:
        return []

    risk_start = add_days(as_of, -(risk_window_days - 1))
    risk_end = as_of
    baseline_end = add_days(risk_start, -1)
    baseline_start = add_days(baseline_end, -(baseline_days - 1))

    perf_classes = sorted(_performance_class_ids(activity_classes))
    proactive: list[DelayedTaxHit] = []
    seen_proactive: set[tuple[str, str, str]] = set()

    for class_id in perf_classes:
        for hit in _proactive_elevated_load(
            class_id,
            activities,
            logs,
            risk_start,
            risk_end,
            baseline_start,
            baseline_end,
        ):
            key = (class_id, hit["contributing_date"], hit["hit_type"])
            if key not in seen_proactive:
                seen_proactive.add(key)
                proactive.append(hit)

        for hit in _proactive_rest_debt(
            class_id, activities, logs, rules, risk_start, risk_end
        ):
            key = (class_id, hit["contributing_date"], hit["hit_type"])
            if key not in seen_proactive:
                seen_proactive.add(key)
                proactive.append(hit)

    symptoms = _collect_symptom_dates(
        check_ins, incidents, risk_start, risk_end, pain_threshold
    )
    markers = _symptom_markers(symptoms)
    acute = _acute_attributions(
        symptoms,
        activity_classes,
        activities,
        logs,
        acute_rest_days,
        acute_symptom_lag_days,
    )
    contributors = _symptom_contributors(
        symptoms, proactive, acute, risk_window_days
    )

    all_hits = proactive + markers + acute + contributors
    return _sort_delayed_tax_hits(all_hits)
