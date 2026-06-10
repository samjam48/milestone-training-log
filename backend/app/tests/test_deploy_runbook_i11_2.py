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


def test_runbook_documents_explicit_production_migration_operator_step(
    runbook_text: str,
) -> None:
    migration_section = _section_matching(
        runbook_text,
        r"(?ms)^#{1,3}\s+.*\b(?:production\s+)?(?:schema\s+)?migration\b.*?(?=^#{1,3}\s+\S|\Z)",
    )
    corpus = migration_section or runbook_text
    lowered = corpus.lower()

    assert "alembic upgrade head" in corpus, (
        "PDH.D2 requires docs/deploy.md to name the canonical production "
        "migration command: `alembic upgrade head`."
    )
    assert re.search(
        r"explicit\s+(?:operator|manual)\s+step|operator\s+step|manual\s+step",
        lowered,
    ), (
        "PDH.D2 requires production schema migration to be documented as an "
        "explicit operator step."
    )
    assert re.search(
        r"separate\s+from\s+web\s+startup|not\s+as\s+the\s+web\s+container\s+start",
        lowered,
    ), (
        "PDH.D2 requires production migration to be documented as separate "
        "from web startup."
    )


def test_runbook_states_when_production_migration_is_required(
    runbook_text: str,
) -> None:
    lowered = runbook_text.lower()

    assert re.search(r"backend/alembic/versions/.*\.py", runbook_text), (
        "PDH.D2 requires the runbook to say migration is required when a PR "
        "adds a new backend/alembic/versions/*.py revision."
    )
    assert re.search(
        r"(?:model|sqlmodel|schema).{0,120}(?:deployed\s+)?schema\s+change|"
        r"schema\s+change.{0,120}(?:model|sqlmodel)",
        lowered,
        flags=re.DOTALL,
    ), (
        "PDH.D2 requires the runbook to say migration is required when model "
        "changes expect a deployed schema change."
    )
    assert re.search(
        r"no\s+migration\s+files?\s+changed.{0,120}skip\s+(?:the\s+)?migration",
        lowered,
        flags=re.DOTALL,
    ), (
        "PDH.D2 requires the runbook to say the migration step is skipped "
        "when no migration files changed."
    )


def test_runbook_documents_production_migration_preflight_checks(
    runbook_text: str,
) -> None:
    preflight_section = _section_matching(
        runbook_text,
        r"(?ms)^#{1,4}\s+.*\bpre[- ]flight\b.*?(?=^#{1,4}\s+\S|\Z)",
    )
    corpus = preflight_section or runbook_text
    lowered = corpus.lower()

    assert re.search(r"target\s+(?:git\s+)?(?:commit|sha|branch)", lowered), (
        "PDH.D2 pre-flight checks must confirm the target Git commit/branch."
    )
    assert "supabase" in lowered and "backup" in lowered, (
        "PDH.D2 pre-flight checks must confirm a Supabase backup exists or "
        "is intentionally skipped for low-risk dev-only data."
    )
    assert re.search(r"alembic\s+(?:graph|heads?|current)", lowered), (
        "PDH.D2 pre-flight checks must confirm the local Alembic graph sees "
        "the intended head."
    )
    assert re.search(r"render.{0,80}main", lowered, flags=re.DOTALL), (
        "PDH.D2 pre-flight checks must confirm the Render service deploys "
        "from main."
    )
    assert re.search(r"netlify.{0,80}main", lowered, flags=re.DOTALL), (
        "PDH.D2 pre-flight checks must confirm Netlify deploys from main."
    )


def test_runbook_documents_safe_places_to_run_production_migration(
    runbook_text: str,
) -> None:
    lowered = runbook_text.lower()

    assert re.search(r"render.{0,80}(?:one[- ]off|shell)", lowered, flags=re.DOTALL), (
        "PDH.D2 requires Render one-off/shell to be documented as the "
        "preferred place to run `alembic upgrade head`."
    )
    assert re.search(
        r"controlled\s+local\s+shell|local\s+shell",
        lowered,
    ), (
        "PDH.D2 requires documenting a controlled local shell as a fallback "
        "place to run the migration."
    )
    assert re.search(
        r"database_url.{0,120}(?:deliberately|intentionally).{0,120}supabase|"
        r"supabase.{0,120}database_url.{0,120}(?:deliberately|intentionally)",
        lowered,
        flags=re.DOTALL,
    ), (
        "PDH.D2 requires local migration docs to say DATABASE_URL must be "
        "deliberately pointed at Supabase."
    )
    assert re.search(r"database_url.{0,120}(?:not\s+committed|never\s+commit)", lowered), (
        "PDH.D2 requires production DATABASE_URL handling to avoid committing "
        "production secrets."
    )
    assert re.search(r"database_url.{0,120}(?:not\s+echoed|never\s+echo)", lowered), (
        "PDH.D2 requires production DATABASE_URL handling to avoid echoing "
        "production secrets into logs."
    )


def test_runbook_documents_production_migration_postflight_checks(
    runbook_text: str,
) -> None:
    postflight_section = _section_matching(
        runbook_text,
        r"(?ms)^#{1,4}\s+.*\bpost[- ]flight\b.*?(?=^#{1,4}\s+\S|\Z)",
    )
    corpus = postflight_section or runbook_text
    lowered = corpus.lower()

    assert "alembic_version" in corpus, (
        "PDH.D2 post-flight checks must inspect Supabase alembic_version."
    )
    assert "https://milestone-training-log.onrender.com/api/health" in corpus, (
        "PDH.D2 post-flight checks must include the direct Render health URL."
    )
    assert "https://milestone-activity.netlify.app/api/health" in corpus, (
        "PDH.D2 post-flight checks must include the Netlify proxy health URL."
    )
    assert re.search(r"\blogin\b", lowered), (
        "PDH.D2 post-flight checks must include a login smoke test."
    )
    assert re.search(r"changed\s+workflow|workflow\s+changed", lowered), (
        "PDH.D2 post-flight checks must smoke-test the changed workflow."
    )


def _section_matching(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text)
    return match.group(0) if match else None
