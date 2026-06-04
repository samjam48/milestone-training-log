import { describe, it, expect } from 'vitest';
import {
  buildLoadRiskBarModels,
  formatDisplayDate,
  proactiveLoadRiskHits,
  summarizeDelayedTaxHit,
} from './delayedTaxDisplay';
import type { DelayedTaxResponse } from '../hooks/useMilestoneEngine';
import type { ActivityClass } from '../types';

const CLASSES: ActivityClass[] = [
  {
    id: 'cls-foot',
    userId: 'u1',
    name: 'High-Intensity Foot Load',
    type: 'performance',
    defaultRecoveryWindowDays: 3,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('delayedTaxDisplay', () => {
  it('formats ISO dates without year', () => {
    expect(formatDisplayDate('2026-06-04')).toBe('4th June');
    expect(formatDisplayDate('2026-05-28')).toBe('28th May');
  });

  it('summarizes elevated_load without repeating ISO dates', () => {
    const row = summarizeDelayedTaxHit(
      {
        hitType: 'elevated_load',
        activityClassId: 'cls-foot',
        contributingDate: '2026-06-04',
        message: 'Elevated load on 2026-06-04: 18.0 (baseline median 0.0)',
      },
      0,
      CLASSES,
    );
    expect(row.className).toBe('High-Intensity Foot Load');
    expect(row.dateLabel).toBe('4th June');
    expect(row.summary).toBe('Load 18.0 vs your usual 0.0');
    expect(row.summary).not.toMatch(/2026-/);
  });

  it('summarizes symptom_contributor with one contributing date', () => {
    const row = summarizeDelayedTaxHit(
      {
        hitType: 'symptom_contributor',
        activityClassId: 'cls-foot',
        contributingDate: '2026-06-04',
        symptomDate: '2026-06-04',
        message:
          'Prior elevated_load on 2026-06-04 may have contributed to symptom on 2026-06-04',
      },
      0,
      CLASSES,
    );
    expect(row.dateLabel).toBe('4th June');
    expect(row.summary).toBe('Earlier load this week may have contributed');
    expect(row.summary).not.toMatch(/2026-/);
  });
});

describe('load risk bar models', () => {
  const hits: DelayedTaxResponse['hits'] = [
    {
      hitType: 'elevated_load',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-22',
      dailyLoad: 18,
      baselineMedianDailyLoad: 10,
      message: 'Elevated load on 2026-05-22: 18.0 (baseline median 10.0)',
    },
    {
      hitType: 'symptom_marker',
      symptomDate: '2026-05-28',
      message: 'Symptom recorded on 2026-05-28',
    },
  ];

  it('filters proactive hits only', () => {
    expect(proactiveLoadRiskHits(hits)).toHaveLength(1);
  });

  it('builds progress bar metrics for elevated load', () => {
    const models = buildLoadRiskBarModels(hits, CLASSES);
    expect(models).toHaveLength(1);
    expect(models[0]?.value).toBe(18);
    expect(models[0]?.target).toBe(10);
    expect(models[0]?.dateLabel).toBe('22nd May');
  });
});
