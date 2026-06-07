from __future__ import annotations

from datetime import UTC, date, datetime
from importlib import import_module, util
from typing import TYPE_CHECKING, cast

import pytest
from sqlalchemy import JSON, Boolean, Float, Integer, String, UniqueConstraint
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.inspection import inspect as sqlalchemy_inspect
from sqlalchemy.orm import Mapper, RelationshipProperty
from sqlalchemy.sql.schema import Column, Table
from sqlmodel import Session, SQLModel, create_engine

if TYPE_CHECKING:
    from app.models.block import Rule
    from app.models.checkin import FlareUpIncident
    from app.models.goal import Goal
    from app.models.log import ActivityLog

EXPECTED_MODEL_MODULES = {
    "app.models.activity": ("ActivityClass", "Activity"),
    "app.models.log": ("ActivityLog",),
    "app.models.checkin": ("DailyCheckIn", "FlareUpIncident"),
    "app.models.block": ("TrainingBlock", "Rule", "WeeklyTarget", "RecoveryTarget"),
    "app.models.goal": ("Goal",),
}

EXPECTED_TABLES = {
    "activity_classes",
    "activities",
    "activity_logs",
    "daily_check_ins",
    "flare_up_incidents",
    "training_blocks",
    "rules",
    "weekly_targets",
    "recovery_targets",
    "goals",
}

TOP_LEVEL_USER_TABLES = {
    "activity_classes",
    "activities",
    "activity_logs",
    "daily_check_ins",
    "flare_up_incidents",
    "training_blocks",
    "goals",
}

BLOCK_CHILD_TABLES = {"rules", "weekly_targets", "recovery_targets"}


def _load_model_classes() -> dict[str, type[SQLModel]]:
    exported_classes: dict[str, type[SQLModel]] = {}

    for module_name, class_names in EXPECTED_MODEL_MODULES.items():
        assert util.find_spec(module_name) is not None, (
            f"Missing required model module {module_name}"
        )
        module = import_module(module_name)

        for class_name in class_names:
            assert hasattr(module, class_name), f"{module_name} must define {class_name}"
            model_class = getattr(module, class_name)
            assert isinstance(model_class, type)
            assert issubclass(model_class, SQLModel)
            exported_classes[class_name] = model_class

    models_module = import_module("app.models")
    for class_name in exported_classes:
        assert hasattr(models_module, class_name), f"app.models must re-export {class_name}"

    return exported_classes


def _get_column(table: Table, column_name: str) -> Column[object]:
    column = table.columns.get(column_name)
    assert column is not None, f"{table.name}.{column_name} is missing"
    return column


def _assert_columns(table_name: str, expected_columns: set[str]) -> None:
    table = SQLModel.metadata.tables[table_name]
    assert set(table.columns.keys()) == expected_columns


def _assert_string_primary_key(table_name: str) -> None:
    id_column = _get_column(SQLModel.metadata.tables[table_name], "id")
    assert id_column.primary_key
    assert isinstance(id_column.type, String)
    assert not id_column.autoincrement


def _assert_foreign_key(
    table_name: str,
    column_name: str,
    expected_target: str,
    *,
    nullable: bool = False,
) -> None:
    column = _get_column(SQLModel.metadata.tables[table_name], column_name)
    assert isinstance(column.type, String)
    assert column.nullable is nullable
    assert {foreign_key.target_fullname for foreign_key in column.foreign_keys} == {expected_target}


def _normalized_server_default(column: Column[object]) -> str | None:
    server_default_arg = getattr(column.server_default, "arg", None)
    if server_default_arg is None:
        return None

    return str(server_default_arg).strip().strip("()").strip().strip("'\"").lower()


def _normalized_sqlite_default(default_value: object) -> str | None:
    if default_value is None:
        return None

    return str(default_value).strip().strip("()").strip().strip("'\"").lower()


def _sqlite_column_defaults(engine: Engine, table_name: str) -> dict[str, str | None]:
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(f"PRAGMA table_info({table_name})").mappings().all()

    return {
        cast(str, row["name"]): _normalized_sqlite_default(row["dflt_value"])
        for row in rows
    }


def _unique_column_sets(table_name: str) -> set[frozenset[str]]:
    table = SQLModel.metadata.tables[table_name]
    unique_sets = {
        frozenset(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    for index in table.indexes:
        if index.unique:
            unique_sets.add(frozenset(column.name for column in index.columns))
    return unique_sets


def _relationship_target_tables(model_class: type[SQLModel]) -> set[str]:
    mapper = cast(Mapper[SQLModel], sqlalchemy_inspect(model_class))
    return {
        cast(Table, relationship.mapper.local_table).name
        for relationship in mapper.relationships
        if isinstance(relationship, RelationshipProperty)
    }


def _utc_now() -> datetime:
    return datetime(2026, 5, 27, 9, 0, tzinfo=UTC)


def _make_engine() -> Engine:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return engine


def test_required_model_modules_define_table_classes_and_central_exports() -> None:
    model_classes = _load_model_classes()

    expected_table_names = {
        "ActivityClass": "activity_classes",
        "Activity": "activities",
        "ActivityLog": "activity_logs",
        "DailyCheckIn": "daily_check_ins",
        "FlareUpIncident": "flare_up_incidents",
        "TrainingBlock": "training_blocks",
        "Rule": "rules",
        "WeeklyTarget": "weekly_targets",
        "RecoveryTarget": "recovery_targets",
        "Goal": "goals",
    }

    assert set(model_classes) == set(expected_table_names)
    for class_name, table_name in expected_table_names.items():
        model_class = model_classes[class_name]
        assert getattr(model_class, "__tablename__") == table_name
        assert hasattr(model_class, "__table__"), f"{class_name} must use SQLModel table=True"


def test_phase_one_metadata_contains_exact_tables_and_columns() -> None:
    _load_model_classes()

    assert set(SQLModel.metadata.tables) == EXPECTED_TABLES

    _assert_columns(
        "activity_classes",
        {
            "id",
            "user_id",
            "name",
            "description",
            "type",
            "default_recovery_window_days",
            "created_at",
        },
    )
    _assert_columns(
        "activities",
        {
            "id",
            "user_id",
            "activity_class_id",
            "name",
            "type",
            "default_volume_unit",
            "is_active",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "activity_logs",
        {
            "id",
            "user_id",
            "activity_id",
            "logged_date",
            "duration_minutes",
            "volume_value",
            "volume_unit",
            "rpe",
            "post_activity_feel",
            "notes",
            "rule_violations_at_log",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "daily_check_ins",
        {
            "id",
            "user_id",
            "check_in_date",
            "pain_level",
            "readiness_level",
            "stiffness_level",
            "has_flare_up",
            "notes",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "flare_up_incidents",
        {
            "id",
            "user_id",
            "incident_date",
            "body_part",
            "severity",
            "activity_class_id",
            "daily_check_in_id",
            "notes",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "training_blocks",
        {
            "id",
            "user_id",
            "name",
            "start_date",
            "end_date",
            "status",
            "related_goal_id",
            "notes",
            "is_review_milestone_hit",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "rules",
        {
            "id",
            "training_block_id",
            "activity_class_id",
            "activity_id",
            "rule_type",
            "threshold_value",
            "window_days",
            "limit_unit",
            "enabled",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "weekly_targets",
        {
            "id",
            "training_block_id",
            "activity_class_id",
            "activity_id",
            "target_value",
            "target_unit",
            "target_kind",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "recovery_targets",
        {
            "id",
            "training_block_id",
            "activity_id",
            "target_frequency",
            "frequency_unit",
            "current_streak_days",
            "created_at",
            "updated_at",
        },
    )
    _assert_columns(
        "goals",
        {
            "id",
            "user_id",
            "title",
            "description",
            "target_date",
            "timeframe",
            "activity_class_id",
            "activity_id",
            "auto_track_progress",
            "progress_value",
            "progress_target",
            "progress_unit",
            "status",
            "created_at",
            "updated_at",
        },
    )


def test_id_user_ownership_and_foreign_key_columns_match_phase_one_contract() -> None:
    _load_model_classes()

    for table_name in EXPECTED_TABLES:
        _assert_string_primary_key(table_name)

    for table_name in TOP_LEVEL_USER_TABLES:
        user_id_column = _get_column(SQLModel.metadata.tables[table_name], "user_id")
        assert isinstance(user_id_column.type, String)
        assert not user_id_column.nullable
        assert _normalized_server_default(user_id_column) == "local"

    for table_name in BLOCK_CHILD_TABLES:
        assert "user_id" not in SQLModel.metadata.tables[table_name].columns

    _assert_foreign_key("activities", "activity_class_id", "activity_classes.id")
    _assert_foreign_key("activity_logs", "activity_id", "activities.id")
    _assert_foreign_key(
        "flare_up_incidents",
        "activity_class_id",
        "activity_classes.id",
        nullable=True,
    )
    _assert_foreign_key(
        "flare_up_incidents",
        "daily_check_in_id",
        "daily_check_ins.id",
        nullable=True,
    )
    _assert_foreign_key("training_blocks", "related_goal_id", "goals.id", nullable=True)
    _assert_foreign_key("rules", "training_block_id", "training_blocks.id")
    _assert_foreign_key("rules", "activity_class_id", "activity_classes.id", nullable=True)
    _assert_foreign_key("rules", "activity_id", "activities.id", nullable=True)
    _assert_foreign_key("goals", "activity_id", "activities.id", nullable=True)
    _assert_foreign_key("weekly_targets", "training_block_id", "training_blocks.id")
    _assert_foreign_key("weekly_targets", "activity_class_id", "activity_classes.id")
    _assert_foreign_key("weekly_targets", "activity_id", "activities.id", nullable=True)
    _assert_foreign_key("recovery_targets", "training_block_id", "training_blocks.id")
    _assert_foreign_key("recovery_targets", "activity_id", "activities.id")


def test_column_nullability_defaults_json_and_uniqueness_constraints_are_declared() -> None:
    _load_model_classes()

    activity_classes = SQLModel.metadata.tables["activity_classes"]
    recovery_window_column = _get_column(activity_classes, "default_recovery_window_days")
    assert not recovery_window_column.nullable
    assert _normalized_server_default(recovery_window_column) == "3"

    activities = SQLModel.metadata.tables["activities"]
    assert not _get_column(activities, "default_volume_unit").nullable

    activity_logs = SQLModel.metadata.tables["activity_logs"]
    assert not _get_column(activity_logs, "duration_minutes").nullable
    assert not _get_column(activity_logs, "volume_value").nullable
    assert isinstance(_get_column(activity_logs, "duration_minutes").type, Integer | Float)
    assert isinstance(_get_column(activity_logs, "volume_value").type, Integer | Float)
    assert _get_column(activity_logs, "rpe").nullable
    assert _get_column(activity_logs, "rule_violations_at_log").nullable
    assert isinstance(_get_column(activity_logs, "rule_violations_at_log").type, JSON)

    daily_check_ins = SQLModel.metadata.tables["daily_check_ins"]
    assert not _get_column(daily_check_ins, "pain_level").nullable
    assert not _get_column(daily_check_ins, "readiness_level").nullable
    assert not _get_column(daily_check_ins, "stiffness_level").nullable
    assert frozenset({"user_id", "check_in_date"}) in _unique_column_sets("daily_check_ins")

    training_blocks = SQLModel.metadata.tables["training_blocks"]
    assert _get_column(training_blocks, "end_date").nullable
    review_column = _get_column(training_blocks, "is_review_milestone_hit")
    assert isinstance(review_column.type, Boolean)
    assert _normalized_server_default(review_column) in {"0", "false"}

    goals = SQLModel.metadata.tables["goals"]
    assert _get_column(goals, "activity_id").nullable
    auto_track_column = _get_column(goals, "auto_track_progress")
    assert isinstance(auto_track_column.type, Boolean)
    assert not auto_track_column.nullable
    assert _normalized_server_default(auto_track_column) in {"0", "false"}

    rules = SQLModel.metadata.tables["rules"]
    assert _get_column(rules, "activity_id").nullable
    assert _get_column(rules, "limit_unit").nullable
    assert isinstance(_get_column(rules, "limit_unit").type, String)

    weekly_targets = SQLModel.metadata.tables["weekly_targets"]
    assert _get_column(weekly_targets, "activity_id").nullable
    target_kind_column = _get_column(weekly_targets, "target_kind")
    assert not target_kind_column.nullable
    assert _normalized_server_default(target_kind_column) == "minimum"

    weekly_target_unique_sets = _unique_column_sets("weekly_targets")
    assert frozenset({"training_block_id", "activity_class_id"}) in weekly_target_unique_sets
    assert frozenset({"training_block_id", "activity_id"}) in weekly_target_unique_sets
    assert frozenset({"training_block_id", "activity_id"}) in _unique_column_sets(
        "recovery_targets"
    )


def test_sqlite_schema_declares_required_database_defaults() -> None:
    _load_model_classes()
    engine = _make_engine()

    for table_name in TOP_LEVEL_USER_TABLES:
        sqlite_defaults = _sqlite_column_defaults(engine, table_name)
        assert sqlite_defaults["user_id"] == "local"

    activity_class_defaults = _sqlite_column_defaults(engine, "activity_classes")
    assert activity_class_defaults["default_recovery_window_days"] == "3"

    training_block_defaults = _sqlite_column_defaults(engine, "training_blocks")
    assert training_block_defaults["is_review_milestone_hit"] in {"0", "false"}

    goal_defaults = _sqlite_column_defaults(engine, "goals")
    assert goal_defaults["auto_track_progress"] in {"0", "false"}


def test_relationship_mappings_cover_required_ownership_paths() -> None:
    model_classes = _load_model_classes()

    assert "activities" in _relationship_target_tables(model_classes["ActivityClass"])
    assert "activity_classes" in _relationship_target_tables(model_classes["Activity"])
    assert "activity_logs" in _relationship_target_tables(model_classes["Activity"])
    assert "activities" in _relationship_target_tables(model_classes["ActivityLog"])
    assert "flare_up_incidents" in _relationship_target_tables(model_classes["DailyCheckIn"])
    assert "daily_check_ins" in _relationship_target_tables(model_classes["FlareUpIncident"])
    assert "training_blocks" in _relationship_target_tables(model_classes["Goal"])
    assert "goals" in _relationship_target_tables(model_classes["TrainingBlock"])
    assert "rules" in _relationship_target_tables(model_classes["TrainingBlock"])
    assert "weekly_targets" in _relationship_target_tables(model_classes["TrainingBlock"])
    assert "recovery_targets" in _relationship_target_tables(model_classes["TrainingBlock"])
    assert "activities" in _relationship_target_tables(model_classes["Goal"])
    assert "activities" in _relationship_target_tables(model_classes["Rule"])


def test_goal_and_rule_models_expose_stage_2_5_field_names() -> None:
    model_classes = _load_model_classes()

    goal_fields = set(model_classes["Goal"].model_fields)
    assert {"activity_id", "auto_track_progress"}.issubset(goal_fields)

    rule_fields = set(model_classes["Rule"].model_fields)
    assert {"activity_id", "limit_unit"}.issubset(rule_fields)


def test_legacy_goal_and_rule_rows_default_stage_2_5_columns() -> None:
    """Existing rows without S25.B1 fields set keep null activity links and auto-track off."""
    model_classes = _load_model_classes()
    engine = _make_engine()
    now = _utc_now()

    activity_class = model_classes["ActivityClass"](
        id="class-legacy",
        name="Walking",
        description="Legacy class-scoped goal and rule",
        type="performance",
        created_at=now,
    )
    activity = model_classes["Activity"](
        id="activity-legacy",
        activity_class_id="class-legacy",
        name="Outdoor walk",
        type="performance",
        default_volume_unit="km",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    goal = model_classes["Goal"](
        id="goal-legacy",
        title="Class-only goal",
        description="Pre-S25.B1 row",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="class-legacy",
        progress_value=None,
        progress_target=None,
        progress_unit=None,
        status="active",
        created_at=now,
        updated_at=now,
    )
    training_block = model_classes["TrainingBlock"](
        id="block-legacy",
        name="Legacy block",
        start_date=date(2026, 5, 27),
        end_date=None,
        status="active",
        related_goal_id=None,
        notes=None,
        created_at=now,
        updated_at=now,
    )
    rule = model_classes["Rule"](
        id="rule-legacy",
        training_block_id="block-legacy",
        activity_class_id="class-legacy",
        rule_type="weekly_load_cap",
        threshold_value=50,
        window_days=7,
        enabled=True,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(activity_class)
        session.add(activity)
        session.add(goal)
        session.add(training_block)
        session.add(rule)
        session.commit()

        persisted_goal = cast(
            "Goal | None",
            session.get(model_classes["Goal"], "goal-legacy"),
        )
        persisted_rule = cast(
            "Rule | None",
            session.get(model_classes["Rule"], "rule-legacy"),
        )

    assert persisted_goal is not None
    assert persisted_goal.activity_id is None
    assert persisted_goal.auto_track_progress is False

    assert persisted_rule is not None
    assert persisted_rule.activity_id is None
    assert persisted_rule.limit_unit is None


def test_sqlite_persistence_roundtrips_relationship_foreign_keys_and_json_snapshots() -> None:
    model_classes = _load_model_classes()
    engine = _make_engine()
    now = _utc_now()

    activity_class = model_classes["ActivityClass"](
        id="class-walk",
        name="Walking",
        description="Foot-loading rehab work",
        type="performance",
        created_at=now,
    )
    activity = model_classes["Activity"](
        id="activity-walk",
        activity_class_id="class-walk",
        name="Outdoor walk",
        type="performance",
        default_volume_unit="km",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    activity_log = model_classes["ActivityLog"](
        id="log-walk-1",
        activity_id="activity-walk",
        logged_date=date(2026, 5, 27),
        duration_minutes=35,
        volume_value=3.2,
        volume_unit="km",
        rpe=4,
        post_activity_feel="fine",
        notes="Easy pace",
        rule_violations_at_log=[{"ruleType": "weekly_load_cap", "severity": "caution"}],
        created_at=now,
        updated_at=now,
    )
    daily_check_in = model_classes["DailyCheckIn"](
        id="checkin-1",
        check_in_date=date(2026, 5, 28),
        pain_level=2,
        readiness_level=7,
        stiffness_level=3,
        has_flare_up=True,
        notes="Slight morning tightness",
        created_at=now,
        updated_at=now,
    )
    flare_up = model_classes["FlareUpIncident"](
        id="flare-1",
        incident_date=date(2026, 5, 28),
        body_part="left foot",
        severity=4,
        activity_class_id="class-walk",
        daily_check_in_id="checkin-1",
        notes="Likely from longer walk",
        created_at=now,
        updated_at=now,
    )
    goal = model_classes["Goal"](
        id="goal-1",
        title="Walk comfortably",
        description="Build up walking tolerance",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="class-walk",
        progress_value=3.2,
        progress_target=10.0,
        progress_unit="km",
        status="active",
        created_at=now,
        updated_at=now,
    )
    training_block = model_classes["TrainingBlock"](
        id="block-1",
        name="Return to walking",
        start_date=date(2026, 5, 27),
        end_date=date(2026, 6, 10),
        status="active",
        related_goal_id="goal-1",
        notes="Keep the ramp boring",
        created_at=now,
        updated_at=now,
    )
    rule = model_classes["Rule"](
        id="rule-1",
        training_block_id="block-1",
        activity_class_id="class-walk",
        rule_type="weekly_load_cap",
        threshold_value=50,
        window_days=7,
        enabled=True,
        created_at=now,
        updated_at=now,
    )
    weekly_target = model_classes["WeeklyTarget"](
        id="weekly-target-1",
        training_block_id="block-1",
        activity_class_id="class-walk",
        target_value=10,
        target_unit="km",
        created_at=now,
        updated_at=now,
    )
    recovery_target = model_classes["RecoveryTarget"](
        id="recovery-target-1",
        training_block_id="block-1",
        activity_id="activity-walk",
        target_frequency=3,
        frequency_unit="weekly",
        current_streak_days=1,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(activity_class)
        session.add(activity)
        session.add(activity_log)
        session.add(daily_check_in)
        session.add(flare_up)
        session.add(goal)
        session.add(training_block)
        session.add(rule)
        session.add(weekly_target)
        session.add(recovery_target)
        session.commit()

        persisted_log = cast(
            "ActivityLog | None",
            session.get(model_classes["ActivityLog"], "log-walk-1"),
        )
        persisted_flare = cast(
            "FlareUpIncident | None",
            session.get(model_classes["FlareUpIncident"], "flare-1"),
        )
        persisted_rule = cast("Rule | None", session.get(model_classes["Rule"], "rule-1"))

    assert persisted_log is not None
    assert persisted_log.rule_violations_at_log == [
        {"ruleType": "weekly_load_cap", "severity": "caution"}
    ]
    assert persisted_flare is not None
    assert persisted_flare.activity_class_id == "class-walk"
    assert persisted_flare.daily_check_in_id == "checkin-1"
    assert persisted_rule is not None
    assert persisted_rule.activity_class_id == "class-walk"


def test_sqlite_persistence_roundtrips_stage_2_5_activity_links() -> None:
    model_classes = _load_model_classes()
    engine = _make_engine()
    now = _utc_now()

    activity_class = model_classes["ActivityClass"](
        id="class-linked",
        name="Walking",
        description="Activity-linked goal and exercise rule",
        type="performance",
        created_at=now,
    )
    activity = model_classes["Activity"](
        id="activity-linked",
        activity_class_id="class-linked",
        name="Outdoor walk",
        type="performance",
        default_volume_unit="km",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    goal = model_classes["Goal"](
        id="goal-linked",
        title="Walk 10 km",
        description="Auto-tracked walking goal",
        target_date=date(2026, 6, 30),
        timeframe="monthly",
        activity_class_id="class-linked",
        activity_id="activity-linked",
        auto_track_progress=True,
        progress_value=0.0,
        progress_target=10.0,
        progress_unit="km",
        status="active",
        created_at=now,
        updated_at=now,
    )
    training_block = model_classes["TrainingBlock"](
        id="block-linked",
        name="Linked block",
        start_date=date(2026, 5, 27),
        end_date=None,
        status="active",
        related_goal_id="goal-linked",
        notes=None,
        created_at=now,
        updated_at=now,
    )
    rule = model_classes["Rule"](
        id="rule-linked",
        training_block_id="block-linked",
        activity_class_id="class-linked",
        activity_id="activity-linked",
        rule_type="daily_volume_cap",
        threshold_value=5,
        window_days=1,
        limit_unit="km",
        enabled=True,
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(activity_class)
        session.add(activity)
        session.add(goal)
        session.add(training_block)
        session.add(rule)
        session.commit()

        persisted_goal = cast(
            "Goal | None",
            session.get(model_classes["Goal"], "goal-linked"),
        )
        persisted_rule = cast(
            "Rule | None",
            session.get(model_classes["Rule"], "rule-linked"),
        )

    assert persisted_goal is not None
    assert persisted_goal.activity_id == "activity-linked"
    assert persisted_goal.auto_track_progress is True

    assert persisted_rule is not None
    assert persisted_rule.activity_id == "activity-linked"
    assert persisted_rule.limit_unit == "km"


@pytest.mark.parametrize(
    ("model_name", "field_name", "bad_value"),
    [
        ("ActivityLog", "rpe", 11),
        ("DailyCheckIn", "pain_level", 11),
        ("DailyCheckIn", "readiness_level", -1),
        ("DailyCheckIn", "stiffness_level", 11),
        ("FlareUpIncident", "severity", 11),
    ],
)
def test_sqlite_constraints_reject_out_of_range_scores(
    model_name: str,
    field_name: str,
    bad_value: int,
) -> None:
    model_classes = _load_model_classes()
    engine = _make_engine()
    now = _utc_now()

    seed_values_by_model = {
        "ActivityLog": {
            "id": "log-bad",
            "activity_id": "activity-walk",
            "logged_date": date(2026, 5, 27),
            "duration_minutes": 35,
            "volume_value": 3.2,
            "created_at": now,
            "updated_at": now,
        },
        "DailyCheckIn": {
            "id": "checkin-bad",
            "check_in_date": date(2026, 5, 28),
            "pain_level": 2,
            "readiness_level": 7,
            "stiffness_level": 3,
            "has_flare_up": False,
            "created_at": now,
            "updated_at": now,
        },
        "FlareUpIncident": {
            "id": "flare-bad",
            "incident_date": date(2026, 5, 28),
            "body_part": "left foot",
            "severity": 4,
            "created_at": now,
            "updated_at": now,
        },
    }
    values = seed_values_by_model[model_name] | {field_name: bad_value}

    with Session(engine) as session:
        if model_name == "ActivityLog":
            session.add(
                model_classes["ActivityClass"](
                    id="class-walk",
                    name="Walking",
                    description="Foot-loading rehab work",
                    type="performance",
                    created_at=now,
                )
            )
            session.add(
                model_classes["Activity"](
                    id="activity-walk",
                    activity_class_id="class-walk",
                    name="Outdoor walk",
                    type="performance",
                    default_volume_unit="km",
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()

        session.add(model_classes[model_name](**values))
        with pytest.raises(IntegrityError):
            session.commit()
