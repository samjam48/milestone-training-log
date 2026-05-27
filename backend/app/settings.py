from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


def _find_app_root() -> Path:
    backend_dir = Path(__file__).resolve().parents[1]
    if backend_dir.name == "backend":
        return backend_dir.parent
    return backend_dir


APP_ROOT = _find_app_root()
ENV_FILE = APP_ROOT / ".env"


def _normalize_database_url(database_url: str) -> str:
    url = make_url(database_url)
    database = url.database
    if url.drivername != "sqlite" or database is None or database in {"", ":memory:"}:
        return database_url

    database_path = Path(database)
    if database_path.is_absolute():
        return database_url

    return str(url.set(database=str((APP_ROOT / database_path).resolve())))


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/milestone.db"
    APP_VERSION: str = "0.1.0"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)
APP_VERSION = settings.APP_VERSION
