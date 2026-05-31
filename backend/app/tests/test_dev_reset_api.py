"""
F2.6 — dev reset endpoint tests.

These tests MUST FAIL until the implementation is in place:
  - backend/app/settings.py: APP_DEV_MODE: bool = False added to Settings
  - backend/app/services/dev_reset.py: reset_to_seed_data(session)
  - backend/app/routers/dev.py: POST /api/dev/reset (guarded by APP_DEV_MODE)
  - backend/app/main.py: conditional router registration reading settings.APP_DEV_MODE

Implementer assumption: seed.py must expose a `run_seed(session: Session) -> None`
callable (or equivalent). The conftest fixture uses `create_app()` which builds the
app fresh; the dev router is included only when APP_DEV_MODE is True at call time.

Environment override strategy: pydantic-settings reads APP_DEV_MODE from the
environment at Settings() construction time. We use monkeypatch.setenv to set the
env var BEFORE importing/calling create_app(), and we re-import the settings module
so a fresh Settings() instance is constructed with the patched env. This is the
standard approach for pydantic-settings in pytest.

Test client pattern: matches conftest.py (async httpx + ASGITransport, SQLite in-memory).
"""

from __future__ import annotations

import importlib
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401 — registers all SQLModel metadata
from app.database import get_session

# ---------------------------------------------------------------------------
# Helper: build an in-memory test database and return a FastAPI app.
# We call create_app() ourselves (instead of using the shared conftest fixture)
# so we can control APP_DEV_MODE via env before create_app() is called.
# ---------------------------------------------------------------------------

def _make_engine() -> object:
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def _build_app_with_db(engine: object) -> FastAPI:
    """Create the FastAPI app with a test in-memory database override.

    Reloads app.settings and app.main so create_app() picks up the patched
    APP_DEV_MODE environment variable set by the calling fixture.
    """
    # Reload settings so the patched env var is read into a fresh Settings().
    import app.settings as _settings_module
    importlib.reload(_settings_module)

    # Reload main so create_app() sees the reloaded settings.
    import app.main as _main_module
    importlib.reload(_main_module)

    app = _main_module.create_app()

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as session:  # type: ignore[arg-type]
            yield session

    app.dependency_overrides[get_session] = override_get_session
    return app


# ---------------------------------------------------------------------------
# Fixture: APP_DEV_MODE = True — dev router MUST be mounted.
# ---------------------------------------------------------------------------

@pytest.fixture
def dev_mode_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """Build an app with APP_DEV_MODE=True set in the environment."""
    monkeypatch.setenv("APP_DEV_MODE", "true")

    engine = _make_engine()
    SQLModel.metadata.create_all(engine)  # type: ignore[arg-type]
    yield _build_app_with_db(engine)

    # Reload settings back to defaults so later tests start clean.
    import app.settings as _settings_module
    importlib.reload(_settings_module)
    import app.main as _main_module
    importlib.reload(_main_module)


@pytest.fixture
async def dev_client(dev_mode_app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=dev_mode_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# ---------------------------------------------------------------------------
# Fixture: APP_DEV_MODE = False (default) — dev router MUST NOT be mounted.
# ---------------------------------------------------------------------------

@pytest.fixture
def prod_mode_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """Build an app with APP_DEV_MODE absent/false (production default)."""
    monkeypatch.delenv("APP_DEV_MODE", raising=False)

    engine = _make_engine()
    SQLModel.metadata.create_all(engine)  # type: ignore[arg-type]
    yield _build_app_with_db(engine)

    import app.settings as _settings_module
    importlib.reload(_settings_module)
    import app.main as _main_module
    importlib.reload(_main_module)


@pytest.fixture
async def prod_client(prod_mode_app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=prod_mode_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# ---------------------------------------------------------------------------
# Tests — APP_DEV_MODE = True
# ---------------------------------------------------------------------------

async def test_dev_reset_returns_200_in_dev_mode(dev_client: AsyncClient) -> None:
    """POST /api/dev/reset must return 200 when APP_DEV_MODE is True."""
    response = await dev_client.post("/api/dev/reset")
    assert response.status_code == 200


async def test_dev_reset_repopulates_activity_classes(dev_client: AsyncClient) -> None:
    """After reset, seeded activity classes must exist in the database.

    The seed script creates at least 3 activity classes (cls-foot, cls-recovery,
    cls-upper). We confirm at least one is retrievable via the existing API.
    """
    response = await dev_client.post("/api/dev/reset")
    assert response.status_code == 200

    classes_response = await dev_client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    classes = classes_response.json()
    assert len(classes) >= 1, "Expected at least one activity class after dev reset"


async def test_dev_reset_repopulates_training_blocks(dev_client: AsyncClient) -> None:
    """After reset, seeded training block must exist.

    The seed script creates 'blk-1' (Return to Walking — Phase 2).
    """
    response = await dev_client.post("/api/dev/reset")
    assert response.status_code == 200

    blocks_response = await dev_client.get("/api/training-blocks")
    assert blocks_response.status_code == 200
    blocks = blocks_response.json()
    assert len(blocks) >= 1, "Expected at least one training block after dev reset"


async def test_dev_reset_is_idempotent(dev_client: AsyncClient) -> None:
    """Calling POST /api/dev/reset twice must return 200 both times and leave the
    DB in a consistent seed state (no duplicate data)."""
    r1 = await dev_client.post("/api/dev/reset")
    assert r1.status_code == 200

    r2 = await dev_client.post("/api/dev/reset")
    assert r2.status_code == 200

    # After two resets, class count must equal seed count (not doubled)
    classes_response = await dev_client.get("/api/activity-classes")
    assert classes_response.status_code == 200
    classes = classes_response.json()
    # Seed creates exactly 3 activity classes
    assert len(classes) == 3, (
        f"Expected exactly 3 activity classes after idempotent reset, got {len(classes)}"
    )


# ---------------------------------------------------------------------------
# Tests — APP_DEV_MODE = False (production default)
# ---------------------------------------------------------------------------

async def test_dev_reset_returns_404_when_dev_mode_is_false(
    prod_client: AsyncClient,
) -> None:
    """POST /api/dev/reset must return 404 (route does not exist) when
    APP_DEV_MODE is False. It must NOT return 403 — the route must be absent,
    not forbidden."""
    response = await prod_client.post("/api/dev/reset")
    assert response.status_code == 404


async def test_dev_reset_route_absent_not_forbidden_in_prod(
    prod_client: AsyncClient,
) -> None:
    """Confirm the production guard is absence-of-route (404), not an auth
    rejection (403). This is the security contract specified in F2.6."""
    response = await prod_client.post("/api/dev/reset")
    # Must be 404 (not found), not 403 (forbidden) or 405 (method not allowed)
    assert response.status_code == 404, (
        f"Expected 404 (route absent) in prod mode, got {response.status_code}. "
        "The dev router must not be included when APP_DEV_MODE is False."
    )
