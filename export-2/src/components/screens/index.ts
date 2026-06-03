// =============================================================================
// Tier 3 — Screens barrel  (v2)
// -----------------------------------------------------------------------------
// Re-export every screen so callers can do:
//   import { DashboardScreen, GoalsScreen, … } from '@/components/screens';
// =============================================================================

// ── v1 screens (unchanged) ───────────────────────────────────────────────────
export { DashboardScreen }        from './DashboardScreen';
export { LogHistoryScreen }       from './LogHistoryScreen';
export { MorningCheckInScreen }   from './MorningCheckInScreen';
export { LogActivityScreen }      from './LogActivityScreen';
export { LogIncidentScreen }      from './LogIncidentScreen';

// ── v2 screens — previously prototype-only, now ported to TS ────────────────
export { GoalsScreen }            from './GoalsScreen';
export { SettingsScreen }         from './SettingsScreen';

// ── v2 screens — new in this release ────────────────────────────────────────
export { GoalEditorScreen }       from './GoalEditorScreen';
export { EditBlockRulesScreen }   from './EditBlockRulesScreen';
export { BlockReviewScreen }      from './BlockReviewScreen';
export { NewTrainingBlockScreen } from './NewTrainingBlockScreen';
export { ActivityManagerScreen }  from './ActivityManagerScreen';
export { InlineLogSheet }         from './InlineLogSheet';
