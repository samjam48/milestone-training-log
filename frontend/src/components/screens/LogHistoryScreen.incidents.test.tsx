/**
 * Log History incident timeline acceptance tests.
 *
 * These tests intentionally fail before the incident timeline implementation
 * because LogHistoryScreen currently groups only engine.logs and ignores
 * engine.incidents.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createLogHistoryEngine, logActivityWalk } from '../../test/fixtures/c62Fixtures';
import type { ActivityLog, FlareUpIncident, RPE } from '../../types';
import { LogHistoryScreen } from './LogHistoryScreen';

const CREATED_AT = '2026-04-07T06:00:00Z';
const USER_ID = 'user-1';

function makeLog(overrides: Partial<ActivityLog> & Pick<ActivityLog, 'id' | 'loggedDate'>): ActivityLog {
  return {
    userId: USER_ID,
    activityId: logActivityWalk.id,
    durationMinutes: 30,
    volumeValue: 3,
    volumeUnit: 'km',
    rpe: 4 as RPE,
    postActivityFeel: 'fine',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeIncident(
  overrides: Partial<FlareUpIncident> & Pick<FlareUpIncident, 'id' | 'incidentDate'>,
): FlareUpIncident {
  return {
    userId: USER_ID,
    bodyPart: 'Left heel',
    severity: 7,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function renderLogHistory(overrides: Parameters<typeof createLogHistoryEngine>[1]): void {
  renderWithProviders(
    <LogHistoryScreen
      engine={createLogHistoryEngine(0, overrides)}
      onOpenLogActivity={vi.fn()}
      onOpenLogIncident={vi.fn()}
      onEditLog={vi.fn()}
      onDeleteLog={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LogHistoryScreen incident timeline', () => {
  it('renders incidents inline by incident date without changing the log-only header count', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-may-20', loggedDate: '2026-05-20', durationMinutes: 42 }),
        makeLog({ id: 'log-may-19', loggedDate: '2026-05-19', durationMinutes: 25 }),
      ],
      incidents: [
        makeIncident({
          id: 'inc-may-20',
          incidentDate: '2026-05-20',
          bodyPart: 'Left heel',
          severity: 8,
          notes: 'Sharp pain after stairs.',
        }),
      ],
    });

    expect(screen.getByText('2 sessions logged')).toBeInTheDocument();
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.getByText('Wed, May 20')).toBeInTheDocument();
    expect(screen.getByText('Tue, May 19')).toBeInTheDocument();

    expect(screen.getAllByText('Morning Walk')).toHaveLength(2);
    expect(screen.getByText('42 min')).toBeInTheDocument();
    expect(screen.getByText('Left heel')).toBeInTheDocument();
    expect(screen.getByText(/severity 8\/10/i)).toBeInTheDocument();
    expect(screen.getByText('Sharp pain after stairs.')).toBeInTheDocument();
  });

  it('renders a timeline instead of the empty state when there are only incidents', () => {
    renderLogHistory({
      logs: [],
      incidents: [
        makeIncident({
          id: 'inc-only',
          incidentDate: '2026-05-18',
          bodyPart: 'Right knee',
          severity: 6,
        }),
      ],
    });

    expect(screen.getByText('0 sessions logged')).toBeInTheDocument();
    expect(screen.queryByTestId('log-history-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('Mon, May 18')).toBeInTheDocument();
    expect(screen.getByText('Right knee')).toBeInTheDocument();
    expect(screen.getByText(/severity 6\/10/i)).toBeInTheDocument();
  });

  it('renders incident rows as caution-tinted read-only rows with a warning icon', () => {
    renderLogHistory({
      logs: [makeLog({ id: 'log-same-day', loggedDate: '2026-05-20' })],
      incidents: [
        makeIncident({
          id: 'inc-same-day',
          incidentDate: '2026-05-20',
          bodyPart: 'Left ankle',
          severity: 9,
          notes: 'Swelling by evening.',
        }),
      ],
    });

    const incidentRow = screen.getByTestId('log-history-incident-row-inc-same-day');
    expect(incidentRow.className).toMatch(/caution|orange/);
    expect(within(incidentRow).getByText('⚠')).toBeInTheDocument();
    expect(within(incidentRow).getByText('Left ankle')).toBeInTheDocument();
    expect(within(incidentRow).getByText(/severity 9\/10/i)).toBeInTheDocument();
    expect(within(incidentRow).getByText('Swelling by evening.')).toBeInTheDocument();
    expect(within(incidentRow).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(within(incidentRow).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('uses deterministic same-day ordering with incidents before activity logs', () => {
    renderLogHistory({
      logs: [makeLog({ id: 'log-same-day', loggedDate: '2026-05-20' })],
      incidents: [
        makeIncident({
          id: 'inc-same-day',
          incidentDate: '2026-05-20',
          bodyPart: 'Left heel',
          severity: 7,
        }),
      ],
    });

    const incidentBodyPart = screen.getByText('Left heel');
    const logActivityName = screen.getByText('Morning Walk');
    expect(incidentBodyPart.compareDocumentPosition(logActivityName)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
