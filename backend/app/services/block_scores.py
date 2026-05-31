"""Service for GET /api/training-blocks/{id}/scores (B3.0)."""

from __future__ import annotations

from datetime import date

from sqlmodel import Session

from app.models.block import TrainingBlock
from app.schemas.block_scores import BlockScoresRead
from app.schemas.dashboard import daily_safety_score_from_dict
from app.services.activity_logs import list_activity_logs
from app.services.daily_check_ins import list_daily_check_ins
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.load_engine import compute_daily_safety_scores, format_iso_date
from app.services.load_queries import check_in_dict, incident_dict, log_dict
from app.services.training_blocks import TrainingBlockNotFoundError


def get_block_scores(session: Session, block_id: str) -> BlockScoresRead:
    block = session.get(TrainingBlock, block_id)
    if block is None:
        raise TrainingBlockNotFoundError

    block_start: date = block.start_date
    block_end: date = block.end_date if block.end_date is not None else date.today()

    block_start_str = format_iso_date(block_start)
    block_end_str = format_iso_date(block_end)

    logs = list_activity_logs(session, start_date=block_start, end_date=block_end)
    check_ins = list_daily_check_ins(session, start_date=block_start, end_date=block_end)
    incidents = [
        incident
        for incident in list_flare_up_incidents(session)
        if block_start <= incident.incident_date <= block_end
    ]

    log_dicts = [log_dict(log) for log in logs]
    check_in_dicts = [check_in_dict(check_in) for check_in in check_ins]
    incident_dicts = [incident_dict(incident) for incident in incidents]

    raw_scores = compute_daily_safety_scores(
        block_start_str,
        block_end_str,
        log_dicts,
        check_in_dicts,
        incident_dicts,
    )

    # Filter out neutral days (no activity, no check-in, no incident)
    active_scores = [s for s in raw_scores if s["state"] != "neutral"]

    return BlockScoresRead(
        block_id=block_id,
        start_date=block_start_str,
        end_date=block_end_str,
        scores=[daily_safety_score_from_dict(dict(score)) for score in active_scores],
    )
