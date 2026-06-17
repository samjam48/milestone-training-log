/** Shared colour tokens for heatmap cells. Import in components that need to
 *  render safety-state swatches so the classes live in a single place. */
export const SAFETY_CELL_CLASSES: Record<'safe' | 'caution' | 'danger', string> = {
  safe:    'bg-safe/70    ring-1 ring-inset ring-safe-border',
  caution: 'bg-caution/70 ring-1 ring-inset ring-caution-border',
  danger:  'bg-danger/70  ring-1 ring-inset ring-danger-border',
};
