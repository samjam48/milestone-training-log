from __future__ import annotations

from scripts.seed import run_seed
from sqlmodel import Session


def reset_to_seed_data(session: Session) -> None:
    """Truncate all user data tables and re-seed from the canonical seed script."""
    run_seed(session)
