// =============================================================================
// BottomTabBar — primary navigation
// -----------------------------------------------------------------------------
// Four tabs: Dashboard / Log / Goals / Settings.
// Fixed to bottom of viewport (within the AppShell column). Honours iOS home-
// indicator safe area. 44px+ hit targets per Apple/Material guidance.
//
// Icons are inline SVGs (no icon-font dep). Keep them 24px monoline so they
// read as "clinical instruments", not toy glyphs.
//
// Active state: full-strength ink + a 2px top accent rule (not a filled pill —
// pills feel app-store-generic; the rule echoes the section labels above).
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';

export type TabKey = 'dashboard' | 'log' | 'goals' | 'settings';

export interface BottomTabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  className?: string;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

// -- Icons --------------------------------------------------------------------
// Stroke-only, currentColor, 24px. Kept inline so the bar has zero external
// asset dependencies. All paths use stroke-linecap=round + stroke-linejoin=round.

const iconBase = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const DashboardIcon = () => (
  <svg {...iconBase} aria-hidden="true">
    {/* three vertical bars — echoes the dashboard's progress-bar motif */}
    <path d="M5 14v5" />
    <path d="M12 9v10" />
    <path d="M19 5v14" />
  </svg>
);

const LogIcon = () => (
  <svg {...iconBase} aria-hidden="true">
    {/* horizontal log lines */}
    <path d="M4 7h12" />
    <path d="M4 12h16" />
    <path d="M4 17h9" />
    {/* a single tick to denote "entry" */}
    <circle cx="20" cy="7" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

const GoalsIcon = () => (
  <svg {...iconBase} aria-hidden="true">
    {/* concentric targets */}
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const SettingsIcon = () => (
  <svg {...iconBase} aria-hidden="true">
    {/* two horizontal sliders — settings as "knobs", not a cog */}
    <path d="M4 8h10" />
    <path d="M18 8h2" />
    <circle cx="16" cy="8" r="2" />
    <path d="M4 16h4" />
    <path d="M12 16h8" />
    <circle cx="10" cy="16" r="2" />
  </svg>
);

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'log',       label: 'Log',       icon: <LogIcon /> },
  { key: 'goals',     label: 'Goals',     icon: <GoalsIcon /> },
  { key: 'settings',  label: 'Settings',  icon: <SettingsIcon /> },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  active,
  onChange,
  className,
}) => {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        // Pin to bottom of the AppShell's max-w column (not the viewport edges)
        'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px]',
        // Surface — slightly raised, with hairline top to separate from content
        'bg-bg/95 backdrop-blur-md border-t border-border',
        // Safe-area for home indicator
        'pb-safe-bottom',
        className,
      )}
    >
      <ul className="grid grid-cols-4 h-tabbar">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key} className="flex">
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  // Full-cell hit target, ≥44px guaranteed by h-tabbar/72px
                  'relative flex w-full flex-col items-center justify-center gap-1',
                  'transition-colors duration-snap ease-out-quint',
                  isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                  // Tap feedback
                  'active:bg-bg-raised/50',
                )}
              >
                {/* Active rule — 2px top accent in ink, NOT a state color
                    (navigation isn't a safety signal). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-b',
                    isActive ? 'bg-ink' : 'bg-transparent',
                  )}
                />
                <span className="block">{tab.icon}</span>
                <span
                  className={cn(
                    'text-caption font-medium',
                    isActive && 'font-semibold',
                  )}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
