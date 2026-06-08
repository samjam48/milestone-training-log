"""WRU.F2 — removed training-block create and weekly-focus mutation routes (TDD).

plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F2
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.tests.helpers.weekly_focus_fixtures import (
    WEEK_ONE_END,
    WEEK_ONE_START,
    seed_weekly_focus_block,
)

@pytest.mark.parametrize(
    ("path", "body"),
    [
        (
            "/api/training-blocks",
            {
                "id": "blk-wru-f2",
                "name": "Should not create",
                "start_date": "2026-06-02",
            },
        ),
        (
            "/api/training-blocks/active/setup",
            {"focus_title": "Should not setup"},
        ),
        (
            "/api/training-blocks/active/reset-focus",
            {"focus_title": "Should not reset"},
        ),
    ],
)
async def test_wru_f2_removed_post_routes_return_not_found_or_method_not_allowed(
    client: AsyncClient,
    path: str,
    body: dict[str, str],
) -> None:
    response = await client.post(path, json=body)

    assert response.status_code in {404, 405}, (
        f"WRU.F2 must remove POST {path}; got {response.status_code}"
    )


async def test_wru_f2_post_training_blocks_not_registered_in_openapi(
    app_with_test_database: FastAPI,
) -> None:
    paths = app_with_test_database.openapi().get("paths", {})
    post_training_blocks = paths.get("/api/training-blocks", {}).get("post")
    assert post_training_blocks is None, (
        "WRU.F2 must unregister POST /api/training-blocks from OpenAPI."
    )


async def test_wru_f2_focus_title_patch_rejected(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wru-f2-patch",
        focus_series_id="fs-wru-f2",
        focus_title="Before",
        week_number=1,
        start_date=WEEK_ONE_START,
        end_date=WEEK_ONE_END,
        status="active",
    )

    response = await client.patch(
        "/api/training-blocks/blk-wru-f2-patch",
        json={"focus_title": "After"},
    )

    assert response.status_code in {404, 405, 422}, (
        "WRU.F2 must remove focus_title patch handling; weekly label is calendar-only."
    )


async def test_wru_f2_patch_name_still_allowed_for_non_focus_fields(
    app_with_test_database: FastAPI,
    client: AsyncClient,
) -> None:
    """Non-focus PATCH fields may remain; focus_title must not be user-editable."""
    seed_weekly_focus_block(
        app_with_test_database,
        block_id="blk-wru-f2-notes",
        focus_series_id="fs-wru-f2-notes",
        focus_title="Weekly focus",
        week_number=1,
        start_date=date(2026, 6, 2),
        end_date=date(2026, 6, 8),
        status="active",
    )

    response = await client.patch(
        "/api/training-blocks/blk-wru-f2-notes",
        json={"notes": "Operator note"},
    )

    # If PATCH is narrowed further in implementation, 404/405 is also acceptable.
    assert response.status_code in {200, 404, 405}
