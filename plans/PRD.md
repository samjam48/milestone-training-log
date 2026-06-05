# Milestone — Product Requirements Document
*Updated: June 2026 | Owner: Sam*

**Historical phase tickets:** `plans/archive/phase-0-10/`

## 1. Product Vision

Milestone is a local-first health and performance tracking app that makes
"creeping cumulative load" visible. Activities that feel fine individually
can stack into inflammatory load over days, only manifesting as pain 24–72h
later. Milestone detects this pattern and surfaces it before the next session.

## 2. Problem Statement

Returning to sport after injury is a data problem disguised as a motivation
problem. Users know their one-session effort was moderate. What they cannot
perceive: the rolling sum over 3–7 days, the rest gap between sessions of the
same tissue type, or the correlation between a "good" session on day 1 and a
flare-up on day 4. Milestone makes this visible and actionable before it
becomes painful.

## 3. Target Users

**Primary — Sam:** 30s, post-op plantar fasciitis rehab. Understands their body
but not the data patterns. Wants a simple daily habit loop (log, check in,
see status), not a training analytics platform. Needs clear stop/go signals,
not dashboards full of numbers to interpret.

**Secondary — self-coaching athlete:** Managing load across multiple activity
types (e.g. padel + gym + running). Needs cross-class safety signals and a way
to see whether this week's volume is sustainable given last week's pattern.

## 4. MVP Scope (Phase 1 — local-first, single user)

### F1: Activity Logging

- Log any activity with a picker grouped by class
- Required fields: activity selection, duration (minutes), volume in the
  activity's default unit
- Optional fields: RPE 1–10, post-activity feel (fine / mild_discomfort / bad),
  notes
- Lazy activity setup: log first, configure rules later
- Rule violations surface live before submission against all enabled block rules
  (rest window, weekly load cap, frequency limit, consecutive-day limit, cross-class
  weekly activity count)
- Log anyway: violations stored as a snapshot on the log entry for history
  display — user is never blocked, only informed
- Log history grouped by month, sorted newest-first, with feel pill and
  violation badge on each row

### F2: Morning Check-In

- Once per calendar day: pain, readiness, stiffness sliders (0–10)
- Optional flare-up toggle: body part, severity (1–10), notes
- Creating a check-in with flare-up=true also creates a FlareUpIncident record
- Dashboard shows a "Check in" CTA if today's check-in is missing

### F3: Flare-Up Incident Logging

- Out-of-band from check-in: body part quick-pick chips, severity 1–10,
  likely cause class, optional notes
- Creates a standalone FlareUpIncident (not tied to a DailyCheckIn)
- Incidents surface as date markers on the load graph and calendar heatmap

### F4: Dashboard

- Greeting + today's date
- "Check in now" CTA if today's check-in is missing
- Suggested activities: all active activities grouped by safety state
  (safe / caution / danger) with reason text
- Weekly targets progress bars (volume progress for current block period)
- Rolling 7-day load graph scoped to primary activity class, with
  flare-up date markers and weekly cap threshold line
- Activity class traffic lights (safe / caution / danger) with reason text
  showing rest window status and load cap status
- Clean streak counter: consecutive activity log entries with no danger
  rule violations and no "bad" post-activity feel
- **Delayed tax / load risk:** proactive flags for elevated daily load (vs a
  14-day median baseline) and under-rested activity in the last 7 days; when the
  user logs elevated pain (`pain_level > 3`), flare on check-in, or a flare-up
  incident, attribute likely causes (isolated return after long rest vs earlier
  stacked load in the same week)

### F5: Training Block Management

- Create 2-week bounded blocks: name, start date, optional end date,
  optional link to a goal
- Define per-class rules for the block:
  - `rest_between_class`: minimum N days between same-class activities
  - `weekly_load_cap`: max rolling load (volume × RPE) per 7-day window
  - `frequency_limit`: max N activities per window
  - `consecutive_day_limit`: max N consecutive days with activity
- Define cross-class rules: `weekly_activity_count` (max N performance
  activities per week across all classes)
- Define weekly volume targets per class (e.g. "walk 10 km this week")
- Review milestone: backend auto-flags `is_review_milestone_hit` when the
  weekly volume target is met AND 2 consecutive safe days have been logged
- Previous blocks listed with name, dates, and status

### F6: Goal Tracking

- Create monthly or quarterly goals: title, target date, optional class
  link, optional numeric target + unit (for quantitative goals)
- Goal list grouped by timeframe with status indicator
  (active / achieved / missed / paused)
- Progress bar for goals that have a numeric target
- Status can be updated manually (e.g. mark as achieved)

### F7: Activity Management

- Create activities: name, activity class, type (performance / recovery),
  default volume unit
- Deactivate activities (hides from log picker but preserves history)
- Reactivate previously deactivated activities
- Activity manager view grouped by class with last-logged date shown

## 5. Delivered vs deferred (Phases 0–10)

**Delivered (local MVP):** Features F1–F7 above on Docker + SQLite; single logical user
(`user_id = "local"`); `GET /api/mcp/context` read stub (no AI calls).

**Deferred to roadmap stages below:**

- Production hosting and minimal access gate (Stage 1)
- PWA install polish (Stage 2)
- Strava / Google Health / Apple Health integration (Stage 3)
- MCP assistant tools beyond context export (Stage 4)
- Multi-user OAuth and account management
- Push or local notifications
- Native Capacitor store packaging (web-first; Android Chrome for Stage 1)
- Multi-class flare-up cause tagging (see `plans/BACKLOG.md`)

## 6. Non-Functional Requirements

- **Mobile-first:** 390px viewport, bottom-tab navigation (Dashboard / Log / Goals / Settings)
- **No install friction:** `docker compose up` starts the full app on localhost
- **API latency:** CRUD endpoints < 200ms; dashboard aggregate < 500ms
- **Type safety:** `mypy --strict` (backend) and `tsc --noEmit` (frontend) must
  pass clean
- **Test coverage:** pytest ≥ 80% backend; Vitest ≥ 70% frontend
- **Local dev:** SQLite via Docker, no network dependency after container start
- **Production (Stage 1):** HTTPS; Postgres on Supabase; session-gated API
- **Forward-compatible schema:** `user_id = "local"` on all user-owned rows
  so multi-user auth migration requires middleware + real user ids, not a schema rewrite

## 7. UI Specification

**Canonical screen flows:** `MOCKUPS.md`

**Functional TypeScript implementations:** `export/src/components/screens/`

Screens complete (TypeScript source in `export/src/`):
- `DashboardScreen` — primary overview
- `LogHistoryScreen` — chronological log list
- `MorningCheckInScreen` — daily health assessment
- `LogActivityScreen` — activity logging form with live rule check
- `LogIncidentScreen` — out-of-band flare-up capture

Screens to be ported in Phase 7 (JSX prototypes in `export/preview/`):
- `SettingsScreen` — block management and rule editing
- `GoalsScreen` — goal list and progress
- `NewActivitySheet` — create new activity

**Integration point:** `export/src/hooks/useMilestoneEngine.ts`
Replace `useState(mockData)` with React Query queries/mutations via the API
client. No screen component code changes required — all screens consume the
same `MilestoneEngineResult` interface.

## 8. Success Metrics

- Log an activity in < 30 seconds from the dashboard
- Rule violations surface before submission (zero-surprise logging)
- Dashboard loads in < 500ms with 90 days of seeded data
- `make test` green on full suite before any commit
- No regressions when mock data is replaced with real backend data

---

## 9. Stage 1 — Production deploy (Phase 11)

**Status:** ✅ **Complete** (2026-06-05) — https://milestone-activity.netlify.app · deploy from `main` · see `docs/deploy.md`

**Goal:** Use the full MVP on a personal phone over the internet with real, empty prod data.

**Hosting (owner-approved):** Netlify (frontend, GitHub deploy) + Render (backend,
free tier) + Supabase (Postgres, free tier). Netlify proxies `/api` to Render;
app-level shared-password session (weeks per device).

**In scope:**

- Empty production database after migrations (no seed)
- HTTPS; login gate on API (not only static site)
- Local dev unchanged (Docker + SQLite)
- Deploy runbook and Supabase backup guidance
- Render cold starts acceptable for personal use

**Primary client:** Android Chrome (Pixel 9 Pro).

**Stage 1 success:** Log activity, morning check-in, dashboard, goals, settings,
and training-block flows on phone against production — same functionality as local MVP.

**Out of Stage 1:** PWA manifest, Strava/Health, MCP tools, multi-user OAuth.

**Planning:** `plans/feature-brief-production-deploy-2026-06-04.md`,
`plans/technical-design-production-deploy-2026-06-04.md`

---

## 10. Stage 2 — Use-driven polish

- Refine UX from real daily use (copy, defaults, hide unused surfaces)
- PWA: manifest, icons, Add to Home Screen on Android Chrome
- Optional performance tuning for Render cold starts (backlog if needed)

---

## 11. Stage 3 — External integrations

- **Strava:** OAuth, activity import → `ActivityLog` with `external_id`, idempotent sync
- **Google Health / Health Connect:** platform-dependent; likely requires mobile
  bridge or Capacitor — not web-only hosting alone
- Normalization and deduplication services; no double-count vs manual logs

---

## 12. Stage 4 — MCP / AI assistant layer

- Expand beyond `GET /api/mcp/context` to tool surface for Claude and similar
- Authenticated API or dedicated MCP server; reuse `services/load_engine.py` and
  dashboard aggregations
- Human-in-the-loop for write actions (log, check-in)
