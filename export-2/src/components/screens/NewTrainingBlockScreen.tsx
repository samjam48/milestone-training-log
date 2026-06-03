// =============================================================================
// NewTrainingBlockScreen — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Create a new training block. Submitting archives the current block.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import type { MilestoneEngineResult, NewBlockDraft } from '../../hooks/useMilestoneEngine';

interface Props {
  engine:     MilestoneEngineResult;
  onBack:     () => void;
  onComplete: () => void;
}

export const NewTrainingBlockScreen: React.FC<Props> = ({ engine, onBack, onComplete }) => {
  const { submitNewBlock, todayDate, block: currentBlock } = engine;

  const [name,      setName]      = React.useState('');
  const [startDate, setStartDate] = React.useState(todayDate);
  const [endDate,   setEndDate]   = React.useState('');

  const canCreate = name.trim().length > 0 && startDate.length > 0;

  function handleCreate() {
    if (!canCreate) return;
    const draft: NewBlockDraft = {
      name: name.trim(),
      startDate,
      endDate: endDate || null,
    };
    submitNewBlock(draft);
    onComplete();
  }

  return (
    <div className="flex flex-col bg-bg" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border shrink-0">
        <button
          type="button" onClick={onBack} aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-title font-bold text-ink flex-1">New Training Block</h1>
        <button
          type="button" onClick={handleCreate} disabled={!canCreate}
          className={cn(
            'h-9 px-4 rounded-md text-body font-semibold transition-colors duration-snap',
            canCreate ? 'bg-ink text-ink-inverse' : 'bg-ink/20 text-ink-faint cursor-not-allowed',
          )}
        >
          Create
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-5 flex flex-col gap-5 pb-12">

        <div>
          <p className="text-body font-medium text-ink mb-2">Block name</p>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="e.g. Return to Running — Phase 1"
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        <div>
          <p className="text-body font-medium text-ink mb-2">Start date</p>
          <input
            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        <div>
          <p className="text-body font-medium text-ink mb-2">
            End date <span className="text-ink-faint font-normal">(optional)</span>
          </p>
          <input
            type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        {currentBlock && (
          <Card pad="md" intent="inset">
            <div className="flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-ink-faint" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
                <line x1="8" y1="5.5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="10.5" r="0.75" fill="currentColor" />
              </svg>
              <p className="text-caption text-ink-muted leading-relaxed">
                Creating this block will archive{' '}
                <strong className="text-ink font-medium">{currentBlock.name}</strong>{' '}
                as completed. Your existing logs and check-in history are preserved.
              </p>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};
