# Feature Brief — v0.2 Screen Completion
**Date:** 2026-06-02
**Status:** APPROVED — split into Phase 8 (Goals flow) and Phase 9 (Settings flow + InlineLogSheet)

---

## Summary

Six editor/detail screens designed in the export-2 prototype are ready to be ported into the production frontend. Two existing screens (`GoalsScreen`, `SettingsScreen`) need new props wired to those screens. The `useMilestoneEngine` hook needs five reactive state fields and nine new mutations. Three API changes are required on the backend. BlockReviewScreen (removed in Phase 7.5) is formally re-enabled via the Settings stack.

---

## User Outcomes

| User can… | Entry point |
|---|---|
| Create a new goal with title, timeframe, and optional target | GoalsScreen → GoalEditorScreen |
| Edit or archive an existing goal | GoalsScreen → GoalEditorScreen |
| Edit load and rest rules live, see Dashboard traffic lights update | SettingsScreen → EditBlockRulesScreen |
| Review the active training block (load graph + calendar heatmap) | SettingsScreen → BlockReviewScreen |
| View a previous block's summary | SettingsScreen → BlockReviewScreen (blockId param) |
| Archive the active block and start a new one | SettingsScreen → NewTrainingBlockScreen |
| Edit an activity's name, unit, or type; or deactivate it | SettingsScreen → ActivityManagerScreen |
| Log quickly from a Dashboard suggestion without opening the Log tab | Dashboard suggestion cards → InlineLogSheet |

---

## Phase Split

### Phase 8 — Goals Flow
Backend, hook, and navigation groundwork scoped to the Goals tab.

- Backend: extend `GET /api/dashboard` with `goals` field
- Hook: `goals` reactive state + `submitGoal`, `editGoal`, `archiveGoal` mutations + `GoalDraft` interface
- Navigation: overlay push/pop stack scaffolded for Goals stack
- `GoalsScreen`: add `onNewGoal` and `onEditGoal` props
- New screen: `GoalEditorScreen`

### Phase 9 — Settings Flow + InlineLogSheet
Heavier backend work plus the four Settings-stack screens and the Dashboard quick-log sheet.

- Backend: extend `GET /api/dashboard` with `previous_blocks` field; new `GET /api/training-blocks/{block_id}/review`; `POST /api/training-blocks` rule-copy service behaviour
- Hook: `rules`, `activities`, `block`, `previousBlocks` reactive state + remaining 6 mutations (`submitNewActivity`, `editActivity`, `deactivateActivity`, `editRule`, `submitNewBlock`, `resetMockData`) + `NewActivityDraft`, `NewBlockDraft` interfaces
- Navigation: Settings stack added to push/pop scaffold
- `SettingsScreen`: add `onEditRules`, `onReview`, `onNewBlock`, `onViewBlock`, `onEditActivity` props; forward to `BlockSummaryCard`
- New screens: `EditBlockRulesScreen`, `BlockReviewScreen`, `NewTrainingBlockScreen`, `ActivityManagerScreen`, `InlineLogSheet`
- BlockReviewScreen formally re-enabled (deferred in Phase 7.5)

### Phase 10 (previously Phase 8 deferred)
Recovery streaks UI, delayed-tax panel, load-graph dynamic title, loading/error polish, review milestone, MCP stub.

## Scope

**In (Phase 8 + 9):**
- 6 new screens across the two phases
- New props on `GoalsScreen` and `SettingsScreen`
- `useMilestoneEngine` hook: 5 reactive state fields + 9 new mutations
- Navigation: overlay push/pop stack extended to cover Goals and Settings stacks
- BlockReviewScreen re-enabled in the Settings stack
- Backend: 1 new endpoint, 2 modified endpoint contracts

**Out:**
- Editing `WEEKLY_TARGETS` or `ACTIVITY_CLASSES` (no UI designed for these)
- `TODAY` as a real date service (remains `new Date()` in production wiring)
- Notification and metric-unit toggles (prototype-only, no backend)
- Auth, multi-user support
- Phase 10 deferred items (recovery streaks UI, delayed-tax panel, load graph dynamic title)

---

## Affected Areas

| Layer | What changes |
|---|---|
| Frontend screens | 6 new screens; 2 existing screens get new props |
| Frontend hook | `useMilestoneEngine` — 5 state fields made reactive, 9 mutations added |
| Frontend navigation | Overlay push/pop stack extended |
| Backend API | `GET /api/dashboard` payload extended; new `GET /api/training-blocks/{block_id}/review`; `POST /api/training-blocks` copies rules automatically |
| Backend service | Block creation service copies rules from previous active block |
| Database | No new tables or columns; rule copy is service behaviour only |

---

## Open Questions / Risks

- **Goal field naming:** prototype uses `value/target/unit` internally; `types.ts` and the DB use `progress_value/progress_target/progress_unit`. Must reconcile before porting any Goal screen. Recommendation: use `progressValue/progressTarget/progressUnit` throughout and update `GoalCard` when porting.
- **InlineLogSheet in React:** the prototype uses an HTML `<dialog>`-style bottom sheet. Production will need a `Modal` or a sheet library (e.g. `@gorhom/bottom-sheet` for React Native, or a CSS fixed overlay for web). Decision belongs in the implementer ticket.
- **BlockReviewScreen for past blocks:** load series and daily scores require the block's full log and check-in history. The new review endpoint must scope its query by `block.start_date` and `block.end_date`. Confirm with the implementer that end_date is always set before a block is marked `completed`.

---

## Decision Record References

- No new architectural patterns introduced — overlay navigation extends the existing pattern.
- Rule-copy-on-block-create is a service responsibility, not a schema change.
- Technical details in `plans/technical-design-v02-screen-completion-2026-06-02.md`.
