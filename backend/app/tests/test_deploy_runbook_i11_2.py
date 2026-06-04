"""I11.2 — Deploy runbook and Supabase backup docs (file-content contract).

Asserts docs/deploy.md (or expanded README deploy section) covers O11 checklists,
environment matrix, production seed prohibition, Supabase backup, Render cold start,
and Render URL security. Production docs land in a separate ticket; these tests fail
until that work is complete.
"""

from __future__ import annotations

import re

import pytest

from app.tests.compose_support import REPO_ROOT

DEPLOY_DOC = REPO_ROOT / "docs" / "deploy.md"
README = REPO_ROOT / "README.md"
PHASE_11_TICKETS = "plans/tickets-phase-11-production-2026-06-04.md"


def _read_runbook_corpus() -> str:
    parts: list[str] = []
    if DEPLOY_DOC.is_file():
        parts.append(DEPLOY_DOC.read_text(encoding="utf-8"))
    if README.is_file():
        parts.append(README.read_text(encoding="utf-8"))
    assert parts, "Expected docs/deploy.md or README.md to exist for I11.2."
    return "\n\n".join(parts)


@pytest.fixture
def runbook_text() -> str:
    return _read_runbook_corpus()


def test_runbook_references_o11_checklists_or_ticket_file(runbook_text: str) -> None:
    has_ticket_link = PHASE_11_TICKETS in runbook_text or re.search(
        r"tickets-phase-11-production",
        runbook_text,
    )
    has_o11_checklists = all(
        re.search(rf"\bO11\.{phase}\b", runbook_text) for phase in (0, 1, 2)
    )
    assert has_ticket_link or has_o11_checklists, (
        "Runbook must link to "
        f"{PHASE_11_TICKETS} or document O11.0 / O11.1 / O11.2 checklists (I11.2)."
    )


def test_runbook_documents_env_matrix_local_vs_prod(runbook_text: str) -> None:
    has_matrix_heading = re.search(
        r"environment\s+matrix|env(?:ironment)?\s+matrix",
        runbook_text,
        flags=re.IGNORECASE,
    )
    has_local_prod_table = re.search(
        r"\|\s*(?:variable|setting)\s*\|\s*local\s*\|\s*prod",
        runbook_text,
        flags=re.IGNORECASE,
    )
    assert has_matrix_heading or has_local_prod_table, (
        "Runbook must include an environment matrix with local vs production columns "
        "(per I11.2 / TRD §12.2)."
    )
    lowered = runbook_text.lower()
    assert "sqlite" in lowered, (
        "Environment matrix must document local SQLite DATABASE_URL (I11.2)."
    )
    assert "postgresql" in lowered or "supabase" in lowered, (
        "Environment matrix must document production Supabase/Postgres DATABASE_URL (I11.2)."
    )


def test_runbook_warns_never_run_seed_in_production(runbook_text: str) -> None:
    warns_against_seed = re.search(
        r"(?:never|do\s+not|don['']t)\s+run\s+(?:`?scripts\.seed(?:\.py)?`?|\S*\bseed\b)",
        runbook_text,
        flags=re.IGNORECASE,
    )
    mentions_production = re.search(
        r"(?:prod(?:uction)?|prod\b).{0,80}\bseed\b|\bseed\b.{0,80}(?:prod(?:uction)?|prod\b)",
        runbook_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert warns_against_seed and mentions_production, (
        "Runbook must state to never run seed (e.g. scripts.seed) in production (I11.2)."
    )


def test_runbook_documents_supabase_backup_section(runbook_text: str) -> None:
    backup_section = _section_matching(
        runbook_text,
        r"(?ms)^#{1,3}\s+.*\bbackup\b.*?(?=^#{1,3}\s+\S|\Z)",
    )
    corpus = backup_section or runbook_text
    lowered = corpus.lower()
    assert "supabase" in lowered, (
        "Runbook must document Supabase backup/export (I11.2)."
    )
    assert "backup" in lowered, (
        "Runbook must include a Supabase backup section or subsection (I11.2)."
    )
    assert "dashboard" in lowered or "pg_dump" in lowered, (
        "Supabase backup docs must mention dashboard backup and/or a pg_dump one-liner (I11.2)."
    )


def test_runbook_notes_render_cold_start(runbook_text: str) -> None:
    lowered = runbook_text.lower()
    assert "cold" in lowered and "start" in lowered, (
        "Runbook must note Render cold start / sleep behaviour (I11.2)."
    )
    assert "render" in lowered, (
        "Cold start note must reference Render hosting (I11.2)."
    )


def test_runbook_notes_render_url_requires_app_auth_not_netlify_only(
    runbook_text: str,
) -> None:
    lowered = runbook_text.lower()
    mentions_render_url = bool(
        re.search(r"render\s+(?:service\s+)?(?:url|host|hostname)|onrender\.com", lowered)
    )
    mentions_app_auth = bool(
        re.search(
            r"app\s+auth|session\s+auth|auth_password|shared\s+(?:app\s+)?password|"
            r"protect.*render|render.*auth",
            lowered,
        )
    )
    warns_not_netlify_only = bool(
        re.search(
            r"netlify[- ]only|not\s+(?:rely\s+on\s+)?netlify|"
            r"direct\s+render|bypass.*netlify|render\s+url.*auth",
            lowered,
        )
    )
    assert mentions_render_url or "onrender.com" in lowered, (
        "Runbook must mention the direct Render service URL/host (I11.2)."
    )
    assert mentions_app_auth, (
        "Runbook must document app/session auth protecting API access (I11.2)."
    )
    assert warns_not_netlify_only, (
        "Runbook must warn that Render URL protection requires app auth, "
        "not a Netlify-only gate (I11.2)."
    )


def _section_matching(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text)
    return match.group(0) if match else None
