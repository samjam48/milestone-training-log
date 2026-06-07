"""WTL.B7 — test fixtures and guards for weekly focus lifecycle tests."""

from __future__ import annotations

import importlib
from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from fastapi import FastAPI
from sqlmodel import Session

from sqlmodel import select

from app.models.block import TrainingBlock
from app.tests.helpers.seed import seed_training_block, utc_datetime, with_session

training_blocks_service = importlib.import_module("app.services.training_blocks")

WTL_B7_TRAINING_BLOCK_FIELDS = frozenset(
    {
        "period_kind",
        "focus_series_id",
        "focus_title",
        "week_number",
    }
)

WTL_B7_SERVICE_SYMBOLS = (
    "calendar_week_bounds",
    "ensure_active_weekly_focus",
    "rollover_weekly_focus",
)

WRU_B1_REMOVED_SERVICE_SYMBOLS = (
    "reset_focus_series",
    "setup_weekly_focus",
    "update_focus_title",
    "_try_legacy_cutover",
)

# Calendar anchors from technical design (Monday = 0).
SUNDAY_AS_OF = date(2026, 6, 7)
MONDAY_AS_OF = date(2026, 6, 8)
WEEK_ONE_START = date(2026, 6, 1)
WEEK_ONE_END = date(2026, 6, 7)
WEEK_TWO_START = date(2026, 6, 8)
WEEK_TWO_END = date(2026, 6, 14)
WEEK_FIVE_START = date(2026, 6, 29)
WEEK_FIVE_END = date(2026, 7, 5)


def require_wtl_b7_training_block_schema() -> None:
    model_fields = set(TrainingBlock.model_fields)
    missing = WTL_B7_TRAINING_BLOCK_FIELDS - model_fields
    if missing:
        pytest.fail(
            "WTL.B7 schema not migrated: TrainingBlock missing "
            f"{sorted(missing)}"
        )


def require_weekly_focus_service() -> Any:
    missing = [
        symbol
        for symbol in WTL_B7_SERVICE_SYMBOLS
        if not hasattr(training_blocks_service, symbol)
    ]
    if missing:
        pytest.fail(
            "WTL.B7 weekly focus service not implemented: missing "
            f"{', '.join(missing)}"
        )
    return training_blocks_service


def calendar_week_bounds(as_of: date) -> tuple[date, date]:
    service = require_weekly_focus_service()
    return service.calendar_week_bounds(as_of)


def seed_legacy_active_block(
    app_with_test_database: FastAPI,
    *,
    block_id: str = "blk-legacy-active",
    name: str = "Return to walking",
    start_date: date = date(2026, 4, 7),
) -> None:
    require_wtl_b7_training_block_schema()
    seed_training_block(
        app_with_test_database,
        block_id=block_id,
        name=name,
        start_date=start_date,
        status="active",
    )
    for session in with_session(app_with_test_database):
        block = session.get(TrainingBlock, block_id)
        assert block is not None
        block.period_kind = "legacy"
        session.add(block)
        session.commit()


def seed_weekly_focus_block(
    app_with_test_database: FastAPI,
    *,
    block_id: str,
    focus_series_id: str,
    focus_title: str | None,
    week_number: int,
    start_date: date,
    end_date: date | None,
    status: str,
) -> None:
    require_wtl_b7_training_block_schema()
    service = require_weekly_focus_service()
    if end_date is not None:
        block_name = service.calendar_week_label(start_date, end_date)
    elif focus_title is not None:
        block_name = f"{focus_title} · Week {week_number}"
    else:
        block_name = f"Week {week_number}"
    for session in with_session(app_with_test_database):
        existing = session.exec(
            select(TrainingBlock).where(TrainingBlock.id == block_id)
        ).first()
        if existing is not None:
            pytest.fail(f"weekly focus seed block {block_id} already exists")

        session.add(
            TrainingBlock(
                id=block_id,
                user_id="local",
                name=block_name,
                start_date=start_date,
                end_date=end_date,
                status=status,
                period_kind="weekly_focus",
                focus_series_id=focus_series_id,
                focus_title=focus_title,
                week_number=week_number,
                related_goal_id=None,
                notes=None,
                is_review_milestone_hit=False,
                created_at=utc_datetime(8),
                updated_at=utc_datetime(8),
            )
        )
        session.commit()


@pytest.fixture
def weekly_focus_service() -> Any:
    return require_weekly_focus_service()


@pytest.fixture
def weekly_focus_session(
    app_with_test_database: FastAPI,
) -> Iterator[Session]:
    require_wtl_b7_training_block_schema()
    for session in with_session(app_with_test_database):
        yield session
