# Stage 2 — Production UX Polish Tickets

*Source: `AGENTS.md`, `agents/planner.md`, `plans/PRD.md` §10, owner feedback 2026-06-05,
`DESIGN.md` (lazy activity setup), `docs/patterns.md`, `docs/deploy.md` (empty prod DB),
`MOCKUPS.md` | Date: 2026-06-05*

---

## Owner decisions locked (2026-06-05)

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Prod seed data | **No** `scripts/seed.py` in production (unchanged). Users build catalog via in-app flows. |
| D2 | Incident “types” | **No** DB catalog or hardcoded anatomical defaults. Free-text primary input; **suggestion chips** derived from prior logged `body_part` values already in the API payload (incidents the client has loaded). |
| D3 | Create activity entry | **Optional** control at the **bottom of the Log tab** (`LogHistoryScreen`), opening existing `NewActivitySheet` — not only Settings. |
| D4 | Activity vs activity type | User-facing “activities” = `Activity` rows (`POST /api/activities`). `ActivityType` in code remains `performance` \| `recovery` only. |
| D5 | PWA manifest / icons | **Batch 2** — after core polish tickets; tracked as **S2.10** (optional). |
| D6 | Primary client | Android Chrome (Pixel 9 Pro) on live Netlify URL. |
| D7 | Branch | `feat/stage-2-polish` (or per-ticket `feat/s2-*`); merge via owner after `make lint` + `make test`. |

### Hard constraints (from `AGENTS.md`)

- Tests before code per implementation ticket.
- No business logic in routers; new backend work (if any) stays in `services/`.
- **No Alembic / schema changes** in this batch unless a ticket explicitly adds one (none planned).
- No `any` in TypeScript; `mypy --strict` unchanged for backend.
- One ticket at a time through Test Writer → Implementer → Reviewer.

---

## Scope summary

| Area | Tickets |
| --- | --- |
| Mobile layout (CTAs vs tab bar / browser chrome) | S2.1 |
| Login password visibility | S2.2 |
| Android / browser Back + in-app back affordance | S2.3, S2.4 |
| Incident body part UX (dynamic suggestions) | S2.5 |
| Activity class creation | S2.6 |
| Create activity + Log tab / empty log flows | S2.7, S2.8 |
| PWA (deferred) | S2.10 |
| Docs / first-run on prod | S2.9 |

---

## Ticket ordering rationale

1. **S2.1** — Layout token unblocks daily use on phone; no API dependency.
2. **S2.2** — Small, isolated login polish.
3. **S2.3 → S2.4** — Navigation: history integration first, then shared `BackButton` audit (S2.4 may reference S2.3 for Android back parity).
4. **S2.6** — Activity classes must exist before `NewActivitySheet` is useful on empty prod.
5. **S2.7** — Wire `NewActivitySheet` + Log tab CTA (depends on S2.6 for empty-class path).
6. **S2.8** — Log Activity overlay empty state (depends on S2.7).
7. **S2.5** — Incident suggestions independent; can run after S2.4.
8. **S2.9** — Docs after UX paths exist.
9. **S2.10** — Optional PWA when owner prioritises.

**Owner-only:** **O2.1** — acceptance smoke on phone after batch (or after each milestone).

---

## O2.1 — Owner acceptance smoke (Android Chrome, production)

**Type:** owner-only  
**Depends on:** S2.1–S2.8 (minimum); S2.10 optional  
**Blocks:** Stage 2 sign-off

### On production URL

- Login: toggle password visibility; sign in successfully.
- Log tab: bottom CTAs clear of tab bar and browser chrome; **+ New Activity** opens sheet and creates an activity.
- Log Activity: picker shows new activity; log a session.
- Log Incident: in-app **Back** returns to Log tab; Android system **Back** returns to previous in-app screen (not pre-app browser history).
- Stack screens from Settings (goal editor, block rules, activity manager): in-app Back and Android Back behave consistently.
- Incident: no hardcoded heel/ankle chips on first use; after logging “Right toe”, reopen incident and see suggestion chip.
- Goals: **+ New Goal** not hidden under tab bar.

### Done when

- [ ] Smoke passed or bugs filed in `plans/BACKLOG.md`.

---

## S2.1 — Bottom inset layout (tab bar + safe area)

**Type:** frontend  
**Reuse:** `AppShell.tsx`, `BottomTabBar.tsx`, `tailwind.config.js` (`spacing.tabbar`, `safe-bottom`), `LogHistoryScreen.tsx`, `GoalsScreen.tsx`, overlay screens with bottom submit buttons.

### Acceptance criteria

- Add a single layout convention (Tailwind utility and/or `components/ui/BottomInset.tsx` or `bottom-action-bar` class) documenting: **`padding-bottom` or `bottom` offset = `theme(spacing.tabbar) + theme(spacing.safe-bottom)`** when the primary tab bar is visible; **`safe-bottom` only** on full-screen overlays (`overlay !== null` or stack overlay) where `showTabBar` is false.
- **Log History:** `+ Log Activity` / `+ Log Incident` bar sits **above** the fixed `BottomTabBar`, never under browser or app chrome (manual test on Android Chrome).
- **Goals:** `+ New Goal` sticky CTA uses the same inset (replace `absolute bottom-0` + `pb-4` only).
- Prefer **`100svh`** (or documented choice) for `AppShell` height so layout viewport matches visible area; do not regress desktop `max-w-[440px]` preview.
- Vitest: extend `LogHistoryScreen.test.tsx` (or layout test) asserting the bottom action region has the tab-bar inset class or `data-testid="bottom-action-bar"` with expected style hook.

### Edge cases

- Long scroll on Log History: CTAs stay pinned above tab bar, not at end of scroll list only (current `shrink-0` footer pattern preserved).
- Overlays (check-in, log activity, log incident): submit buttons respect `safe-bottom` only.
- `InlineLogSheet` / `NewActivitySheet` (`fixed bottom-0`): sheet panel clears safe area (and tab bar if ever shown).

### Patterns

- `docs/patterns.md` — screen orchestration; no fetch logic in layout primitive.
- Reuse existing `pb-[calc(theme(spacing.tabbar)+theme(spacing.safe-bottom))]` from `AppShell` as the single source of truth.

---

## S2.2 — Login password show / hide toggle

**Type:** frontend + tests  
**Reuse:** `LoginScreen.tsx`, existing input/button classes from log forms.

### Acceptance criteria

- Password field has an accessible control (button) to toggle `type` between `password` and `text`.
- `aria-label` reflects state (“Show password” / “Hide password”); control is keyboard operable.
- Toggle does not clear the input or submit the form.
- `LoginScreen.test.tsx` (create if missing): toggling changes input type; login still posts `{ password }` on submit.

### Edge cases

- `disabled={isSubmitting}` applies to toggle and input.
- No new dependencies (inline SVG icon OK).

---

## S2.3 — Browser history integration (Android system Back)

**Type:** frontend  
**Reuse:** `App.tsx` (`overlay`, `screenStack`, `activeTab`), `useEffect` + `history.pushState` / `popstate`.

### Acceptance criteria

- When opening a **tab overlay** (`check-in`, `log-activity`, `log-incident`), push a history entry so the first Android **Back** closes the overlay instead of leaving the SPA.
- When **pushing** a stack screen (`goal-editor`, `activity-manager`, `edit-block-rules`, etc.), push a history entry; Android **Back** pops one stack level.
- `popstate` handler calls the same callbacks as in-app Back (`closeOverlay`, `popScreen`) without duplicate pops.
- Closing overlay/stack via in-app Back uses `history.back()` **or** `replaceState` so history stack stays consistent (no “dead” back entries).
- On initial app load after login, optional `history.replaceState` guard so the first Back does not exit to an external referrer when avoidable.
- `App.test.tsx`: simulate `popstate` with overlay open → overlay closes, tab unchanged.

### Edge cases

- Deep stack: Back pops one level at a time.
- Fatal error / login screen: no history hooks required.
- Does not break browser forward after Back.

### Patterns

- State owner remains `App.tsx`; hook `useMilestoneNavigationHistory` allowed if it keeps logic out of screens (`docs/patterns.md` frontend state ownership).

---

## S2.4 — Standard in-app Back affordance (non-tab screens)

**Type:** frontend  
**Reuse:** Extract from `MorningCheckInScreen` / `LogActivityScreen` / `LogIncidentScreen` duplicated `BackButton`; `App.tsx` stack + overlay wiring.

### Acceptance criteria

- Shared `components/ui/BackButton.tsx` (or `ScreenBackHeader`) used by all **Tier 3 / stack** screens:
  - `MorningCheckInScreen`, `LogActivityScreen`, `LogIncidentScreen`
  - `GoalEditorScreen`, `EditBlockRulesScreen`, `BlockReviewScreen`, `NewTrainingBlockScreen`, `ActivityManagerScreen`
- Each screen’s `onBack` prop wired to `App.tsx` (already passed for overlays; verify stack screens).
- Header region includes top safe-area padding (`pt-safe-top` or parent overlay applies it) so Back is visible below mobile status/URL chrome.
- **Log Incident:** Back control visible without scrolling on 390×844 viewport (test or storybook-style RTL assertion on header).
- No new screens added without Back when they are not one of the four tab roots.

### Edge cases

- Success/submitted states on log flows: Back or Done still exits cleanly.
- `LogIncidentScreen` already has `BackButton` in code — ticket verifies production layout + adopts shared component.

### Note

Android system Back is **S2.3**; this ticket is the visible, tappable control.

---

## S2.5 — Incident body part: remove hardcoded chips; suggest from history

**Type:** frontend (+ hook helper)  
**Reuse:** `LogIncidentScreen.tsx`, `engine.incidents`, `MorningCheckInScreen` flare text field as UX reference; **no** new API or DB table.

### Acceptance criteria

- Remove `BODY_PARTS` constant from `LogIncidentScreen.tsx`.
- Primary input: text field (placeholder e.g. “e.g. Right toe”) — same spirit as check-in flare body part field.
- Suggestion chips: built from **distinct non-empty `bodyPart` values** on `engine.incidents` (trimmed, case-insensitive dedupe, sort recent-first by `incidentDate` then `createdAt` if available).
- Tapping a chip fills the text field; user can still type a new label.
- Submit still sends `body_part` string via existing `submitIncident` / `createFlareUpIncident` — **no schema change**.
- Tests: with mock incidents `[{ bodyPart: 'Right toe' }, …]`, chip “Right toe” renders; with empty incidents, no chips, text field only.

### Edge cases

- Empty / whitespace-only historical values excluded.
- “Other” flow removed — custom text is the default path.
- Do **not** add server-side defaults or seed body parts in prod.

### Out of scope

- Persisting a separate “incident type” entity.
- Mining body parts from check-in JSON unless already on `MilestoneEngineResult` (future ticket if needed).

---

## S2.6 — Create activity class (Settings)

**Type:** frontend (+ hook mutation)  
**Reuse:** `frontend/src/lib/api/activityClasses.ts` (`createActivityClass`), `POST /api/activity-classes` per `docs/api-map.md`, Settings Activities section, pattern from `submitNewActivity` in `useMilestoneEngine.ts`.

### Acceptance criteria

- `useMilestoneEngine` exposes `submitNewActivityClass(draft)` calling `createActivityClass` with client-generated `id` (`crypto.randomUUID()`), invalidates `['dashboard']` and activity-class queries.
- Settings → **Activity classes** section (or header action): **+ New class** opens a sheet or stack form: name (required), type `performance` \| `recovery`, optional description, default recovery window (default 3 days per API).
- New class appears in Settings / block rules / pickers after save without full page reload.
- Tests: hook unit test for POST body shape; Settings RTL smoke for open form + submit (mocked API).

### Edge cases

- Duplicate `id` conflict → show API error message.
- Empty name blocked client-side.
- No router business logic; no migration.

### Patterns

- `docs/patterns.md` — form container vs presentation; mutations in hook, not in `SettingsScreen` router logic.

---

## S2.7 — Wire NewActivitySheet + Log tab “+ New Activity”

**Type:** frontend  
**Depends on:** S2.6 (for empty prod with zero classes — sheet shows “create a class first” with link/action to Settings class flow)  
**Reuse:** `NewActivitySheet.tsx` (already tested), `submitNewActivity`, `LogHistoryScreen.tsx`, `App.tsx`.

### Acceptance criteria

- Mount `NewActivitySheet` in `App.tsx` (or `LogHistoryScreen` with lifted state) with `open` / `onClose` / `onCreate` → `engine.submitNewActivity`.
- **Log tab bottom bar:** add optional **+ New Activity** control (secondary style — not replacing `+ Log Activity` / `+ Log Incident`). Layout respects **S2.1** bottom inset.
- After create: invalidate activities; optionally open `log-activity` overlay with new activity pre-selected (`openLogActivity(createdId)`).
- Settings → Activities: **+ New Activity** entry point to same sheet (in addition to Log tab).
- `NewActivitySheet` not duplicated; single wiring path.

### Edge cases

- `activityClasses.length === 0`: sheet shows existing empty copy; primary action routes user toward S2.6 class creation (button “Add activity class” → Settings or inline message).
- Cancel sheet without create.

### Patterns

- `DESIGN.md` lazy activity setup — create activity before first log.

---

## S2.8 — Log Activity empty state (no activities)

**Type:** frontend + tests  
**Depends on:** S2.7  
**Reuse:** `LogActivityScreen.tsx`, `groupActivities`, `LogHistoryScreen` empty illustration pattern.

### Acceptance criteria

- When `activities.filter(isActive)` is empty, `LogActivityScreen` shows empty state copy (e.g. “No activities yet”) and CTA **Create activity** that opens `NewActivitySheet` (same handler as S2.7) or closes overlay and focuses Log tab CTA.
- `Log History` empty state unchanged except optional hint: “Create an activity to start logging.”
- Test: render with `activities: []` → empty state visible; CTA triggers sheet open (mock `onCreateActivity` or sheet `open` state).

### Edge cases

- Inactive-only catalog still shows empty active picker.
- Prefill `initialActivityId` ignored when activity missing.

---

## S2.9 — Docs: production first-run (no seed)

**Type:** docs only  
**Depends on:** S2.6, S2.7 (wording matches real UI)

### Acceptance criteria

- `docs/deploy.md` (or `README.md` deploy subsection): short **First use on production** ordered steps: sign in → create activity class → create activity → create training block → log / check-in.
- Reiterate: **never** run `scripts/seed.py` against Supabase.
- `plans/PRD.md` §10 cross-link optional (one line).

### Edge cases

- None.

---

## S2.10 — PWA manifest and icons (optional / Batch 2)

**Type:** frontend + docs  
**Status:** deferred until S2.1–S2.9 complete  
**Reuse:** `frontend/index.html`, `plans/PRD.md` §10, Netlify headers.

### Acceptance criteria

- `manifest.webmanifest` with name, short_name, theme/background colors matching design tokens, icons (192/512).
- `<link rel="manifest">` in `index.html`; meta theme-color.
- `docs/deploy.md` note: Add to Home Screen on Android Chrome.
- Lighthouse / manual install test on Pixel.

### Edge cases

- Cache busting on Netlify deploy.
- Does not replace S2.1 layout fixes in browser tab mode.

---

## BACKLOG items addressed by this file

Move to implementation via tickets above (do not duplicate in BACKLOG):

- Empty prod activities / log picker blocked → **S2.6–S2.8**
- Sticky CTAs under tab bar → **S2.1**
- Hardcoded incident body parts → **S2.5**
- `NewActivitySheet` unwired → **S2.7**

Remain in `plans/BACKLOG.md` for later stages:

- Render cold start, custom domain, automated Supabase backup
- Delayed-tax dashboard panel, CalendarHeatmap, recovery streaks UI
- Strava / Health / MCP (Stage 3–4)

---

## Planner output

| Item | Value |
| --- | --- |
| **Ticket file** | `plans/tickets-stage-2-polish-2026-06-05.md` |
| **Branch suggestion** | `feat/stage-2-polish` |
| **Unresolved** | Whether S2.10 ships in same PR as S2.1–S2.9 (owner choice). Check-in historical body parts for incident chips deferred. |
| **AGENTS.md** | Updated to point at this ticket file for active sprint. |

**Status: SIGNED OFF** (planner — ready for owner approval, then orchestrator on `feat/stage-2-polish`).
