# Phase 11 — Production Deploy Tickets

*Source: `AGENTS.md`, `agents/planner.md`, `plans/feature-brief-production-deploy-2026-06-04.md`,
`plans/technical-design-production-deploy-2026-06-04.md`, `plans/PRD.md` §9,
`plans/TRD.md` §12 | Date: 2026-06-04*

---

## Owner decisions locked (2026-06-04)


| #   | Topic             | Decision                                                                               |
| --- | ----------------- | -------------------------------------------------------------------------------------- |
| D1  | Hosting           | Netlify (frontend, GitHub deploy) + Render (backend, free) + Supabase (Postgres, free) |
| D2  | Auth              | Netlify `/api` proxy **and** app session cookie (shared password, ~30 days)            |
| D3  | URLs              | Default `*.netlify.app` / `*.onrender.com`                                             |
| D4  | Render cold start | Acceptable                                                                             |
| D5  | Local DB          | SQLite + Docker; Postgres prod only                                                    |
| D6  | Prod data         | Empty after migrate; no `scripts/seed.py`                                              |
| D7  | PWA               | Stage 2 — out of Phase 11                                                              |
| D8  | Primary client    | Android Chrome (Pixel 9 Pro)                                                           |
| D9  | Backup            | Document Supabase backup/export; do not lose prod casually                             |


### Hard constraints (from `AGENTS.md`)

- Tests before code per implementation ticket.
- No business logic in routers — auth in `services/`.
- No schema changes for v1 auth (signed cookie only).
- Branch: `feat/phase-11-production`. Do not push or merge without owner instruction.
- Secrets never committed.

---

## Owner work — do this first (one session, ~45–60 min)

Complete **O11.0** before starting **B11.1**. Store values in a password manager or a **local** note (e.g. `~/milestone-deploy-secrets.txt`) — **never commit**.

After implementation tickets through **I11.1** are merged on the branch, complete **O11.1** once (platform wiring). Then agents run remaining code tickets without further owner steps until **O11.2** smoke on your phone.


| Ticket    | When                                       | Blocks                         |
| --------- | ------------------------------------------ | ------------------------------ |
| **O11.0** | ✅ **Done** (2026-06-04) — unblocks B11.1     | —                              |
| **O11.1** | After B11.3 + B11.4 + I11.1 land on branch | F11.2 manual prod check, O11.2 |
| **O11.2** | After full ticket batch + O11.1            | Phase 11 sign-off              |


---

## O11.0 — Owner platform preflight (accounts + secrets + Supabase DB)

**Status:** ✅ **DONE** — owner sign-off 2026-06-04  
**Type:** owner-only (no code)  
**Blocks:** ~~B11.1~~ (cleared)

### Checklist — accounts

- **Supabase:** account + new project (any region). Note project name: `milestone`
- **Render:** account (free tier). Note login email: `s.w.h@live.co.uk`
- **Netlify:** account (free tier). Note login email: `s.w.h@live.co.uk`
- **GitHub → Netlify:** authorize Netlify to access `milestone-training-log` repo (can finish site creation in O11.1)

### Checklist — Supabase database

- Project Settings → Database → copy **Connection string** → **URI** (or **Session pooler** if Render cannot reach direct host — try pooler first: port 6543).
- Convert to SQLAlchemy URL: `postgresql+psycopg://USER:PASSWORD@HOST:PORT/postgres` (replace `postgresql://` prefix).
- Save as `DATABASE_URL` in password manager. **Do not** run seed against this DB yet.

### Checklist — secrets (generate now)

- `SESSION_SECRET` — e.g. `openssl rand -hex 32`
- `AUTH_PASSWORD` — strong shared password you will type on phone (not the same as Supabase DB password unless you choose)
- Save both in password manager

### Checklist — optional local reference file

Create a local-only file (not in repo) with:

```
DATABASE_URL=postgresql+psycopg://...
SESSION_SECRET=...
AUTH_PASSWORD=...
# Fill in O11.1:
RENDER_SERVICE_HOST=          # e.g. milestone-api.onrender.com
NETLIFY_SITE_URL=             # e.g. https://something.netlify.app
```

### Done when

- [x] All three accounts exist.
- [x] `DATABASE_URL`, `SESSION_SECRET`, and `AUTH_PASSWORD` saved securely (local `.env` / password manager; `DATABASE_URL` on Render).
- [x] Secrets **not** committed to git.
- [x] Prod hostnames noted for O11.1: Render `milestone-training-log.onrender.com`, Netlify `milestone-activity.netlify.app`.

**Owner sign-off:** ✅ **2026-06-04** — orchestrator may start **B11.1**. Remaining Render/Netlify env wiring per **O11.1** after B11.3, B11.4, I11.1.

---

## O11.1 — Owner first production wiring (Render + Netlify)

**Type:** owner-only  
**Depends on:** B11.3, B11.4, I11.1 merged on `feat/phase-11-production`  
**Blocks:** O11.2; optional manual verification during F11.2

### Render Web Service

- New **Web Service** → deploy from repo → root `backend/` (or Dockerfile path `backend/Dockerfile` per Render UI).
- Environment variables:

  | Key                    | Value                 |
  | ---------------------- | --------------------- |
  | `DATABASE_URL`         | From O11.0 (Supabase) |
  | `SESSION_SECRET`       | From O11.0            |
  | `AUTH_PASSWORD`        | From O11.0            |
  | `APP_DEV_MODE`         | `false`               |
  | `SESSION_MAX_AGE_DAYS` | `30` (optional)       |

- Health check path: `/api/health`
- Deploy; wait until live. Copy **service hostname** (no `https://`): `____________`
- Open `https://<hostname>/api/health` → `{"status":"ok"}` or equivalent
- Open `https://<hostname>/docs` → Swagger loads (optional)
- Confirm Supabase Table Editor shows **empty** application tables (migrations ran, no seed rows)

### Netlify site

- Import site from GitHub → repo `milestone-training-log`, branch `feat/phase-11-production` (or `main` after merge)
- Build settings: base `frontend`, command `npm ci && npm run build`, publish `dist`
- Environment: `VITE_DEV_MODE=false` (and `VITE_API_BASE_URL` empty/unset)
- Ensure `frontend/netlify.toml` proxy target uses your Render hostname from above (commit from I11.1 may use placeholder — **update** `to = "https://<RENDER_HOST>/api/:splat"` if still placeholder)
- Deploy site; copy **site URL**: `____________`
- Enable automatic deploys on push to chosen production branch

### Quick wiring test (desktop)

- Open Netlify URL → login screen appears (or 401 → login after F11.2)
- `curl -i https://<NETLIFY_HOST>/api/health` → 200 through proxy

### Done when

- Render and Netlify URLs recorded in password manager.
- Health check passes on Render and via Netlify proxy.

---

## O11.2 — Owner acceptance smoke (Android Chrome)

**Type:** owner-only  
**Depends on:** All B11.*, F11.*, I11.* tickets + O11.1  
**Blocks:** Phase 11 handoff / merge approval

### On Pixel 9 Pro (Chrome)

- Open Netlify production URL (bookmark for daily use)
- First load after cold start: acceptable delay; app loads
- Login with shared password → session persists after closing tab (same day)
- Empty dashboard → create activity class + activity via Settings flow
- Log activity from Log tab
- Morning check-in
- Flare-up incident (optional path)
- Goal create/edit (Goals tab)
- Training block / rules surface loads without error
- Confirm Settings has **no** “Reset mock data” button
- In Render dashboard: restart service → data still in app after reload

### Security spot-check

- `POST https://<RENDER_HOST>/api/dev/reset` → **404** (not 200)
- Unauthenticated `GET https://<RENDER_HOST>/api/dashboard` → **401**

### Backup

- Skim `docs/deploy.md` (or README deploy section) — note how to export Supabase backup

### Done when

- All boxes ticked; note any bugs in `plans/BACKLOG.md` for Stage 2.

---

## Ticket ordering rationale

1. **O11.0** — owner preflight; unblocks all code.
2. **B11.1** — Postgres driver + env docs (no owner stop).
3. **B11.2** — prove Alembic on Postgres in CI/tests before prod relies on it.
4. **B11.3** — production container start command (unblocks O11.1 Render deploy).
5. **B11.4** — session auth (unblocks frontend login + O11.1 API test).
6. **B11.5** — auth tests (test-first may run before B11.4 per workflow).
7. **B11.6** — optional CORS (parallel-safe).
8. **F11.1** — API client credentials + 401 handling.
9. **F11.2** — Login UI + app gate (local dev: optional `AUTH_PASSWORD` in `.env` for manual test).
10. **I11.1** — `netlify.toml` + Render deploy doc template (unblocks O11.1 Netlify proxy).
11. **I11.2** — README/deploy runbook + backup section.
12. **O11.1** — owner wires Render + Netlify (**only owner stop** during implementation batch).
13. **O11.2** — owner phone smoke (**final gate**).

**Parallel groups (agent may sequence one ticket at a time per AGENTS.md):** B11.6 after B11.4; I11.* after core auth.

---

## B11.1 — Postgres driver and env documentation

**Type:** backend + docs  
**Owner:** none (after O11.0)  
**Reuse:** `backend/pyproject.toml`, repo-root `.env.example`, `backend/app/settings.py`.

### Acceptance criteria

- `psycopg` (or `psycopg[binary]`) added to backend dependencies; install succeeds in Docker build.
- `.env.example` documents production shape:
  - `DATABASE_URL=postgresql+psycopg://...` with comment “Supabase only; local dev uses sqlite”
  - `SESSION_SECRET`, `AUTH_PASSWORD`, `SESSION_MAX_AGE_DAYS`, `CORS_ORIGINS` (optional)
- `settings.py` reads new settings with safe local defaults (`SESSION_SECRET` dev-only default documented as insecure).
- `make test` still passes with SQLite (no Postgres required for default local test run unless B11.2 adds opt-in job).

### Edge cases

- Password with special characters in `DATABASE_URL` — document URL-encoding.
- Supabase pooler vs direct — comment in `.env.example` to try Session pooler if Render connection fails.

---

## B11.2 — Postgres migration verification

**Type:** backend test  
**Owner:** none  
**Reuse:** `backend/alembic/`, `backend/app/tests/test_migrations.py`, Alembic `env.py` + `app.settings.DATABASE_URL`.

### Acceptance criteria

- Test (or CI job documented in ticket commit message) runs `alembic upgrade head` against **temporary Postgres** and asserts core tables exist (`activity_classes`, `activity_logs`, `training_blocks`, etc.).
- Prefer ephemeral Postgres: GitHub Actions `postgres` service, or `pytest` fixture with Docker if already used in repo — **do not** require owner's Supabase URL in CI.
- If CI Postgres is deferred, test must run locally via documented `make test-postgres` target and TRD §12.8 notes the gate — **owner prefers automated gate**; implement CI if feasible without scope creep.
- Downgrade test optional; upgrade head required.

### Edge cases

- JSON columns migrate cleanly (existing migration uses `sa.JSON()`).
- SQLite test suite unchanged and still green.

---

## B11.3 — Production Dockerfile and Render start command

**Type:** backend / infra  
**Owner:** none (O11.1 uses output)  
**Reuse:** `backend/Dockerfile`, `backend/alembic.ini`, Render docs in `plans/TRD.md` §12.3.

### Acceptance criteria

- Production image CMD runs: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}` (no `--reload`).
- Docker build succeeds from `backend/`.
- `docs/deploy.md` or README subsection lists Render settings: root directory / Dockerfile path, health check, required env vars (pointer to O11.0/O11.1).
- Local Docker Compose dev command unchanged (still uses reload for dev if applicable).

### Edge cases

- Render sets `PORT` — uvicorn must bind to it.
- Migration failure on boot fails container (non-zero exit) so Render shows deploy failed.

---

## B11.4 — Session authentication (service + routes + dependency)

**Type:** backend  
**Owner:** none  
**Reuse:** `backend/app/settings.py`, `backend/app/main.py`, `backend/app/services/local_scope.py` (`LOCAL_USER_ID`),
router pattern from `health.py`.

### Acceptance criteria

- New `services/auth.py`: constant-time password check; sign/verify session cookie (e.g. `itsdangerous` or stdlib HMAC + expiry); payload includes `user_id: "local"` and expiry.
- New `routers/auth.py`:
  - `POST /api/auth/login` — JSON `{ "password": string }` → sets HTTP-only cookie; 401 on bad password
  - `POST /api/auth/logout` — clears cookie
  - `GET /api/auth/me` — 200 `{ "ok": true }` when session valid; 401 otherwise
- New dependency `require_session` applied to **all** existing API routers (or global middleware) except:
  - `GET /api/health`
  - `POST /api/auth/login`
- Cookie flags in production: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`
- `APP_DEV_MODE=false` → `dev` router not registered (existing behaviour preserved).
- Pydantic schemas in `schemas/auth.py` (or equivalent); `mypy --strict` clean.

### Edge cases

- Missing `AUTH_PASSWORD` in prod → fail fast at startup with clear error.
- Local dev without `AUTH_PASSWORD`: document bypass or dev password in `.env.example` for optional local auth testing.
- Session expired → 401 JSON (same shape as other API errors).

---

## B11.5 — Authentication API tests

**Type:** test (may precede B11.4 per test-first workflow)  
**Owner:** none  
**Reuse:** `backend/app/tests/conftest.py`, httpx test client pattern from existing route tests.

### Acceptance criteria

- Test: `GET /api/dashboard` without cookie → 401.
- Test: `POST /api/auth/login` wrong password → 401; correct password → 200 + `Set-Cookie`.
- Test: after login, `GET /api/dashboard` → 200 (empty/minimal fixture).
- Test: `GET /api/health` without cookie → 200.
- Test: with `APP_DEV_MODE=false`, `POST /api/dev/reset` → 404.
- Test: logout clears session (`GET /api/dashboard` → 401 after logout).

### Edge cases

- Use test settings override for `AUTH_PASSWORD` and `SESSION_SECRET` in conftest.

---

## B11.6 — Optional CORS from settings

**Type:** backend  
**Owner:** none  
**Reuse:** `backend/app/main.py`, `settings.CORS_ORIGINS`.

### Acceptance criteria

- When `CORS_ORIGINS` env is non-empty (comma-separated list), register `CORSMiddleware` with `allow_credentials=True`, methods/headers needed for API.
- When unset, no CORS middleware (Netlify proxy path unchanged).
- Unit or integration smoke: not required if proxy is primary; document in `docs/deploy.md`.

### Edge cases

- Trailing spaces in origin list trimmed.

---

## F11.1 — API client session credentials and 401 handling

**Type:** frontend  
**Owner:** none  
**Reuse:** `frontend/src/lib/api/client.ts`, `ApiError`, existing `apiFetch` callers.

### Acceptance criteria

- `apiFetch` / `apiFetchOrNullOn404` use `credentials: 'include'`.
- Optional `VITE_API_BASE_URL` prefixes paths when set (default empty).
- On 401: throw `ApiError` with status 401; export a type guard or helper `isUnauthorizedError` for UI.
- Existing tests updated; new test: mock 401 response handled.
- Local Vite proxy dev flow still works when auth disabled or dev password set.

### Edge cases

- 401 on optional reads (`apiFetchOrNullOn404`) — do not treat as 404.

---

## F11.2 — Login screen and authenticated app shell

**Type:** frontend  
**Owner:** optional local manual test; prod check in O11.2  
**Reuse:** `frontend/src/App.tsx`, `AppFatalError`, existing form/input components, `apiFetch`.

### Acceptance criteria

- New `LoginScreen` (or route): password field + submit → `POST /api/auth/login`; show API error message on failure.
- `App.tsx` (or provider): on initial load, if dashboard/engine fetch returns 401, show login instead of main shell.
- After successful login, load `useMilestoneEngine` / main app as today.
- Logout control in Settings (footer): calls `POST /api/auth/logout` and returns to login.
- `VITE_DEV_MODE=false` hides dev reset UI (existing).
- Vitest: login screen renders; successful login mock shows dashboard shell.
- TypeScript strict clean.

### Edge cases

- Cold start on Render: login submit may be slow — disable double-submit on button.
- Session persists across browser restarts within max age (manual O11.2).

---

## I11.1 — Netlify config and deploy template

**Type:** infra / docs  
**Owner:** O11.1 updates Render host if placeholder used  
**Reuse:** `plans/technical-design-production-deploy-2026-06-04.md` §5.

### Acceptance criteria

- `frontend/netlify.toml` committed with:
  - build `npm ci && npm run build`, publish `dist`
  - force proxy `/api/`* → `https://REPLACE_ME.onrender.com/api/:splat` with comment to replace after first Render deploy
  - SPA fallback `/*` → `/index.html`
- `docs/deploy.md` section “Netlify” with build settings screenshot-level bullet list and GitHub connect steps.
- `AGENTS.md` ticket source line updated to this file (Planner / follow-up commit).

### Edge cases

- Document that owner must replace `REPLACE_ME` during O11.1 before phone smoke.

---

## I11.2 — Deploy runbook and Supabase backup docs

**Type:** docs  
**Owner:** none  
**Reuse:** `plans/TRD.md` §12.6, `README.md`, `plans/feature-brief-production-deploy-2026-06-04.md`.

### Acceptance criteria

- `docs/deploy.md` (or expanded README §Deploy) includes:
  - O11.0 / O11.1 / O11.2 checklists (or links to this ticket file)
  - Env matrix (local vs prod)
  - “Never run seed in production”
  - Supabase backup: dashboard backup + optional `pg_dump` one-liner
  - Render cold start note
  - Security: protect Render URL with app auth, not Netlify-only
- Cross-link from `plans/TRD.md` §12 if not duplicated verbatim.

### Edge cases

- No real secrets in committed docs.

---

## Phase 11 definition of done

- O11.0, O11.1, O11.2 complete (owner)
- All B11.*, F11.*, I11.* tickets committed on `feat/phase-11-production`
- `make lint` and `make test` green at end-of-batch handoff
- Production app usable on Android Chrome with empty DB and session auth
- Owner reviewed; owner decides merge to `main`

---

## Unresolved assumptions

- Render deploy uses Dockerfile from `backend/`; if Render blueprint (`render.yaml`) is added, keep in sync with B11.3.
- Local dev may skip auth until `AUTH_PASSWORD` set — implementer documents chosen behaviour in `.env.example`.
- GitHub → Netlify production branch: `feat/phase-11-production` until merge, then `main`.

---

**Planner status:** `SIGNED OFF`