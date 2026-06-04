"""Shared docker-compose test helpers and fixtures (not a test module)."""

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


def read_required_text(path: Path) -> str:
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


def load_compose_config() -> dict[str, object]:
    read_required_text(COMPOSE_FILE)
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return cast(dict[str, object], json.loads(result.stdout))


def get_mapping(value: object) -> dict[str, object]:
    assert isinstance(value, dict)
    return cast(dict[str, object], value)


def get_list(value: object) -> list[object]:
    assert isinstance(value, list)
    return cast(list[object], value)
