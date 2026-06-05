"""Session authentication — password check and signed session cookie."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from typing import Final

from fastapi import Response

from app.services.local_scope import LOCAL_USER_ID
from app.settings import Settings

SESSION_COOKIE_NAME: Final[str] = "milestone_session"
_SESSION_PAYLOAD_VERSION: Final[int] = 1


@dataclass(frozen=True, slots=True)
class SessionPayload:
    user_id: str
    exp: int


class InvalidSessionError(Exception):
    """Raised when a session cookie is missing, malformed, or expired."""


def _settings() -> Settings:
    import app.settings as settings_module

    return settings_module.settings


def auth_is_enabled() -> bool:
    return bool(_settings().AUTH_PASSWORD.strip())


def validate_production_auth_settings() -> None:
    current = _settings()
    if current.APP_DEV_MODE:
        return
    if not current.AUTH_PASSWORD.strip():
        msg = "AUTH_PASSWORD must be set when APP_DEV_MODE is false"
        raise RuntimeError(msg)


def verify_password(plain_password: str) -> bool:
    expected = _settings().AUTH_PASSWORD
    if not expected:
        return False
    return secrets.compare_digest(plain_password.encode("utf-8"), expected.encode("utf-8"))


def session_max_age_seconds() -> int:
    return _settings().SESSION_MAX_AGE_DAYS * 24 * 60 * 60


def create_session_token(*, user_id: str = LOCAL_USER_ID) -> str:
    exp = int(time.time()) + session_max_age_seconds()
    payload = {"v": _SESSION_PAYLOAD_VERSION, "user_id": user_id, "exp": exp}
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("ascii")
    signature = _sign_payload_b64(payload_b64)
    return f"{payload_b64}.{signature}"


def parse_session_token(token: str) -> SessionPayload:
    if not token or "." not in token:
        raise InvalidSessionError("malformed session token")

    payload_b64, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign_payload_b64(payload_b64), signature):
        raise InvalidSessionError("invalid session signature")

    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
        payload = json.loads(payload_bytes.decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise InvalidSessionError("malformed session payload") from exc

    if payload.get("v") != _SESSION_PAYLOAD_VERSION:
        raise InvalidSessionError("unsupported session version")

    user_id = payload.get("user_id")
    exp = payload.get("exp")
    if not isinstance(user_id, str) or not isinstance(exp, int):
        raise InvalidSessionError("invalid session fields")

    if exp < int(time.time()):
        raise InvalidSessionError("session expired")

    return SessionPayload(user_id=user_id, exp=exp)


def session_cookie_secure() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return not _settings().APP_DEV_MODE


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=session_max_age_seconds(),
        httponly=True,
        secure=session_cookie_secure(),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=session_cookie_secure(),
        samesite="lax",
        path="/",
    )


def _sign_payload_b64(payload_b64: str) -> str:
    digest = hmac.new(
        _settings().SESSION_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return digest
