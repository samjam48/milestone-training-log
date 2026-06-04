"""Service for GET /api/training-blocks/{id}/review (B9.2)."""

from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.models.block import TrainingBlock
from app.schemas.block_review import BlockReviewRead
from app.schemas.dashboard import (
    daily_safety_score_from_dict,
    load_point_from_dict,
)
from app.schemas.training_blocks import TrainingBlockRead
from app.services.activities import list_activities
from app.services.activity_classes import list_activity_classes
from app.services.activity_logs import list_activity_logs
from app.services.daily_check_ins import list_daily_check_ins
from app.services.flare_up_incidents import list_flare_up_incidents
from app.services.load_engine import (
    compute_daily_safety_scores,
    compute_load_series,
    format_iso_date,
)
from app.services.load_queries import (
    activity_class_dict,
    activity_dict,
    check_in_dict,
    incident_dict,
    log_dict,
    resolve_graph_class_id,
    rule_dict,
)
from app.services.local_scope import LOCAL_USER_ID
from app.services.rules import list_rules
from app.services.training_blocks import TrainingBlockNotFoundError


def get_block_review(session: Session, block_id: str) -> BlockReviewRead:
    block = _get_local_training_block(session, block_id)
    block_start = block.start_date
    block_end = block.end_date if block.end_date is not None else date.today()

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
    active_scores = [score for score in raw_scores if score["state"] != "neutral"]

    activity_classes = list_activity_classes(session)
    activities = list_activities(session)
    rules = list_rules(session, block_id)

    class_dicts = [activity_class_dict(cls) for cls in activity_classes]
    activity_dicts = [activity_dict(activity) for activity in activities]
    rule_dicts = [rule_dict(rule) for rule in rules]
    graph_class_id = resolve_graph_class_id(rule_dicts, class_dicts)
    load_series = (
        compute_load_series(
            graph_class_id,
            activity_dicts,
            log_dicts,
            block_start_str,
            block_end_str,
        )
        if graph_class_id is not None
        else []
    )

    flare_up_dates = sorted({format_iso_date(incident.incident_date) for incident in incidents})
    day_count = (block_end - block_start).days + 1

    return BlockReviewRead(
        block=TrainingBlockRead.model_validate(block),
        daily_scores=[daily_safety_score_from_dict(dict(score)) for score in active_scores],
        load_series=[load_point_from_dict(dict(point)) for point in load_series],
        flare_up_dates=flare_up_dates,
        total_sessions=len(logs),
        clean_days=day_count - len(flare_up_dates),
    )


def _get_local_training_block(session: Session, block_id: str) -> TrainingBlock:
    statement = select(TrainingBlock).where(
        TrainingBlock.id == block_id,
        TrainingBlock.user_id == LOCAL_USER_ID,
    )
    block = session.exec(statement).first()
    if block is None:
        raise TrainingBlockNotFoundError
    return block
