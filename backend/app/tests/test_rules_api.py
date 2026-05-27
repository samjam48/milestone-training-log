from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401
from app.database import get_session
from app.main import create_app
from app.models.activity import ActivityClass
from app.models.block import Rule, TrainingBlock


@pytest.fixture
def app_with_test_database() -> Iterator[FastAPI]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    app = create_app()

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app_with_test_database: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app_with_test_database)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def _utc_datetime(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 5, 27, hour, minute, tzinfo=UTC)


def _seed_training_block(
    app_with_test_database: FastAPI,
    *,
    block_id: str,
    name: str,
    start_date: date,
    status: str = "active",
    end_date: date | None = None,
    notes: str | None = None,
    created_at: datetime | None = None,
) -> None:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    now = created_at or _utc_datetime(8)
    try:
        session.add(
            TrainingBlock(
                id=block_id,
                user_id="local",
                name=name,
                start_date=start_date,
                end_date=end_date,
                status=status,
                related_goal_id=None,
                notes=notes,
                is_review_milestone_hit=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    finally:
        session.close()
        try:
            next(session_iterator)
        except StopIteration:
            pass


def _seed_activity_class(
    app_with_test_database: FastAPI,
    *,
    class_id: str,
    name: str,
    description: str = "Seeded class",
    class_type: str = "performance",
    default_recovery_window_days: int = 3,
    created_at: datetime | None = None,
) -> None:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    try:
        session.add(
            ActivityClass(
                id=class_id,
                user_id="local",
                name=name,
                description=description,
                type=class_type,
                default_recovery_window_days=default_recovery_window_days,
                created_at=created_at or _utc_datetime(8),
            )
        )
        session.commit()
    finally:
        session.close()
        try:
            next(session_iterator)
        except StopIteration:
            pass


def _seed_rule(
    app_with_test_database: FastAPI,
    *,
    rule_id: str,
    training_block_id: str,
    rule_type: str,
    threshold_value: float,
    window_days: int,
    activity_class_id: str | None = None,
    enabled: bool = True,
    created_at: datetime | None = None,
) -> None:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    now = created_at or _utc_datetime(9)
    try:
        session.add(
            Rule(
                id=rule_id,
                training_block_id=training_block_id,
                activity_class_id=activity_class_id,
                rule_type=rule_type,
                threshold_value=threshold_value,
                window_days=window_days,
                enabled=enabled,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    finally:
        session.close()
        try:
            next(session_iterator)
        except StopIteration:
            pass


def _assert_rule_payload(
    payload: dict[str, Any],
    *,
    rule_id: str,
    training_block_id: str,
    rule_type: str,
    threshold_value: float,
    window_days: int,
    activity_class_id: str | None = None,
    enabled: bool = True,
) -> None:
    assert payload["id"] == rule_id
    assert payload["training_block_id"] == training_block_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["rule_type"] == rule_type
    assert payload["threshold_value"] == threshold_value
    assert payload["window_days"] == window_days
    assert payload["enabled"] is enabled
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])


def _seed_rule_graph(app_with_test_database: FastAPI) -> None:
    _seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Rehab Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )


async def test_list_rules_returns_empty_list(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Empty Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_rules_returns_rules_ordered_by_rule_type_then_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Ordered Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )
    _seed_rule(
        app_with_test_database,
        rule_id="rule-z",
        training_block_id="blk-1",
        rule_type="weekly_load_cap",
        threshold_value=100.0,
        window_days=7,
    )
    _seed_rule(
        app_with_test_database,
        rule_id="rule-a",
        training_block_id="blk-1",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )
    _seed_rule(
        app_with_test_database,
        rule_id="rule-b",
        training_block_id="blk-1",
        rule_type="frequency_limit",
        threshold_value=2.0,
        window_days=7,
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert [rule["id"] for rule in response.json()] == [
        "rule-a",
        "rule-b",
        "rule-z",
    ]


async def test_list_rules_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/rules")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize("parent_status", ["completed", "archived"])
async def test_list_rules_remains_readable_when_parent_block_is_not_active(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    parent_status: str,
) -> None:
    _seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Inactive Parent",
        start_date=date(2026, 4, 7),
        status=parent_status,
    )
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
    )

    response = await client.get("/api/training-blocks/blk-1/rules")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "rule-1"


async def test_create_class_scoped_rule_returns_created_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-rest",
            "activity_class_id": "cls-foot-load",
            "rule_type": "rest_between_class",
            "threshold_value": 2.0,
            "window_days": 7,
            "enabled": False,
        },
    )

    assert response.status_code == 201
    _assert_rule_payload(
        response.json(),
        rule_id="rule-rest",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="rest_between_class",
        threshold_value=2.0,
        window_days=7,
        enabled=False,
    )


async def test_create_cross_class_rule_allows_null_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_training_block(
        app_with_test_database,
        block_id="blk-1",
        name="Cross-Class Block",
        start_date=date(2026, 4, 7),
        status="archived",
    )

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-cross",
            "activity_class_id": None,
            "rule_type": "weekly_activity_count",
            "threshold_value": 4.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 201
    _assert_rule_payload(
        response.json(),
        rule_id="rule-cross",
        training_block_id="blk-1",
        activity_class_id=None,
        rule_type="weekly_activity_count",
        threshold_value=4.0,
        window_days=7,
    )


async def test_create_rule_defaults_enabled_to_true(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-enabled-default",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 201
    assert response.json()["enabled"] is True


async def test_create_rule_rejects_training_block_id_and_timestamps_in_body(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-invalid",
            "training_block_id": "other-block",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
        },
    )

    assert response.status_code == 422


async def test_create_rule_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks/missing-block/rules",
        json={
            "id": "rule-orphan",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_create_rule_validates_activity_class_id_when_supplied(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)

    valid_response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-valid-class",
            "activity_class_id": "cls-foot-load",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["activity_class_id"] == "cls-foot-load"

    invalid_response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-missing-class",
            "activity_class_id": "missing-class",
            "rule_type": "frequency_limit",
            "threshold_value": 3.0,
            "window_days": 7,
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_create_rule_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": "rule-1",
            "activity_class_id": "cls-foot-load",
            "rule_type": "weekly_load_cap",
            "threshold_value": 100.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Rule already exists"}


@pytest.mark.parametrize(
    "missing_field",
    ["threshold_value", "window_days"],
)
async def test_create_rule_rejects_missing_required_numeric_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    missing_field: str,
) -> None:
    _seed_rule_graph(app_with_test_database)

    payload: dict[str, object] = {
        "id": "rule-incomplete",
        "activity_class_id": "cls-foot-load",
        "rule_type": "frequency_limit",
        "threshold_value": 3.0,
        "window_days": 7,
    }
    del payload[missing_field]

    response = await client.post("/api/training-blocks/blk-1/rules", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "rule_type",
    [
        "rest_between_class",
        "frequency_limit",
        "weekly_load_cap",
        "consecutive_day_limit",
        "weekly_activity_count",
    ],
)
async def test_create_rule_accepts_known_rule_type_strings(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    rule_type: str,
) -> None:
    _seed_rule_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/rules",
        json={
            "id": f"rule-{rule_type}",
            "activity_class_id": "cls-foot-load" if rule_type != "weekly_activity_count" else None,
            "rule_type": rule_type,
            "threshold_value": 1.0,
            "window_days": 7,
        },
    )

    assert response.status_code == 201
    assert response.json()["rule_type"] == rule_type


async def test_patch_rule_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
        enabled=True,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={
            "threshold_value": 4.0,
            "enabled": False,
        },
    )

    assert response.status_code == 200
    _assert_rule_payload(
        response.json(),
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=4.0,
        window_days=7,
        enabled=False,
    )


async def test_patch_rule_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch("/api/rules/rule-1", json={})

    assert response.status_code == 200
    _assert_rule_payload(
        response.json(),
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )


async def test_patch_rule_allows_activity_class_id_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": None},
    )

    assert response.status_code == 200
    assert response.json()["activity_class_id"] is None


async def test_patch_rule_updates_threshold_value_and_window_days_independently(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    threshold_response = await client.patch(
        "/api/rules/rule-1",
        json={"threshold_value": 5.0},
    )
    assert threshold_response.status_code == 200
    assert threshold_response.json()["threshold_value"] == 5.0
    assert threshold_response.json()["window_days"] == 7

    window_response = await client.patch(
        "/api/rules/rule-1",
        json={"window_days": 14},
    )
    assert window_response.status_code == 200
    assert window_response.json()["threshold_value"] == 5.0
    assert window_response.json()["window_days"] == 14


async def test_patch_rule_validates_activity_class_id_when_changed(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    valid_response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": "cls-recovery"},
    )
    assert valid_response.status_code == 200
    assert valid_response.json()["activity_class_id"] == "cls-recovery"

    invalid_response = await client.patch(
        "/api/rules/rule-1",
        json={"activity_class_id": "missing-class"},
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_patch_missing_rule_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/rules/missing-rule",
        json={"enabled": False},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Rule not found"}


async def test_delete_rule_returns_no_content_and_removes_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_rule_graph(app_with_test_database)
    _seed_rule(
        app_with_test_database,
        rule_id="rule-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        rule_type="frequency_limit",
        threshold_value=3.0,
        window_days=7,
    )

    response = await client.delete("/api/rules/rule-1")

    assert response.status_code == 204
    assert response.content == b""

    list_response = await client.get("/api/training-blocks/blk-1/rules")
    assert list_response.status_code == 200
    assert list_response.json() == []


async def test_delete_missing_rule_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.delete("/api/rules/missing-rule")

    assert response.status_code == 404
    assert response.json() == {"detail": "Rule not found"}
