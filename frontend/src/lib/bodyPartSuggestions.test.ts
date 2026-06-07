import { describe, it, expect } from 'vitest';
import type { DailyCheckIn, FlareUpIncident } from '../types';
import { buildBodyPartSuggestions } from './bodyPartSuggestions';

const USER_ID = 'user-1';
const CREATED_AT = '2026-05-01T12:00:00Z';

function makeIncident(
  overrides: Partial<FlareUpIncident> & Pick<FlareUpIncident, 'bodyPart'>,
): FlareUpIncident {
  return {
    id: overrides.id ?? 'inc-test',
    userId: overrides.userId ?? USER_ID,
    incidentDate: overrides.incidentDate ?? '2026-05-01',
    severity: overrides.severity ?? 5,
    createdAt: overrides.createdAt ?? CREATED_AT,
    ...overrides,
  };
}

function makeCheckIn(
  overrides: Partial<DailyCheckIn> & Pick<DailyCheckIn, 'checkInDate'>,
): DailyCheckIn {
  return {
    id: overrides.id ?? 'ci-test',
    userId: overrides.userId ?? USER_ID,
    checkInDate: overrides.checkInDate,
    painLevel: overrides.painLevel ?? 5,
    readinessLevel: overrides.readinessLevel ?? 5,
    stiffnessLevel: overrides.stiffnessLevel ?? 5,
    hasFlareUp: overrides.hasFlareUp ?? false,
    flareUp: overrides.flareUp,
    createdAt: overrides.createdAt ?? CREATED_AT,
  };
}

describe('buildBodyPartSuggestions — S25.F9', () => {
  it('returns distinct incident body parts recent-first', () => {
    const suggestions = buildBodyPartSuggestions(
      [
        makeIncident({
          id: 'inc-old',
          bodyPart: 'Left ankle',
          incidentDate: '2026-05-01',
          createdAt: '2026-05-01T10:00:00Z',
        }),
        makeIncident({
          id: 'inc-new',
          bodyPart: 'Right toe',
          incidentDate: '2026-05-20',
          createdAt: '2026-05-20T10:00:00Z',
        }),
      ],
      [],
    );

    expect(suggestions).toEqual(['Right toe', 'Left ankle']);
  });

  it('includes flare-up body parts from check-ins with hasFlareUp', () => {
    const suggestions = buildBodyPartSuggestions(
      [],
      [
        makeCheckIn({
          id: 'ci-flare',
          checkInDate: '2026-05-15',
          hasFlareUp: true,
          flareUp: {
            bodyPart: 'Left heel',
            severity: 7,
            likelyCauseActivityClassIds: [],
          },
        }),
      ],
    );

    expect(suggestions).toEqual(['Left heel']);
  });

  it('dedupes case-insensitively across incidents and check-ins', () => {
    const suggestions = buildBodyPartSuggestions(
      [
        makeIncident({
          id: 'inc-a',
          bodyPart: 'Right toe',
          incidentDate: '2026-05-20',
          createdAt: '2026-05-20T10:00:00Z',
        }),
      ],
      [
        makeCheckIn({
          id: 'ci-b',
          checkInDate: '2026-05-10',
          hasFlareUp: true,
          flareUp: {
            bodyPart: 'right toe',
            severity: 6,
            likelyCauseActivityClassIds: [],
          },
        }),
      ],
    );

    expect(suggestions).toEqual(['Right toe']);
  });

  it('excludes check-ins without flare-up and whitespace-only parts', () => {
    const suggestions = buildBodyPartSuggestions(
      [
        makeIncident({ id: 'inc-space', bodyPart: '   ' }),
        makeIncident({ id: 'inc-valid', bodyPart: 'Knee' }),
      ],
      [
        makeCheckIn({
          id: 'ci-no-flare',
          checkInDate: '2026-05-12',
          hasFlareUp: false,
        }),
        makeCheckIn({
          id: 'ci-empty-flare',
          checkInDate: '2026-05-11',
          hasFlareUp: true,
          flareUp: {
            bodyPart: '  ',
            severity: 5,
            likelyCauseActivityClassIds: [],
          },
        }),
      ],
    );

    expect(suggestions).toEqual(['Knee']);
  });

  it('returns empty array when no history', () => {
    expect(buildBodyPartSuggestions([], [])).toEqual([]);
  });
});
