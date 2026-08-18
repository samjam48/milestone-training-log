"""B11.3 — Production Dockerfile and Render start command."""

from __future__ import annotations

import re
import subprocess

import pytest

from app.tests.compose_support import (
    COMPOSE_FILE,
    REPO_ROOT,
    get_list,
    get_mapping,
    load_compose_config,
    read_required_text,
)

BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_DOCKERFILE = BACKEND_DIR / "Dockerfile"
DEPLOY_DOC = REPO_ROOT / "docs" / "deploy.md"
README = REPO_ROOT / "README.md"


def _dockerfile_text() -> str:
    assert BACKEND_DOCKERFILE.is_file(), (
        f"Expected {BACKEND_DOCKERFILE.relative_to(REPO_ROOT)} for B11.3."
    )
    return BACKEND_DOCKERFILE.read_text(encoding="utf-8")


def _dockerfile_cmd_section(dockerfile_text: str) -> str:
    """Return Dockerfile CMD instruction text (may span exec-form brackets)."""
    lines = dockerfile_text.splitlines()
    cmd_start: int | None = None
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.upper().startswith("CMD "):
            cmd_start = index
            break
        if stripped.upper() == "CMD":
            cmd_start = index
            break
    assert cmd_start is not None, "backend/Dockerfile must define a CMD for B11.3."
    cmd_lines = [lines[cmd_start].strip()]
    if cmd_lines[0].endswith("["):
        for line in lines[cmd_start + 1 :]:
            cmd_lines.append(line.strip())
            if line.strip().endswith("]"):
                break
    return "\n".join(cmd_lines)


def _production_deploy_runbook_text() -> str:
    if DEPLOY_DOC.is_file():
        return DEPLOY_DOC.read_text(encoding="utf-8")

    readme_text = README.read_text(encoding="utf-8")
    section_pattern = re.compile(
        r"(?ms)^##\s+.*(?:production|deploy|render).*\n(.*?)(?=^##\s|\Z)",
        re.IGNORECASE,
    )
    match = section_pattern.search(readme_text)
    if match is not None:
        return match.group(0)

    raise AssertionError(
        "B11.3 requires docs/deploy.md or a README subsection covering Render deployment."
    )


@pytest.fixture
def dockerfile_text() -> str:
    return _dockerfile_text()


@pytest.fixture
def dockerfile_cmd(dockerfile_text: str) -> str:
    return _dockerfile_cmd_section(dockerfile_text)


def test_backend_dockerfile_production_cmd_starts_uvicorn_without_migrations(
    dockerfile_cmd: str,
) -> None:
    lowered = dockerfile_cmd.lower()
    assert "uvicorn app.main:app" in lowered, (
        "Production CMD must start uvicorn with app.main:app (B11.3)."
    )
    assert "alembic upgrade" not in lowered, (
        "Production CMD must not run Alembic migrations; production schema changes "
        "are an explicit operator step (PDH.B1)."
    )


def test_backend_dockerfile_production_cmd_binds_render_port(dockerfile_cmd: str) -> None:
    assert "${PORT:-8084}" in dockerfile_cmd, (
        "Production CMD must bind uvicorn to ${PORT:-8084} for Render PORT injection."
    )
    assert "--host 0.0.0.0" in dockerfile_cmd


def test_backend_dockerfile_production_cmd_has_no_reload(dockerfile_cmd: str) -> None:
    assert "--reload" not in dockerfile_cmd, (
        "Production image CMD must not pass --reload (dev-only; compose overrides for local)."
    )


def test_backend_dockerfile_cmd_does_not_chain_migrations_before_web_start(
    dockerfile_cmd: str,
) -> None:
    assert not re.search(
        r"alembic\s+upgrade\s+head\s*&&",
        dockerfile_cmd,
        flags=re.IGNORECASE,
    ), (
        "Production CMD must not chain `alembic upgrade head && uvicorn`; a failed "
        "web deploy must not mutate the production DB before Render promotes the image."
    )


def test_backend_dockerfile_includes_alembic_assets_for_explicit_migration_command(
    dockerfile_text: str,
) -> None:
    assert "alembic.ini" in dockerfile_text, (
        "backend/Dockerfile must COPY alembic.ini so an explicit migration command "
        "can run from the backend image."
    )
    assert re.search(r"COPY\s+alembic", dockerfile_text), (
        "backend/Dockerfile must COPY the alembic/ directory for explicit production migrations."
    )


def _docker_daemon_available() -> bool:
    result = subprocess.run(
        ["docker", "info"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.returncode == 0


def test_backend_dockerfile_builds_from_backend_directory() -> None:
    if not _docker_daemon_available():
        pytest.skip("Docker daemon is not available.")

    result = subprocess.run(
        ["docker", "build", "-f", "Dockerfile", "."],
        cwd=BACKEND_DIR,
        check=False,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert result.returncode == 0, (
        "docker build must succeed with backend/ as context (B11.3).\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )


def test_deploy_runbook_documents_render_dockerfile_path() -> None:
    deploy_runbook_text = _production_deploy_runbook_text()
    lowered = deploy_runbook_text.lower()
    assert "render" in lowered
    assert "dockerfile" in lowered or "backend/" in lowered, (
        "Deploy runbook must document Render root directory or Dockerfile path (backend/)."
    )


def test_deploy_runbook_documents_api_health_check() -> None:
    deploy_runbook_text = _production_deploy_runbook_text()
    assert "/api/health" in deploy_runbook_text, (
        "Deploy runbook must document Render health check path /api/health."
    )


def test_deploy_runbook_points_to_required_render_env_vars() -> None:
    deploy_runbook_text = _production_deploy_runbook_text()
    lowered = deploy_runbook_text.lower()
    for key in ("database_url", "session_secret", "auth_password"):
        assert key in lowered, (
            f"Deploy runbook must reference Render env var {key.upper()} "
            "(or point to O11.0/O11.1 wiring)."
        )
    assert "o11.0" in lowered or "o11.1" in lowered or "owner" in lowered, (
        "Deploy runbook should point operators to O11.0/O11.1 for secret setup."
    )


def test_docker_compose_dev_backend_command_still_uses_reload(
    root_env_file: None,
) -> None:
    """B11.3: local compose dev start must stay reload-based; production CMD is image-only."""
    compose_config = load_compose_config()
    services = get_mapping(compose_config["services"])
    backend_service = get_mapping(services["backend"])
    command = get_list(backend_service["command"])
    command_text = " ".join(str(part) for part in command).lower()

    assert "--reload" in command_text, (
        "docker-compose.yml backend command must still include --reload for local dev."
    )
    assert "alembic" not in command_text, (
        "docker-compose dev command must not run migrations implicitly."
    )


def test_docker_compose_file_unchanged_for_b11_3_dev_contract() -> None:
    compose_text = read_required_text(COMPOSE_FILE)
    assert "command:" in compose_text
    assert "--reload" in compose_text
    assert "${BACKEND_PORT:-8084}" in compose_text
    assert "alembic upgrade" not in compose_text.lower()
