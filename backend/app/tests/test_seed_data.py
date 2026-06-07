from __future__ import annotations

import os
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import cast

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, RowMapping
from sqlmodel import Session, select

from app.models.activity import Activity, ActivityClass
from app.models.block import Rule, TrainingBlock, WeeklyTarget
from app.models.checkin import DailyCheckIn, FlareUpIncident
from app.models.log import ActivityLog
from app.services.seed_data import SEED_WEEK_END, SEED_WEEK_START
from app.services.training_blocks import calendar_week_label

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"
ALEMBIC_ROOT = BACKEND_ROOT / "alembic"
SEED_SCRIPT = BACKEND_ROOT / "scripts" / "seed.py"

PROTOTYPE_TODAY = date(2026, 5, 25)
EXPECTED_COUNTS = {
    "activity_classes": 3,
    "activities": 5,
    "training_blocks": 1,
    "rules": 6,
    "weekly_targets": 2,
    "activity_logs": 26,
    "daily_check_ins": 6,
    "flare_up_incidents": 2,
    "goals": 2,
    "recovery_targets": 0,
}
USER_OWNED_TABLES = {
    "activity_classes",
    "activities",
    "training_blocks",
    "activity_logs",
    "daily_check_ins",
    "flare_up_incidents",
    "goals",
}


def _make_alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", database_url)
    config.set_main_option("script_location", str(ALEMBIC_ROOT))
    return config


def _make_migrated_engine(database_path: Path) -> Engine:
    database_url = f"sqlite:///{database_path}"
    command.upgrade(_make_alembic_config(database_url), "head")
    return create_engine(database_url)


def _run_seed(database_url: str) -> None:
    assert SEED_SCRIPT.exists(), "B1.3 requires backend/scripts/seed.py."

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    result = subprocess.run(
        [sys.executable, "-m", "scripts.seed"],
        cwd=BACKEND_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )

    assert result.returncode == 0, (
        "Expected python -m scripts.seed to succeed against the provided DATABASE_URL.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def _count_rows(engine: Engine, table_name: str) -> int:
    assert table_name in EXPECTED_COUNTS
    with engine.connect() as connection:
        row_count = connection.exec_driver_sql(
            f"SELECT COUNT(*) FROM {table_name}"
        ).scalar_one()
    return cast(int, row_count)


def _row_by_id(engine: Engine, table_name: str, row_id: str) -> RowMapping:
    assert table_name in EXPECTED_COUNTS
    with engine.connect() as connection:
        row = (
            connection.exec_driver_sql(
                f"SELECT * FROM {table_name} WHERE id = ?",
                (row_id,),
            )
            .mappings()
            .one()
        )
    return row


def test_seed_script_module_is_invokable_from_backend_directory() -> None:
    assert SEED_SCRIPT.exists(), "B1.3 requires backend/scripts/seed.py."


def test_seed_populates_prototype_counts_and_is_safe_to_rerun(tmp_path: Path) -> None:
    database_path = tmp_path / "seed-counts.db"
    database_url = f"sqlite:///{database_path}"
    engine = _make_migrated_engine(database_path)

    _run_seed(database_url)
    first_counts = {
        table_name: _count_rows(engine, table_name) for table_name in EXPECTED_COUNTS
    }
    assert first_counts == EXPECTED_COUNTS

    _run_seed(database_url)
    second_counts = {
        table_name: _count_rows(engine, table_name) for table_name in EXPECTED_COUNTS
    }
    assert second_counts == EXPECTED_COUNTS


def test_seed_uses_local_user_contract_for_top_level_rows(tmp_path: Path) -> None:
    database_path = tmp_path / "seed-users.db"
    database_url = f"sqlite:///{database_path}"
    engine = _make_migrated_engine(database_path)

    _run_seed(database_url)

    with engine.connect() as connection:
        for table_name in USER_OWNED_TABLES:
            rows = connection.exec_driver_sql(
                f"SELECT DISTINCT user_id FROM {table_name}",
            ).all()
            assert {cast(str, row[0]) for row in rows} <= {"local"}


def test_seed_mirrors_sam_chen_training_scenario_semantics(tmp_path: Path) -> None:
    database_path = tmp_path / "seed-scenario.db"
    database_url = f"sqlite:///{database_path}"
    engine = _make_migrated_engine(database_path)

    _run_seed(database_url)

    with Session(engine) as session:
        block = session.get(TrainingBlock, "blk-1")
        assert block is not None
        assert block.user_id == "local"
        assert block.name == calendar_week_label(SEED_WEEK_START, SEED_WEEK_END)
        assert block.status == "active"
        assert block.period_kind == "weekly_focus"
        assert block.start_date == SEED_WEEK_START
        assert block.end_date == SEED_WEEK_END
        assert block.start_date.weekday() == 0
        assert block.end_date is not None
        assert block.end_date.weekday() == 6
        assert (block.end_date - block.start_date).days == 6
        assert block.is_review_milestone_hit is False

        classes = session.exec(select(ActivityClass)).all()
        class_names_by_id = {activity_class.id: activity_class.name for activity_class in classes}
        assert class_names_by_id == {
            "cls-foot": "High-Intensity Foot Load",
            "cls-recovery": "Low-Impact Recovery",
            "cls-upper": "Upper Body Strength",
        }
        assert {
            activity_class.id: activity_class.default_recovery_window_days
            for activity_class in classes
        } == {
            "cls-foot": 3,
            "cls-recovery": 1,
            "cls-upper": 2,
        }

        activities = session.exec(select(Activity)).all()
        assert {activity.id: activity.default_volume_unit for activity in activities} == {
            "act-walk": "km",
            "act-bike": "minutes",
            "act-stretch": "minutes",
            "act-pool": "minutes",
            "act-bands": "sets",
        }

        rules = session.exec(select(Rule)).all()
        assert {rule.id: rule.rule_type for rule in rules} == {
            "rule-rest-foot": "rest_between_class",
            "rule-consec-foot": "consecutive_day_limit",
            "rule-vol-walk-weekly": "weekly_volume_cap",
            "rule-vol-bike-daily": "daily_volume_cap",
            "rule-freq-foot": "frequency_limit",
            "rule-rest-upper": "rest_between_class",
        }
        vol_walk = next(r for r in rules if r.id == "rule-vol-walk-weekly")
        assert vol_walk.activity_id == "act-walk"
        assert vol_walk.limit_unit == "km"
        vol_bike = next(r for r in rules if r.id == "rule-vol-bike-daily")
        assert vol_bike.activity_id == "act-bike"
        assert vol_bike.limit_unit == "minutes"
        assert {rule.training_block_id for rule in rules} == {"blk-1"}

        weekly_targets = session.exec(select(WeeklyTarget)).all()
        assert {
            target.id: (target.activity_class_id, target.target_value, target.target_unit)
            for target in weekly_targets
        } == {
            "wt-foot": ("cls-foot", 8.0, "km"),
            "wt-recovery": ("cls-recovery", 4.0, "sessions"),
        }


def test_seed_preserves_log_violation_snapshots_and_key_log_dates(tmp_path: Path) -> None:
    database_path = tmp_path / "seed-logs.db"
    database_url = f"sqlite:///{database_path}"
    engine = _make_migrated_engine(database_path)

    _run_seed(database_url)

    with Session(engine) as session:
        logs = session.exec(select(ActivityLog)).all()
        assert min(log.logged_date for log in logs) == date(2026, 4, 8)
        assert max(log.logged_date for log in logs) == date(2026, 5, 24)
        assert len({log.logged_date.isocalendar().week for log in logs}) == 7

        caution_log = session.get(ActivityLog, "log-21")
        assert caution_log is not None
        assert caution_log.activity_id == "act-bike"
        assert caution_log.logged_date == date(2026, 5, 15)
        assert caution_log.rule_violations_at_log == [
            {
                "rule_id": "rule-rest-foot",
                "rule_type": "rest_between_class",
                "message": "Breaks 3-day rest rule for foot load — 2 days since last walk",
                "severity": "caution",
            }
        ]
        caution_violation = caution_log.rule_violations_at_log[0]
        assert "ruleId" not in caution_violation
        assert "ruleType" not in caution_violation

        danger_log = session.get(ActivityLog, "log-22")
        assert danger_log is not None
        assert danger_log.post_activity_feel == "bad"
        assert danger_log.rule_violations_at_log is not None
        assert danger_log.rule_violations_at_log[0] == {
            "rule_id": "rule-rest-foot",
            "rule_type": "rest_between_class",
            "message": "Breaks 3-day rest rule for foot load — 1 day since last session",
            "severity": "danger",
        }

        for log in logs:
            if not log.rule_violations_at_log:
                continue
            for violation in log.rule_violations_at_log:
                assert "rule_id" in violation
                assert "rule_type" in violation
                assert "ruleId" not in violation
                assert "ruleType" not in violation


def test_seed_links_flare_up_incidents_to_check_ins_and_keeps_today_missing(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "seed-checkins.db"
    database_url = f"sqlite:///{database_path}"
    engine = _make_migrated_engine(database_path)

    _run_seed(database_url)

    with Session(engine) as session:
        check_ins = session.exec(select(DailyCheckIn)).all()
        assert {check_in.check_in_date for check_in in check_ins} == {
            date(2026, 4, 24),
            date(2026, 4, 28),
            date(2026, 5, 5),
            date(2026, 5, 16),
            date(2026, 5, 22),
            date(2026, 5, 24),
        }
        assert session.exec(
            select(DailyCheckIn).where(DailyCheckIn.check_in_date == PROTOTYPE_TODAY)
        ).first() is None

        incidents = session.exec(select(FlareUpIncident)).all()
        assert {
            incident.id: (
                incident.incident_date,
                incident.body_part,
                incident.severity,
                incident.activity_class_id,
                incident.daily_check_in_id,
            )
            for incident in incidents
        } == {
            "inc-1": (date(2026, 4, 24), "Left heel", 6, "cls-foot", "ci-1"),
            "inc-2": (date(2026, 5, 16), "Left heel", 8, "cls-foot", "ci-4"),
        }

    assert _row_by_id(engine, "daily_check_ins", "ci-1")["has_flare_up"] == 1
    assert _row_by_id(engine, "daily_check_ins", "ci-4")["has_flare_up"] == 1
