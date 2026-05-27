"""Shared local-first scope constants and timestamp helpers for services."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Final, Literal

LOCAL_USER_ID: Final[Literal["local"]] = "local"


def next_updated_at(previous_updated_at: datetime) -> datetime:
    previous = previous_updated_at
    if previous.tzinfo is None:
        previous = previous.replace(tzinfo=UTC)

    now = datetime.now(UTC)
    if now <= previous:
        return previous + timedelta(microseconds=1)
    return now
