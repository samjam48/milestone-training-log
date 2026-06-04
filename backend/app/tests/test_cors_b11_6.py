"""B11.6 — Optional CORS from settings.

Asserts backend/app/main.py CORS behavior:
  - When CORS_ORIGINS is non-empty, register CORSMiddleware with allow_credentials=True
    and API-suitable methods/headers.
  - When unset or empty, do not register CORS middleware.
  - Comma-separated origins are trimmed (including trailing spaces per origin).

Deploy documentation in docs/deploy.md is covered by I11.2, not here.
"""

from __future__ import annotations

import importlib
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware


def _reload_settings_and_main() -> None:
    import app.main as main_module
    import app.settings as settings_module

    importlib.reload(settings_module)
    importlib.reload(main_module)


def _create_app(monkeypatch: pytest.MonkeyPatch, *, cors_origins: str | None) -> FastAPI:
    monkeypatch.setenv("APP_DEV_MODE", "true")
    monkeypatch.setenv("AUTH_PASSWORD", "")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    if cors_origins is not None:
        monkeypatch.setenv("CORS_ORIGINS", cors_origins)

    _reload_settings_and_main()
    import app.main as main_module

    return main_module.create_app()


def _cors_middleware_entry(app: FastAPI) -> Middleware | None:
    for entry in app.user_middleware:
        if getattr(entry.cls, "__name__", "") == CORSMiddleware.__name__:
            return entry
    return None


@pytest.fixture(autouse=True)
def _restore_app_modules() -> Iterator[None]:
    yield
    _reload_settings_and_main()


@pytest.mark.parametrize("cors_origins", [None, ""])
def test_no_cors_middleware_when_cors_origins_unset_or_empty(
    monkeypatch: pytest.MonkeyPatch,
    cors_origins: str | None,
) -> None:
    app = _create_app(monkeypatch, cors_origins=cors_origins)

    assert _cors_middleware_entry(app) is None, (
        "CORSMiddleware must not be registered when CORS_ORIGINS is unset or empty "
        "(Netlify proxy path unchanged)."
    )


def test_cors_middleware_registered_with_credentials_when_origins_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = _create_app(
        monkeypatch,
        cors_origins="https://app.example.com,https://api.example.com",
    )
    entry = _cors_middleware_entry(app)

    assert entry is not None, "CORSMiddleware must be registered when CORS_ORIGINS is set."
    kwargs = entry.kwargs
    assert kwargs.get("allow_credentials") is True
    assert kwargs.get("allow_origins") == [
        "https://app.example.com",
        "https://api.example.com",
    ]


def test_cors_middleware_trims_trailing_spaces_in_origin_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = _create_app(
        monkeypatch,
        cors_origins="https://app.example.com , https://api.example.com  ",
    )
    entry = _cors_middleware_entry(app)

    assert entry is not None
    assert entry.kwargs.get("allow_origins") == [
        "https://app.example.com",
        "https://api.example.com",
    ]


def test_cors_middleware_allows_api_methods_and_headers_when_origins_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = _create_app(monkeypatch, cors_origins="https://app.example.com")
    entry = _cors_middleware_entry(app)

    assert entry is not None
    methods = entry.kwargs.get("allow_methods")
    headers = entry.kwargs.get("allow_headers")
    assert methods, "CORSMiddleware must configure allow_methods for API use."
    assert headers, "CORSMiddleware must configure allow_headers for API use."

    if methods == ["*"]:
        return

    assert isinstance(methods, list)
    normalized_methods = {str(method).upper() for method in methods}
    assert "OPTIONS" in normalized_methods, "Preflight OPTIONS must be allowed for CORS API access."
    assert {"GET", "POST"}.issubset(normalized_methods), (
        "Common API verbs must be allowed when allow_methods is not wildcard."
    )
