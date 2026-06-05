# Technical Design — Production Deploy (Phase 11)
**Date:** 2026-06-04  
**Status:** APPROVED  
**Feature brief:** `plans/feature-brief-production-deploy-2026-06-04.md`

---

## Architecture boundary check

| Boundary | Verdict |
| --- | --- |
| No business logic in routers | ✓ — login + session validation in services |
| No hardcoded config | ✓ — `SESSION_SECRET`, `AUTH_PASSWORD` (or hash) in env |
| No schema change without Alembic | ✓ — v1 auth uses signed cookie, no new tables |
| No `any` in TypeScript | ✓ — typed login response / 401 handling |
| Secrets not committed | ✓ — platform env vars only |

---

## 1. Target topology

```
┌─────────────────┐     HTTPS      ┌──────────────────────────────┐
│ Android Chrome  │ ──────────────▶ │ Netlify (static + /api proxy) │
│ (Pixel 9 Pro)   │                 │  dist/ + netlify.toml         │
└─────────────────┘                 └──────────────┬───────────────┘
                                                   │ /api/* proxy
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │ Render Web Service (Docker)   │
                                    │ FastAPI + uvicorn             │
                                    └──────────────┬───────────────┘
                                                   │ DATABASE_URL
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │ Supabase Postgres (free)      │
                                    └──────────────────────────────┘

Local dev (unchanged):
  Vite :5151 ──proxy──▶ Docker backend :8084 ──▶ SQLite ./data/milestone.db
```

**GitHub → Netlify:** push to `main` (or chosen branch) triggers frontend build. Backend deploy is separate (Render dashboard or GitHub integration per owner setup).

---

## 2. Database

### Production

- **Provider:** Supabase free tier Postgres.
- **URL shape:** `postgresql+psycopg://...` (use Supabase **connection pooling** URI if direct connection fails from Render).
- **Provision:** create project → copy connection string → set `DATABASE_URL` on Render.
- **Migrate:** `alembic upgrade head` in container start command (before uvicorn).
- **Seed:** **do not** run `backend/scripts/seed.py` in production.

### Local

- Unchanged: `DATABASE_URL=sqlite:///./data/milestone.db` in repo-root `.env`.
- Docker Compose volume `./data:/app/data`.

### Verification

- Add or extend CI/test: run `alembic upgrade head` against ephemeral Postgres (e.g. service container or `testcontainers`) before first prod deploy.
- Smoke-test critical routes on Postgres in integration tests if not already covered.

### Backup (owner priority: do not lose prod data)

- Document in deploy runbook:
  - Supabase dashboard → backups / point-in-time (per plan tier)
  - Periodic manual `pg_dump` or Supabase export to owner storage
- Optional ticket: scripted export command (out of band cron — backlog if not in Phase 11)

---

## 3. Backend — Render

### Docker production CMD

Replace dev `--reload` with:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}
```

Render injects `PORT`; map service to listen on `$PORT`.

### Dependencies

- Add `psycopg` (or `psycopg[binary]`) to backend dependencies for Postgres driver.

### Environment variables (Render)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase Postgres URL |
| `SESSION_SECRET` | yes | Long random string; signs session cookie |
| `AUTH_PASSWORD` | yes | Plain shared password (or `AUTH_PASSWORD_HASH` if bcrypt) |
| `SESSION_MAX_AGE_DAYS` | no | Default `30` for multi-week sessions |
| `APP_DEV_MODE` | yes | `false` |
| `CORS_ORIGINS` | no | Empty if all traffic via Netlify proxy; set if testing split-origin |

### Health check

- Path: `/api/health`
- Render health check interval per free tier docs

### Security

- `APP_DEV_MODE=false` — excludes `POST /api/dev/reset` router registration (`main.py`).
- All `/api/*` routes except `/api/health` and `/api/auth/login` require valid session.

---

## 4. Auth — session cookie (no new DB tables)

### Flow

1. User opens Netlify URL → SPA loads → `GET /api/dashboard` (or dedicated `/api/auth/me`) returns **401** if no cookie.
2. SPA shows login form → `POST /api/auth/login` with `{ "password": "..." }`.
3. Backend compares password to env (constant-time compare); on success sets **HTTP-only** cookie:
   - `Secure` (prod HTTPS)
   - `SameSite=Lax`
   - `Path=/`
   - Signed payload (e.g. `itsdangerous` or sealed JWT) containing expiry + `user_id: "local"`
4. Subsequent `fetch` calls use `credentials: 'include'`.
5. FastAPI dependency `require_session` validates cookie → continues to use `LOCAL_USER_ID` in services.

### Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Session (clears cookie) |
| GET | `/api/auth/me` | Session (optional; returns `{ ok: true }`) |
| * | All other `/api/*` | Session required |

### Why not Netlify-only Basic Auth

Split hosting exposes `*.onrender.com` directly. App-level session protects the API regardless of entry URL.

### Session duration

- Default max age **30 days** (owner: weeks per device).
- Refresh on activity optional (backlog); sliding expiry not required for v1.

---

## 5. Frontend — Netlify

### Build settings

| Setting | Value |
| --- | --- |
| Base directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `frontend/dist` |

### `netlify.toml` (repo root or `frontend/` per Netlify base dir)

If base directory is `frontend`, place file at `frontend/netlify.toml`:

```toml
[build]
  command = "npm ci && npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://<RENDER_SERVICE_HOST>/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Replace `<RENDER_SERVICE_HOST>` with actual Render hostname after first deploy (or document placeholder update in B11.7).

### API client

- `apiFetch`: add `credentials: 'include'`.
- Optional `VITE_API_BASE_URL` prefix (default `''`) for future split-origin debugging.
- On **401**: redirect to login route / show `LoginScreen`.

### Dev mode

- `VITE_DEV_MODE=false` in Netlify env — hides reset mock UI.

### GitHub integration

- Connect repo in Netlify; deploy previews optional; production branch `main`.

---

## 6. CORS

- **Primary path:** Netlify proxy → browser sees same origin → **CORS not required** for normal use.
- Add optional `CORSMiddleware` in `main.py` when `CORS_ORIGINS` is set (comma-separated) for Swagger on Render or split-origin tests.

---

## 7. Environment matrix

| Variable | Local dev | Production |
| --- | --- | --- |
| `DATABASE_URL` | SQLite file | Supabase Postgres |
| `APP_DEV_MODE` | `true` optional | `false` |
| `VITE_DEV_MODE` | `true` optional | `false` |
| `VITE_API_BASE_URL` | empty | empty (proxy) |
| `SESSION_SECRET` | dev default in `.env.example` | Render secret |
| `AUTH_PASSWORD` | optional local | Render secret |

---

## 8. Owner deploy runbook (acceptance)

1. Create Supabase project; save `DATABASE_URL`.
2. Create Render Web Service from `backend/Dockerfile`; set env vars; deploy; note hostname.
3. Create Netlify site; set build; add env; set `netlify.toml` proxy target to Render host; connect GitHub.
4. `alembic upgrade head` runs on Render start — confirm tables in Supabase Table Editor (empty).
5. Open Netlify URL on phone → login → empty dashboard.
6. Create class, activity, log entry, morning check-in, goal — full smoke.
7. Confirm `POST /api/dev/reset` returns 404 in prod.
8. Restart Render service → data still present.
9. Note Supabase backup/export steps in personal ops doc.

---

## 9. Ticket breakdown (for Planner)

Dependency order — Planner writes `plans/tickets-phase-11-production-2026-06-04.md`:

| ID | Title | Layer |
| --- | --- | --- |
| B11.1 | Add `psycopg`; document Postgres `DATABASE_URL` in `.env.example` | Backend |
| B11.2 | Postgres migration verification test (ephemeral DB or documented CI job) | Backend/test |
| B11.3 | Production Dockerfile CMD + Render env template | Backend/infra |
| B11.4 | Session auth service + login/logout/me routes + `require_session` dependency | Backend |
| B11.5 | Auth API tests (401 without cookie, login success, dev reset disabled) | Test |
| B11.6 | Frontend `credentials: 'include'` + 401 → login | Frontend |
| B11.7 | `LoginScreen` + route guard | Frontend |
| B11.8 | `netlify.toml` + README Netlify/Render setup | Infra/docs |
| B11.9 | Optional narrow CORS from settings | Backend |
| B11.10 | Deploy runbook + Supabase backup section in TRD/README | Docs |
| B11.11 | Archive + PRD/TRD/AGENTS (this batch — may be done pre-implementation) | Docs |

Owner manual smoke is acceptance gate after implementation batch.

---

## 10. Future stages (PRD reference only)

- **Stage 2:** PWA, UX polish from usage.
- **Stage 3:** Strava + Health integrations (`external_id`, OAuth tables — schema decision then).
- **Stage 4:** MCP tools server with API key or session auth.

---

**Final status:** `SIGNED OFF`
