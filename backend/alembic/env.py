from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlmodel import SQLModel

import app.models as _models
from app.settings import DATABASE_URL

_ = _models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Do not call config.set_main_option("sqlalchemy.url", DATABASE_URL): ConfigParser
# treats % in URL-encoded passwords (e.g. %2A) as interpolation syntax.


def _migration_database_url() -> str:
    configured = config.get_main_option("sqlalchemy.url")
    if configured:
        return configured
    return DATABASE_URL


target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_migration_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_migration_database_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
