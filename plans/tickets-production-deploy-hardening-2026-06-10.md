# Production Deploy Hardening

*Source: owner post-incident request 2026-06-10, Render rollback/migration skew diagnosis from 2026-06-08 logs | Date: 2026-06-10*

---

## Incident summary

On 2026-06-08, the `main@c3a463a` backend deploy ran Alembic migrations through
`20260608_0006`, then Render marked the web deploy as timed out. Subsequent
starts attempted to boot code that could not locate `20260608_0006`, while
Supabase `alembic_version` was already stamped to that revision. The app then
served intermittently from an existing process and later failed health checks
through Netlify.

Root operational risk: the production Docker `CMD` couples schema migration and
web startup:

```text
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}
```

If a deploy mutates the production database and Render does not promote that web
image, rollback/restart can leave older code unable to start against the newer
database revision.

## Scope summary

| Area | Tickets |
| --- | --- |
| Emergency runbook and operator checks | PDH.D1 |
| Web startup migration decoupling | PDH.B1 |
| Explicit production migration process | PDH.D2 |
| Backward-compatible migration policy | PDH.D3 |
| Weekly target duplicate-submit guard | PDH.F1 |
| Optional CI migration safety gate | PDH.CI1 |
| Owner operational smoke | OPDH.1 |

## Ownership map

| Ticket | Repo changes by agent | Owner actions outside repo |
| --- | --- | --- |
| PDH.D1 | Update deployment docs/tests | Follow documented recovery SOP during incidents |
| PDH.B1 | Dockerfile, tests, docs | Confirm Render has no custom start command still running Alembic |
| PDH.D2 | Docs and optional local helper command | Run production migration manually/one-off during migration deploys |
| PDH.D3 | Docs and optional migration-risk test | Enforce policy when approving destructive migration PRs |
| PDH.F1 | Frontend code/tests | Smoke weekly target form after deploy |
| PDH.CI1 | GitHub workflow/tests | Enable/confirm GitHub Actions if required |
| OPDH.1 | None | Render/Supabase/Netlify verification |

## Ticket ordering rationale

1. **PDH.D1** captures the incident response now while details are fresh.
2. **PDH.B1** removes the risky startup coupling that caused the restart loop.
3. **PDH.D2** defines the replacement migration path so schema deploys remain deliberate.
4. **PDH.D3** records the safer migration style for future tickets.
5. **PDH.F1** addresses the separate observed `409 Conflict` client-error source.
6. **PDH.CI1** adds stronger pre-merge protection once the operating model is documented.
7. **OPDH.1** confirms the full production workflow with owner-controlled services.

---

## PDH.D1 — Document production deploy recovery SOP

**Type:** docs + tests  
**Depends on:** none  
**Blocks:** PDH.B1, PDH.D2  
**Repo owner:** agent  
**External owner:** owner follows SOP when production deploys misbehave  
**Reuse:** `docs/deploy.md`, `backend/app/tests/test_deploy_runbook_i11_2.py`, `backend/app/tests/test_production_dockerfile_b11_3.py`

### Acceptance criteria

- `docs/deploy.md` includes a clearly named recovery section for a failed migration-backed deploy.
- Recovery SOP documents the exact symptoms from this incident:
  - Render deploy shows timeout or port scan failure.
  - Supabase `alembic_version` is ahead of the currently booting image.
  - Render logs include `Can't locate revision identified by '<revision>'`.
  - Netlify `/api/health` may return 5xx or time out while an old/new process mix exists.
- SOP instructs the owner to:
  - Use Render **Manual Deploy** from `main`.
  - Prefer **Clear build cache & deploy** when the image/cache state is suspect.
  - Wait for `Your service is live` and no later timeout/port-scan messages.
  - Verify direct Render health and Netlify proxy health.
  - Avoid manually editing `alembic_version` unless a separately planned DB repair says to.
- SOP includes exact current health URLs:
  - `https://milestone-training-log.onrender.com/api/health`
  - `https://milestone-activity.netlify.app/api/health`
- Tests or docs checks cover the new recovery section enough to prevent accidental deletion.

### Edge cases

- Direct Render health works but Netlify proxy health fails: SOP routes investigation to Netlify proxy/routing.
- Netlify health works but app login fails: SOP routes investigation to auth/session logs, not migration recovery.
- Render free-tier cold start is slow: SOP distinguishes expected cold start delay from repeated 5xx/timeout failure.

### Test strategy

- Extend existing deploy runbook tests to assert the recovery section mentions Render manual redeploy, clear cache, both health URLs, and the `alembic_version` caution.
- No production code tests required.

---

## PDH.B1 — Decouple web startup from Alembic migrations

**Type:** backend infra + tests + docs  
**Depends on:** PDH.D1  
**Blocks:** PDH.D2, OPDH.1  
**Repo owner:** agent  
**External owner:** owner verifies Render service does not override Docker `CMD` with a custom Alembic start command  
**Reuse:** `backend/Dockerfile`, `docs/deploy.md`, `backend/app/tests/test_production_dockerfile_b11_3.py`, `docker-compose.yml`

### Acceptance criteria

- Production web image starts Uvicorn directly and does **not** run `alembic upgrade head` in the web `CMD`.
- Docker `CMD` remains Render-compatible:
  - Binds `0.0.0.0`.
  - Uses `${PORT:-8084}`.
  - Does not use `--reload`.
- Existing local Docker Compose behavior remains unchanged; compose development command still does not run production migrations implicitly.
- Deploy docs no longer claim that the production web image applies schema migrations on every container start.
- A separate migration command is referenced but not coupled to web startup.
- Tests that previously required `alembic upgrade head && uvicorn` are updated to assert the new safer behavior.

### Edge cases

- If Render has a dashboard-level **Start Command**, owner must remove or update it so it does not reintroduce `alembic upgrade head &&`.
- Existing Render port detection must still find Uvicorn promptly after container start.
- A rollback to an older web image after a migrated DB may still be logically incompatible, but it should not be trapped in Alembic revision discovery before the app can expose diagnostics.

### Test strategy

- Update Dockerfile production tests to assert:
  - `CMD` contains Uvicorn.
  - `CMD` does not contain `alembic upgrade`.
  - `CMD` binds Render `$PORT`.
- Keep or update Docker build smoke test if present.
- Manual verification remains required on Render because dashboard-level start commands are outside the repo.

---

## PDH.D2 — Add explicit production migration runbook

**Type:** docs + optional Makefile/helper test  
**Depends on:** PDH.B1  
**Blocks:** PDH.D3, OPDH.1  
**Repo owner:** agent  
**External owner:** owner runs the production migration step in Render/Supabase workflow  
**Reuse:** `docs/deploy.md`, `Makefile`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/app/tests/test_deploy_runbook_i11_2.py`

### Acceptance criteria

- `docs/deploy.md` documents production schema migration as an explicit operator step, separate from web startup.
- Runbook states when migration is required:
  - Any PR adding a new `backend/alembic/versions/*.py` revision.
  - Any PR changing models in a way that expects a deployed schema change.
- Runbook includes pre-flight checks:
  - Confirm target Git commit/branch.
  - Confirm Supabase backup exists or is intentionally skipped for low-risk dev-only data.
  - Confirm local Alembic graph sees the intended head.
  - Confirm Render service and Netlify are deploying from `main`.
- Runbook includes the canonical migration command:
  - `alembic upgrade head`
- Runbook documents safe places to run the command, in preference order:
  - Render one-off/shell environment for the backend service if available.
  - A controlled local shell only when `DATABASE_URL` is deliberately pointed at Supabase and not committed or echoed.
- Runbook includes post-flight checks:
  - Query/inspect `alembic_version`.
  - Check Render `/api/health`.
  - Check Netlify `/api/health`.
  - Smoke login and the changed workflow.
- If a Makefile helper is added, it must not embed production secrets or make production migration accidental.

### Edge cases

- Migration command fails before changing schema: stop and do not deploy frontend until diagnosis is complete.
- Migration command partially succeeds: stop; do not redeploy older code blindly; inspect Alembic/Supabase state first.
- No migration files changed: skip migration step and deploy web/frontend normally.

### Test strategy

- Extend deploy docs tests to assert explicit migration step, backup mention, health checks, and no production secret storage.
- If a helper command is added, add a focused test that it is documented as explicit/manual and does not contain hardcoded `DATABASE_URL`.

---

## PDH.D3 — Define backward-compatible migration policy

**Type:** docs + optional migration-risk check  
**Depends on:** PDH.D2  
**Blocks:** future schema-changing tickets  
**Repo owner:** agent  
**External owner:** owner applies policy when approving migration PRs  
**Reuse:** `docs/architecture.md`, `docs/deploy.md`, `docs/database-schema.md`, `backend/app/tests/test_migrations.py`

### Acceptance criteria

- Architecture/deploy docs define the default production migration style:
  - **Expand:** add nullable columns/tables/indexes that current and next code can tolerate.
  - **Deploy compatible code:** code handles old and new shape where needed.
  - **Backfill:** run data migration separately when useful.
  - **Contract:** remove old columns/routes/tables only in a later deployment after the new code is live and verified.
- Docs define destructive/high-risk operations that require explicit owner approval:
  - `drop_table`
  - `drop_column`
  - broad `DELETE FROM`
  - changing enum/value semantics in a way older code cannot parse
  - data migrations that rewrite or wipe production history
- Docs add a deploy-review question: "Can the previous backend version start and serve health against the migrated DB revision?"
- Docs explain that if the answer is "no", rollback must be treated as a database-aware recovery, not just "redeploy previous image".
- Optional static test/check flags destructive Alembic operations and requires an allowlist/comment naming the owner-approved ticket.

### Edge cases

- Personal/local-first MVP data may justify a destructive migration, but the ticket must call that out before merge.
- SQLite/Postgres differences must be considered before production migration approval.
- Data-only migrations still need rollback/recovery thinking, even when schema is unchanged.

### Test strategy

- Minimum: docs tests assert migration policy and high-risk operation examples are present.
- Optional: add a focused migration file scan test for destructive operations. If added, keep it lightweight and allowlist current historical migrations instead of rewriting history.

---

## PDH.F1 — Prevent duplicate weekly target submit

**Type:** frontend + tests  
**Depends on:** none  
**Blocks:** none  
**Repo owner:** agent  
**External owner:** owner smoke-tests Goals weekly target create/edit after deploy  
**Reuse:** `frontend/src/hooks/useMilestoneEngine.ts`, `frontend/src/components/screens/GoalsScreen.tsx`, `frontend/src/hooks/useMilestoneEngine.wtlF2.test.tsx`, `frontend/src/components/screens/GoalsScreen.wtlF2.test.tsx`, `frontend/src/lib/api/client.ts`

### Acceptance criteria

- Weekly target editor disables or guards **Save** while create/update mutation is pending.
- A double-click or rapid repeated submit creates at most one API request for a new weekly target.
- Existing mutation errors still render in the editor.
- A backend `409 Conflict` still shows clear conflict copy and leaves the editor open for correction/cancel.
- The editor does not close optimistically before the create/update mutation has succeeded.
- Existing weekly target create/edit/delete behavior remains unchanged for normal single-submit flows.

### Edge cases

- Slow network: Save stays visibly unavailable while request is pending.
- Error response: Save becomes available again after failure.
- User changes fields after an error: stale error can be cleared by the existing error-clear path.
- Activity already has a weekly target from another tab/device: backend `409` remains the source of truth and is surfaced.

### Test strategy

- Extend hook tests to expose a pending flag or mutation state only if the component needs it; keep state ownership in the existing engine/screen boundary.
- Extend `GoalsScreen` tests:
  - Save button disabled while pending.
  - repeated save does not call `createWeeklyTarget` twice.
  - conflict alert remains visible and editor remains open.
- Mock API/mutation behavior at the existing test layer; do not add an end-to-end test for this small interaction.

---

## PDH.CI1 — Add migration safety CI gate

**Type:** CI + backend tests  
**Depends on:** PDH.D2, PDH.D3  
**Blocks:** none  
**Repo owner:** agent  
**External owner:** owner confirms GitHub Actions availability/permissions if needed  
**Reuse:** `.github/workflows/` if present or new workflow, `Makefile`, `backend/app/tests/test_postgres_migrations.py`, `backend/app/tests/helpers/postgres_migration.py`

### Acceptance criteria

- PR checks include a migration safety gate against temporary Postgres, not production Supabase.
- Gate runs Alembic upgrade to `head` from a clean database and asserts expected application tables exist.
- Gate fails when Alembic revision graph is broken or a migration is not discoverable.
- Gate does not require production secrets.
- Workflow or Makefile entry is documented as the canonical pre-merge migration check.
- If GitHub Actions is not currently enabled for the repo, docs identify the owner setup step instead of pretending CI is active.

### Edge cases

- Local SQLite migration tests can still pass while Postgres fails; Postgres gate is the production-relevant check.
- CI should not run seed against production-like credentials.
- Workflow should avoid excessive runtime; migration gate can be separate from full frontend coverage if needed.

### Test strategy

- Add or extend workflow/config tests if this repo already tests CI files.
- Verify locally with existing `make test-postgres` or equivalent if available.
- Owner verifies GitHub checks appear on a PR after the workflow is merged/enabled.

---

## OPDH.1 — Owner production hardening smoke

**Type:** owner verification  
**Depends on:** PDH.B1, PDH.D2  
**Blocks:** production confidence after merge  
**Repo owner:** none  
**External owner:** owner

### Acceptance criteria

- Render backend service settings are checked:
  - Branch is `main`.
  - Dockerfile path/root directory still match `docs/deploy.md`.
  - No custom Render Start Command runs `alembic upgrade head &&`.
- After merging PDH.B1/PDH.D2, owner deploys backend and confirms Render says `Your service is live`.
- Owner checks direct Render health:
  - `https://milestone-training-log.onrender.com/api/health`
- Owner checks Netlify proxy health:
  - `https://milestone-activity.netlify.app/api/health`
- Owner opens the Netlify app, logs in, and verifies dashboard loads.
- For the next schema-changing PR, owner follows the new explicit migration runbook once before considering this batch fully proven.

### Edge cases

- If Render dashboard still runs an old custom command, fix the setting before judging repo changes.
- If health works on Render but not Netlify, investigate Netlify proxy separately.
- If a future migration fails, do not deploy older web images until DB revision state is understood.

### Test strategy

- Manual only; these checks depend on owner-controlled Render, Netlify, and Supabase services.

