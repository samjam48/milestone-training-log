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


def _get_activity_class(app_with_test_database: FastAPI, class_id: str) -> ActivityClass:
    for session in _with_session(app_with_test_database):
        activity_class = session.get(ActivityClass, class_id)
        if activity_class is None:
            raise AssertionError(f"Missing seeded activity class {class_id}")
        return activity_class
    raise AssertionError("test session dependency did not yield a session")


def _get_check_in(app_with_test_database: FastAPI, check_in_id: str) -> DailyCheckIn:
    for session in _with_session(app_with_test_database):
        check_in = session.get(DailyCheckIn, check_in_id)
        if check_in is None:
            raise AssertionError(f"Missing seeded check-in {check_in_id}")
        return check_in
    raise AssertionError("test session dependency did not yield a session")


def _assert_flare_up_incident_payload(
    payload: dict[str, Any],
    *,
    incident_id: str,
    incident_date: str,
    body_part: str,
    severity: int,
    activity_class_id: str | None,
    daily_check_in_id: str | None,
    notes: str | None,
) -> None:
    assert payload["id"] == incident_id
    assert payload["incident_date"] == incident_date
    assert payload["body_part"] == body_part
    assert payload["severity"] == severity
    assert payload["activity_class_id"] == activity_class_id
    assert payload["daily_check_in_id"] == daily_check_in_id
    assert payload["notes"] == notes
    assert "created_at" in payload
    assert "updated_at" in payload
    datetime.fromisoformat(payload["created_at"])
    datetime.fromisoformat(payload["updated_at"])
    assert "user_id" not in payload
    assert "activity_class" not in payload
    assert "daily_check_in" not in payload


async def test_list_flare_up_incidents_returns_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/flare-up-incidents")

    assert response.status_code == 200
    assert response.json() == []


async def test_list_flare_up_incidents_returns_local_incidents_in_stable_recent_order(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-old",
        incident_date=date(2026, 5, 20),
        created_at=_utc_datetime(9),
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-newer-created",
        incident_date=date(2026, 5, 21),
        created_at=_utc_datetime(11),
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-alpha-same-created",
        incident_date=date(2026, 5, 21),
        created_at=_utc_datetime(10),
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-beta-same-created",
        incident_date=date(2026, 5, 21),
        created_at=_utc_datetime(10),
    )

    response = await client.get("/api/flare-up-incidents")

    assert response.status_code == 200
    payload = response.json()
    assert [incident["id"] for incident in payload] == [
        "incident-newer-created",
        "incident-alpha-same-created",
        "incident-beta-same-created",
        "incident-old",
    ]
    assert all("user_id" not in incident for incident in payload)
    assert all("activity_class" not in incident for incident in payload)
    assert all("daily_check_in" not in incident for incident in payload)


async def test_list_flare_up_incidents_includes_check_in_linked_incidents(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-linked",
        check_in_date=date(2026, 5, 22),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-linked",
        incident_date=date(2026, 5, 22),
        daily_check_in_id="check-linked",
    )

    response = await client.get("/api/flare-up-incidents")

    assert response.status_code == 200
    assert response.json()[0]["id"] == "incident-linked"
    assert response.json()[0]["daily_check_in_id"] == "check-linked"


async def test_create_standalone_flare_up_incident_returns_created_payload(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-standalone",
            "incident_date": "2026-05-22",
            "body_part": "achilles",
            "severity": 5,
            "activity_class_id": None,
            "daily_check_in_id": None,
            "notes": "Morning flare after hills",
        },
    )

    assert response.status_code == 201
    _assert_flare_up_incident_payload(
        response.json(),
        incident_id="incident-standalone",
        incident_date="2026-05-22",
        body_part="achilles",
        severity=5,
        activity_class_id=None,
        daily_check_in_id=None,
        notes="Morning flare after hills",
    )


async def test_create_activity_class_linked_flare_up_incident(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")

    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-class-linked",
            "incident_date": "2026-05-22",
            "body_part": "knee",
            "severity": 6,
            "activity_class_id": "cls-load",
            "daily_check_in_id": None,
            "notes": None,
        },
    )

    assert response.status_code == 201
    assert response.json()["activity_class_id"] == "cls-load"
    assert response.json()["daily_check_in_id"] is None


async def test_create_check_in_linked_flare_up_incident(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-flare",
        check_in_date=date(2026, 5, 22),
        has_flare_up=True,
    )

    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-check-linked",
            "incident_date": "2026-05-22",
            "body_part": "hip",
            "severity": 7,
            "activity_class_id": None,
            "daily_check_in_id": "check-flare",
            "notes": "Logged from incident screen",
        },
    )

    assert response.status_code == 201
    assert response.json()["daily_check_in_id"] == "check-flare"


async def test_create_flare_up_incident_allows_omitted_nullable_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-minimal",
            "incident_date": "2026-05-22",
            "body_part": "foot",
            "severity": 3,
        },
    )

    assert response.status_code == 201
    assert response.json()["activity_class_id"] is None
    assert response.json()["daily_check_in_id"] is None
    assert response.json()["notes"] is None


async def test_create_flare_up_incident_rejects_server_owned_or_relationship_fields(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-server-owned",
            "user_id": "someone-else",
            "incident_date": "2026-05-22",
            "body_part": "knee",
            "severity": 4,
            "activity_class_id": None,
            "daily_check_in_id": None,
            "notes": None,
            "created_at": "2026-05-22T09:00:00Z",
            "updated_at": "2026-05-22T09:00:00Z",
            "activity_class": {"id": "cls-load"},
            "daily_check_in": {"id": "check-flare"},
        },
    )

    assert response.status_code == 422


async def test_create_flare_up_incident_rejects_duplicate_id(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-duplicate",
        incident_date=date(2026, 5, 22),
    )

    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-duplicate",
            "incident_date": "2026-05-23",
            "body_part": "ankle",
            "severity": 4,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Flare-up incident already exists"}


async def test_create_flare_up_incident_rejects_missing_activity_class(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-missing-class",
            "incident_date": "2026-05-22",
            "body_part": "knee",
            "severity": 4,
            "activity_class_id": "cls-missing",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity class not found"}


async def test_create_flare_up_incident_rejects_missing_daily_check_in(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": "incident-missing-check",
            "incident_date": "2026-05-22",
            "body_part": "knee",
            "severity": 4,
            "daily_check_in_id": "check-missing",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Daily check-in not found"}


@pytest.mark.parametrize("invalid_severity", [-1, 11])
async def test_create_flare_up_incident_rejects_severity_outside_zero_to_ten(
    client: AsyncClient,
    invalid_severity: int,
) -> None:
    response = await client.post(
        "/api/flare-up-incidents",
        json={
            "id": f"incident-invalid-severity-{invalid_severity}",
            "incident_date": "2026-05-22",
            "body_part": "knee",
            "severity": invalid_severity,
        },
    )

    assert response.status_code == 422


async def test_patch_flare_up_incident_updates_present_fields_only(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-patch",
        incident_date=date(2026, 5, 22),
        body_part="knee",
        severity=4,
        activity_class_id=None,
        daily_check_in_id=None,
        notes="Before",
        updated_at=_utc_datetime(10),
    )

    response = await client.patch(
        "/api/flare-up-incidents/incident-patch",
        json={
            "incident_date": "2026-05-23",
            "body_part": "achilles",
            "severity": 6,
            "activity_class_id": "cls-load",
            "notes": "After",
        },
    )

    assert response.status_code == 200
    _assert_flare_up_incident_payload(
        response.json(),
        incident_id="incident-patch",
        incident_date="2026-05-23",
        body_part="achilles",
        severity=6,
        activity_class_id="cls-load",
        daily_check_in_id=None,
        notes="After",
    )
    assert response.json()["updated_at"] != _utc_datetime(10).isoformat()


async def test_patch_flare_up_incident_allows_empty_patch(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-empty-patch",
        incident_date=date(2026, 5, 22),
        body_part="knee",
        severity=4,
        updated_at=_utc_datetime(10),
    )

    response = await client.patch("/api/flare-up-incidents/incident-empty-patch", json={})

    assert response.status_code == 200
    _assert_flare_up_incident_payload(
        response.json(),
        incident_id="incident-empty-patch",
        incident_date="2026-05-22",
        body_part="knee",
        severity=4,
        activity_class_id=None,
        daily_check_in_id=None,
        notes="Seeded incident",
    )


async def test_patch_flare_up_incident_can_null_optional_relationships_without_deleting_parents(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_activity_class(app_with_test_database, class_id="cls-load", name="Load")
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-linked",
        check_in_date=date(2026, 5, 22),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-linked",
        incident_date=date(2026, 5, 22),
        activity_class_id="cls-load",
        daily_check_in_id="check-linked",
        notes="Linked",
    )

    response = await client.patch(
        "/api/flare-up-incidents/incident-linked",
        json={
            "activity_class_id": None,
            "daily_check_in_id": None,
            "notes": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["activity_class_id"] is None
    assert response.json()["daily_check_in_id"] is None
    assert response.json()["notes"] is None
    assert _get_activity_class(app_with_test_database, "cls-load").id == "cls-load"
    assert _get_check_in(app_with_test_database, "check-linked").id == "check-linked"


async def test_patch_flare_up_incident_can_link_existing_daily_check_in(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_check_in(
        app_with_test_database,
        check_in_id="check-link-target",
        check_in_date=date(2026, 5, 22),
        has_flare_up=True,
    )
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-to-link",
        incident_date=date(2026, 5, 22),
        daily_check_in_id=None,
    )

    response = await client.patch(
        "/api/flare-up-incidents/incident-to-link",
        json={"daily_check_in_id": "check-link-target"},
    )

    assert response.status_code == 200
    assert response.json()["daily_check_in_id"] == "check-link-target"


async def test_patch_flare_up_incident_rejects_missing_activity_class(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-missing-class-patch",
        incident_date=date(2026, 5, 22),
        activity_class_id=None,
    )

    response = await client.patch(
        "/api/flare-up-incidents/incident-missing-class-patch",
        json={"activity_class_id": "cls-missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Activity class not found"}
    assert (
        _get_flare_up_incident(
            app_with_test_database,
            "incident-missing-class-patch",
        ).activity_class_id
        is None
    )


async def test_patch_flare_up_incident_rejects_missing_daily_check_in(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-missing-check-patch",
        incident_date=date(2026, 5, 22),
        daily_check_in_id=None,
    )

    response = await client.patch(
        "/api/flare-up-incidents/incident-missing-check-patch",
        json={"daily_check_in_id": "check-missing"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Daily check-in not found"}
    assert (
        _get_flare_up_incident(
            app_with_test_database,
            "incident-missing-check-patch",
        ).daily_check_in_id
        is None
    )


async def test_patch_missing_flare_up_incident_returns_stable_not_found(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/api/flare-up-incidents/incident-missing",
        json={"notes": "No row"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Flare-up incident not found"}


@pytest.mark.parametrize("invalid_severity", [-1, 11])
async def test_patch_flare_up_incident_rejects_severity_outside_zero_to_ten(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    invalid_severity: int,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id=f"incident-invalid-patch-{invalid_severity}",
        incident_date=date(2026, 5, 22),
        severity=5,
    )

    response = await client.patch(
        f"/api/flare-up-incidents/incident-invalid-patch-{invalid_severity}",
        json={"severity": invalid_severity},
    )

    assert response.status_code == 422
    assert (
        _get_flare_up_incident(
            app_with_test_database,
            f"incident-invalid-patch-{invalid_severity}",
        ).severity
        == 5
    )


@pytest.mark.parametrize("field_name", ["incident_date", "body_part", "severity"])
async def test_patch_flare_up_incident_rejects_explicit_null_required_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
    field_name: str,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id=f"incident-null-{field_name}",
        incident_date=date(2026, 5, 22),
        body_part="knee",
        severity=5,
    )

    response = await client.patch(
        f"/api/flare-up-incidents/incident-null-{field_name}",
        json={field_name: None},
    )

    assert response.status_code == 422
    incident = _get_flare_up_incident(
        app_with_test_database,
        f"incident-null-{field_name}",
    )
    assert incident.incident_date == date(2026, 5, 22)
    assert incident.body_part == "knee"
    assert incident.severity == 5


async def test_delete_flare_up_incident_route_is_not_available_in_phase_two(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    _seed_flare_up_incident(
        app_with_test_database,
        incident_id="incident-no-delete",
        incident_date=date(2026, 5, 22),
    )

    response = await client.delete("/api/flare-up-incidents/incident-no-delete")

    assert response.status_code == 405
    assert _get_flare_up_incident(app_with_test_database, "incident-no-delete").id == (
        "incident-no-delete"
    )
