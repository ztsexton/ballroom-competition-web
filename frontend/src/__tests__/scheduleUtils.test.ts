import { describe, it, expect } from 'vitest';
import {
  getMergeIncompatibilityReason,
  getMergeWarnings,
  getHeatCoupleCount,
} from '../pages/dayof/Schedule/utils';
import { Event, ScheduledHeat } from '../types';

function makeEvent(overrides: Partial<Event> & { id: number }): Event {
  return {
    name: `Event ${overrides.id}`,
    heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }],
    competitionId: 1,
    scoringType: 'standard',
    style: 'Smooth',
    ...overrides,
  };
}

function makeHeat(id: string, entries: ScheduledHeat['entries'], extra?: Partial<ScheduledHeat>): ScheduledHeat {
  return { id, entries, ...extra };
}

describe('getMergeIncompatibilityReason', () => {
  const events: Event[] = [
    makeEvent({ id: 1, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] }),
    makeEvent({ id: 2, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'final', bibs: [4, 5, 6], judges: [] }] }),
    makeEvent({ id: 3, style: 'Rhythm', scoringType: 'standard', heats: [{ round: 'final', bibs: [7, 8], judges: [] }] }),
    makeEvent({ id: 4, style: 'Smooth', scoringType: 'proficiency', heats: [{ round: 'final', bibs: [9, 10], judges: [] }] }),
    makeEvent({
      id: 5, style: 'Smooth', scoringType: 'standard',
      heats: [
        { round: 'semi-final', bibs: [11, 12, 13, 14], judges: [] },
        { round: 'final', bibs: [11, 12, 13], judges: [] },
      ],
    }),
    makeEvent({ id: 6, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'semi-final', bibs: [1, 2], judges: [] }] }),
  ];

  it('should return null for compatible heats', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    expect(getMergeIncompatibilityReason(source, target, events, 10)).toBeNull();
  });

  it('should allow different scoring types (no longer blocks)', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h4', [{ eventId: 4, round: 'final' }]);
    expect(getMergeIncompatibilityReason(source, target, events)).toBeNull();
  });

  it('should detect different style', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h3', [{ eventId: 3, round: 'final' }]);
    expect(getMergeIncompatibilityReason(source, target, events)).toBe('Different style (Rhythm)');
  });

  it('should detect different round', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h6', [{ eventId: 6, round: 'semi-final' }]);
    expect(getMergeIncompatibilityReason(source, target, events)).toBe('Different round');
  });

  it('should no longer block on couple count overflow', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    // 3 + 3 = 6 > maxCouplesPerHeat of 4 — now allowed (warning only)
    expect(getMergeIncompatibilityReason(source, target, events, 4)).toBeNull();
  });

  it('should detect multi-round events', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h5', [{ eventId: 5, round: 'final' }]);
    expect(getMergeIncompatibilityReason(source, target, events, 20)).toBe('Multi-round event cannot be merged');
  });

  it('should detect completed heat status', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    const statuses = { 'h1': 'pending', 'h2': 'completed' };
    expect(getMergeIncompatibilityReason(source, target, events, 10, statuses)).toBe('Already completed');
  });

  it('should detect scoring heat status', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    const statuses = { 'h1': 'pending', 'h2': 'scoring' };
    expect(getMergeIncompatibilityReason(source, target, events, 10, statuses)).toBe('Currently scoring');
  });

  it('should detect overlapping bibs (shared couples)', () => {
    // Event 1 has bibs [1,2,3], Event 6 has bibs [1,2] — overlap!
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h6', [{ eventId: 6, round: 'final' }]);
    // Fix: make them same round to avoid round mismatch being the first failure
    const modifiedEvents = [...events];
    modifiedEvents[5] = makeEvent({ id: 6, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
    expect(getMergeIncompatibilityReason(source, target, modifiedEvents, 10)).toBe('Shared couples');
  });
});

describe('getMergeWarnings', () => {
  const events: Event[] = [
    makeEvent({ id: 1, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] }),
    makeEvent({ id: 2, style: 'Smooth', scoringType: 'standard', heats: [{ round: 'final', bibs: [4, 5, 6], judges: [] }] }),
    makeEvent({ id: 4, style: 'Smooth', scoringType: 'proficiency', heats: [{ round: 'final', bibs: [9, 10], judges: [] }] }),
  ];

  it('should return empty array for compatible heats with no warnings', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    expect(getMergeWarnings(source, target, events, 10)).toEqual([]);
  });

  it('should warn when couple count exceeds max', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    const warnings = getMergeWarnings(source, target, events, 4);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Exceeds 4 couple limit');
    expect(warnings[0]).toContain('6 total');
  });

  it('should warn on mixed scoring types', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h4', [{ eventId: 4, round: 'final' }]);
    const warnings = getMergeWarnings(source, target, events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Mixed scoring types');
  });

  it('should return both warnings when applicable', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h4', [{ eventId: 4, round: 'final' }]);
    const warnings = getMergeWarnings(source, target, events, 2);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('couple limit');
    expect(warnings[1]).toContain('Mixed scoring types');
  });

  it('should not warn when maxCouplesPerHeat is not set', () => {
    const source = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    const target = makeHeat('h2', [{ eventId: 2, round: 'final' }]);
    // No maxCouplesPerHeat passed — no couple count warning
    expect(getMergeWarnings(source, target, events)).toEqual([]);
  });
});

describe('getHeatCoupleCount', () => {
  const events: Event[] = [
    makeEvent({ id: 1, heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] }),
    makeEvent({ id: 2, heats: [{ round: 'final', bibs: [4, 5], judges: [] }] }),
  ];

  it('should count couples for single-entry heat', () => {
    const heat = makeHeat('h1', [{ eventId: 1, round: 'final' }]);
    expect(getHeatCoupleCount(heat, events)).toBe(3);
  });

  it('should count couples for multi-entry heat', () => {
    const heat = makeHeat('h1', [
      { eventId: 1, round: 'final' },
      { eventId: 2, round: 'final' },
    ]);
    expect(getHeatCoupleCount(heat, events)).toBe(5);
  });

  it('should count couples from bibSubset when present', () => {
    const heat = makeHeat('h1', [
      { eventId: 1, round: 'final', bibSubset: [1, 2] },
    ]);
    expect(getHeatCoupleCount(heat, events)).toBe(2);
  });
});
