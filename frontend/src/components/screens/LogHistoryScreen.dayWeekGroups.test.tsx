/**
 * Log History day and week grouping acceptance tests.
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

describe('LogHistoryScreen day and week grouping', () => {
  it('renders each day as its own padded rounded timeline block while preserving month headers', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-may-19', loggedDate: '2026-05-19', durationMinutes: 25 }),
        makeLog({ id: 'log-may-20', loggedDate: '2026-05-20', durationMinutes: 42 }),
      ],
      incidents: [
        makeIncident({
          id: 'inc-may-20',
          incidentDate: '2026-05-20',
          bodyPart: 'Left heel',
          severity: 8,
        }),
      ],
    });

    expect(screen.getByText('May 2026')).toBeInTheDocument();

    const may20Group = screen.getByTestId('log-history-day-group-2026-05-20');
    const may19Group = screen.getByTestId('log-history-day-group-2026-05-19');

    expect(may20Group.className).toMatch(/rounded/);
    expect(may20Group.className).toMatch(/p-/);
    expect(may19Group.className).toMatch(/rounded/);
    expect(may19Group.className).toMatch(/p-/);

    expect(within(may20Group).getByText('Wed, May 20')).toBeInTheDocument();
    expect(within(may20Group).getByText('Left heel')).toBeInTheDocument();
    expect(within(may20Group).getByText('42 min')).toBeInTheDocument();
    expect(within(may19Group).getByText('Tue, May 19')).toBeInTheDocument();
    expect(within(may19Group).getByText('25 min')).toBeInTheDocument();
  });

  it('inserts Monday-based week separators only between day groups in different weeks', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-sun-may-24', loggedDate: '2026-05-24' }),
        makeLog({ id: 'log-mon-may-18', loggedDate: '2026-05-18' }),
        makeLog({ id: 'log-sun-may-17', loggedDate: '2026-05-17' }),
      ],
      incidents: [],
    });

    expect(screen.getAllByText('Week of May 18')).toHaveLength(1);
    expect(screen.getAllByText('Week of May 11')).toHaveLength(1);
    expect(screen.getByText('Sun, May 24')).toBeInTheDocument();
    expect(screen.getByText('Mon, May 18')).toBeInTheDocument();
    expect(screen.getByText('Sun, May 17')).toBeInTheDocument();

    const may18Separator = screen.getByText('Week of May 18');
    const may11Separator = screen.getByText('Week of May 11');
    const may24Group = screen.getByTestId('log-history-day-group-2026-05-24');
    const may18Group = screen.getByTestId('log-history-day-group-2026-05-18');
    const may17Group = screen.getByTestId('log-history-day-group-2026-05-17');

    expect(may24Group.compareDocumentPosition(may18Separator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(may18Separator.compareDocumentPosition(may18Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(may18Group.compareDocumentPosition(may11Separator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(may11Separator.compareDocumentPosition(may17Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText('Week of May 25')).not.toBeInTheDocument();
  });

  it('inserts a week separator for sparse histories that cross weeks without rendering Monday', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-tue-may-26', loggedDate: '2026-05-26' }),
        makeLog({ id: 'log-fri-may-22', loggedDate: '2026-05-22' }),
      ],
      incidents: [],
    });

    expect(screen.getByText('Tue, May 26')).toBeInTheDocument();
    expect(screen.getByText('Fri, May 22')).toBeInTheDocument();

    const may18Separator = screen.getByText('Week of May 18');
    const may26Group = screen.getByTestId('log-history-day-group-2026-05-26');
    const may22Group = screen.getByTestId('log-history-day-group-2026-05-22');

    expect(may26Group.compareDocumentPosition(may18Separator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(may18Separator.compareDocumentPosition(may22Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('does not show week separators for a single-day or single-week month', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-wed-may-20', loggedDate: '2026-05-20' }),
        makeLog({ id: 'log-mon-may-18', loggedDate: '2026-05-18' }),
      ],
      incidents: [
        makeIncident({
          id: 'inc-sun-may-24',
          incidentDate: '2026-05-24',
          bodyPart: 'Right knee',
          severity: 6,
        }),
      ],
    });

    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.getByText('Sun, May 24')).toBeInTheDocument();
    expect(screen.getByText('Wed, May 20')).toBeInTheDocument();
    expect(screen.getByText('Mon, May 18')).toBeInTheDocument();
    expect(screen.queryByText(/Week of/)).not.toBeInTheDocument();
  });

  it('keeps week separators within month sections when a week spans a month boundary', () => {
    renderLogHistory({
      logs: [
        makeLog({ id: 'log-jun-02', loggedDate: '2026-06-02' }),
        makeLog({ id: 'log-jun-01', loggedDate: '2026-06-01' }),
        makeLog({ id: 'log-may-31', loggedDate: '2026-05-31' }),
      ],
      incidents: [],
    });

    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.queryByText('Week of June 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Week of May 25')).not.toBeInTheDocument();

    const juneHeader = screen.getByText('June 2026');
    const mayHeader = screen.getByText('May 2026');
    const june2Group = screen.getByTestId('log-history-day-group-2026-06-02');
    const june1Group = screen.getByTestId('log-history-day-group-2026-06-01');
    const may31Group = screen.getByTestId('log-history-day-group-2026-05-31');

    expect(juneHeader.compareDocumentPosition(june2Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(june2Group.compareDocumentPosition(june1Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(june1Group.compareDocumentPosition(mayHeader)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(mayHeader.compareDocumentPosition(may31Group)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
