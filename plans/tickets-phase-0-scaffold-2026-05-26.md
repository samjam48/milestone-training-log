# Phase 0 — Scaffold Tickets
*Source: plans/TRD.md §7 Phase 0 | Date: 2026-05-26*

## Ticket ordering rationale

B0.1 must come first because it creates the entire `backend/` directory tree,
`pyproject.toml`, and `Makefile`. Without these there is no Python package to
import, no test runner to invoke, and no lint commands to wire.

B0.2 depends on B0.1 because `docker-compose.yml` references the `backend/`
directory for its build context and expects the `pyproject.toml` to be present
for the image build step.

B0.3 depends on B0.1 (the package structure and test runner must exist) and
should be done with B0.2 available so the full `docker compose up` verification
step is reachable. The test file must be written before the router is
implemented (tests-before-code constraint).

---

## B0.1 — Repo structure, pyproject.toml, and Makefile

**Type:** devops
**Branch:** feat/phase-0-scaffold
**Depends on:** none

### Acceptance criteria
- `backend/` directory exists at repo root with the following sub-tree fully
  created (empty `__init__.py` files where required to form valid Python packages):
  ```
  backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py           (stub: FastAPI app factory, no routes yet)
  │   ├── settings.py       (reads .env; exposes DATABASE_URL, APP_VERSION)
  │   ├── database.py       (engine + get_session stub; no tables yet)
  │   ├── models/
  │   │   └── __init__.py
  │   ├── schemas/
  │   │   └── __init__.py
  │   ├── routers/
  │   │   └── __init__.py
  │   ├── services/
  │   │   └── __init__.py
  │   └── tests/
  │       └── __init__.py
  ├── alembic/              (empty directory; alembic init happens in B1.2)
  ├── pyproject.toml
  └── .env.example
  ```
- `backend/pyproject.toml` declares `[project]` with `name = "milestone-backend"`,
  `requires-python = ">=3.12"`, and the following runtime dependencies at minimum:
  - `fastapi>=0.115`
  - `sqlmodel>=0.0.21`
  - `alembic`
  - `uvicorn[standard]`
  - `python-dotenv`
- `backend/pyproject.toml` declares `[project.optional-dependencies]` `dev` group
  containing at minimum: `pytest`, `pytest-asyncio`, `httpx`, `ruff`, `mypy`.
- `backend/pyproject.toml` includes `[tool.ruff]` section targeting `backend/app`
  with at least `select = ["E", "F", "I"]` and `line-length = 100`.
- `backend/pyproject.toml` includes `[tool.mypy]` section with `strict = true`.
- `backend/pyproject.toml` includes `[tool.pytest.ini_options]` with
  `asyncio_mode = "auto"` and `testpaths = ["app/tests"]`.
- `backend/.env.example` contains at minimum:
  ```
  DATABASE_URL=sqlite:///./data/milestone.db
  APP_VERSION=0.1.0
  ```
  No real secrets or credentials are present in `.env.example`.
- `backend/app/settings.py` reads values from `.env` using `pydantic-settings`
  or `python-dotenv` and exposes at minimum `DATABASE_URL: str` and
  `APP_VERSION: str`. It must be the single import point for all env-backed
  config; no other file should call `os.getenv` or `os.environ` directly.
- `backend/app/main.py` is a valid FastAPI app factory stub: imports `FastAPI`,
  creates an `app` instance, exports it. No routes registered yet.
- `Makefile` at repo root defines exactly these three targets:
  - `make dev` — runs `docker compose up` (or equivalent local hot-reload command)
  - `make test` — runs `pytest --cov=backend/app --cov-fail-under=80` scoped to
    the backend package (run from `backend/` or with correct `--rootdir`)
  - `make lint` — runs `ruff check backend/` then `mypy backend/app --strict`
- Running `make lint` from repo root succeeds (exit 0) on the stub files.
- Running `make test` from repo root fails only because there are no test files
  yet (empty test suite warning is acceptable; a lint or import error is not).
- `.gitignore` at repo root ignores `.env`, `data/`, `*.db`, `__pycache__/`,
  `.mypy_cache/`, `.pytest_cache/`, `*.egg-info/`.

### Files to create / modify
- `backend/app/__init__.py` — empty, marks package
- `backend/app/main.py` — FastAPI stub
- `backend/app/settings.py` — env-backed settings module
- `backend/app/database.py` — SQLite engine stub (no tables yet)
- `backend/app/models/__init__.py` — empty
- `backend/app/schemas/__init__.py` — empty
- `backend/app/routers/__init__.py` — empty
- `backend/app/services/__init__.py` — empty
- `backend/app/tests/__init__.py` — empty
- `backend/alembic/` — empty directory (placeholder; `alembic init` runs in B1.2)
- `backend/pyproject.toml` — full tool config as above
- `backend/.env.example` — documented env var template
- `Makefile` — repo-root Makefile with `dev`, `test`, `lint` targets
- `.gitignore` — update to include all items listed above if not already present

### Edge cases
- `settings.py` must not crash on import if `.env` is absent; it should fall
  back to environment variables already set in the shell (Docker will inject
  these at runtime).
- `Makefile` targets must work from repo root, not from `backend/`. Use
  `cd backend && ...` or `--rootdir` flags where needed so paths resolve
  correctly.
- `pyproject.toml` is the only place tool configuration lives; do not create
  separate `setup.cfg`, `setup.py`, or `tox.ini`.

### Notes
- **AGENTS.md constraint:** No hardcoded config. `settings.py` is the single
  source for all env-backed values. Any future file needing `DATABASE_URL` must
  import from `app.settings`, not from `os`.
- **AGENTS.md constraint:** No secrets committed. `.env.example` contains
  placeholder values only; `.env` must be gitignored.
- **TRD §2 stack:** `mypy --strict` must be wired in `make lint` now so the
  quality gate is enforced from the first commit.
- The `alembic/` directory is a placeholder here; `alembic.ini` and the full
  Alembic init are B1.2 scope. Do not run `alembic init` in this ticket.
- `backend/app/database.py` at this stage only needs the engine creation line
  and a `get_session` function stub; it does not need to create tables (that
  is B1.2).

---

## B0.2 — docker-compose.yml

**Type:** devops
**Branch:** feat/phase-0-scaffold
**Depends on:** B0.1

### Acceptance criteria
- `docker-compose.yml` exists at repo root and defines exactly two services:
  `backend` and `frontend`.
- `backend` service:
  - Builds from `./backend` (Dockerfile in `backend/`).
  - Maps container port `8000` to host port `8000`.
  - Mounts `./data` as a bind-mount volume to `/app/data` inside the container
    so the SQLite file persists across container restarts.
  - Passes environment variables from a `.env` file in the repo root (via
    `env_file: .env` or equivalent) so no values are hardcoded in
    `docker-compose.yml`.
  - Starts uvicorn with the `--reload` flag so source changes inside the
    mounted working directory are picked up without a full rebuild.
  - Has a `healthcheck` defined: `test: ["CMD", "curl", "-f",
    "http://localhost:8000/api/health"]`, `interval: 10s`, `timeout: 5s`,
    `retries: 5`. (The health endpoint does not exist yet; the healthcheck will
    pass once B0.3 is complete.)
- `frontend` service:
  - Builds from `./frontend` (Dockerfile in `frontend/`), OR uses a placeholder
    image (`node:20-alpine`) with a `command: echo "frontend placeholder"` if the
    `frontend/` directory does not yet exist — allowing B0.2 to land before Phase 6.
  - Maps container port `5173` to host port `5173`.
  - Has a simple healthcheck or `depends_on` declaration so `docker compose up`
    does not exit immediately on the frontend stub.
- `docker-compose.yml` references no hardcoded secret values; all
  environment-specific config flows through `.env`.
- `./data/` directory must be listed in `.gitignore` (verified by B0.1, but
  confirm it is present).
- A `backend/Dockerfile` exists that:
  - Uses a `python:3.12-slim` base image.
  - Installs dependencies from `pyproject.toml` (e.g. via `pip install -e .[dev]`
    or `pip install` with a generated requirements file).
  - Sets `WORKDIR /app` and copies the `backend/app/` source.
  - Exposes port `8000`.
  - Default `CMD` runs uvicorn: `uvicorn app.main:app --host 0.0.0.0 --port 8000
    --reload`.
- Running `docker compose config` from repo root exits 0 with no validation
  errors.
- Running `docker compose up` starts both containers without immediate crash.
  (Full health-check green depends on B0.3.)

### Files to create / modify
- `docker-compose.yml` — repo root, two-service compose file
- `backend/Dockerfile` — Python 3.12 slim image, uvicorn entrypoint
- `.gitignore` — confirm `data/` is ignored (likely already set in B0.1)

### Edge cases
- The `./data` directory will not exist in a fresh clone. The volume bind-mount
  must not cause Docker to error; Docker creates the host-side directory
  automatically on `up`, but document this in a comment inside
  `docker-compose.yml`.
- The `--reload` flag only hot-reloads when the source directory is mounted into
  the container. The `backend/Dockerfile` must mount or `COPY` sources and the
  compose file must bind-mount `./backend/app:/app/app` (or equivalent) so that
  reloads are actually triggered by local file changes.
- If `.env` does not exist at repo root (e.g. first clone), `docker compose up`
  must not crash silently. Add a note in the README or a comment in
  `docker-compose.yml` that `.env` must be created from `.env.example` before
  first run.
- `frontend` service stub must not cause `docker compose up` to exit with a
  non-zero code. Use `restart: "no"` on the stub so it does not loop-crash.

### Notes
- **AGENTS.md constraint:** No hardcoded config in `docker-compose.yml`. All
  values come from `.env` via `env_file`.
- **TRD §1 architecture:** The Vite proxy (`/api → http://backend:8000`) belongs
  in `vite.config.ts` (Phase 6, F1.1), not here. Do not attempt to configure
  it in this ticket.
- **TRD §3 repo layout:** `data/` is the SQLite volume mount location; keep it
  consistent with `DATABASE_URL=sqlite:///./data/milestone.db` in `.env.example`.
- The frontend `Dockerfile` (for Phase 6) is out of scope here. The frontend
  service stub is sufficient to validate compose syntax and allow the backend
  to come up in the correct network context.

---

## B0.3 — GET /api/health endpoint and test

**Type:** backend
**Branch:** feat/phase-0-scaffold
**Depends on:** B0.1 (package structure, test runner); B0.2 recommended for
full docker-compose verification but not strictly required for the unit test

### Acceptance criteria

**Test (written before production code):**
- `backend/app/tests/test_health.py` exists and contains at least one test named
  to describe observable behavior (e.g. `test_health_returns_ok`).
- The test uses `httpx.AsyncClient` with `ASGITransport` pointing at the FastAPI
  `app` instance (no live server required).
- The test asserts: HTTP status code is `200`.
- The test asserts: response body JSON equals exactly
  `{"status": "ok", "version": "0.1.0"}`.
- The test file is runnable via `pytest` and fails (because the endpoint does not
  exist yet) before the router is implemented.

**Production code (written after the failing test exists):**
- `backend/app/routers/health.py` exists and defines a single `GET /api/health`
  route.
- The route returns `{"status": "ok", "version": "0.1.0"}` where `"0.1.0"` is
  read from `settings.APP_VERSION`, not hardcoded.
- The router is registered on the FastAPI app in `backend/app/main.py` with no
  prefix (the `/api` prefix is part of the route path itself to match the
  docker-compose proxy expectation).
- Running `make test` from repo root exits 0 with the health test passing.
- Running `make lint` (`ruff check` + `mypy --strict`) exits 0 on all
  `backend/app/` files including the new router.
- `curl localhost:8000/api/health` returns HTTP 200 and the JSON body above when
  the docker compose stack is up.

### Files to create / modify
- `backend/app/tests/test_health.py` — test file (written first; must fail
  before the router exists)
- `backend/app/routers/health.py` — thin GET handler, reads version from settings
- `backend/app/routers/__init__.py` — update if router registration uses
  package-level imports
- `backend/app/main.py` — register the health router

### Edge cases
- `APP_VERSION` must be sourced from `settings.py`, not from a string literal
  in the router. This ensures the version shown by the endpoint stays consistent
  with the `pyproject.toml` `version` field (which can be kept in sync manually
  at this stage; a dynamic `importlib.metadata` approach is BACKLOG scope).
- The test must use `ASGITransport` (not `TestClient` from Starlette) so it stays
  compatible with `asyncio_mode = "auto"` configured in `pyproject.toml`.
- `mypy --strict` requires explicit return type annotation on the route function.
  Use `dict[str, str]` or a typed `TypedDict`/Pydantic schema as the return type.
- Do not add a `response_model=` to the route at this stage; a plain `dict`
  return is sufficient for the health endpoint.

### Notes
- **AGENTS.md constraint (tests before code):** `test_health.py` must be
  committed and runnable (and failing) before `health.py` is created. The
  test-writer agent handles this step; the implementer must not write the
  router until the test exists.
- **AGENTS.md constraint (no hardcoded config):** Version string in the response
  comes from `settings.APP_VERSION` which reads `APP_VERSION` from `.env`.
- **TRD §5 API contract:** The health route is `GET /api/health`. The `/api`
  prefix is part of the path string in the router, not a FastAPI `prefix=`
  argument, so it is consistent with how all other routes will be mounted.
- **patterns.md (backend route and service split):** The health route has no
  business logic and no database access so no service layer is needed. The
  router function may return directly. This is the only acceptable exception
  to the router/service split rule.
- **patterns.md (test naming):** Name the test after observable behavior, not
  the ticket. `test_health_returns_ok` is appropriate.
- **Phase verification gate:** Once B0.3 is complete, the full Phase 0
  verification is reachable: `docker compose up` → both containers healthy →
  `curl localhost:8000/api/health` returns 200 OK.

---

## Unresolved assumptions

1. **Frontend Dockerfile (Phase 6 scope):** B0.2 uses a stub (`node:20-alpine`
   placeholder) for the frontend service because `frontend/` does not exist
   until Phase 6 (F1.1). The stub is explicitly acceptable per the TRD's phased
   plan, but the implementer must confirm that `docker compose up` does not
   immediately exit non-zero due to the stub container finishing. Using
   `command: tail -f /dev/null` or `restart: "no"` with a health-check-free
   definition is the recommended approach; implementer should pick the one that
   produces the cleanest compose output.

2. **`pydantic-settings` vs `python-dotenv`:** The TRD specifies `python-dotenv`
   as a dependency but the idiomatic FastAPI settings pattern uses
   `pydantic-settings` (which wraps dotenv internally). Either is acceptable
   here; recommend `pydantic-settings` for cleaner type-safety but this is the
   implementer's call. If `pydantic-settings` is chosen, add it to
   `pyproject.toml` dependencies.

3. **Coverage gate on empty test suite (B0.1):** `make test` with
   `--cov-fail-under=80` will error on an empty test suite in some pytest-cov
   versions. The Makefile `test` target for Phase 0 may need to omit
   `--cov-fail-under=80` until at least one test file exists, or use
   `--no-cov` in the B0.1 step. The flag should be present by the time B0.3
   is committed. Implementer should decide and document in the Makefile with a
   comment.

## Status
SIGNED OFF
