"""Shared helpers for load and dashboard API integration tests."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.tests.helpers.load_engine_fixtures import AS_OF

FROZEN_TODAY = date.fromisoformat(AS_OF)


def freeze_server_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.load_queries._server_local_today",
        lambda: FROZEN_TODAY,
    )


def foot_status(payload: dict[str, Any]) -> dict[str, Any]:
    return next(
        status for status in payload["class_statuses"] if status["activity_class_id"] == "cls-foot"
    )
