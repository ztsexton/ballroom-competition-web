import { getEventTypePriority, interleaveLevels, separateEventRounds, mergeEntries } from '../../services/schedule/scheduleGenerator';
import { Event, HeatEntry, ScheduledHeat } from '../../types';

describe('getEventTypePriority', () => {
  const baseEvent: Event = {
    id: 1, name: 'Test', heats: [], competitionId: 1,
  };

  it('returns 0 for single dance event', () => {
    expect(getEventTypePriority({ ...baseEvent, dances: ['Waltz'] })).toBe(0);
  });

  it('returns 0 for event with no dances', () => {
    expect(getEventTypePriority({ ...baseEvent })).toBe(0);
  });

  it('returns 1 for multi-dance event', () => {
    expect(getEventTypePriority({ ...baseEvent, dances: ['Waltz', 'Tango'] })).toBe(1);
  });

  it('returns 2 for scholarship event', () => {
    expect(getEventTypePriority({ ...baseEvent, isScholarship: true, dances: ['Waltz', 'Tango'] })).toBe(2);
  });

  it('returns 2 for single-dance scholarship', () => {
    expect(getEventTypePriority({ ...baseEvent, isScholarship: true, dances: ['Waltz'] })).toBe(2);
  });
});

describe('interleaveLevels', () => {
  it('returns copy for stride < 2', () => {
    const levels = ['A', 'B', 'C'];
    expect(interleaveLevels(levels, 1)).toEqual(['A', 'B', 'C']);
  });

  it('returns copy for stride >= length', () => {
    const levels = ['A', 'B'];
    expect(interleaveLevels(levels, 3)).toEqual(['A', 'B']);
  });

  it('interleaves 4 levels with stride 2', () => {
    expect(interleaveLevels(['B1', 'B2', 'B3', 'B4'], 2)).toEqual(['B1', 'B3', 'B2', 'B4']);
  });

  it('interleaves 6 levels with stride 3', () => {
    expect(interleaveLevels(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'], 3))
      .toEqual(['B1', 'B4', 'B2', 'B5', 'B3', 'B6']);
  });

  it('interleaves 7 levels with stride 2', () => {
    expect(interleaveLevels(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 2))
      .toEqual(['A', 'C', 'E', 'G', 'B', 'D', 'F']);
  });

  it('handles standard levels with stride 2', () => {
    const levels = ['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'];
    const result = interleaveLevels(levels, 2);
    // Consecutive original levels should not be adjacent
    expect(result.indexOf('Newcomer')).not.toBe(result.indexOf('Bronze') - 1);
    expect(result).toHaveLength(7);
    // All levels should be present
    expect(new Set(result)).toEqual(new Set(levels));
  });

  it('does not mutate input array', () => {
    const levels = ['A', 'B', 'C', 'D'];
    interleaveLevels(levels, 2);
    expect(levels).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('separateEventRounds', () => {
  function makeHeat(id: string, eventIds: number[]): ScheduledHeat {
    return {
      id,
      entries: eventIds.map(eventId => ({ eventId, round: 'final' })),
    };
  }

  function makeBreak(id: string): ScheduledHeat {
    return { id, entries: [], isBreak: true };
  }

  it('does nothing when no adjacent heats share an event', () => {
    const heats = [makeHeat('a', [1]), makeHeat('b', [2]), makeHeat('c', [3])];
    const result = separateEventRounds(heats);
    expect(result.map(h => h.id)).toEqual(['a', 'b', 'c']);
  });

  it('swaps to separate adjacent heats with same eventId', () => {
    const heats = [
      makeHeat('a', [1]),
      makeHeat('b', [1]),   // same event as 'a' — should get swapped
      makeHeat('c', [2]),
      makeHeat('d', [3]),
    ];
    const result = separateEventRounds(heats);
    // After swap, 'a' and 'b' should no longer be adjacent
    const idxA = result.findIndex(h => h.id === 'a');
    const idxB = result.findIndex(h => h.id === 'b');
    expect(Math.abs(idxA - idxB)).toBeGreaterThan(1);
  });

  it('skips breaks', () => {
    const heats = [
      makeHeat('a', [1]),
      makeBreak('brk'),
      makeHeat('b', [1]),
    ];
    const result = separateEventRounds(heats);
    // Break separates them already, no swap needed
    expect(result.map(h => h.id)).toEqual(['a', 'brk', 'b']);
  });

  it('does not create new event adjacency when swapping', () => {
    const heats = [
      makeHeat('a', [1]),
      makeHeat('b', [1]),
      makeHeat('c', [1]),  // All same event — limited swap options
    ];
    const result = separateEventRounds(heats);
    // Should still have all heats
    expect(result).toHaveLength(3);
  });
});

describe('mergeEntries', () => {
  it('should not merge section events with same sectionGroupId', () => {
    const eventA: Event = {
      id: 1, name: 'Bronze Waltz - A', heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
      sectionGroupId: 'sg-123', sectionLetter: 'A',
    };
    const eventB: Event = {
      id: 2, name: 'Bronze Waltz - B', heats: [{ round: 'final', bibs: [3, 4], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
      sectionGroupId: 'sg-123', sectionLetter: 'B',
    };

    const items = [
      { entry: { eventId: 1, round: 'final' } as HeatEntry, event: eventA, coupleCount: 2 },
      { entry: { eventId: 2, round: 'final' } as HeatEntry, event: eventB, coupleCount: 2 },
    ];

    const result = mergeEntries(items, 10);

    // Should be in separate heats despite fitting in one
    expect(result.length).toBe(2);
    const heat1Events = result[0].entries.map(e => e.eventId);
    const heat2Events = result[1].entries.map(e => e.eventId);
    expect(heat1Events).not.toEqual(expect.arrayContaining(heat2Events));
  });

  it('should merge events without sectionGroupId normally', () => {
    const eventA: Event = {
      id: 1, name: 'Bronze Waltz', heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
    };
    const eventB: Event = {
      id: 2, name: 'Silver Waltz', heats: [{ round: 'final', bibs: [3, 4], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
    };

    const items = [
      { entry: { eventId: 1, round: 'final' } as HeatEntry, event: eventA, coupleCount: 2 },
      { entry: { eventId: 2, round: 'final' } as HeatEntry, event: eventB, coupleCount: 2 },
    ];

    const result = mergeEntries(items, 10);

    // Should be merged into one heat
    expect(result.length).toBe(1);
    expect(result[0].entries.length).toBe(2);
  });

  it('should allow merging section event with non-section event', () => {
    const eventA: Event = {
      id: 1, name: 'Bronze Waltz - A', heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
      sectionGroupId: 'sg-123', sectionLetter: 'A',
    };
    const eventC: Event = {
      id: 3, name: 'Silver Waltz', heats: [{ round: 'final', bibs: [5, 6], judges: [] }],
      competitionId: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
    };

    const items = [
      { entry: { eventId: 1, round: 'final' } as HeatEntry, event: eventA, coupleCount: 2 },
      { entry: { eventId: 3, round: 'final' } as HeatEntry, event: eventC, coupleCount: 2 },
    ];

    const result = mergeEntries(items, 10);

    // Should merge — different sectionGroupId (one has none)
    expect(result.length).toBe(1);
    expect(result[0].entries.length).toBe(2);
  });
});
