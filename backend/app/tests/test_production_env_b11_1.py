"""B11.1 — Postgres driver and production env documentation."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
PYPROJECT_PATH = REPO_ROOT / "backend" / "pyproject.toml"
ENV_EXAMPLE_PATH = REPO_ROOT / ".env.example"


def _read_repo_text(path: Path) -> str:
    assert path.is_file(), f"Expected {path.relative_to(REPO_ROOT)} to exist for B11.1."
    return path.read_text(encoding="utf-8")


@pytest.fixture
def pyproject_text() -> str:
    return _read_repo_text(PYPROJECT_PATH)


@pytest.fixture
def env_example_text() -> str:
    return _read_repo_text(ENV_EXAMPLE_PATH)


def test_backend_pyproject_includes_psycopg_dependency(pyproject_text: str) -> None:
    assert re.search(r"psycopg(?:\[binary\])?", pyproject_text), (
        "backend/pyproject.toml must list psycopg (or psycopg[binary]) for Postgres production."
    )


def test_env_example_documents_postgresql_psycopg_database_url(env_example_text: str) -> None:
    assert re.search(
        r"DATABASE_URL\s*=\s*postgresql\+psycopg://",
        env_example_text,
        flags=re.IGNORECASE,
    ), ".env.example must show production DATABASE_URL=postgresql+psycopg://..."


def test_env_example_documents_supabase_only_local_sqlite_comment(
    env_example_text: str,
) -> None:
    lowered = env_example_text.lower()
    assert "supabase" in lowered, (
        ".env.example must mention Supabase for production DATABASE_URL."
    )
    assert "sqlite" in lowered, (
        ".env.example must note local dev uses sqlite for DATABASE_URL."
    )
    assert re.search(
        r"local\s+dev.*sqlite|sqlite.*local\s+dev",
        env_example_text,
        flags=re.IGNORECASE | re.DOTALL,
    ), (
        '.env.example should comment that Supabase/Postgres is production-only '
        'and local dev uses sqlite (per B11.1).'
    )


def test_env_example_documents_session_secret(env_example_text: str) -> None:
    assert re.search(r"^SESSION_SECRET\s*=", env_example_text, flags=re.MULTILINE), (
        ".env.example must document SESSION_SECRET."
    )


def test_env_example_documents_insecure_dev_session_secret(env_example_text: str) -> None:
    lowered = env_example_text.lower()
    assert "session_secret" in lowered
    assert "insecure" in lowered or "do not use in production" in lowered, (
        ".env.example must warn that the documented SESSION_SECRET dev default is insecure."
    )


def test_env_example_documents_auth_password(env_example_text: str) -> None:
    assert re.search(r"^AUTH_PASSWORD\s*=", env_example_text, flags=re.MULTILINE), (
        ".env.example must document AUTH_PASSWORD."
    )


def test_env_example_documents_session_max_age_days(env_example_text: str) -> None:
    assert re.search(r"^SESSION_MAX_AGE_DAYS\s*=", env_example_text, flags=re.MULTILINE), (
        ".env.example must document SESSION_MAX_AGE_DAYS."
    )


def test_env_example_documents_optional_cors_origins(env_example_text: str) -> None:
    assert re.search(r"^CORS_ORIGINS\s*=", env_example_text, flags=re.MULTILINE), (
        ".env.example must document CORS_ORIGINS."
    )
    cors_block = _line_block_for_key(env_example_text, "CORS_ORIGINS")
    assert re.search(r"optional", cors_block, flags=re.IGNORECASE), (
        ".env.example must mark CORS_ORIGINS as optional."
    )


def test_env_example_documents_database_url_password_url_encoding(
    env_example_text: str,
) -> None:
    assert re.search(r"url[- ]?encod", env_example_text, flags=re.IGNORECASE), (
        ".env.example must document URL-encoding for DATABASE_URL passwords "
        "with special characters."
    )


def test_env_example_documents_supabase_session_pooler_hint(env_example_text: str) -> None:
    lowered = env_example_text.lower()
    assert "pooler" in lowered, (
        ".env.example must mention Supabase connection pooler when direct host fails."
    )
    assert "session" in lowered or "6543" in env_example_text, (
        ".env.example should reference Session pooler (e.g. port 6543) per B11.1 edge case."
    )


def _line_block_for_key(text: str, key: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}\s*=.*(?:\n(?!#?\s*[A-Z_]+\s*=).*)*", re.MULTILINE)
    match = pattern.search(text)
    if match is None:
        return ""
    start = max(0, text.rfind("\n", 0, match.start()))
    end = text.find("\n\n", match.end())
    if end == -1:
        end = len(text)
    return text[start:end]
