import * as React from 'react';
import { cn } from '../../lib/cn';
import { BackButton } from '../ui/BackButton';
import { Card } from '../ui/Card';
import {
  StackScreenEngineBody,
  stackScreenEngineBlocked,
} from '../ui/StackScreenEngineBody';
import type {
  BlockDraft,
  MilestoneEngineResult,
} from '../../hooks/useMilestoneEngine';
import type { ISODate } from '../../types';

export interface NewTrainingBlockScreenProps {
  engine: MilestoneEngineResult;
  onBack: () => void;
  onComplete: () => void;
}

export function NewTrainingBlockScreen({
  engine,
  onBack,
  onComplete,
}: NewTrainingBlockScreenProps): React.ReactElement {
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState<string>(engine.todayDate);
  const [endDate, setEndDate] = React.useState('');

  const canCreate = name.trim().length > 0 && startDate !== '';
  const hasCurrentBlock = engine.block.id !== '';
  const blocked = stackScreenEngineBlocked(engine);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canCreate) return;

    const draft: BlockDraft = {
      name: name.trim(),
      startDate: startDate as ISODate,
    };

    if (endDate !== '') {
      draft.endDate = endDate as ISODate;
    }

    engine.createTrainingBlock(draft);
    onComplete();
  }

  return (
    <section className="flex min-h-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3">
        <BackButton onPress={onBack} />
        <h1 className="flex-1 text-title font-bold text-ink">New training block</h1>
        {!blocked ? (
          <button
            type="submit"
            form="new-training-block-form"
            disabled={!canCreate}
            className={cn(
              'h-9 rounded-md px-4 text-body font-semibold transition-colors duration-snap',
              canCreate
                ? 'bg-ink text-ink-inverse active:opacity-80'
                : 'cursor-not-allowed bg-ink/20 text-ink-faint',
            )}
          >
            Create
          </button>
        ) : null}
      </header>

      <StackScreenEngineBody engine={engine}>
      <form
        id="new-training-block-form"
        aria-label="New training block"
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-5 px-4 py-5 pb-12"
      >
        <div>
          <label
            htmlFor="new-training-block-name"
            className="mb-2 block text-body font-medium text-ink"
          >
            Block name
          </label>
          <input
            id="new-training-block-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            placeholder="e.g. June Rehab Block"
            className={cn(
              'w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5',
              'text-body text-ink placeholder:text-ink-faint',
              'focus:border-border-strong focus:outline-none',
            )}
          />
        </div>

        <div>
          <label
            htmlFor="new-training-block-start-date"
            className="mb-2 block text-body font-medium text-ink"
          >
            Start date
          </label>
          <input
            id="new-training-block-start-date"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5',
              'text-body text-ink',
              'focus:border-border-strong focus:outline-none',
            )}
          />
        </div>

        <div>
          <label
            htmlFor="new-training-block-end-date"
            className="mb-2 block text-body font-medium text-ink"
          >
            End date <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="new-training-block-end-date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5',
              'text-body text-ink',
              'focus:border-border-strong focus:outline-none',
            )}
          />
        </div>

        {hasCurrentBlock ? (
          <Card pad="md" intent="inset" role="status">
            <div className="flex items-start gap-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="mt-0.5 shrink-0 text-ink-faint"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
                <line
                  x1="8"
                  y1="5.5"
                  x2="8"
                  y2="8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="10.5" r="0.75" fill="currentColor" />
              </svg>
              <p className="text-caption leading-relaxed text-ink-muted">
                Creating this block will archive{' '}
                <strong className="font-medium text-ink">{engine.block.name}</strong>.
                Your existing logs and check-in history are preserved.
              </p>
            </div>
          </Card>
        ) : null}
      </form>
      </StackScreenEngineBody>
    </section>
  );
}
