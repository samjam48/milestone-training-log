from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from app.database import get_session
from app.schemas.rules import RuleCreate, RulePatch, RuleRead
from app.services.rules import (
    ActivityClassNotFoundError,
    RuleAlreadyExistsError,
    RuleNotFoundError,
    TrainingBlockNotFoundError,
    create_rule,
    delete_rule,
    list_rules,
    update_rule,
)

training_block_rules_router = APIRouter(prefix="/api/training-blocks", tags=["rules"])
rules_router = APIRouter(prefix="/api/rules", tags=["rules"])

SessionDep = Annotated[Session, Depends(get_session)]


@training_block_rules_router.get("/{block_id}/rules", response_model=list[RuleRead])
async def get_rules(block_id: str, session: SessionDep) -> list[RuleRead]:
    try:
        rules = list_rules(session, block_id)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    return [RuleRead.model_validate(rule) for rule in rules]


@training_block_rules_router.post(
    "/{block_id}/rules",
    response_model=RuleRead,
    status_code=status.HTTP_201_CREATED,
)
async def post_rule(
    block_id: str,
    payload: RuleCreate,
    session: SessionDep,
) -> RuleRead:
    try:
        rule = create_rule(session, block_id, payload)
    except TrainingBlockNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training block not found",
        ) from exc
    except RuleAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rule already exists",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return RuleRead.model_validate(rule)


@rules_router.patch("/{rule_id}", response_model=RuleRead)
async def patch_rule(
    rule_id: str,
    payload: RulePatch,
    session: SessionDep,
) -> RuleRead:
    try:
        rule = update_rule(session, rule_id, payload)
    except RuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        ) from exc
    except ActivityClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity class not found",
        ) from exc
    return RuleRead.model_validate(rule)


@rules_router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_route(rule_id: str, session: SessionDep) -> Response:
    try:
        delete_rule(session, rule_id)
    except RuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
