from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import app.models  # noqa: F401
from app.database import get_session
from app.main import create_app
from app.models.activity import ActivityClass
from app.models.checkin import DailyCheckIn, FlareUpIncident


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


def _with_session(app_with_test_database: FastAPI) -> Iterator[Session]:
    override = app_with_test_database.dependency_overrides[get_session]
    session_iterator = override()
    session = next(session_iterator)
    try:
        yield session
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
    for session in _with_session(app_with_test_database):
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


def _seed_check_in(
    app_with_test_database: FastAPI,
    *,
    check_in_id: str,
    check_in_date: date,
    pain_level: int = 2,
    readiness_level: int = 7,
    stiffness_level: int = 3,
    has_flare_up: bool = False,
    notes: str | None = "Seeded check-in",
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> None:
    for session in _with_session(app_with_test_database):
        session.add(
            DailyCheckIn(
                id=check_in_id,
                user_id="local",
                check_in_date=check_in_date,
                pain_level=pain_level,
                readiness_level=readiness_level,
                stiffness_level=stiffness_level,
                has_flare_up=has_flare_up,
                notes=notes,
                created_at=created_at or _utc_datetime(9),
                updated_at=updated_at or _utc_datetime(9),
            )
        )
        session.commit()


def _seed_flare_up_incident(
    app_with_test_database: FastAPI,
    *,
    incident_id: str,
    incident_date: date,
    body_part: str = "knee",
    severity: int = 4,
    activity_class_id: str | None = None,
    daily_check_in_id: str | None = None,
    notes: str | None = "Seeded incident",
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> None:
    for session in _with_session(app_with_test_database):
        session.add(
            FlareUpIncident(
                id=incident_id,
                user_id="local",
                incident_date=incident_date,
                body_part=body_part,
                severity=severity,
                activity_class_id=activity_class_id,
                daily_check_in_id=daily_check_in_id,
                notes=notes,
                created_at=created_at or _utc_datetime(10),
                updated_at=updated_at or _utc_datetime(10),
            )
        )
        session.commit()


def _count_linked_incidents(app_with_test_database: FastAPI, check_in_id: str) -> int:
    for session in _with_session(app_with_test_database):
        statement = select(FlareUpIncident).where(
            FlareUpIncident.daily_check_in_id == check_in_id
        )
        return len(session.exec(statement).all())
    raise AssertionError("test session dependency did not yield a session")


def _get_flare_up_incident(
    app_with_test_database: FastAPI,
    incident_id: str,
) -> FlareUpIncident:
    for session in _with_session(app_with_test_database):
        incident = session.get(FlareUpIncident, incident_id)
        if incident is None:
            raise AssertionError(f"Missing seeded flare-up incident {incident_id}")
        return incident
    raise AssertionError("test session dependency did not yield a session")


def _get_check_in(app_with_test_database: FastAPI, check_in_id: str) -> DailyCheckIn:
    for session in _with_session(app_with_test_database):
        check_in = session.get(DailyCheckIn, check_in_id)
        if check_in is None:
            raise AssertionError(f"Missing seeded check-in {check_in_id}")
        return check_in
    raise AssertionError("test session dependency did not yield a session")


def _assert_check_in_payload(
    payload: dict[str, Any],
    *,
    check_in_id: str,
    check_in_date: str,
    pain_level: int,
    readiness_level: int,
    stiffness_level: int,
    has_flare_up: bool,
    notes: str | None,
    flare_up: dict[str, Any] | None = None,
) -> None:
    assert payload["id"] == check_in_id
    assert payload["check_in_date"] == check_in_date
    assert payload["pain_level"] == pain_level
    assert payload["readiness_level"] == readiness_level
    assert payload["stiffness_level"] == stiffness_level
    assert payload["has_flare_up"] is has_flare_up
    assert payload["notes"] == notes
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert payload.get("flare_up") == flare_up
    assert "user_id" not in payload
    assert "flare_up_incidents" not in payload


def _flare_up_payload(
    *,
    incident_id: str,
    incident_date: str,
    body_part: str,
    severity: int,
    activity_class_id: str | None,
    daily_check_in_id: str,
    notes: str | None,
) -> dict[str, Any]:
    return {
        "id": incident_id,
        "incident_date": incident_date,
        "body_part": body_part,
        "severity": severity,
        "activity_class_id": activity_class_id,
        "daily_check_in_id": daily_check_in_id,
        "notes": notes,
    }


async def test_list_daily_check_ins_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/daily-check-ins")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_daily_check_ins_returns_local_check_ins_in_stable_recent_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-oldest",
        check_in_date=date(2026, 5, 19),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-middle",
        check_in_date=date(2026, 5, 20),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-newest",
        check_in_date=date(2026, 5, 21),
    )

    response = await client.get("/api/daily-check-ins")

    assert response.status_code == 200
    payload = response.json()
    assert [check_in["id"] for check_in in payload] == [
        "check-newest",
        "check-middle",
        "check-oldest",
    ]
    assert all("user_id" not in check_in for check_in in payload)
    assert all("flare_up_incidents" not in check_in for check_in in payload)


async def test_list_daily_check_ins_filters_from_start_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-before",
        check_in_date=date(2026, 5, 19),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-on-start",
        check_in_date=date(2026, 5, 20),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-after",
        check_in_date=date(2026, 5, 21),
    )

    response = await client.get("/api/daily-check-ins", params={"from": "2026-05-20"})

    assert response.status_code == 200
    assert [check_in["id"] for check_in in response.json()] == ["check-after", "check-on-start"]


async def test_list_daily_check_ins_filters_to_end_date(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-before",
        check_in_date=date(2026, 5, 19),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-on-end",
        check_in_date=date(2026, 5, 20),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-after",
        check_in_date=date(2026, 5, 21),
    )

    response = await client.get("/api/daily-check-ins", params={"to": "2026-05-20"})

    assert response.status_code == 200
    assert [check_in["id"] for check_in in response.json()] == ["check-on-end", "check-before"]


async def test_list_daily_check_ins_applies_combined_date_filters(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-before-window",
        check_in_date=date(2026, 5, 18),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-target",
        check_in_date=date(2026, 5, 20),
    )
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-after-window",
        check_in_date=date(2026, 5, 22),
    )

    response = await client.get(
        "/api/daily-check-ins",
        params={"from": "2026-05-19", "to": "2026-05-21"},
    )

    assert response.status_code == 200
    assert [check_in["id"] for check_in in response.json()] == ["check-target"]


async def test_list_daily_check_ins_returns_empty_when_from_is_after_to(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-window",
        check_in_date=date(2026, 5, 20),
    )

    response = await client.get(
        "/api/daily-check-ins",
        params={"from": "2026-05-22", "to": "2026-05-20"},
    )

    assert response.status_code == 200
    assert response.json() == []


async def test_get_daily_check_in_by_date_returns_payload_without_server_owned_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-morning",
        check_in_date=date(2026, 5, 21),
        pain_level=1,
        readiness_level=8,
        stiffness_level=2,
        notes="Slept well",
    )

    response = await client.get("/api/daily-check-ins/2026-05-21")

    assert response.status_code == 200
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-morning",
        check_in_date="2026-05-21",
        pain_level=1,
        readiness_level=8,
        stiffness_level=2,
        has_flare_up=False,
        notes="Slept well",
    )


async def test_get_daily_check_in_by_date_returns_embedded_linked_flare_up(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-flare",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-check",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=6,
        activity_class_id="cls-load",
        daily_check_in_id="check-flare",
        notes="Likely from hills",
    )

    response = await client.get("/api/daily-check-ins/2026-05-21")

    assert response.status_code == 200
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-flare",
        check_in_date="2026-05-21",
        pain_level=2,
        readiness_level=7,
        stiffness_level=3,
        has_flare_up=True,
        notes="Seeded check-in",
        flare_up=_flare_up_payload(
            incident_id="incident-check",
            incident_date="2026-05-21",
            body_part="ankle",
            severity=6,
            activity_class_id="cls-load",
            daily_check_in_id="check-flare",
            notes="Likely from hills",
        ),
    )


async def test_get_daily_check_in_by_date_returns_not_found_for_missing_date(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/daily-check-ins/2026-05-21")

    assert response.status_code == 404
    assert response.json() == {"detail": "Daily check-in not found"}


async def test_get_today_daily_check_in_returns_current_server_date_when_present(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    today = date.today()
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-today",
        check_in_date=today,
        pain_level=3,
        readiness_level=6,
        stiffness_level=4,
    )

    response = await client.get("/api/daily-check-ins/today")

    assert response.status_code == 200
    assert response.json()["id"] == "check-today"
    assert response.json()["check_in_date"] == today.isoformat()


async def test_get_today_daily_check_in_returns_not_found_when_missing(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/daily-check-ins/today")

    assert response.status_code == 404
    assert response.json() == {"detail": "Daily check-in not found"}


async def test_create_daily_check_in_returns_created_payload_without_server_owned_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-created",
            "check_in_date": "2026-05-21",
            "pain_level": 2,
            "readiness_level": 8,
            "stiffness_level": 3,
            "has_flare_up": False,
            "notes": "Solid morning",
        },
    )

    assert response.status_code == 201
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-created",
        check_in_date="2026-05-21",
        pain_level=2,
        readiness_level=8,
        stiffness_level=3,
        has_flare_up=False,
        notes="Solid morning",
    )


async def test_create_daily_check_in_rejects_server_owned_or_relationship_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-invalid",
            "user_id": "not-local",
            "check_in_date": "2026-05-21",
            "pain_level": 2,
            "readiness_level": 8,
            "stiffness_level": 3,
            "has_flare_up": False,
            "notes": "Invalid payload",
            "created_at": "2026-05-27T08:00:00Z",
            "updated_at": "2026-05-27T08:00:00Z",
            "flare_up_incidents": [{"id": "incident-invalid"}],
        },
    )

    assert response.status_code == 422


async def test_create_daily_check_in_with_flare_up_creates_linked_incident(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")

    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-with-flare",
            "check_in_date": "2026-05-21",
            "pain_level": 5,
            "readiness_level": 3,
            "stiffness_level": 6,
            "has_flare_up": True,
            "notes": "Rough morning",
            "flare_up": {
                "id": "incident-with-flare",
                "body_part": "knee",
                "severity": 7,
                "activity_class_id": "cls-load",
                "notes": "After long walk",
            },
        },
    )

    assert response.status_code == 201
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-with-flare",
        check_in_date="2026-05-21",
        pain_level=5,
        readiness_level=3,
        stiffness_level=6,
        has_flare_up=True,
        notes="Rough morning",
        flare_up=_flare_up_payload(
            incident_id="incident-with-flare",
            incident_date="2026-05-21",
            body_part="knee",
            severity=7,
            activity_class_id="cls-load",
            daily_check_in_id="check-with-flare",
            notes="After long walk",
        ),
    )
    assert _count_linked_incidents(app_with_test_database, "check-with-flare") == 1


async def test_create_daily_check_in_allows_null_flare_up_activity_class(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-null-class",
            "check_in_date": "2026-05-21",
            "pain_level": 5,
            "readiness_level": 3,
            "stiffness_level": 6,
            "has_flare_up": True,
            "flare_up": {
                "id": "incident-null-class",
                "body_part": "foot",
                "severity": 4,
                "activity_class_id": None,
                "notes": "No obvious trigger",
            },
        },
    )

    assert response.status_code == 201
    assert response.json()["flare_up"]["activity_class_id"] is None


async def test_create_daily_check_in_rejects_flare_up_missing_when_flag_is_true(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-missing-flare",
            "check_in_date": "2026-05-21",
            "pain_level": 5,
            "readiness_level": 3,
            "stiffness_level": 6,
            "has_flare_up": True,
        },
    )

    assert response.status_code == 422


async def test_post_daily_check_in_upserts_existing_date_and_preserves_existing_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-existing",
        check_in_date=date(2026, 5, 21),
        pain_level=2,
        readiness_level=7,
        stiffness_level=3,
        notes="Before update",
    )
    original = _get_check_in(app_with_test_database, "check-existing")

    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-ignored-on-upsert",
            "check_in_date": "2026-05-21",
            "pain_level": 4,
            "readiness_level": 5,
            "stiffness_level": 6,
            "has_flare_up": False,
            "notes": "After update",
        },
    )

    assert response.status_code == 200
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-existing",
        check_in_date="2026-05-21",
        pain_level=4,
        readiness_level=5,
        stiffness_level=6,
        has_flare_up=False,
        notes="After update",
    )
    updated = _get_check_in(app_with_test_database, "check-existing")
    assert updated.created_at == original.created_at
    assert updated.updated_at > original.updated_at


async def test_post_daily_check_in_upserts_existing_linked_flare_up(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-existing",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-existing",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=5,
        activity_class_id=None,
        daily_check_in_id="check-existing",
        notes="Before update",
    )

    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-ignored",
            "check_in_date": "2026-05-21",
            "pain_level": 6,
            "readiness_level": 4,
            "stiffness_level": 7,
            "has_flare_up": True,
            "flare_up": {
                "id": "incident-ignored-on-upsert",
                "body_part": "knee",
                "severity": 8,
                "activity_class_id": "cls-load",
                "notes": "After update",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == "check-existing"
    assert response.json()["flare_up"] == _flare_up_payload(
        incident_id="incident-existing",
        incident_date="2026-05-21",
        body_part="knee",
        severity=8,
        activity_class_id="cls-load",
        daily_check_in_id="check-existing",
        notes="After update",
    )
    assert _count_linked_incidents(app_with_test_database, "check-existing") == 1


async def test_post_daily_check_in_with_no_flare_deletes_existing_linked_incident(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-existing",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-existing",
        incident_date=date(2026, 5, 21),
        daily_check_in_id="check-existing",
    )

    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-ignored",
            "check_in_date": "2026-05-21",
            "pain_level": 1,
            "readiness_level": 9,
            "stiffness_level": 2,
            "has_flare_up": False,
            "notes": "Resolved",
        },
    )

    assert response.status_code == 200
    assert response.json()["has_flare_up"] is False
    assert response.json().get("flare_up") is None
    assert _count_linked_incidents(app_with_test_database, "check-existing") == 0


async def test_post_daily_check_in_rejects_no_flare_with_flare_up_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-contradictory-post",
        check_in_date=date(2026, 5, 21),
        pain_level=5,
        readiness_level=4,
        stiffness_level=6,
        has_flare_up=True,
        notes="Before contradictory post",
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-contradictory-post",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=7,
        activity_class_id=None,
        daily_check_in_id="check-contradictory-post",
        notes="Before contradictory post",
    )
    original_check_in = _get_check_in(app_with_test_database, "check-contradictory-post")

    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": "check-ignored",
            "check_in_date": "2026-05-21",
            "pain_level": 1,
            "readiness_level": 9,
            "stiffness_level": 2,
            "has_flare_up": False,
            "notes": "Contradictory post",
            "flare_up": {
                "id": "incident-ignored",
                "body_part": "knee",
                "severity": 3,
                "activity_class_id": "cls-load",
                "notes": "Should be rejected",
            },
        },
    )

    assert response.status_code == 422
    unchanged_check_in = _get_check_in(app_with_test_database, "check-contradictory-post")
    assert unchanged_check_in.pain_level == 5
    assert unchanged_check_in.readiness_level == 4
    assert unchanged_check_in.stiffness_level == 6
    assert unchanged_check_in.has_flare_up is True
    assert unchanged_check_in.notes == "Before contradictory post"
    assert unchanged_check_in.updated_at == original_check_in.updated_at
    incident = _get_flare_up_incident(
        app_with_test_database,
        "incident-contradictory-post",
    )
    assert incident.body_part == "ankle"
    assert incident.severity == 7
    assert incident.activity_class_id is None
    assert incident.daily_check_in_id == "check-contradictory-post"
    assert incident.notes == "Before contradictory post"
    assert _count_linked_incidents(app_with_test_database, "check-contradictory-post") == 1


async def test_patch_daily_check_in_by_date_updates_present_fields_only(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-patch",
        check_in_date=date(2026, 5, 21),
        pain_level=2,
        readiness_level=7,
        stiffness_level=3,
        notes="Before patch",
    )
    original = _get_check_in(app_with_test_database, "check-patch")

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={"pain_level": 4, "notes": "After patch"},
    )

    assert response.status_code == 200
    _assert_check_in_payload(
        response.json(),
        check_in_id="check-patch",
        check_in_date="2026-05-21",
        pain_level=4,
        readiness_level=7,
        stiffness_level=3,
        has_flare_up=False,
        notes="After patch",
    )
    updated = _get_check_in(app_with_test_database, "check-patch")
    assert updated.created_at == original.created_at
    assert updated.updated_at > original.updated_at


async def test_patch_daily_check_in_allows_notes_to_be_cleared(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-clear-notes",
        check_in_date=date(2026, 5, 21),
        notes="Clear me",
    )

    response = await client.patch("/api/daily-check-ins/2026-05-21", json={"notes": None})

    assert response.status_code == 200
    assert response.json()["notes"] is None


async def test_patch_daily_check_in_updates_linked_flare_up_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-recovery", name="Recovery")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-flare",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-flare",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=5,
        activity_class_id=None,
        daily_check_in_id="check-flare",
        notes="Before patch",
    )

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={
            "flare_up": {
                "body_part": "foot",
                "severity": 6,
                "activity_class_id": "cls-recovery",
                "notes": "After patch",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["flare_up"] == _flare_up_payload(
        incident_id="incident-flare",
        incident_date="2026-05-21",
        body_part="foot",
        severity=6,
        activity_class_id="cls-recovery",
        daily_check_in_id="check-flare",
        notes="After patch",
    )
    assert _count_linked_incidents(app_with_test_database, "check-flare") == 1


async def test_patch_daily_check_in_can_create_linked_flare_up_when_enabled(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-enable-flare",
        check_in_date=date(2026, 5, 21),
        has_flare_up=False,
    )

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={
            "has_flare_up": True,
            "flare_up": {
                "id": "incident-enabled",
                "body_part": "calf",
                "severity": 5,
                "activity_class_id": None,
                "notes": "Started today",
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["has_flare_up"] is True
    assert response.json()["flare_up"] == _flare_up_payload(
        incident_id="incident-enabled",
        incident_date="2026-05-21",
        body_part="calf",
        severity=5,
        activity_class_id=None,
        daily_check_in_id="check-enable-flare",
        notes="Started today",
    )


async def test_patch_daily_check_in_rejects_first_flare_up_missing_body_part(
    app_with_test_database: FastAPI,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-missing-flare-body-part",
        check_in_date=date(2026, 5, 21),
        has_flare_up=False,
    )
    transport = ASGITransport(app=app_with_test_database, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.patch(
            "/api/daily-check-ins/2026-05-21",
            json={
                "has_flare_up": True,
                "flare_up": {
                    "id": "incident-missing-body-part",
                    "severity": 5,
                    "activity_class_id": None,
                    "notes": "Missing body part",
                },
            },
        )

    assert response.status_code == 422
    assert _count_linked_incidents(app_with_test_database, "check-missing-flare-body-part") == 0


async def test_patch_daily_check_in_rejects_first_flare_up_missing_severity(
    app_with_test_database: FastAPI,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-missing-flare-severity",
        check_in_date=date(2026, 5, 21),
        has_flare_up=False,
    )
    transport = ASGITransport(app=app_with_test_database, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.patch(
            "/api/daily-check-ins/2026-05-21",
            json={
                "has_flare_up": True,
                "flare_up": {
                    "id": "incident-missing-severity",
                    "body_part": "calf",
                    "activity_class_id": None,
                    "notes": "Missing severity",
                },
            },
        )

    assert response.status_code == 422
    assert _count_linked_incidents(app_with_test_database, "check-missing-flare-severity") == 0


async def test_patch_daily_check_in_to_no_flare_deletes_existing_linked_incident(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-flare",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-flare",
        incident_date=date(2026, 5, 21),
        daily_check_in_id="check-flare",
    )

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={"has_flare_up": False},
    )

    assert response.status_code == 200
    assert response.json()["has_flare_up"] is False
    assert response.json().get("flare_up") is None
    assert _count_linked_incidents(app_with_test_database, "check-flare") == 0


async def test_patch_daily_check_in_rejects_no_flare_with_flare_up_payload(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-contradictory-patch",
        check_in_date=date(2026, 5, 21),
        pain_level=5,
        readiness_level=4,
        stiffness_level=6,
        has_flare_up=True,
        notes="Before contradictory patch",
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-contradictory-patch",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=7,
        activity_class_id=None,
        daily_check_in_id="check-contradictory-patch",
        notes="Before contradictory patch",
    )
    original_check_in = _get_check_in(app_with_test_database, "check-contradictory-patch")

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={
            "has_flare_up": False,
            "flare_up": {
                "id": "incident-ignored",
                "body_part": "knee",
                "severity": 3,
                "activity_class_id": "cls-load",
                "notes": "Should be rejected",
            },
        },
    )

    assert response.status_code == 422
    unchanged_check_in = _get_check_in(app_with_test_database, "check-contradictory-patch")
    assert unchanged_check_in.pain_level == 5
    assert unchanged_check_in.readiness_level == 4
    assert unchanged_check_in.stiffness_level == 6
    assert unchanged_check_in.has_flare_up is True
    assert unchanged_check_in.notes == "Before contradictory patch"
    assert unchanged_check_in.updated_at == original_check_in.updated_at
    incident = _get_flare_up_incident(
        app_with_test_database,
        "incident-contradictory-patch",
    )
    assert incident.body_part == "ankle"
    assert incident.severity == 7
    assert incident.activity_class_id is None
    assert incident.daily_check_in_id == "check-contradictory-patch"
    assert incident.notes == "Before contradictory patch"
    assert _count_linked_incidents(app_with_test_database, "check-contradictory-patch") == 1


async def test_patch_daily_check_in_returns_not_found_for_missing_date(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={"pain_level": 4},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Daily check-in not found"}


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("pain_level", -1),
        ("pain_level", 11),
        ("readiness_level", -1),
        ("readiness_level", 11),
        ("stiffness_level", -1),
        ("stiffness_level", 11),
    ],
)
async def test_create_daily_check_in_rejects_levels_outside_zero_to_ten(
    client: AsyncClient,
    field_name: str,
    invalid_value: int,
) -> None:
    payload = {
        "id": f"check-invalid-{field_name}-{invalid_value}",
        "check_in_date": "2026-05-21",
        "pain_level": 2,
        "readiness_level": 8,
        "stiffness_level": 3,
        "has_flare_up": False,
    }
    payload[field_name] = invalid_value

    response = await client.post("/api/daily-check-ins", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("invalid_severity", [-1, 11])
async def test_create_daily_check_in_rejects_flare_up_severity_outside_zero_to_ten(
    client: AsyncClient,
    invalid_severity: int,
) -> None:
    response = await client.post(
        "/api/daily-check-ins",
        json={
            "id": f"check-invalid-severity-{invalid_severity}",
            "check_in_date": "2026-05-21",
            "pain_level": 5,
            "readiness_level": 3,
            "stiffness_level": 6,
            "has_flare_up": True,
            "flare_up": {
                "id": f"incident-invalid-severity-{invalid_severity}",
                "body_part": "knee",
                "severity": invalid_severity,
                "activity_class_id": None,
            },
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "field_name",
    ["check_in_date", "pain_level", "readiness_level", "stiffness_level", "has_flare_up"],
)
async def test_create_daily_check_in_rejects_explicit_null_required_fields(
    client: AsyncClient,
    field_name: str,
) -> None:
    payload = {
        "id": f"check-null-{field_name}",
        "check_in_date": "2026-05-21",
        "pain_level": 2,
        "readiness_level": 8,
        "stiffness_level": 3,
        "has_flare_up": False,
    }
    payload[field_name] = None

    response = await client.post("/api/daily-check-ins", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "field_name",
    ["pain_level", "readiness_level", "stiffness_level", "has_flare_up"],
)
async def test_patch_daily_check_in_rejects_explicit_null_required_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id=f"check-null-{field_name}",
        check_in_date=date(2026, 5, 21),
        pain_level=2,
        readiness_level=8,
        stiffness_level=3,
        has_flare_up=False,
    )

    response = await client.patch(
        "/api/daily-check-ins/2026-05-21",
        json={field_name: None},
    )

    assert response.status_code == 422
    unchanged = _get_check_in(app_with_test_database, f"check-null-{field_name}")
    assert unchanged.pain_level == 2
    assert unchanged.readiness_level == 8
    assert unchanged.stiffness_level == 3
    assert unchanged.has_flare_up is False


async def test_get_daily_check_in_returns_at_most_one_embedded_check_in_sourced_flare_up(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-duplicate-incidents",
        check_in_date=date(2026, 5, 21),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-first",
        incident_date=date(2026, 5, 21),
        body_part="knee",
        severity=4,
        daily_check_in_id="check-duplicate-incidents",
        created_at=_utc_datetime(9),
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-second",
        incident_date=date(2026, 5, 21),
        body_part="ankle",
        severity=6,
        daily_check_in_id="check-duplicate-incidents",
        created_at=_utc_datetime(10),
    )

    response = await client.get("/api/daily-check-ins/2026-05-21")

    assert response.status_code == 200
    assert isinstance(response.json()["flare_up"], dict)
    assert response.json()["flare_up"]["id"] == "incident-first"
    assert "flare_up_incidents" not in response.json()
