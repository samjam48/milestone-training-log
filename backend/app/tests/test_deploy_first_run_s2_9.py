"""S2.9 — Production first-run docs (file-content contract).

Asserts docs/deploy.md documents ordered first-use on production steps
(sign in → activity class → activity → training block → log / check-in)
and reiterates never run scripts/seed.py against Supabase.

plans/PRD.md §10 cross-link is optional per ticket; not asserted here.
"""

from __future__ import annotations

import re

import pytest

from app.tests.compose_support import REPO_ROOT

DEPLOY_DOC = REPO_ROOT / "docs" / "deploy.md"
README = REPO_ROOT / "README.md"
FIRST_USE_SECTION_PATTERN = (
    r"(?ms)^#{1,3}\s+.*first\s+use\s+on\s+production.*?(?=^#{1,3}\s+\S|\Z)"
)


def _read_deploy_corpus() -> str:
    parts: list[str] = []
    if DEPLOY_DOC.is_file():
        parts.append(DEPLOY_DOC.read_text(encoding="utf-8"))
    if README.is_file():
        readme = README.read_text(encoding="utf-8")
        if re.search(r"(?ms)^#{1,3}\s+.*(?:deploy|production)", readme):
            parts.append(readme)
    assert parts, (
        "Expected docs/deploy.md (or README deploy subsection) to exist for S2.9."
    )
    return "\n\n".join(parts)


def _section_matching(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text)
    return match.group(0) if match else None


@pytest.fixture
def deploy_text() -> str:
    return _read_deploy_corpus()


def test_deploy_doc_has_first_use_on_production_section(deploy_text: str) -> None:
    section = _section_matching(deploy_text, FIRST_USE_SECTION_PATTERN)
    assert section is not None, (
        "docs/deploy.md must include a 'First use on production' section (S2.9)."
    )


def test_first_use_steps_documented_in_order(deploy_text: str) -> None:
    section = _section_matching(deploy_text, FIRST_USE_SECTION_PATTERN)
    assert section is not None, (
        "Cannot verify step order without a 'First use on production' section (S2.9)."
    )

    def _pos(pattern: str) -> int:
        match = re.search(pattern, section, flags=re.IGNORECASE)
        return match.start() if match else -1

    steps: list[tuple[int, str]] = [
        (_pos(r"sign\s*in|log\s*in"), "sign in"),
        (_pos(r"activity\s+class|create\s+(?:an?\s+)?class"), "create activity class"),
        (_pos(r"create\s+(?:an?\s+)?activity|new\s+activity"), "create activity"),
        (
            _pos(r"training\s+block|new\s+(?:training\s+)?block"),
            "create training block",
        ),
        (
            _pos(r"log\s+activity|log\s+a\s+session|check[- ]?in"),
            "log / check-in",
        ),
    ]

    positions = [pos for pos, _ in steps]
    for pos, label in steps:
        assert pos >= 0, f"First-use section must document step: {label} (S2.9)."

    assert positions == sorted(positions), (
        "First-use steps must appear in order: "
        "sign in → activity class → activity → training block → log/check-in (S2.9)."
    )


def test_deploy_warns_never_run_seed_against_supabase(deploy_text: str) -> None:
    warns_seed_supabase = re.search(
        r"(?:never|do\s+not|don['']t)\s+run\s+"
        r"(?:`?scripts[/\\.]seed(?:\.py)?`?|\S*\bseed\b).{0,120}supabase|"
        r"supabase.{0,120}(?:never|do\s+not|don['']t).{0,80}"
        r"(?:`?scripts[/\\.]seed(?:\.py)?`?|\bseed\b)",
        deploy_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert warns_seed_supabase, (
        "Runbook must reiterate to never run scripts/seed.py against Supabase (S2.9)."
    )
