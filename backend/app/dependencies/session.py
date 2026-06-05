"""FastAPI dependencies for session authentication."""

from __future__ import annotations

from typing import Annotated

from fastapi import HTTPException, Request, status

from app.services import auth as auth_service
from app.services.local_scope import LOCAL_USER_ID

SessionUserId = Annotated[str, "Authenticated local user id"]


def require_session(request: Request) -> SessionUserId:
    if not auth_service.auth_is_enabled():
        return LOCAL_USER_ID

    token = request.cookies.get(auth_service.SESSION_COOKIE_NAME)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    try:
        payload = auth_service.parse_session_token(token)
    except auth_service.InvalidSessionError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        ) from None

    return payload.user_id
