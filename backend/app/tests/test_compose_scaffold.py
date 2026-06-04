from __future__ import annotations

from app.tests.compose_support import (
    BACKEND_DOCKERFILE,
    COMPOSE_FILE,
    GITIGNORE_FILE,
    REPO_ROOT,
    get_list,
    get_mapping,
    load_compose_config,
    read_required_text,
)


def test_compose_uses_repo_env_file_without_inline_app_settings() -> None:
    compose_text = read_required_text(COMPOSE_FILE)

    assert "env_file:" in compose_text
    assert ".env" in compose_text
    assert "DATABASE_URL=" not in compose_text
    assert "APP_VERSION=" not in compose_text


def test_compose_config_defines_backend_service_only(root_env_file: None) -> None:
    # Frontend runs locally via `npm run dev`; only backend is in compose.
    compose_config = load_compose_config()
    services = get_mapping(compose_config["services"])

    assert "backend" in services
    assert "frontend" not in services


def test_backend_service_matches_scaffold_contract(root_env_file: None) -> None:
    compose_config = load_compose_config()
    services = get_mapping(compose_config["services"])
    backend_service = get_mapping(services["backend"])
    build = get_mapping(backend_service["build"])

    assert str(build["context"]).endswith("/backend")
    assert build["dockerfile"] == "Dockerfile"

    published_ports = {
        (get_mapping(port)["target"], get_mapping(port)["published"])
        for port in get_list(backend_service["ports"])
    }
    assert (8084, "8084") in published_ports

    bind_targets = {
        get_mapping(volume)["target"]: get_mapping(volume)["type"]
        for volume in get_list(backend_service["volumes"])
    }
    assert bind_targets["/app/data"] == "bind"
    assert bind_targets["/app/app"] == "bind"

    assert "--reload" in get_list(backend_service["command"])
    assert backend_service["healthcheck"] == {
        "test": ["CMD", "curl", "-f", "http://localhost:8084/api/health"],
        "interval": "10s",
        "timeout": "5s",
        "retries": 5,
    }


def test_frontend_not_in_compose(root_env_file: None) -> None:
    # Frontend was intentionally removed from compose (runs locally via npm run dev).
    compose_text = read_required_text(COMPOSE_FILE)
    assert "frontend:" not in compose_text


def test_backend_dockerfile_matches_scaffold_contract() -> None:
    """Image layout contract; production CMD is asserted in test_production_dockerfile_b11_3."""
    dockerfile_text = read_required_text(BACKEND_DOCKERFILE)

    assert "FROM python:3.12-slim" in dockerfile_text
    assert "WORKDIR /app" in dockerfile_text
    assert "pyproject.toml" in dockerfile_text
    assert "pip install" in dockerfile_text
    assert "COPY app" in dockerfile_text
    assert "EXPOSE 8084" in dockerfile_text


def test_gitignore_ignores_local_database_artifacts() -> None:
    gitignore_text = read_required_text(GITIGNORE_FILE)

    assert ".env" in gitignore_text
    assert "data/" in gitignore_text
    assert "*.db" in gitignore_text
