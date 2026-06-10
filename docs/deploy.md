# Production deployment

This runbook covers hosting the Milestone backend on **Render**, frontend on **Netlify**, and production data on **Supabase**. Operational detail also lives in [`plans/TRD.md` §12](../plans/TRD.md#12-production-deployment-phase-11) (services, matrix, backup).

Owner checklists **O11.0**–**O11.2** are in [`plans/tickets-phase-11-production-2026-06-04.md`](../plans/tickets-phase-11-production-2026-06-04.md) (all complete as of 2026-06-05).

## Current production status (2026-06-05)

| Item | Value |
| ---- | ----- |
| **App (daily use)** | [https://milestone-activity.netlify.app](https://milestone-activity.netlify.app) |
| **Backend (direct)** | [https://milestone-training-log.onrender.com](https://milestone-training-log.onrender.com) |
| **Health** | `GET /api/health` on either host (Netlify proxies `/api/*` to Render) |
| **Git deploy branch** | `main` (Render + Netlify) |
| **Database** | Supabase project `milestone` — **Session pooler** `DATABASE_URL` on Render (not direct `db.*` host; required for Render IPv4) |
| **Auth** | Shared password + session cookie; `APP_DEV_MODE=false`, `VITE_DEV_MODE=false` in prod |
| **Data** | Schema via explicit `alembic upgrade head` operator step when migrations are present; **no seed** in production |

**Operator notes from first deploy:**

- URL-encode special characters in `DATABASE_URL` passwords (e.g. `*` → `%2A`).
- Alembic reads `DATABASE_URL` directly (`backend/alembic/env.py`) so `%` in encoded passwords does not break ConfigParser.
- `frontend/netlify.toml` proxies `/api/*` to `milestone-training-log.onrender.com`.
- Render free tier: expect cold-start delay after idle (see below).

## Production setup — first use on production

Production starts with an empty database after deploy (schema only). **Never run `scripts/seed.py` against Supabase** — use seed only against local SQLite during development.

Open the [Netlify app URL](https://milestone-activity.netlify.app) and complete setup in this order:

1. **Sign in** with the shared app password.
2. **Activity classes** — Settings → **+ New class** (name, type, optional description).
3. **+ New Activity** — Log tab (or Settings → Activities) to add an activity.
4. **Weekly rules** — Settings → **Weekly rules** (current calendar week is auto-created; use **Edit rules**).
5. **+ Log Activity** on the Log tab; **Morning check-in** on the Dashboard tab.

Stage 2 polish context: [`plans/PRD.md` §10](../plans/PRD.md#10-stage-2--use-driven-polish).

## Environment matrix

Local development uses SQLite; production uses Supabase Postgres. Do not point a production `DATABASE_URL` at SQLite.

| Variable | Local | Production |
| -------- | ----- | ---------- |
| `DATABASE_URL` | `sqlite:///./data/milestone.db` | Supabase **Session pooler** `postgresql+psycopg://...` (URL-encode password) |
| `APP_DEV_MODE` | optional `true` in `.env` | `false` on Render |
| `VITE_DEV_MODE` | optional `true` | `false` on Netlify |
| `VITE_API_BASE_URL` | empty (Vite dev proxy) | empty (browser uses Netlify `/api` proxy) |
| `SESSION_SECRET` | dev value in `.env.example` | long random secret on Render |
| `AUTH_PASSWORD` | optional locally | required on Render (shared app password) |
| `SESSION_MAX_AGE_DAYS` | optional | default `30` |
| `CORS_ORIGINS` | unset for same-origin dev | unset when API is only reached via Netlify proxy |

**Never run seed in production.** Use `scripts/seed.py` only against a local SQLite database during development. Production starts with an empty database after the explicit schema migration step; do not run `scripts.seed` or any seed command in prod.

## Security: Render URL and app auth

The public site is served from Netlify (`*.netlify.app`), which proxies `/api/*` to Render. The backend also has a direct **Render service URL** (`https://<service>.onrender.com`). That hostname is not hidden behind Netlify alone — anyone who discovers it can call the API directly.

Protection is **app auth** (session cookies after `POST /api/auth/login` with `AUTH_PASSWORD`), not a Netlify-only gate. Do not rely on Netlify as the only security boundary; unauthenticated callers hitting the Render URL must still get 401 on protected routes. Keep `AUTH_PASSWORD` and `SESSION_SECRET` only in Render env (and your password manager), never in the frontend build.

## Render cold start

Render free-tier Web Services **sleep** after idle traffic. The first request after sleep incurs a **cold start** (container boot, then uvicorn). Expect several seconds of delay on the first `/api/health` or login after idle; subsequent requests are warm until the service sleeps again. This is acceptable for personal daily use; use the Netlify URL for routine phone access.

## Recovery: migration-backed deploy timeout

Use this SOP for the 2026-06-08 style failure where a deploy runs database migrations, Render does not promote the new web service cleanly, and the next booting image cannot see the database revision that is already recorded in Supabase.

### Symptoms

- Render deploy logs show a timeout or port scan failure after a deploy that appeared to start.
- Supabase `alembic_version` is ahead of the migration files available to the image that is currently booting.
- Render logs include `Can't locate revision identified by '<revision>'`.
- Netlify `/api/health` returns 5xx or times out while old and new backend processes are mixed, restarting, or unavailable.

### Owner recovery steps

1. In Render, open the backend web service and confirm it deploys from `main`.
2. Choose **Manual Deploy** from `main`. Prefer **Clear build cache & deploy** when the image/cache state is suspect, the deployed commit is unclear, or logs suggest an older image is booting.
3. Watch Render logs until the deploy says `Your service is live`. Keep watching briefly and confirm there are no later timeout or port scan messages.
4. Verify direct Render health: [https://milestone-training-log.onrender.com/api/health](https://milestone-training-log.onrender.com/api/health).
5. Verify Netlify proxy health: [https://milestone-activity.netlify.app/api/health](https://milestone-activity.netlify.app/api/health).
6. Do **not** manually edit Supabase `alembic_version` unless there is a separately planned database repair. If the database is already stamped to the expected head, the usual recovery is to get the matching backend image live.

### Triage notes

- **Direct Render health works, Netlify health fails:** backend is up; investigate Netlify redirects/proxy config, deploy status, or Netlify edge errors.
- **Both health checks work, app login fails:** health is no longer the issue; investigate auth/session settings and backend auth logs (`AUTH_PASSWORD`, `SESSION_SECRET`, cookies).
- **Slow first request only:** a Render free-tier cold start can take several seconds after idle. Treat it as normal if one refresh later returns 200 and logs show a clean Uvicorn start. Treat repeated 5xx, timeouts, restart loops, or port scan failures as an incident.

## Supabase backup

Production data lives in Supabase Postgres. Back up before risky changes (schema deploys, manual SQL).

**Dashboard (recommended):** In the [Supabase](https://supabase.com/) project → **Database** → **Backups**, use the plan’s scheduled backups or on-demand backup/export if your tier provides it. Note retention and restore steps in the Supabase docs for your plan.

**Optional `pg_dump` one-liner** (manual export; use the connection string from Supabase → **Project settings** → **Database**, not committed to git):

```bash
pg_dump "$DATABASE_URL" -Fc -f milestone-prod-$(date +%Y%m%d).dump
```

Store dump files offline (encrypted disk or password manager attachment policy). Test restore on a throwaway database before you depend on a backup.

## Render Web Service

### Repository layout

- **Root directory:** `backend/` (build context is the backend folder).
- **Dockerfile path:** `backend/Dockerfile` (or set Render’s root directory to `backend` and use `Dockerfile`).

The production image serves the API directly:

```text
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}
```

Render injects `PORT`; the default `8084` applies only when `PORT` is unset (e.g. local image runs).

When a deployment includes new files under `backend/alembic/versions/`, run the schema migration as an explicit operator step before or during the production deploy, not as the web container start command. The canonical migration command remains:

```text
alembic upgrade head
```

### Health check

- **Path:** `/api/health`
- Expect a successful JSON health response when the service is up.

### Required environment variables

Set these on the Render service (values come from **O11.0**; first deploy wiring is **O11.1** — see `plans/tickets-phase-11-production-2026-06-04.md`):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Supabase Postgres URL (`postgresql+psycopg://...`) |
| `SESSION_SECRET` | Signing key for session cookies |
| `AUTH_PASSWORD` | Shared app login password |

Also set `APP_DEV_MODE=false` for production. Optional: `SESSION_MAX_AGE_DAYS`, `CORS_ORIGINS` (omit when the browser only calls the API via the Netlify `/api` proxy — same origin, no CORS).

**Do not** commit secrets to the repo. Store values in a password manager and paste them into Render’s dashboard during **O11.1**.

### After deploy

1. Open `https://<RENDER_SERVICE_HOST>/api/health` and confirm OK.
2. Continue Netlify proxy and login checks per **O11.1**.

## Netlify

Host the React app on Netlify with GitHub-connected deploys. The committed `frontend/netlify.toml` defines build, publish, API proxy, and SPA routing; the owner replaces the Render placeholder during **O11.1**.

**Site settings** (Netlify dashboard or `frontend/netlify.toml`):

- **Base directory:** `frontend` (repo root is not the site root).
- **Build command:** `npm ci && npm run build` (matches `[build]` in `frontend/netlify.toml`).
- **Publish directory:** `dist` (relative to `frontend/`, i.e. `frontend/dist` on disk).

Optional environment variables on the Netlify site (production): `VITE_DEV_MODE=false`. No API secrets belong in the frontend build; the browser calls `/api/*` on the same origin.

**Connect GitHub repository:**

1. Log in to [Netlify](https://www.netlify.com/) and choose **Add new site** → **Import an existing project**.
2. Select **GitHub** and authorize the Netlify GitHub integration for your account or organization.
3. Choose the **milestone-training-log** repository (or your fork).
4. Confirm **base directory** `frontend`, **build command** `npm ci && npm run build`, and **publish directory** `dist` (Netlify reads `frontend/netlify.toml` when present).
5. Set the production branch (e.g. `main` after merge, or `feat/phase-11-production` during Phase 11).
6. Deploy the site and note the `*.netlify.app` URL for **O11.1**.

**API proxy and SPA:**

- `/api/*` is force-proxied to Render (`force = true` in `netlify.toml`). Until **O11.1**, the target uses placeholder host `REPLACE_ME` — update `to = "https://<RENDER_SERVICE_HOST>/api/:splat"` after Render is live.
- `/*` falls back to `/index.html` for client-side routes.

**After Netlify deploy:**

1. Replace `REPLACE_ME` in `frontend/netlify.toml` with your Render hostname and redeploy (or edit redirects in the Netlify UI).
2. `curl -i https://<NETLIFY_HOST>/api/health` should return 200 through the proxy.
3. Open the Netlify URL in the browser and complete login smoke per **O11.2**.

## Local development

`docker-compose.yml` at the repo root overrides the image command for dev: `uvicorn` with `--reload` and no migrations in compose. Production behaviour lives in `backend/Dockerfile` only.
