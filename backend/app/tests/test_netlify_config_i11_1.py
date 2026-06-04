"""I11.1 — Netlify config and deploy template (file-content contract).

Asserts frontend/netlify.toml build, publish, /api proxy, and SPA fallback, plus
docs/deploy.md Netlify section. Production files are implemented in a separate ticket;
these tests fail until that work lands.
"""

from __future__ import annotations

import re

import pytest

from app.tests.test_compose_scaffold import REPO_ROOT

NETLIFY_TOML = REPO_ROOT / "frontend" / "netlify.toml"
DEPLOY_DOC = REPO_ROOT / "docs" / "deploy.md"


def _read_netlify_toml() -> str:
    assert NETLIFY_TOML.is_file(), (
        f"Expected {NETLIFY_TOML.relative_to(REPO_ROOT)} for I11.1."
    )
    return NETLIFY_TOML.read_text(encoding="utf-8")


def _read_deploy_doc() -> str:
    assert DEPLOY_DOC.is_file(), (
        f"Expected {DEPLOY_DOC.relative_to(REPO_ROOT)} for I11.1."
    )
    return DEPLOY_DOC.read_text(encoding="utf-8")


def _netlify_section(deploy_text: str) -> str:
    match = re.search(
        r"(?ms)^#{1,3}\s+Netlify\b.*?(?=^#{1,3}\s+\S|\Z)",
        deploy_text,
    )
    assert match is not None, (
        'docs/deploy.md must include a "Netlify" section heading (I11.1).'
    )
    return match.group(0)


@pytest.fixture
def netlify_toml_text() -> str:
    return _read_netlify_toml()


@pytest.fixture
def deploy_doc_text() -> str:
    return _read_deploy_doc()


def test_netlify_toml_declares_build_command(netlify_toml_text: str) -> None:
    assert re.search(
        r'command\s*=\s*["\']npm ci && npm run build["\']',
        netlify_toml_text,
    ), "netlify.toml [build] command must be `npm ci && npm run build` (I11.1)."


def test_netlify_toml_publishes_dist(netlify_toml_text: str) -> None:
    assert re.search(r'publish\s*=\s*["\']dist["\']', netlify_toml_text), (
        "netlify.toml [build] publish must be `dist` when base directory is frontend/."
    )


def test_netlify_toml_force_proxies_api_to_render_placeholder(
    netlify_toml_text: str,
) -> None:
    assert re.search(
        r'from\s*=\s*["\']/api/\*["\']',
        netlify_toml_text,
    ), "netlify.toml must declare a redirect from /api/*."
    assert "https://REPLACE_ME.onrender.com/api/:splat" in netlify_toml_text, (
        "netlify.toml /api proxy must target "
        "https://REPLACE_ME.onrender.com/api/:splat until O11.1 updates the host."
    )
    assert re.search(r"force\s*=\s*true", netlify_toml_text, flags=re.IGNORECASE), (
        "netlify.toml /api redirect must set force = true so Netlify proxies to Render."
    )


def test_netlify_toml_documents_placeholder_replacement_for_owner(
    netlify_toml_text: str,
) -> None:
    lowered = netlify_toml_text.lower()
    assert "replace" in lowered or "o11.1" in lowered, (
        "netlify.toml should comment that REPLACE_ME is updated after first Render deploy (O11.1)."
    )


def test_netlify_toml_spa_fallback_to_index_html(netlify_toml_text: str) -> None:
    assert re.search(r'from\s*=\s*["\']/\*["\']', netlify_toml_text), (
        "netlify.toml must declare SPA fallback redirect from /*."
    )
    assert re.search(
        r'to\s*=\s*["\']/index\.html["\']',
        netlify_toml_text,
    ), "netlify.toml SPA fallback must route /* to /index.html."


def test_deploy_doc_has_netlify_section_with_build_settings(
    deploy_doc_text: str,
) -> None:
    section = _netlify_section(deploy_doc_text)
    lowered = section.lower()
    assert "npm ci" in lowered or "npm run build" in lowered, (
        "Netlify section must document the build command (npm ci && npm run build)."
    )
    assert "dist" in lowered, (
        "Netlify section must document publish directory dist."
    )
    assert "base" in lowered or "frontend" in lowered, (
        "Netlify section should note site base directory (frontend)."
    )


def test_deploy_doc_netlify_section_covers_github_connect(
    deploy_doc_text: str,
) -> None:
    section = _netlify_section(deploy_doc_text)
    lowered = section.lower()
    assert "github" in lowered, (
        "Netlify section must describe connecting the GitHub repo to Netlify (I11.1)."
    )
    assert re.search(r"\bconnect\b|\bintegration\b|\brepository\b", lowered), (
        "Netlify section should include GitHub connect / integration steps."
    )
