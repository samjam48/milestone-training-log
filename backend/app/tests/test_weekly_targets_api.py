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
from app.models.block import TrainingBlock, WeeklyTarget


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


def _seed_weekly_target(
    app_with_test_database: FastAPI,
    *,
    target_id: str,
    training_block_id: str,
    activity_class_id: str,
    target_value: float,
    target_unit: str,
    created_at: datetime | None = None,
) -> None:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    now = created_at or _utc_datetime(9)
    try:
        session.add(
            WeeklyTarget(
                id=target_id,
                training_block_id=training_block_id,
                activity_class_id=activity_class_id,
                target_value=target_value,
                target_unit=target_unit,
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


def _assert_weekly_target_payload(
    payload: dict[str, Any],
    *,
    target_id: str,
    training_block_id: str,
    activity_class_id: str,
    target_value: float,
    target_unit: str,
) -> None:
    assert payload["id"] == target_id
    assert payload["training_block_id"] == training_block_id
    assert payload["activity_class_id"] == activity_class_id
    assert payload["target_value"] == target_value
    assert payload["target_unit"] == target_unit
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])


def _seed_weekly_target_graph(app_with_test_database: FastAPI) -> None:
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


async def test_list_weekly_targets_returns_empty_list(
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

    response = await client.get("/api/training-blocks/blk-1/weekly-targets")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_weekly_targets_returns_targets_ordered_by_class_then_id(
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
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-b",
        name="Class B",
    )
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-a",
        name="Class A",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-z",
        training_block_id="blk-1",
        activity_class_id="cls-b",
        target_value=5.0,
        target_unit="km",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-a",
        training_block_id="blk-1",
        activity_class_id="cls-a",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.get("/api/training-blocks/blk-1/weekly-targets")

    assert response.status_code == 200
    assert [target["id"] for target in response.json()] == [
        "wt-a",
        "wt-z",
    ]


async def test_list_weekly_targets_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/training-blocks/missing-block/weekly-targets")

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


@pytest.mark.parametrize("parent_status", ["completed", "archived"])
async def test_list_weekly_targets_remains_readable_when_parent_block_is_not_active(
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
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-foot-load",
        name="Foot Load",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.get("/api/training-blocks/blk-1/weekly-targets")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "wt-1"


async def test_create_weekly_target_returns_created_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-foot",
            "activity_class_id": "cls-foot-load",
            "target_value": 10.0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 201
    _assert_weekly_target_payload(
        response.json(),
        target_id="wt-foot",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=10.0,
        target_unit="km",
    )


async def test_create_weekly_target_rejects_training_block_id_and_timestamps_in_body(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-invalid",
            "training_block_id": "other-block",
            "activity_class_id": "cls-foot-load",
            "target_value": 10.0,
            "target_unit": "km",
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
        },
    )

    assert response.status_code == 422


async def test_create_weekly_target_returns_not_found_for_missing_parent_block(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/training-blocks/missing-block/weekly-targets",
        json={
            "id": "wt-orphan",
            "activity_class_id": "cls-foot-load",
            "target_value": 10.0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Training block not found"}


async def test_create_weekly_target_validates_activity_class_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    valid_response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-valid-class",
            "activity_class_id": "cls-foot-load",
            "target_value": 10.0,
            "target_unit": "km",
        },
    )
    assert valid_response.status_code == 201
    assert valid_response.json()["activity_class_id"] == "cls-foot-load"

    invalid_response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-missing-class",
            "activity_class_id": "missing-class",
            "target_value": 10.0,
            "target_unit": "km",
        },
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_create_weekly_target_returns_conflict_for_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-1",
            "activity_class_id": "cls-foot-load",
            "target_value": 12.0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Weekly target already exists"}


async def test_create_weekly_target_returns_conflict_for_duplicate_block_class_pair(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-existing",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-new",
            "activity_class_id": "cls-foot-load",
            "target_value": 12.0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Weekly target for this activity class already exists",
    }


async def test_create_weekly_target_accepts_zero_target_value(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-zero",
            "activity_class_id": "cls-foot-load",
            "target_value": 0,
            "target_unit": "km",
        },
    )

    assert response.status_code == 201
    assert response.json()["target_value"] == 0


async def test_create_weekly_target_accepts_recovery_activity_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-recovery",
            "activity_class_id": "cls-recovery",
            "target_value": 4.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 201
    assert response.json()["activity_class_id"] == "cls-recovery"


@pytest.mark.parametrize(
    "missing_field",
    ["activity_class_id", "target_value", "target_unit"],
)
async def test_create_weekly_target_rejects_missing_required_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    missing_field: str,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    payload: dict[str, object] = {
        "id": "wt-incomplete",
        "activity_class_id": "cls-foot-load",
        "target_value": 10.0,
        "target_unit": "km",
    }
    del payload[missing_field]

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json=payload,
    )

    assert response.status_code == 422


async def test_create_weekly_target_rejects_non_numeric_target_value(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)

    response = await client.post(
        "/api/training-blocks/blk-1/weekly-targets",
        json={
            "id": "wt-bad-value",
            "activity_class_id": "cls-foot-load",
            "target_value": "ten",
            "target_unit": "km",
        },
    )

    assert response.status_code == 422


async def test_patch_weekly_target_updates_only_present_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={
            "target_value": 12.0,
            "target_unit": "sessions",
        },
    )

    assert response.status_code == 200
    _assert_weekly_target_payload(
        response.json(),
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=12.0,
        target_unit="sessions",
    )


async def test_patch_weekly_target_allows_empty_body_without_changing_row(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.patch("/api/weekly-targets/wt-1", json={})

    assert response.status_code == 200
    _assert_weekly_target_payload(
        response.json(),
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )


async def test_patch_weekly_target_allows_activity_class_id_change_when_pair_unique(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-other",
        name="Other Class",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"activity_class_id": "cls-other"},
    )

    assert response.status_code == 200
    assert response.json()["activity_class_id"] == "cls-other"


async def test_patch_weekly_target_returns_conflict_when_class_pair_is_not_unique(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-other",
        name="Other Class",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-2",
        training_block_id="blk-1",
        activity_class_id="cls-other",
        target_value=4.0,
        target_unit="sessions",
    )

    response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"activity_class_id": "cls-other"},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Weekly target for this activity class already exists",
    }


async def test_patch_weekly_target_validates_activity_class_id_when_changed(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_activity_class(
        app_with_test_database,
        class_id="cls-recovery",
        name="Recovery",
        class_type="recovery",
        default_recovery_window_days=1,
    )
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    valid_response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"activity_class_id": "cls-recovery"},
    )
    assert valid_response.status_code == 200
    assert valid_response.json()["activity_class_id"] == "cls-recovery"

    invalid_response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"activity_class_id": "missing-class"},
    )
    assert invalid_response.status_code == 404
    assert invalid_response.json() == {"detail": "Activity class not found"}


async def test_patch_weekly_target_updates_target_value_and_unit_independently(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    value_response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"target_value": 0},
    )
    assert value_response.status_code == 200
    assert value_response.json()["target_value"] == 0
    assert value_response.json()["target_unit"] == "km"

    unit_response = await client.patch(
        "/api/weekly-targets/wt-1",
        json={"target_unit": "sessions"},
    )
    assert unit_response.status_code == 200
    assert unit_response.json()["target_value"] == 0
    assert unit_response.json()["target_unit"] == "sessions"


async def test_patch_missing_weekly_target_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/weekly-targets/missing-target",
        json={"target_value": 5.0},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Weekly target not found"}


async def test_delete_weekly_target_route_is_not_available(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_weekly_target_graph(app_with_test_database)
    _seed_weekly_target(
        app_with_test_database,
        target_id="wt-1",
        training_block_id="blk-1",
        activity_class_id="cls-foot-load",
        target_value=8.0,
        target_unit="km",
    )

    response = await client.delete("/api/weekly-targets/wt-1")

    assert response.status_code == 405
