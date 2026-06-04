from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

from app import settings

REPO_ROOT = Path(__file__).resolve().parents[3]

_PRODUCTION_SETTING_KEYS = (
    "SESSION_SECRET",
    "AUTH_PASSWORD",
    "SESSION_MAX_AGE_DAYS",
    "CORS_ORIGINS",
)


def _settings_without_env_file(monkeypatch: pytest.MonkeyPatch) -> settings.Settings:
    for key in _PRODUCTION_SETTING_KEYS:
        monkeypatch.delenv(key, raising=False)
    return settings.Settings.model_validate({})


def test_settings_reads_repo_root_env_file() -> None:
    assert settings.ENV_FILE == REPO_ROOT / ".env"


def test_sqlite_database_url_resolves_to_repo_root_data_directory() -> None:
    database_url = make_url(settings.DATABASE_URL)

    assert database_url.drivername == "sqlite"
    assert database_url.database is not None
    assert Path(database_url.database).resolve() == REPO_ROOT / "data" / "milestone.db"


def test_settings_model_default_database_url_remains_sqlite_for_local() -> None:
    field = settings.Settings.model_fields["DATABASE_URL"]
    default = field.default
    assert isinstance(default, str)
    assert default.startswith("sqlite:")


def test_settings_model_defines_session_secret() -> None:
    assert "SESSION_SECRET" in settings.Settings.model_fields


def test_settings_session_secret_has_dev_default_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    instance = _settings_without_env_file(monkeypatch)
    assert instance.SESSION_SECRET
    assert instance.SESSION_SECRET != ""


def test_settings_model_defines_auth_password() -> None:
    assert "AUTH_PASSWORD" in settings.Settings.model_fields


def test_settings_auth_password_safe_local_default_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    instance = _settings_without_env_file(monkeypatch)
    assert instance.AUTH_PASSWORD == ""


def test_settings_model_defines_session_max_age_days() -> None:
    assert "SESSION_MAX_AGE_DAYS" in settings.Settings.model_fields


def test_settings_session_max_age_days_defaults_to_thirty_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    instance = _settings_without_env_file(monkeypatch)
    assert instance.SESSION_MAX_AGE_DAYS == 30


def test_settings_model_defines_optional_cors_origins() -> None:
    assert "CORS_ORIGINS" in settings.Settings.model_fields


def test_settings_cors_origins_defaults_empty_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    instance = _settings_without_env_file(monkeypatch)
    assert instance.CORS_ORIGINS == ""


def test_settings_module_exports_production_settings() -> None:
    for name in _PRODUCTION_SETTING_KEYS:
        assert hasattr(settings, name), f"settings module must export {name} for B11.1."
