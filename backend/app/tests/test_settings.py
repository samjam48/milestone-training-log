from pathlib import Path

from sqlalchemy.engine import make_url

from app import settings

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_settings_reads_repo_root_env_file() -> None:
    assert settings.ENV_FILE == REPO_ROOT / ".env"


def test_sqlite_database_url_resolves_to_repo_root_data_directory() -> None:
    database_url = make_url(settings.DATABASE_URL)

    assert database_url.drivername == "sqlite"
    assert database_url.database is not None
    assert Path(database_url.database).resolve() == REPO_ROOT / "data" / "milestone.db"
