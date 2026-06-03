// =============================================================================
// AppShell — root mobile frame
// -----------------------------------------------------------------------------
// Single column, full-viewport, dark canvas. Honours iOS safe areas and
// reserves space for the BottomTabBar via `pb-tabbar`. Children scroll
// independently of the tab bar (which is fixed by BottomTabBar itself).
//
// Layout contract:
//   AppShell
//   ├── (optional) <ScreenHeader> rendered by children
//   ├── <main> scroll region          ← Tier-3 screens live here
//   └── (fixed) <BottomTabBar>        ← rendered as a sibling, see App root
//
// Why not render BottomTabBar inside AppShell directly? Because some flows
// (Log form, Check-in, Block Review) are full-screen with no tabs. We keep
// AppShell agnostic and let the router decide when to mount the bar.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, reserves bottom padding for the fixed BottomTabBar. */
  withTabBar?: boolean;
  children: React.ReactNode;
}

export const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ withTabBar = true, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Canvas — bounded viewport column. Content within scrolls independently; AppShell is not a scroll container.
          'relative flex min-h-screen h-dvh w-full flex-col bg-bg text-ink font-sans antialiased',
          // Safe-area top inset (status bar on notched devices)
          'pt-safe-top',
          // Reserve bottom space when tab bar is mounted (+ device home indicator)
          withTabBar && 'pb-[calc(theme(spacing.tabbar)+theme(spacing.safe-bottom))]',
          // Constrain to phone width on desktop preview so dev surface matches mobile
          'mx-auto max-w-[440px]',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
AppShell.displayName = 'AppShell';
