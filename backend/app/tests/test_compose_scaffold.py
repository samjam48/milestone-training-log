from __future__ import annotations

import json
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import cast

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
COMPOSE_FILE = REPO_ROOT / "docker-compose.yml"
BACKEND_DOCKERFILE = REPO_ROOT / "backend" / "Dockerfile"
GITIGNORE_FILE = REPO_ROOT / ".gitignore"


def _read_required_text(path: Path) -> str:
    assert path.exists(), f"Expected {path.relative_to(REPO_ROOT)} to exist for B0.2."
    return path.read_text(encoding="utf-8")


@pytest.fixture
def root_env_file() -> Iterator[None]:
    env_path = REPO_ROOT / ".env"
    original_contents = env_path.read_text(encoding="utf-8") if env_path.exists() else None
    env_path.write_text(
        "DATABASE_URL=sqlite:///./data/milestone.db\n"
        "APP_VERSION=0.1.0\n"
        "BACKEND_PORT=8084\n"
        "FRONTEND_PORT=5151\n",
        encoding="utf-8",
    )

    try:
        yield
    finally:
        if original_contents is None:
            env_path.unlink(missing_ok=True)
        else:
            env_path.write_text(original_contents, encoding="utf-8")


def _load_compose_config() -> dict[str, object]:
    _read_required_text(COMPOSE_FILE)
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return cast(dict[str, object], json.loads(result.stdout))


def _get_mapping(value: object) -> dict[str, object]:
    assert isinstance(value, dict)
    return cast(dict[str, object], value)


def _get_list(value: object) -> list[object]:
    assert isinstance(value, list)
    return cast(list[object], value)


def test_compose_uses_repo_env_file_without_inline_app_settings() -> None:
    compose_text = _read_required_text(COMPOSE_FILE)

    assert "env_file:" in compose_text
    assert ".env" in compose_text
    assert "DATABASE_URL=" not in compose_text
    assert "APP_VERSION=" not in compose_text


def test_compose_config_defines_backend_service_only(root_env_file: None) -> None:
    # Frontend runs locally via `npm run dev`; only backend is in compose.
    compose_config = _load_compose_config()
    services = _get_mapping(compose_config["services"])

    assert "backend" in services
    assert "frontend" not in services


def test_backend_service_matches_scaffold_contract(root_env_file: None) -> None:
    compose_config = _load_compose_config()
    services = _get_mapping(compose_config["services"])
    backend_service = _get_mapping(services["backend"])
    build = _get_mapping(backend_service["build"])

    assert str(build["context"]).endswith("/backend")
    assert build["dockerfile"] == "Dockerfile"

    published_ports = {
        (_get_mapping(port)["target"], _get_mapping(port)["published"])
        for port in _get_list(backend_service["ports"])
    }
    assert (8084, "8084") in published_ports

    bind_targets = {
        _get_mapping(volume)["target"]: _get_mapping(volume)["type"]
        for volume in _get_list(backend_service["volumes"])
    }
    assert bind_targets["/app/data"] == "bind"
    assert bind_targets["/app/app"] == "bind"

    assert "--reload" in _get_list(backend_service["command"])
    assert backend_service["healthcheck"] == {
        "test": ["CMD", "curl", "-f", "http://localhost:8084/api/health"],
        "interval": "10s",
        "timeout": "5s",
        "retries": 5,
    }


def test_frontend_not_in_compose(root_env_file: None) -> None:
    # Frontend was intentionally removed from compose (runs locally via npm run dev).
    compose_text = _read_required_text(COMPOSE_FILE)
    assert "frontend:" not in compose_text


def test_backend_dockerfile_matches_scaffold_contract() -> None:
    dockerfile_text = _read_required_text(BACKEND_DOCKERFILE)

    assert "FROM python:3.12-slim" in dockerfile_text
    assert "WORKDIR /app" in dockerfile_text
    assert "pyproject.toml" in dockerfile_text
    assert "pip install" in dockerfile_text
    assert "COPY app" in dockerfile_text
    assert "EXPOSE 8084" in dockerfile_text
    assert "uvicorn app.main:app --host 0.0.0.0 --port 8084 --reload" in dockerfile_text


def test_gitignore_ignores_local_database_artifacts() -> None:
    gitignore_text = _read_required_text(GITIGNORE_FILE)

    assert ".env" in gitignore_text
    assert "data/" in gitignore_text
    assert "*.db" in gitignore_text
