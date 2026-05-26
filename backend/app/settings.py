from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/milestone.db"
    APP_VERSION: str = "0.1.0"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

DATABASE_URL = settings.DATABASE_URL
APP_VERSION = settings.APP_VERSION
