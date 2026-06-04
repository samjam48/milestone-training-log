from __future__ import annotations

import importlib
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401
from app.database import get_session

# B11.5 — auth API test overrides (see app_with_auth_settings fixture).
TEST_AUTH_PASSWORD = "test-auth-password-b115"
TEST_SESSION_SECRET = "test-session-secret-b115-32chars!!"


@pytest.fixture
def app_with_test_database(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """In-memory SQLite app with auth disabled for existing API route tests."""
    monkeypatch.setenv("AUTH_PASSWORD", "")
    monkeypatch.setenv("APP_DEV_MODE", "true")

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    app = _create_app_with_test_db(engine)
    yield app
    app.dependency_overrides.clear()
    _reload_app_modules()


@pytest.fixture
async def client(app_with_test_database: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app_with_test_database)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def _reload_app_modules() -> None:
    """Reload settings and main so create_app() picks up patched env vars."""
    import app.main as main_module
    import app.settings as settings_module

    importlib.reload(settings_module)
    importlib.reload(main_module)


def _create_app_with_test_db(engine: object) -> FastAPI:
    _reload_app_modules()
    import app.main as main_module

    app = main_module.create_app()

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as session:  # type: ignore[arg-type]
            yield session

    app.dependency_overrides[get_session] = override_get_session
    return app


@pytest.fixture
def app_with_auth_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    """FastAPI app with AUTH_PASSWORD and SESSION_SECRET set for B11.5 auth tests."""
    monkeypatch.setenv("AUTH_PASSWORD", TEST_AUTH_PASSWORD)
    monkeypatch.setenv("SESSION_SECRET", TEST_SESSION_SECRET)
    monkeypatch.setenv("APP_DEV_MODE", "false")

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    app = _create_app_with_test_db(engine)
    yield app
    app.dependency_overrides.clear()
    _reload_app_modules()


@pytest.fixture
async def auth_client(app_with_auth_settings: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app_with_auth_settings)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
