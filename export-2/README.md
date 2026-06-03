# Milestone — Codebase Export

> v0.2.0 — May 2026
> Drop the `src/` folder and `tailwind.config.js` into any standard React (web)
> or React Native / Expo project and the imports will resolve without modification.

---

## What's new in v0.2

- **`GoalsScreen`** and **`SettingsScreen`** — previously prototype-only, now fully ported to TypeScript
- **6 new editor screens:** `GoalEditorScreen`, `EditBlockRulesScreen`, `BlockReviewScreen`, `NewTrainingBlockScreen`, `ActivityManagerScreen`, `InlineLogSheet`
- **`useMilestoneEngine` extended** — `activities`, `rules`, `block`, `previousBlocks`, `goals` are now reactive (`useState`); 9 new mutations added
- **`mockData.ts` extended** — `GOALS` and `PREVIOUS_BLOCKS` seed data added
- **`MilestoneEngineResult`** interface extended with `weeklyTargets`, `previousBlocks`, `goals`, `rules` (reactive), and all new mutations
- See `HANDOVER_v0.2.md` (project root) for a full diff guide

---

## File Structure

```
src/
├── types.ts                              # Single source of truth for all stored data shapes
│
├── lib/
│   ├── cn.ts                             # Lightweight classnames helper (clsx drop-in)
│   ├── load.ts                           # Rolling load math + ISO date helpers
│   ├── engine.ts                         # Pure rules-engine functions (no React)
│   └── mockData.ts                       # Seed data: Sam Chen / plantar fasciitis scenario
│
├── hooks/
│   └── useMilestoneEngine.ts             # React hook — wires mockData → engine → reactive state
│
└── components/
    ├── ui/                               # Tier 1 — design-system primitives
    │   ├── index.ts
    │   ├── AppShell.tsx                  # Root mobile frame (safe-areas, max-w column)
    │   ├── BottomTabBar.tsx              # 4-tab fixed nav (Dashboard / Log / Goals / Settings)
    │   ├── Card.tsx                      # Layered surface — intents: default | inset | safe | caution | danger | info
    │   ├── Metric.tsx                    # Big tabular numeric readout (sm / md / lg sizes)
    │   ├── ProgressBar.tsx               # value/target bar — state auto-inferred or explicit
    │   ├── StatusDot.tsx                 # Traffic-light dot + halo (solid | pulse variants)
    │   ├── Slider.tsx                    # 0–10 native range with hero readout + state tint
    │   ├── SegmentedControl.tsx          # Multi-option picker with per-option tone
    │   └── ActivityLogRow.tsx            # Row for any ActivityLog list (feel pill + violations)
    │
    ├── composites/                       # Tier 2 — domain-aware composed components
    │   ├── index.ts
    │   ├── CalendarHeatmap.tsx           # Week-column heatmap of DailySafetyScores
    │   ├── WeeklyLoadGraph.tsx           # SVG rolling-load line chart + flare-up markers
    │   ├── RuleViolationBanner.tsx       # Inline warning when a draft log breaks a rule
    │   └── SuggestedActivityCard.tsx     # "What's safe today?" grouped suggestion card
    │
    └── screens/                          # Tier 3 — full screens (consume useMilestoneEngine)
        ├── index.ts
        │
        │  ── v1 (unchanged) ──────────────────────────────────────────────────
        ├── DashboardScreen.tsx           # Overview: greeting, CTA, targets, load graph, status
        ├── LogHistoryScreen.tsx          # Chronological log list grouped by month → day
        ├── MorningCheckInScreen.tsx      # Pain / readiness / stiffness + flare-up toggle
        ├── LogActivityScreen.tsx         # Activity picker → session details → RPE → feel
        ├── LogIncidentScreen.tsx         # Quick flare-up capture (body part + severity)
        │
        │  ── v2: previously prototype-only, now ported ──────────────────────
        ├── GoalsScreen.tsx               # Goal list + progress tracking (monthly / quarterly)
        ├── SettingsScreen.tsx            # Block summary, activity list, preferences
        │
        │  ── v2: new screens ────────────────────────────────────────────────
        ├── GoalEditorScreen.tsx          # Create / edit a goal (title, timeframe, target)
        ├── EditBlockRulesScreen.tsx      # Live rule editor — changes dashboard immediately
        ├── BlockReviewScreen.tsx         # Block stats + CalendarHeatmap + WeeklyLoadGraph
        ├── NewTrainingBlockScreen.tsx    # Create a new block (archives current block)
        ├── ActivityManagerScreen.tsx     # Edit activity fields or deactivate
        └── InlineLogSheet.tsx            # Compact quick-log bottom sheet (from Dashboard)

tailwind.config.js                        # Custom tokens: surfaces, state palette, type scale, spacing
```

---

## Navigation

The new editor screens are designed to be pushed onto a navigation stack — they
are not tabs. In your root navigator:

```
BottomTabs
  Dashboard
  Log
  Goals (stack)
    GoalsScreen         → push GoalEditorScreen (new / edit)
  Settings (stack)
    SettingsScreen      → push EditBlockRulesScreen
                        → push BlockReviewScreen
                        → push NewTrainingBlockScreen
                        → push ActivityManagerScreen
Overlays / modals
  MorningCheckInScreen
  LogActivityScreen
  LogIncidentScreen
  InlineLogSheet        ← bottom sheet, not a full screen
```

Each screen accepts `onBack` and (where applicable) `onComplete` callbacks so
it is decoupled from any specific navigator implementation.

---

## Import Conventions

All files use **relative imports** — no path aliases required. If you add `@/`
aliases in `tsconfig.json`, a find-and-replace from `../../` to `@/` on the
`src/` tree is all that's needed.

```ts
// From a screen:
import { cn }                    from '../../lib/cn';
import { Card }                  from '../ui/Card';
import { CalendarHeatmap }       from '../composites/CalendarHeatmap';
import { RuleViolationBanner }   from '../composites/RuleViolationBanner';
import type { MilestoneEngineResult, GoalDraft } from '../../hooks/useMilestoneEngine';
import type { Goal, Activity, VolumeUnit }       from '../../types';
```

---

## Key Dependencies

| Package | Why |
|---|---|
| `react` ≥ 18 | `useId`, `useMemo`, `useCallback`, `forwardRef` all used |
| `typescript` ≥ 5 | Satisfies types, const enums in `types.ts` |
| `tailwindcss` ≥ 3.4 | Custom token theme in `tailwind.config.js` |
| _(no other runtime deps)_ | `cn.ts` replaces `clsx`; date math is bespoke in `load.ts` |

### Google Fonts (load in your HTML `<head>` or equivalent)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

---

## Replacing Mock Data with a Real Backend

`useMilestoneEngine.ts` is the only file that touches mock data. To wire a real
backend:

1. Replace `useState(LOGS)` etc. with your data-fetching hook (SWR, React Query,
   `expo-sqlite`, etc.)
2. Replace mutation callbacks (`submitLog`, `editGoal`, etc.) with your mutation
   calls — the signatures are defined in the `*Draft` interfaces at the top of
   `useMilestoneEngine.ts`
3. Keep `lib/engine.ts` and `lib/load.ts` unchanged — they are pure functions
   that work against any data matching the `types.ts` shapes
4. Delete `lib/mockData.ts` once real data is flowing

All screen components are fully decoupled from the data layer via the
`MilestoneEngineResult` interface — no screen imports from `mockData.ts` directly.

---

## Type Notes

| Type | Notes |
|---|---|
| `Goal.progressValue/progressTarget/progressUnit` | Numeric progress fields — optional for qualitative goals |
| `Goal.targetDate` | Required `ISODate` — use `TODAY` as fallback when creating |
| `TrainingBlock.isReviewMilestoneHit` | Required boolean — default `false` on create |
| `VolumeUnit` | `'km' \| 'mi' \| 'm' \| 'reps' \| 'sets' \| 'sessions' \| 'minutes'` — note `'mi'` not `'miles'` |
| `RPE` | Discriminated union `1 \| 2 \| … \| 10` — cast with `rpe as RPE` when reading from `number` |
