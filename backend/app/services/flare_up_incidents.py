from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models.activity import ActivityClass
from app.models.checkin import DailyCheckIn, FlareUpIncident
from app.schemas.flare_up_incidents import FlareUpIncidentCreate, FlareUpIncidentPatch
from app.services.local_scope import LOCAL_USER_ID, next_updated_at


class FlareUpIncidentAlreadyExistsError(Exception):
    pass


class FlareUpIncidentNotFoundError(Exception):
    pass


class ActivityClassNotFoundError(Exception):
    pass


class DailyCheckInNotFoundError(Exception):
    pass


def list_flare_up_incidents(session: Session) -> list[FlareUpIncident]:
    statement = (
        select(FlareUpIncident)
        .where(FlareUpIncident.user_id == LOCAL_USER_ID)
        .order_by(
            col(FlareUpIncident.incident_date).desc(),
            col(FlareUpIncident.created_at).desc(),
            FlareUpIncident.id,
        )
    )
    return list(session.exec(statement).all())


def create_flare_up_incident(
    session: Session,
    payload: FlareUpIncidentCreate,
) -> FlareUpIncident:
    existing_incident = session.get(FlareUpIncident, payload.id)
    if existing_incident is not None:
        raise FlareUpIncidentAlreadyExistsError

    if payload.activity_class_id is not None:
        _ensure_local_activity_class_exists(session, payload.activity_class_id)
    if payload.daily_check_in_id is not None:
        _ensure_local_daily_check_in_exists(session, payload.daily_check_in_id)

    now = datetime.now(UTC)
    incident = FlareUpIncident(
        id=payload.id,
        user_id=LOCAL_USER_ID,
        incident_date=payload.incident_date,
        body_part=payload.body_part,
        severity=payload.severity,
        activity_class_id=payload.activity_class_id,
        daily_check_in_id=payload.daily_check_in_id,
        notes=payload.notes,
        created_at=now,
        updated_at=now,
    )
    session.add(incident)
    session.commit()
    session.refresh(incident)
    return incident


def update_flare_up_incident(
    session: Session,
    incident_id: str,
    payload: FlareUpIncidentPatch,
) -> FlareUpIncident:
    incident = _get_local_flare_up_incident(session, incident_id)
    updates = payload.model_dump(exclude_unset=True)

    if (
        "activity_class_id" in updates
        and updates["activity_class_id"] is not None
    ):
        _ensure_local_activity_class_exists(session, str(updates["activity_class_id"]))
    if (
        "daily_check_in_id" in updates
        and updates["daily_check_in_id"] is not None
    ):
        _ensure_local_daily_check_in_exists(session, str(updates["daily_check_in_id"]))

    for field_name, value in updates.items():
        setattr(incident, field_name, value)

    if updates:
        incident.updated_at = next_updated_at(incident.updated_at)

    session.add(incident)
    session.commit()
    session.refresh(incident)
    return incident


def _ensure_local_activity_class_exists(session: Session, activity_class_id: str) -> None:
    statement = select(ActivityClass).where(
        ActivityClass.id == activity_class_id,
        ActivityClass.user_id == LOCAL_USER_ID,
    )
    activity_class = session.exec(statement).first()
    if activity_class is None:
        raise ActivityClassNotFoundError


def _ensure_local_daily_check_in_exists(session: Session, check_in_id: str) -> None:
    statement = select(DailyCheckIn).where(
        DailyCheckIn.id == check_in_id,
        DailyCheckIn.user_id == LOCAL_USER_ID,
    )
    check_in = session.exec(statement).first()
    if check_in is None:
        raise DailyCheckInNotFoundError


def _get_local_flare_up_incident(session: Session, incident_id: str) -> FlareUpIncident:
    statement = select(FlareUpIncident).where(
        FlareUpIncident.id == incident_id,
        FlareUpIncident.user_id == LOCAL_USER_ID,
    )
    incident = session.exec(statement).first()
    if incident is None:
        raise FlareUpIncidentNotFoundError
    return incident


