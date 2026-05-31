"""CLI entry-point for seeding the database.

Seed data and logic live in app/services/seed_data.py (inside the app package
so Docker can access them). This script is a thin CLI wrapper for local use.
"""
from __future__ import annotations

import argparse

from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.services.seed_data import run_seed
from app.settings import DATABASE_URL


def seed_database(engine: Engine) -> None:
    with Session(engine) as session:
        run_seed(session)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the Sam Chen prototype dataset.")
    parser.add_argument(
        "--database-url",
        default=DATABASE_URL,
        help="Database URL to seed. Defaults to the shared backend settings value.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    engine = create_engine(str(args.database_url), echo=False)
    seed_database(engine)


if __name__ == "__main__":
    main()
