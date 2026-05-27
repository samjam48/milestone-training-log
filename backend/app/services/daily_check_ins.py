from datetime import UTC, date, datetime

from sqlmodel import Session, col, select

from app.models.activity import ActivityClass
from app.models.checkin import DailyCheckIn, FlareUpIncident
from app.schemas.daily_check_ins import (
    DailyCheckInCreate,
    DailyCheckInPatch,
    FlareUpForCheckInPatch,
    FlareUpForCheckInRead,
)
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class DailyCheckInAlreadyExistsError(Exception):
    pass


class DailyCheckInNotFoundError(Exception):
    pass


class FlareUpIncidentAlreadyExistsError(Exception):
    pass


class FlareUpDetailsRequiredError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


def list_daily_check_ins(
    session: Session,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[DailyCheckIn]:
    statement = select(DailyCheckIn).where(DailyCheckIn.user_id == LOCAL_USER_ID)
    if start_date is not None:
        statement = statement.where(DailyCheckIn.check_in_date >= start_date)
    if end_date is not None:
        statement = statement.where(DailyCheckIn.check_in_date <= end_date)
    statement = statement.order_by(col(DailyCheckIn.check_in_date).desc(), DailyCheckIn.id)
    return list(session.exec(statement).all())


def get_daily_check_in_by_date(session: Session, check_in_date: date) -> DailyCheckIn:
    return _get_local_check_in_by_date(session, check_in_date)


def upsert_daily_check_in(
    session: Session,
    payload: DailyCheckInCreate,
) -> tuple[DailyCheckIn, bool]:
    existing_check_in = _find_local_check_in_by_date(session, payload.check_in_date)
    if existing_check_in is not None:
        return _update_existing_check_in_for_upsert(session, existing_check_in, payload), False

    duplicate = session.get(DailyCheckIn, payload.id)
    if duplicate is not None:
        raise DailyCheckInAlreadyExistsError

    now = datetime.now(UTC)
    check_in = DailyCheckIn(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        check_in_date=payload.check_in_date,
        pain_level=payload.pain_level,
        readiness_level=payload.readiness_level,
        stiffness_level=payload.stiffness_level,
        has_flare_up=payload.has_flare_up,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    session.add(check_in)
    session.flush()
    _sync_linked_flare_up_from_create(session, check_in, payload, now)
    session.commit()
    session.refresh(check_in)
    return check_in, True


def update_daily_check_in(
    session: Session,
    check_in_date: date,
    payload: DailyCheckInPatch,
) -> DailyCheckIn:
    check_in = _get_local_check_in_by_date(session, check_in_date)
    updates = payload.model_dump(exclude_unset=True)
    check_in_fields = {
        "pain_level",
        "readiness_level",
        "stiffness_level",
        "has_flare_up",
        "notes",
    }

    for field_name in check_in_fields & updates.keys():
        setattr(check_in, field_name, updates[field_name])

    if "flare_up" in updates and updates["flare_up"] is not None:
        check_in.has_flare_up = True
        _sync_linked_flare_up_from_patch(session, check_in, payload.flare_up)
    elif updates.get("has_flare_up") is False:
        _delete_linked_flare_ups(session, check_in)
    elif (
        updates.get("has_flare_up") is True
        and _get_first_linked_flare_up(session, check_in) is None
    ):
        raise FlareUpDetailsRequiredError

    if updates:
        check_in.updated_at = next_updated_at(check_in.updated_at)

    session.add(check_in)
    session.commit()
    session.refresh(check_in)
    return check_in


def build_daily_check_in_read_payload(
    check_in: DailyCheckIn,
    session: Session,
) -> dict[str, object]:
    linked_flare_up = _get_first_linked_flare_up(session, check_in)
    flare_up = None
    if check_in.has_flare_up and linked_flare_up is not None:
        flare_up = FlareUpForCheckInRead(
            id=linked_flare_up.id,
            incident_date=linked_flare_up.incident_date,
            body_part=linked_flare_up.body_part,
            severity=linked_flare_up.severity,
            activity_class_id=linked_flare_up.activity_class_id,
            daily_check_in_id=check_in.id,
            notes=linked_flare_up.notes,
        )

    return {
        "id": check_in.id,
        "check_in_date": check_in.check_in_date,
        "pain_level": check_in.pain_level,
        "readiness_level": check_in.readiness_level,
        "stiffness_level": check_in.stiffness_level,
        "has_flare_up": check_in.has_flare_up,
        "notes": check_in.notes,
        "created_at": check_in.created_at,
        "updated_at": check_in.updated_at,
        "flare_up": flare_up,
    }


def _update_existing_check_in_for_upsert(
    session: Session,
    check_in: DailyCheckIn,
    payload: DailyCheckInCreate,
) -> DailyCheckIn:
    check_in.pain_level = payload.pain_level
    check_in.readiness_level = payload.readiness_level
    check_in.stiffness_level = payload.stiffness_level
    check_in.has_flare_up = payload.has_flare_up
    check_in.notes = payload.notes
    check_in.updated_at = next_updated_at(check_in.updated_at)
    _sync_linked_flare_up_from_create(session, check_in, payload, check_in.updated_at)
    session.add(check_in)
    session.commit()
    session.refresh(check_in)
    return check_in


def _sync_linked_flare_up_from_create(
    session: Session,
    check_in: DailyCheckIn,
    payload: DailyCheckInCreate,
    timestamp: datetime,
) -> None:
    if not payload.has_flare_up:
        _delete_linked_flare_ups(session, check_in)
        return
    if payload.flare_up is None:
        raise FlareUpDetailsRequiredError

    if payload.flare_up.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.flare_up.activity_class_id)

    linked_flare_up = _get_first_linked_flare_up(session, check_in)
    if linked_flare_up is None:
        existing_incident = session.get(FlareUpIncident, payload.flare_up.id)
        if existing_incident is not None:
            raise FlareUpIncidentAlreadyExistsError
        linked_flare_up = FlareUpIncident(
            id=payload.flare_up.id,
            user_id=LOCAL_USER_ID,
            incident_date=check_in.check_in_date,
            body_part=payload.flare_up.body_part,
            severity=payload.flare_up.severity,
            activity_class_id=payload.flare_up.activity_class_id,
            daily_check_in_id=check_in.id,
            notes=payload.flare_up.notes,
            created_at=timestamp,
            updated_at=timestamp,
        )
    else:
        linked_flare_up.incident_date = check_in.check_in_date
        linked_flare_up.body_part = payload.flare_up.body_part
        linked_flare_up.severity = payload.flare_up.severity
        linked_flare_up.activity_class_id = payload.flare_up.activity_class_id
        linked_flare_up.notes = payload.flare_up.notes
        linked_flare_up.updated_at = timestamp

    session.add(linked_flare_up)


def _sync_linked_flare_up_from_patch(
    session: Session,
    check_in: DailyCheckIn,
    payload: FlareUpForCheckInPatch | None,
) -> None:
    if payload is None:
        return

    updates = payload.model_dump(exclude_unset=True)
    linked_flare_up = _get_first_linked_flare_up(session, check_in)
    if linked_flare_up is None:
        body_part = payload.body_part
        severity = payload.severity
        if payload.id is None or body_part is None or severity is None:
            raise FlareUpDetailsRequiredError
        if payload.activity_class_id is not None:
            _ensure_local_activity_class_exists(session, payload.activity_class_id)
        existing_incident = session.get(FlareUpIncident, payload.id)
        if existing_incident is not None:
            raise FlareUpIncidentAlreadyExistsError
        now = datetime.now(UTC)
        linked_flare_up = FlareUpIncident(
            id=payload.id,
            user_id=LOCAL_USER_ID,
            incident_date=check_in.check_in_date,
            body_part=body_part,
            severity=severity,
            activity_class_id=payload.activity_class_id,
            daily_check_in_id=check_in.id,
            notes=payload.notes,
            created_at=now,
            updated_at=now,
        )
    else:
        if payload.activity_class_id is not None:
            _ensure_local_activity_class_exists(session, payload.activity_class_id)
        for field_name, value in updates.items():
            if field_name != "id":
                setattr(linked_flare_up, field_name, value)
        linked_flare_up.incident_date = check_in.check_in_date
        linked_flare_up.updated_at = next_updated_at(linked_flare_up.updated_at)

    session.add(linked_flare_up)


def _ensure_local_activity_class_exists(session: Session, activity_class_id: str) -> None:
    statement = select(ActivityClass).where(
        ActivityClass.id == activity_class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError


def _find_local_check_in_by_date(session: Session, check_in_date: date) -> DailyCheckIn | None:
    statement = select(DailyCheckIn).where(
        DailyCheckIn.user_id == LOCAL_USER_ID,
        DailyCheckIn.check_in_date == check_in_date,
    )
    return session.exec(statement).first()


def _get_local_check_in_by_date(session: Session, check_in_date: date) -> DailyCheckIn:
    check_in = _find_local_check_in_by_date(session, check_in_date)
    if check_in is None:
        raise DailyCheckInNotFoundError
    return check_in


def _get_first_linked_flare_up(
    session: Session,
    check_in: DailyCheckIn,
) -> FlareUpIncident | None:
    statement = (
        select(FlareUpIncident)
        .where(
            FlareUpIncident.user_id == LOCAL_USER_ID,
            FlareUpIncident.daily_check_in_id == check_in.id,
        )
        .order_by(col(FlareUpIncident.created_at).asc(), FlareUpIncident.id)
    )
    return session.exec(statement).first()


def _delete_linked_flare_ups(session: Session, check_in: DailyCheckIn) -> None:
    statement = select(FlareUpIncident).where(
        FlareUpIncident.user_id == LOCAL_USER_ID,
        FlareUpIncident.daily_check_in_id == check_in.id,
    )
    for flare_up in session.exec(statement).all():
        session.delete(flare_up)


