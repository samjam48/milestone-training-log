# Feature Brief — Production Deploy (Phase 11)
**Date:** 2026-06-04  
**Status:** APPROVED — owner decisions recorded below  
**Technical design:** `plans/technical-design-production-deploy-2026-06-04.md`

---

## Summary

Ship the completed MVP as a **personal production instance** on the public internet: React SPA on Netlify, FastAPI on Render (free tier), Postgres on Supabase (free tier). Production database starts **empty** (migrations only, no seed). Access is gated with a **single shared password** and a **session cookie** lasting weeks per device. Local development stays on Docker + SQLite.

Netlify proxies `/api/*` to Render so the browser keeps same-origin relative API paths. GitHub connects to Netlify for frontend deploys.

---

## Owner decisions (2026-06-04)

| Topic | Decision |
| --- | --- |
| Hosting | Option B: Netlify + Render + Supabase |
| Auth | Netlify `/api` proxy to Render **and** app-level session login (shared password) |
| URLs | Default `*.netlify.app` / `*.onrender.com` for now |
| Render cold start | Acceptable for personal use |
| Local DB | SQLite via Docker; Postgres **only** in production |
| Prod data | Empty after migrate; no seed script |
| PWA / Add to Home Screen | Stage 2 (post-deploy polish) |
| Frontend CI | GitHub → Netlify auto-deploy |
| Branch | Phase 11 from `main` after Phase 10 merge |
| Primary device | Android (Pixel 9 Pro), Chrome |
| Usage | Several times per day; tolerate cold starts |
| Auth UX | One shared password; session persists ~weeks per device |
| Data residency | No region constraint |
| Backup | Prefer not to lose prod data (backup/runbook in scope) |
| Stage 1 success | Full app functionality on phone over HTTPS, gated, real data |

---

## User outcomes

| User can… | Notes |
| --- | --- |
| Open the app on phone (Chrome) over HTTPS | Netlify URL |
| Log in once per device with a shared password | Session cookie; not multi-user |
| Log activities, check-ins, incidents, goals, blocks, settings | Same as local MVP |
| Trust prod data persists | Supabase Postgres; owner backup guidance |
| Keep developing locally | `docker compose` + SQLite unchanged |

---

## Scope — In (Stage 1 / Phase 11)

- Supabase Postgres project; `DATABASE_URL` on Render
- `alembic upgrade head` on deploy; **no** `scripts/seed.py` in prod
- Production backend Docker image (no `--reload`)
- Render Web Service (free): health check `/api/health`
- Netlify: build `frontend/dist`, GitHub-connected deploy
- `netlify.toml`: proxy `/api/*` → Render; SPA fallback for client routes
- App auth: `POST /api/auth/login`, HTTP-only session cookie, protect `/api/*` except health + login
- Prod flags: `APP_DEV_MODE=false`, `VITE_DEV_MODE=false`
- Env documentation: `.env.example`, TRD deploy matrix, README smoke checklist
- Postgres migration verification in tests or documented gate
- Supabase backup / export note in runbook (point-in-time or manual export)
- Archive Phase 0–10 ticket docs; PRD/TRD roadmap sections

---

## Scope — Out (later stages)

| Stage | Contents |
| --- | --- |
| **Stage 2** | Usage-driven UI polish; PWA manifest + install UX |
| **Stage 3** | Strava OAuth + ingest; Google Health / Health Connect (likely needs mobile bridge) |
| **Stage 4** | MCP server / Claude tools beyond `GET /api/mcp/context` read stub |
| **All stages** | Multi-user OAuth, Capacitor store build, WEEKLY_TARGETS / ACTIVITY_CLASSES editors (still backlog) |

---

## Affected areas

| Layer | Changes |
| --- | --- |
| Backend | Auth service + router; session middleware/dependency; optional CORS narrow config; prod start command; `psycopg` |
| Frontend | Login screen; `credentials: 'include'`; optional `VITE_API_BASE_URL` prefix in client |
| Infra | `netlify.toml`, Render service config, GitHub → Netlify |
| Data | Postgres prod only; Alembic unchanged schema |
| Docs | PRD §9–12, TRD §12, `AGENTS.md` sprint, archive |

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Render free tier sleeps | Document cold start; optional keep-alive in backlog |
| Direct Render URL bypasses Netlify | Require auth on all API routes; do not rely on Netlify-only gate |
| SQLite vs Postgres dialect | Migration test against temp Postgres before prod |
| Supabase free tier pause / limits | Runbook: export backup; monitor dashboard |
| Session secret leakage | Render env only; never commit |

---

## Architecture boundary check

| Boundary | Verdict |
| --- | --- |
| No business logic in routers | Auth in `services/auth.py`; routers thin |
| Config via `settings.py` | Session secret, password hash, CORS origins |
| Schema changes | Prefer signed cookie session **without** new tables for v1; if sessions table added, Alembic required — see technical design |
| `LOCAL_USER_ID` | Stage 1 maps authenticated session → `"local"` |

---

## Open questions

None blocking — owner answered 2026-06-04. Planner may refine ticket boundaries.

**Final status:** `SIGNED OFF`
