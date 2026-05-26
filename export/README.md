# Milestone — Codebase Export

> Frozen prototype snapshot · May 2026  
> Drop the `src/` folder and `tailwind.config.js` into any standard React (web) or
> React Native / Expo project and the imports will resolve without modification.

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
    │   ├── index.ts                      # Barrel: import { Card, Slider, … } from '@/components/ui'
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
    │   ├── index.ts                      # Barrel: import { CalendarHeatmap, … } from '@/components/composites'
    │   ├── CalendarHeatmap.tsx           # Week-column heatmap of DailySafetyScores
    │   ├── WeeklyLoadGraph.tsx           # SVG rolling-load line chart + flare-up markers
    │   ├── RuleViolationBanner.tsx       # Inline warning when a draft log breaks a rule
    │   └── SuggestedActivityCard.tsx     # "What's safe today?" grouped suggestion card
    │
    └── screens/                          # Tier 3 — full screens (consume useMilestoneEngine)
        ├── index.ts                      # Barrel: import { DashboardScreen, … } from '@/components/screens'
        ├── DashboardScreen.tsx           # Primary overview: greeting, CTA, targets, load graph, status
        ├── LogHistoryScreen.tsx          # Chronological log list grouped by month → day
        ├── MorningCheckInScreen.tsx      # Pain / readiness / stiffness sliders + flare-up toggle
        ├── LogActivityScreen.tsx         # Activity picker → session details → RPE → feel → submit
        └── LogIncidentScreen.tsx         # Quick flare-up capture (body part chips + severity slider)

tailwind.config.js                        # Custom tokens: surfaces, state palette, type scale, spacing
```

---

## What is NOT yet in `src/` (prototype-only, lives in `preview/`)

These three screens exist as JSX in the HTML preview but have not been ported
to TypeScript source files. They are the next implementation targets:

| Screen | File in `preview/` | Notes |
|---|---|---|
| **SettingsScreen** | `preview/SettingsScreen.jsx` | Block management, rule editing |
| **GoalsScreen** | `preview/GoalsScreen.jsx` | Goal list + progress tracking |
| **NewActivitySheet** | `preview/NewActivitySheet.jsx` | Bottom-sheet for creating a new Activity |

---

## Import Conventions

All files use **relative imports** throughout — no path aliases required. If
you add `@/` aliases in your `tsconfig.json` (common in Next.js / Expo), a
find-and-replace from `../../` to `@/` on the `src/` tree is all that's needed.

### Import examples (as written)

```ts
// From a screen:
import { cn }             from '../../lib/cn';
import { Card }           from '../ui/Card';
import { CalendarHeatmap} from '../composites/CalendarHeatmap';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';

// From a composite:
import { StatusDot }      from '../ui/StatusDot';
import { buildLoadSeries} from '../../lib/load';
import type { DailySafetyScore } from '../../types';

// From the hook:
import { computeClassStatuses } from '../lib/engine';
import { TODAY, LOGS }          from '../lib/mockData';
```

### If you add `@/` aliases (tsconfig paths):

```ts
// Equivalent alias-style imports:
import { cn }             from '@/lib/cn';
import { Card }           from '@/components/ui';
import { CalendarHeatmap} from '@/components/composites';
import type { MilestoneEngineResult } from '@/hooks/useMilestoneEngine';
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

`useMilestoneEngine.ts` is the only file that touches mock data. It imports
seed arrays from `lib/mockData.ts` and manages them with `useState`. To wire a
real backend:

1. Replace `useState(LOGS)` etc. with your data-fetching hook (SWR, React
   Query, `expo-sqlite` query, etc.)
2. Replace `submitLog / submitCheckIn / submitIncident` with your mutation
   calls.
3. Keep `lib/engine.ts` and `lib/load.ts` unchanged — they are pure functions
   and work against any data that matches the `types.ts` shapes.
4. Delete `lib/mockData.ts` once you have real data flowing.

All screen components are fully decoupled from the data layer via the
`MilestoneEngineResult` interface — no screen imports from `mockData.ts`
directly.
