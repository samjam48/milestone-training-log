"""Ephemeral Postgres helpers for B11.2 migration verification tests."""

from __future__ import annotations

import importlib.util
import os
import socket
import subprocess
import time
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

POSTGRES_TEST_URL_ENV = "POSTGRES_TEST_URL"
RUN_POSTGRES_TESTS_ENV = "RUN_POSTGRES_TESTS"
POSTGRES_IMAGE = "postgres:16-alpine"
POSTGRES_READY_TIMEOUT_SECONDS = 30


def postgres_tests_requested() -> bool:
    return (
        os.environ.get(POSTGRES_TEST_URL_ENV) is not None
        or os.environ.get(RUN_POSTGRES_TESTS_ENV) == "1"
    )


def _require_psycopg_driver() -> None:
    if importlib.util.find_spec("psycopg") is None:
        raise RuntimeError(
            "Postgres migration tests require psycopg (see B11.1 backend dependencies)."
        )


def resolve_postgres_database_url() -> str | None:
    explicit_url = os.environ.get(POSTGRES_TEST_URL_ENV)
    if explicit_url:
        _require_psycopg_driver()
        return explicit_url

    if os.environ.get(RUN_POSTGRES_TESTS_ENV) != "1":
        return None

    _require_psycopg_driver()
    return _start_ephemeral_postgres_docker()


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_postgres(database_url: str) -> None:
    deadline = time.monotonic() + POSTGRES_READY_TIMEOUT_SECONDS
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            engine = create_engine(database_url)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            engine.dispose()
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(0.5)

    message = f"Postgres did not become ready within {POSTGRES_READY_TIMEOUT_SECONDS}s."
    if last_error is not None:
        raise RuntimeError(message) from last_error
    raise RuntimeError(message)


def _start_ephemeral_postgres_docker() -> str:
    docker_path = _require_docker_cli()
    port = _pick_free_port()
    run_result = subprocess.run(
        [
            docker_path,
            "run",
            "-d",
            "--rm",
            "-e",
            "POSTGRES_PASSWORD=pytest",
            "-e",
            "POSTGRES_DB=milestone_migration_test",
            "-p",
            f"127.0.0.1:{port}:5432",
            POSTGRES_IMAGE,
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if run_result.returncode != 0:
        raise RuntimeError(run_result.stderr or run_result.stdout)

    container_id = run_result.stdout.strip()
    database_url = (
        f"postgresql+psycopg://postgres:pytest@127.0.0.1:{port}/milestone_migration_test"
    )

    try:
        _wait_for_postgres(database_url)
    except Exception:
        subprocess.run(
            [docker_path, "stop", container_id],
            check=False,
            capture_output=True,
            text=True,
        )
        raise

    os.environ["_MILESTONE_POSTGRES_CONTAINER_ID"] = container_id
    return database_url


def _require_docker_cli() -> str:
    docker_path = subprocess.run(
        ["sh", "-c", "command -v docker"],
        check=False,
        capture_output=True,
        text=True,
    )
    if docker_path.returncode != 0 or not docker_path.stdout.strip():
        raise RuntimeError("Docker CLI is required when RUN_POSTGRES_TESTS=1.")
    return docker_path.stdout.strip()


def stop_ephemeral_postgres_container() -> None:
    container_id = os.environ.pop("_MILESTONE_POSTGRES_CONTAINER_ID", None)
    if not container_id:
        return

    subprocess.run(
        ["docker", "stop", container_id],
        check=False,
        capture_output=True,
        text=True,
    )


@contextmanager
def postgres_engine(database_url: str) -> Iterator[Engine]:
    engine = create_engine(database_url)
    try:
        yield engine
    finally:
        engine.dispose()
