"""B11.5 — Authentication API tests.

These tests MUST FAIL until B11.4 session auth is implemented:
  - backend/app/services/auth.py
  - backend/app/routers/auth.py (POST /api/auth/login, POST /api/auth/logout)
  - require_session dependency on existing API routers

Fixtures: app_with_auth_settings and auth_client in conftest.py override
AUTH_PASSWORD and SESSION_SECRET via environment before create_app().
"""

from __future__ import annotations

from httpx import AsyncClient

from app.tests.conftest import TEST_AUTH_PASSWORD

DASHBOARD_URL = "/api/dashboard"
HEALTH_URL = "/api/health"
LOGIN_URL = "/api/auth/login"
LOGOUT_URL = "/api/auth/logout"
DEV_RESET_URL = "/api/dev/reset"


async def test_get_dashboard_without_cookie_returns_401(auth_client: AsyncClient) -> None:
    response = await auth_client.get(DASHBOARD_URL)
    assert response.status_code == 401


async def test_post_login_wrong_password_returns_401(auth_client: AsyncClient) -> None:
    response = await auth_client.post(LOGIN_URL, json={"password": "wrong-password"})
    assert response.status_code == 401


async def test_post_login_correct_password_returns_200_and_set_cookie(
    auth_client: AsyncClient,
) -> None:
    response = await auth_client.post(LOGIN_URL, json={"password": TEST_AUTH_PASSWORD})
    assert response.status_code == 200
    assert "set-cookie" in response.headers


async def test_get_dashboard_after_login_returns_200(auth_client: AsyncClient) -> None:
    login_response = await auth_client.post(LOGIN_URL, json={"password": TEST_AUTH_PASSWORD})
    assert login_response.status_code == 200

    response = await auth_client.get(DASHBOARD_URL)
    assert response.status_code == 200


async def test_get_health_without_cookie_returns_200(auth_client: AsyncClient) -> None:
    response = await auth_client.get(HEALTH_URL)
    assert response.status_code == 200


async def test_dev_reset_returns_404_when_app_dev_mode_is_false(
    auth_client: AsyncClient,
) -> None:
    response = await auth_client.post(DEV_RESET_URL)
    assert response.status_code == 404


async def test_logout_clears_session(auth_client: AsyncClient) -> None:
    login_response = await auth_client.post(LOGIN_URL, json={"password": TEST_AUTH_PASSWORD})
    assert login_response.status_code == 200

    dashboard_before_logout = await auth_client.get(DASHBOARD_URL)
    assert dashboard_before_logout.status_code == 200

    logout_response = await auth_client.post(LOGOUT_URL)
    assert logout_response.status_code in {200, 204}

    dashboard_after_logout = await auth_client.get(DASHBOARD_URL)
    assert dashboard_after_logout.status_code == 401
