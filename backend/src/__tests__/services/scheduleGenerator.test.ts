import { getEventTypePriority, getEventTypeTag, interleaveLevels, separateEventRounds, mergeEntries } from '../../services/schedule/scheduleGenerator';
import { Event, HeatEntry, ScheduledHeat, LevelCombiningConfig } from '../../types';

// ── Helpers ──────────────────────────────────────────────────

function makeEvent(overrides: Partial<Event> & { id: number }): Event {
  return {
    name: `Event ${overrides.id}`,
    heats: [{ round: 'final', bibs: [], judges: [] }],
    competitionId: 1,
    ...overrides,
  };
}

function makeItem(event: Event, round = 'final') {
  const heat = event.heats.find(h => h.round === round) || event.heats[0];
  return {
    entry: { eventId: event.id, round } as HeatEntry,
    event,
    coupleCount: heat?.bibs.length ?? 0,
  };
}

function heatEventIds(heat: ScheduledHeat): number[] {
  return heat.entries.map(e => e.eventId);
}

function allEventIdsInOrder(heats: ScheduledHeat[]): number[][] {
  return heats.map(h => heatEventIds(h));
}

// ── getEventTypeTag ──────────────────────────────────────────

describe('getEventTypeTag', () => {
  it('returns "single" for event with one dance', () => {
    expect(getEventTypeTag(makeEvent({ id: 1, dances: ['Waltz'] }))).toBe('single');
  });

  it('returns "single" for event with no dances', () => {
    expect(getEventTypeTag(makeEvent({ id: 1 }))).toBe('single');
  });

  it('returns "multi" for event with multiple dances', () => {
    expect(getEventTypeTag(makeEvent({ id: 1, dances: ['Waltz', 'Tango'] }))).toBe('multi');
  });

  it('returns "scholarship" for scholarship event regardless of dance count', () => {
    expect(getEventTypeTag(makeEvent({ id: 1, isScholarship: true, dances: ['Waltz'] }))).toBe('scholarship');
    expect(getEventTypeTag(makeEvent({ id: 1, isScholarship: true, dances: ['Waltz', 'Tango'] }))).toBe('scholarship');
  });
});

// ── getEventTypePriority ─────────────────────────────────────

describe('getEventTypePriority', () => {
  it('returns 0 for single dance event', () => {
    expect(getEventTypePriority(makeEvent({ id: 1, dances: ['Waltz'] }))).toBe(0);
  });

  it('returns 0 for event with no dances', () => {
    expect(getEventTypePriority(makeEvent({ id: 1 }))).toBe(0);
  });

  it('returns 1 for multi-dance event', () => {
    expect(getEventTypePriority(makeEvent({ id: 1, dances: ['Waltz', 'Tango'] }))).toBe(1);
  });

  it('returns 2 for scholarship event', () => {
    expect(getEventTypePriority(makeEvent({ id: 1, isScholarship: true, dances: ['Waltz', 'Tango'] }))).toBe(2);
  });

  it('returns 2 for single-dance scholarship', () => {
    expect(getEventTypePriority(makeEvent({ id: 1, isScholarship: true, dances: ['Waltz'] }))).toBe(2);
  });

  it('respects custom event type order', () => {
    const customOrder = ['scholarship', 'multi', 'single'];
    expect(getEventTypePriority(makeEvent({ id: 1, dances: ['Waltz'] }), customOrder)).toBe(2); // single is last
    expect(getEventTypePriority(makeEvent({ id: 1, isScholarship: true }), customOrder)).toBe(0); // scholarship is first
    expect(getEventTypePriority(makeEvent({ id: 1, dances: ['Waltz', 'Tango'] }), customOrder)).toBe(1); // multi is middle
  });
});

// ── interleaveLevels ─────────────────────────────────────────

describe('interleaveLevels', () => {
  it('returns copy for stride < 2', () => {
    expect(interleaveLevels(['A', 'B', 'C'], 1)).toEqual(['A', 'B', 'C']);
  });

  it('returns copy for stride >= length', () => {
    expect(interleaveLevels(['A', 'B'], 3)).toEqual(['A', 'B']);
  });

  it('interleaves 4 levels with stride 2', () => {
    expect(interleaveLevels(['B1', 'B2', 'B3', 'B4'], 2)).toEqual(['B1', 'B3', 'B2', 'B4']);
  });

  it('interleaves 6 levels with stride 3', () => {
    expect(interleaveLevels(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'], 3))
      .toEqual(['B1', 'B4', 'B2', 'B5', 'B3', 'B6']);
  });

  it('preserves all elements', () => {
    const levels = ['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'];
    const result = interleaveLevels(levels, 2);
    expect(result).toHaveLength(7);
    expect(new Set(result)).toEqual(new Set(levels));
  });

  it('does not mutate input array', () => {
    const levels = ['A', 'B', 'C', 'D'];
    interleaveLevels(levels, 2);
    expect(levels).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ── separateEventRounds ──────────────────────────────────────

describe('separateEventRounds', () => {
  function makeHeat(id: string, eventIds: number[]): ScheduledHeat {
    return { id, entries: eventIds.map(eventId => ({ eventId, round: 'final' })) };
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
      makeHeat('b', [1]),
      makeHeat('c', [2]),
      makeHeat('d', [3]),
    ];
    const result = separateEventRounds(heats);
    const idxA = result.findIndex(h => h.id === 'a');
    const idxB = result.findIndex(h => h.id === 'b');
    expect(Math.abs(idxA - idxB)).toBeGreaterThan(1);
  });

  it('skips breaks', () => {
    const heats = [makeHeat('a', [1]), makeBreak('brk'), makeHeat('b', [1])];
    const result = separateEventRounds(heats);
    expect(result.map(h => h.id)).toEqual(['a', 'brk', 'b']);
  });

  it('preserves all heats even when swapping is limited', () => {
    const heats = [makeHeat('a', [1]), makeHeat('b', [1]), makeHeat('c', [1])];
    const result = separateEventRounds(heats);
    expect(result).toHaveLength(3);
  });
});

// ── mergeEntries ─────────────────────────────────────────────
// This is the core of schedule generation — thorough coverage required.

describe('mergeEntries', () => {
  // ── Basic merging ──────────────────────────────────────────

  describe('basic merging', () => {
    it('merges compatible events into one heat', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard', heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
      expect(result[0].entries).toHaveLength(2);
    });

    it('does not merge events with different styles', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Latin', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });

    it('does not merge events with different dances', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Tango'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });

    it('does not merge events with different scoring types', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], scoringType: 'proficiency', heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });

    it('does not merge scholarship with non-scholarship events', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], isScholarship: true, heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });
  });

  // ── Max couples limit ──────────────────────────────────────

  describe('max couples limit', () => {
    it('respects maxCouples limit', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [4, 5, 6], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 4);
      expect(result).toHaveLength(2); // 3 + 3 = 6 > 4
    });

    it('merges when exactly at maxCouples', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 4);
      expect(result).toHaveLength(1); // 2 + 2 = 4 === 4
    });

    it('splits into multiple heats when many events exceed maxCouples', () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent({ id: i + 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [i * 3 + 1, i * 3 + 2, i * 3 + 3], judges: [] }] })
      );
      const items = events.map(e => makeItem(e));
      const result = mergeEntries(items, 6);
      // 5 events × 3 bibs = 15 couples, maxCouples=6, so at least 3 heats
      expect(result.length).toBeGreaterThanOrEqual(3);
      // Each heat must have ≤ 6 total bibs
      for (const heat of result) {
        const totalBibs = new Set<number>();
        for (const entry of heat.entries) {
          const event = events.find(e => e.id === entry.eventId);
          event?.heats[0]?.bibs.forEach(b => totalBibs.add(b));
        }
        expect(totalBibs.size).toBeLessThanOrEqual(6);
      }
    });
  });

  // ── Bib overlap ────────────────────────────────────────────

  describe('bib overlap prevention', () => {
    it('does not merge events that share the same bib', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4, 5], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2); // bib 3 overlaps
    });

    it('merges events without bib overlap', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
    });

    it('prevents three-way merge when third event overlaps with first', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const e3 = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 5], judges: [] }] }); // bib 1 overlaps with e1
      const result = mergeEntries([makeItem(e1), makeItem(e2), makeItem(e3)], 10);
      // e1 and e2 can merge, but e3 cannot join because bib 1 overlaps with e1
      expect(result).toHaveLength(2);
      // Verify e3 is not in the same heat as e1
      for (const heat of result) {
        const ids = heatEventIds(heat);
        expect(ids.includes(1) && ids.includes(3)).toBe(false);
      }
    });

    it('handles a person in multiple events - never in same heat', () => {
      // Person with bib 1 is in both e1 and e3
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const e3 = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 5], judges: [] }] });
      const e4 = makeEvent({ id: 4, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [6, 7], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2), makeItem(e3), makeItem(e4)], 10);
      // Verify: no heat has both event 1 and event 3
      for (const heat of result) {
        const ids = heatEventIds(heat);
        if (ids.includes(1)) {
          expect(ids).not.toContain(3);
        }
      }
    });
  });

  // ── Multi-round events ─────────────────────────────────────

  describe('multi-round events', () => {
    it('never merges events with multiple rounds', () => {
      const e1 = makeEvent({
        id: 1, style: 'Smooth', dances: ['Waltz'],
        heats: [
          { round: 'semi-final', bibs: [1, 2, 3, 4, 5, 6, 7], judges: [] },
          { round: 'final', bibs: [1, 2, 3, 4, 5], judges: [] },
        ],
      });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [8, 9], judges: [] }] });
      const items = [makeItem(e1, 'semi-final'), makeItem(e1, 'final'), makeItem(e2)];
      const result = mergeEntries(items, 20);
      // e1's rounds each get their own heat, e2 might merge with nothing compatible
      const e1Heats = result.filter(h => h.entries.some(e => e.eventId === 1));
      expect(e1Heats).toHaveLength(2); // semi-final and final each in own heat
    });

    it('single-round events can still merge alongside multi-round events', () => {
      const e1 = makeEvent({
        id: 1, style: 'Smooth', dances: ['Waltz'],
        heats: [
          { round: 'semi-final', bibs: [1, 2, 3, 4, 5, 6], judges: [] },
          { round: 'final', bibs: [1, 2, 3], judges: [] },
        ],
      });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [8, 9], judges: [] }] });
      const e3 = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [10, 11], judges: [] }] });
      const items = [makeItem(e1, 'semi-final'), makeItem(e1, 'final'), makeItem(e2), makeItem(e3)];
      const result = mergeEntries(items, 10);
      // e2 and e3 should be merged since they're both single-round
      const singleRoundHeats = result.filter(h => h.entries.every(e => e.eventId !== 1));
      expect(singleRoundHeats).toHaveLength(1);
      expect(singleRoundHeats[0].entries).toHaveLength(2);
    });
  });

  // ── Section events ─────────────────────────────────────────

  describe('section events', () => {
    it('does not merge section events with same sectionGroupId', () => {
      const e1 = makeEvent({
        id: 1, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
        sectionGroupId: 'sg-1', sectionLetter: 'A',
        heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      });
      const e2 = makeEvent({
        id: 2, style: 'Smooth', dances: ['Waltz'], scoringType: 'standard',
        sectionGroupId: 'sg-1', sectionLetter: 'B',
        heats: [{ round: 'final', bibs: [3, 4], judges: [] }],
      });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });

    it('merges section event with non-section event', () => {
      const e1 = makeEvent({
        id: 1, style: 'Smooth', dances: ['Waltz'],
        sectionGroupId: 'sg-1', sectionLetter: 'A',
        heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      });
      const e2 = makeEvent({
        id: 2, style: 'Smooth', dances: ['Waltz'],
        heats: [{ round: 'final', bibs: [5, 6], judges: [] }],
      });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
    });

    it('merges section events with different sectionGroupIds', () => {
      const e1 = makeEvent({
        id: 1, style: 'Smooth', dances: ['Waltz'],
        sectionGroupId: 'sg-1', sectionLetter: 'A',
        heats: [{ round: 'final', bibs: [1, 2], judges: [] }],
      });
      const e2 = makeEvent({
        id: 2, style: 'Smooth', dances: ['Waltz'],
        sectionGroupId: 'sg-2', sectionLetter: 'A',
        heats: [{ round: 'final', bibs: [3, 4], judges: [] }],
      });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
    });
  });

  // ── Level combining modes ──────────────────────────────────

  describe('level combining', () => {
    const bronzeWaltz = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
    const silverWaltz = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
    const goldWaltz = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], level: 'Gold', heats: [{ round: 'final', bibs: [5, 6], judges: [] }] });

    describe('same-level mode', () => {
      it('keeps different levels in separate heats', () => {
        const config: LevelCombiningConfig = { mode: 'same-level' };
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(silverWaltz)], 10, config);
        expect(result).toHaveLength(2);
      });

      it('merges same-level events', () => {
        const e2 = makeEvent({ id: 4, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [7, 8], judges: [] }] });
        const config: LevelCombiningConfig = { mode: 'same-level' };
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(e2)], 10, config);
        expect(result).toHaveLength(1);
      });
    });

    describe('any mode (default)', () => {
      it('freely combines different levels', () => {
        const config: LevelCombiningConfig = { mode: 'any' };
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(silverWaltz), makeItem(goldWaltz)], 10, config);
        expect(result).toHaveLength(1);
        expect(result[0].entries).toHaveLength(3);
      });

      it('combines levels when no config provided (default behavior)', () => {
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(silverWaltz)], 10);
        expect(result).toHaveLength(1);
      });
    });

    describe('prefer-same mode', () => {
      it('prefers same-level first', () => {
        const bronze2 = makeEvent({ id: 4, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [7, 8], judges: [] }] });
        const config: LevelCombiningConfig = { mode: 'prefer-same' };
        const items = [makeItem(bronzeWaltz), makeItem(bronze2), makeItem(silverWaltz)];
        const result = mergeEntries(items, 10, config);
        // Bronze events should be merged together first
        const bronzeHeat = result.find(h => h.entries.some(e => e.eventId === 1));
        expect(bronzeHeat!.entries.some(e => e.eventId === 4)).toBe(true);
      });

      it('consolidates under-filled cross-level heats in second pass', () => {
        // 3 different levels, each with 2 bibs, maxCouples=10
        // First pass creates 3 heats (one per level), second pass should merge them
        const config: LevelCombiningConfig = { mode: 'prefer-same' };
        const result = mergeEntries(
          [makeItem(bronzeWaltz), makeItem(silverWaltz), makeItem(goldWaltz)],
          10,
          config,
        );
        // Second pass should consolidate all into 1 heat since 2+2+2 = 6 ≤ 10
        expect(result).toHaveLength(1);
      });

      it('does not consolidate cross-level if bib overlap exists', () => {
        const bronze = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
        const silver = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [1, 3], judges: [] }] }); // bib 1 overlap
        const config: LevelCombiningConfig = { mode: 'prefer-same' };
        const result = mergeEntries([makeItem(bronze), makeItem(silver)], 10, config);
        expect(result).toHaveLength(2);
      });

      it('does not consolidate cross-level if exceeds maxCouples', () => {
        const bronze = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] });
        const silver = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [4, 5, 6], judges: [] }] });
        const config: LevelCombiningConfig = { mode: 'prefer-same' };
        const result = mergeEntries([makeItem(bronze), makeItem(silver)], 4, config);
        expect(result).toHaveLength(2); // 3+3=6 > 4
      });
    });

    describe('custom mode', () => {
      it('combines levels within same custom group', () => {
        const config: LevelCombiningConfig = {
          mode: 'custom',
          customGroups: [['Bronze', 'Silver'], ['Gold']],
        };
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(silverWaltz), makeItem(goldWaltz)], 10, config);
        // Bronze+Silver in one group, Gold alone
        expect(result).toHaveLength(2);
        const bronzeSilverHeat = result.find(h => h.entries.some(e => e.eventId === 1));
        expect(bronzeSilverHeat!.entries.some(e => e.eventId === 2)).toBe(true);
      });

      it('does not combine levels from different custom groups', () => {
        const config: LevelCombiningConfig = {
          mode: 'custom',
          customGroups: [['Bronze'], ['Silver'], ['Gold']],
        };
        const result = mergeEntries([makeItem(bronzeWaltz), makeItem(silverWaltz)], 10, config);
        expect(result).toHaveLength(2);
      });

      it('treats levels not in any custom group as their own group', () => {
        const openWaltz = makeEvent({ id: 4, style: 'Smooth', dances: ['Waltz'], level: 'Open', heats: [{ round: 'final', bibs: [7, 8], judges: [] }] });
        const config: LevelCombiningConfig = {
          mode: 'custom',
          customGroups: [['Bronze', 'Silver']],
          // 'Gold' and 'Open' not in any group
        };
        const result = mergeEntries([makeItem(goldWaltz), makeItem(openWaltz)], 10, config);
        // Gold and Open are each their own group
        expect(result).toHaveLength(2);
      });
    });
  });

  // ── Dance ordering preservation ────────────────────────────

  describe('dance ordering', () => {
    it('maintains input order when events are in correct dance order', () => {
      const waltz = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const tango = makeEvent({ id: 2, style: 'Smooth', dances: ['Tango'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const foxtrot = makeEvent({ id: 3, style: 'Smooth', dances: ['Foxtrot'], heats: [{ round: 'final', bibs: [5, 6], judges: [] }] });
      const items = [makeItem(waltz), makeItem(tango), makeItem(foxtrot)];
      const result = mergeEntries(items, 10);
      // Different dances = different heats, in the order provided
      expect(result).toHaveLength(3);
      expect(result[0].entries[0].eventId).toBe(1); // Waltz first
      expect(result[1].entries[0].eventId).toBe(2); // Tango second
      expect(result[2].entries[0].eventId).toBe(3); // Foxtrot third
    });

    it('groups same-dance events together regardless of input position', () => {
      const waltz1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const tango1 = makeEvent({ id: 2, style: 'Smooth', dances: ['Tango'], level: 'Bronze', heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const waltz2 = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [5, 6], judges: [] }] });
      // Input: waltz, tango, waltz — the two waltzes should merge into one heat
      const items = [makeItem(waltz1), makeItem(tango1), makeItem(waltz2)];
      const result = mergeEntries(items, 10);
      // Waltz events merge, tango stays separate
      const waltzHeat = result.find(h => h.entries.some(e => e.eventId === 1));
      expect(waltzHeat!.entries.some(e => e.eventId === 3)).toBe(true);
    });
  });

  // ── Multi-dance events ─────────────────────────────────────

  describe('multi-dance events', () => {
    it('merges multi-dance events with same dance set', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz', 'Tango'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz', 'Tango'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
    });

    it('does not merge multi-dance events with different dance sets', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz', 'Tango'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz', 'Foxtrot'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });

    it('merges multi-dance events regardless of dance order in the array', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Tango', 'Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz', 'Tango'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1); // Same dances, just different order
    });

    it('does not merge single-dance with multi-dance events', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz', 'Tango'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(2);
    });
  });

  // ── First-fit-decreasing packing ───────────────────────────

  describe('first-fit-decreasing packing', () => {
    it('packs larger events first to minimize total heats', () => {
      // 4 events: 4+3+2+1 = 10 bibs, maxCouples=5
      // Optimal: [4+1, 3+2] = 2 heats. Greedy FFD: sort desc [4,3,2,1], place 4→H1, 3→H2, 2→H2(3+2=5), 1→H1(4+1=5) = 2 heats
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2, 3, 4], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [5, 6, 7], judges: [] }] });
      const e3 = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [8, 9], judges: [] }] });
      const e4 = makeEvent({ id: 4, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [10], judges: [] }] });
      const result = mergeEntries([makeItem(e4), makeItem(e3), makeItem(e1), makeItem(e2)], 5);
      expect(result).toHaveLength(2);
    });

    it('handles many small events efficiently', () => {
      // 10 events with 1 couple each, maxCouples=4
      const events = Array.from({ length: 10 }, (_, i) =>
        makeEvent({ id: i + 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [i + 1], judges: [] }] })
      );
      const result = mergeEntries(events.map(e => makeItem(e)), 4);
      expect(result).toHaveLength(3); // ceil(10/4) = 3
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const result = mergeEntries([], 10);
      expect(result).toHaveLength(0);
    });

    it('handles single item', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const result = mergeEntries([makeItem(e1)], 10);
      expect(result).toHaveLength(1);
    });

    it('handles events with no bibs', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      // Events with 0 bibs should still merge
      expect(result).toHaveLength(1);
    });

    it('handles maxCouples of 1', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [2], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 1);
      expect(result).toHaveLength(2);
    });

    it('handles events with undefined style', () => {
      const e1 = makeEvent({ id: 1, dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10);
      expect(result).toHaveLength(1);
    });

    it('handles events with undefined level in same-level mode', () => {
      const e1 = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const e2 = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const config: LevelCombiningConfig = { mode: 'same-level' };
      const result = mergeEntries([makeItem(e1), makeItem(e2)], 10, config);
      // Both have undefined level → same group
      expect(result).toHaveLength(1);
    });
  });

  // ── Complex scenario: full style with multiple dances/levels ──

  describe('full style scenario', () => {
    it('correctly separates a full Smooth style with multiple levels and dances', () => {
      // Simulate Bronze Waltz, Bronze Tango, Silver Waltz, Silver Tango
      const bronzeWaltz = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const bronzeTango = makeEvent({ id: 2, style: 'Smooth', dances: ['Tango'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 3], judges: [] }] });
      const silverWaltz = makeEvent({ id: 3, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [4, 5], judges: [] }] });
      const silverTango = makeEvent({ id: 4, style: 'Smooth', dances: ['Tango'], level: 'Silver', heats: [{ round: 'final', bibs: [4, 6], judges: [] }] });

      const items = [
        makeItem(bronzeWaltz), makeItem(bronzeTango),
        makeItem(silverWaltz), makeItem(silverTango),
      ];
      const result = mergeEntries(items, 10);

      // Waltz events should merge together, Tango events together
      // But bib 1 is in both bronzeWaltz and bronzeTango → they can't merge
      // And bib 4 is in both silverWaltz and silverTango → they can't merge
      // But bronzeWaltz + silverWaltz can merge (no bib overlap: {1,2} ∩ {4,5} = {})
      // And bronzeTango + silverTango can merge (no bib overlap: {1,3} ∩ {4,6} = {})
      expect(result).toHaveLength(2); // Waltz heat + Tango heat

      // Verify waltz heat
      const waltzHeat = result.find(h => h.entries.some(e => e.eventId === 1));
      expect(waltzHeat).toBeDefined();
      expect(heatEventIds(waltzHeat!).sort()).toEqual([1, 3]);

      // Verify tango heat
      const tangoHeat = result.find(h => h.entries.some(e => e.eventId === 2));
      expect(tangoHeat).toBeDefined();
      expect(heatEventIds(tangoHeat!).sort()).toEqual([2, 4]);
    });

    it('keeps Waltz heats before Tango heats (input order preserved)', () => {
      const bronzeWaltz = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], level: 'Bronze', heats: [{ round: 'final', bibs: [1, 2], judges: [] }] });
      const silverWaltz = makeEvent({ id: 2, style: 'Smooth', dances: ['Waltz'], level: 'Silver', heats: [{ round: 'final', bibs: [3, 4], judges: [] }] });
      const bronzeTango = makeEvent({ id: 3, style: 'Smooth', dances: ['Tango'], level: 'Bronze', heats: [{ round: 'final', bibs: [5, 6], judges: [] }] });
      const silverTango = makeEvent({ id: 4, style: 'Smooth', dances: ['Tango'], level: 'Silver', heats: [{ round: 'final', bibs: [7, 8], judges: [] }] });

      // Input in dance order: Waltz first, then Tango
      const items = [
        makeItem(bronzeWaltz), makeItem(silverWaltz),
        makeItem(bronzeTango), makeItem(silverTango),
      ];
      const result = mergeEntries(items, 10);

      expect(result).toHaveLength(2);
      // First heat should be Waltz (events 1, 2), second should be Tango (events 3, 4)
      expect(heatEventIds(result[0]).sort()).toEqual([1, 2]);
      expect(heatEventIds(result[1]).sort()).toEqual([3, 4]);
    });

    it('handles same couple across many single-dance events', () => {
      // One couple (bib 1) enters Waltz, Tango, Foxtrot, VW — all single dance
      // Each event also has other unique couples
      const waltz = makeEvent({ id: 1, style: 'Smooth', dances: ['Waltz'], heats: [{ round: 'final', bibs: [1, 2, 3], judges: [] }] });
      const tango = makeEvent({ id: 2, style: 'Smooth', dances: ['Tango'], heats: [{ round: 'final', bibs: [1, 4, 5], judges: [] }] });
      const foxtrot = makeEvent({ id: 3, style: 'Smooth', dances: ['Foxtrot'], heats: [{ round: 'final', bibs: [1, 6, 7], judges: [] }] });
      const vw = makeEvent({ id: 4, style: 'Smooth', dances: ['Viennese Waltz'], heats: [{ round: 'final', bibs: [1, 8, 9], judges: [] }] });

      const items = [makeItem(waltz), makeItem(tango), makeItem(foxtrot), makeItem(vw)];
      const result = mergeEntries(items, 10);

      // All different dances → each in separate heat (can't merge different dances)
      expect(result).toHaveLength(4);
      // No heat should contain bib 1 more than once (already guaranteed by separate heats)
      for (const heat of result) {
        expect(heat.entries).toHaveLength(1);
      }
    });
  });

  // ── Stress / larger scenarios ──────────────────────────────

  describe('larger scenarios', () => {
    it('merges 20 events correctly without bib collisions', () => {
      const events: Event[] = [];
      for (let i = 0; i < 20; i++) {
        events.push(makeEvent({
          id: i + 1,
          style: 'Smooth',
          dances: ['Waltz'],
          level: i % 2 === 0 ? 'Bronze' : 'Silver',
          heats: [{ round: 'final', bibs: [i * 2 + 1, i * 2 + 2], judges: [] }],
        }));
      }
      const items = events.map(e => makeItem(e));
      const result = mergeEntries(items, 8);

      // Verify no bib appears twice in any heat
      for (const heat of result) {
        const allBibs: number[] = [];
        for (const entry of heat.entries) {
          const event = events.find(e => e.id === entry.eventId)!;
          allBibs.push(...event.heats[0].bibs);
        }
        const uniqueBibs = new Set(allBibs);
        expect(uniqueBibs.size).toBe(allBibs.length);
        expect(uniqueBibs.size).toBeLessThanOrEqual(8);
      }
    });

    it('packs events into minimum heats when no constraints conflict', () => {
      // 12 events with 2 bibs each, no overlap, maxCouples=6
      // Optimal: ceil(24/6) = 4 heats
      const events = Array.from({ length: 12 }, (_, i) =>
        makeEvent({
          id: i + 1,
          style: 'Smooth',
          dances: ['Waltz'],
          heats: [{ round: 'final', bibs: [i * 2 + 1, i * 2 + 2], judges: [] }],
        })
      );
      const result = mergeEntries(events.map(e => makeItem(e)), 6);
      expect(result).toHaveLength(4);
    });
  });
});
