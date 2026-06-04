# Production deployment

This runbook covers hosting the Milestone backend on **Render**. Frontend (Netlify) and owner secret wiring are separate steps.

## Render Web Service

### Repository layout

- **Root directory:** `backend/` (build context is the backend folder).
- **Dockerfile path:** `backend/Dockerfile` (or set Render’s root directory to `backend` and use `Dockerfile`).

The production image runs migrations on container start, then serves the API:

```text
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}
```

Render injects `PORT`; the default `8084` applies only when `PORT` is unset (e.g. local image runs).

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

## Local development

`docker-compose.yml` at the repo root overrides the image command for dev: `uvicorn` with `--reload` and no migrations in compose. Production behaviour lives in `backend/Dockerfile` only.
