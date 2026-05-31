from __future__ import annotations

from sqlmodel import Session

from app.services.seed_data import run_seed


def reset_to_seed_data(session: Session) -> None:
    """Truncate all user data tables and re-seed to the canonical seed state."""
    run_seed(session)
