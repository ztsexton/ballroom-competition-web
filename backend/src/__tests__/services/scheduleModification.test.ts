import { dataService } from '../../services/dataService';
import {
  reorderHeat,
  suggestPosition,
  insertEvent,
  addBreak,
  removeBreak,
  updateHeatEntries,
  splitRoundIntoFloorHeats,
  unsplitFloorHeats,
  splitHeatEntry,
  resplitPendingHeats,
} from '../../services/schedule/scheduleModification';

describe('Schedule Modification', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupWithSchedule() {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 10,
    });

    const bibs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      bibs.push(couple!.bib);
    }

    const event1 = await dataService.addEvent(
      'Waltz', bibs.slice(0, 3), [], comp.id,
      undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
    );
    const event2 = await dataService.addEvent(
      'Tango', bibs.slice(3, 6), [], comp.id,
      undefined, undefined, undefined, 'Smooth', ['Tango'], 'standard',
    );

    const schedule = await dataService.saveSchedule({
      competitionId: comp.id,
      heatOrder: [
        { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
        { id: 'heat-2', entries: [{ eventId: event2.id, round: 'final' }] },
      ],
      heatStatuses: { 'heat-1': 'pending', 'heat-2': 'pending' },
      currentHeatIndex: 0,
      styleOrder: ['Smooth', 'Rhythm'],
      levelOrder: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { comp, event1, event2, bibs, schedule };
  }

  describe('reorderHeat', () => {
    it('should swap two heats', async () => {
      const { comp } = await setupWithSchedule();

      const result = await reorderHeat(comp.id, 0, 1);
      expect(result).not.toBeNull();
      expect(result!.heatOrder[0].id).toBe('heat-2');
      expect(result!.heatOrder[1].id).toBe('heat-1');
    });

    it('should return null for no schedule', async () => {
      expect(await reorderHeat(999, 0, 1)).toBeNull();
    });

    it('should return null for out-of-bounds fromIndex', async () => {
      const { comp } = await setupWithSchedule();
      expect(await reorderHeat(comp.id, -1, 1)).toBeNull();
      expect(await reorderHeat(comp.id, 10, 1)).toBeNull();
    });

    it('should return null for out-of-bounds toIndex', async () => {
      const { comp } = await setupWithSchedule();
      expect(await reorderHeat(comp.id, 0, -1)).toBeNull();
      expect(await reorderHeat(comp.id, 0, 10)).toBeNull();
    });
  });

  describe('suggestPosition', () => {
    it('should return 0 when no schedule exists', async () => {
      expect(await suggestPosition(999, 1)).toBe(0);
    });

    it('should return end of schedule for unknown event', async () => {
      const { comp } = await setupWithSchedule();
      expect(await suggestPosition(comp.id, 999)).toBe(2);
    });

    it('should suggest position based on style/level order', async () => {
      const { comp, event1 } = await setupWithSchedule();
      const pos = await suggestPosition(comp.id, event1.id);
      expect(typeof pos).toBe('number');
    });
  });

  describe('insertEvent', () => {
    it('should insert event at specified position', async () => {
      const { comp, bibs } = await setupWithSchedule();

      const event3 = await dataService.addEvent(
        'Foxtrot', bibs.slice(0, 2), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Foxtrot'], 'standard',
      );

      const result = await insertEvent(comp.id, event3.id, 1);
      expect(result).not.toBeNull();
      expect(result!.heatOrder.length).toBeGreaterThanOrEqual(3);
    });

    it('should return null when no schedule exists', async () => {
      expect(await insertEvent(999, 1, 0)).toBeNull();
    });

    it('should return null when event does not exist', async () => {
      const { comp } = await setupWithSchedule();
      expect(await insertEvent(comp.id, 999, 0)).toBeNull();
    });

    it('should return schedule unchanged if event already scheduled', async () => {
      const { comp, event1 } = await setupWithSchedule();

      const result = await insertEvent(comp.id, event1.id, 0);
      expect(result).not.toBeNull();
      expect(result!.heatOrder).toHaveLength(2); // unchanged
    });

    it('should adjust currentHeatIndex when inserting before it', async () => {
      const { comp, bibs } = await setupWithSchedule();

      // Set currentHeatIndex to 1
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.currentHeatIndex = 1;
      await dataService.saveSchedule(schedule!);

      const event3 = await dataService.addEvent(
        'Foxtrot', bibs.slice(0, 2), [], comp.id,
        undefined, undefined, undefined, 'Latin', ['Samba'], 'standard',
      );

      const result = await insertEvent(comp.id, event3.id, 0);
      expect(result).not.toBeNull();
      expect(result!.currentHeatIndex).toBe(2); // incremented
    });
  });

  describe('addBreak', () => {
    it('should add break at end by default', async () => {
      const { comp } = await setupWithSchedule();

      const result = await addBreak(comp.id, 'Lunch', 30);
      expect(result).not.toBeNull();
      const lastHeat = result!.heatOrder[result!.heatOrder.length - 1];
      expect(lastHeat.isBreak).toBe(true);
      expect(lastHeat.breakLabel).toBe('Lunch');
      expect(lastHeat.breakDuration).toBe(30);
    });

    it('should add break at specified position', async () => {
      const { comp } = await setupWithSchedule();

      const result = await addBreak(comp.id, 'Break', undefined, 1);
      expect(result).not.toBeNull();
      expect(result!.heatOrder[1].isBreak).toBe(true);
    });

    it('should return null when no schedule exists', async () => {
      expect(await addBreak(999, 'Break')).toBeNull();
    });

    it('should adjust currentHeatIndex when adding before it', async () => {
      const { comp } = await setupWithSchedule();

      // Set currentHeatIndex to 1
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.currentHeatIndex = 1;
      await dataService.saveSchedule(schedule!);

      const result = await addBreak(comp.id, 'Break', undefined, 0);
      expect(result!.currentHeatIndex).toBe(2);
    });
  });

  describe('removeBreak', () => {
    it('should remove a break heat', async () => {
      const { comp } = await setupWithSchedule();

      await addBreak(comp.id, 'Lunch', undefined, 1);
      const result = await removeBreak(comp.id, 1);
      expect(result).not.toBeNull();
      expect(result!.heatOrder).toHaveLength(2);
      expect(result!.heatOrder.every(h => !h.isBreak)).toBe(true);
    });

    it('should return null when no schedule exists', async () => {
      expect(await removeBreak(999, 0)).toBeNull();
    });

    it('should return null for out-of-bounds index', async () => {
      const { comp } = await setupWithSchedule();
      expect(await removeBreak(comp.id, 10)).toBeNull();
    });

    it('should return null when heat is not a break', async () => {
      const { comp } = await setupWithSchedule();
      expect(await removeBreak(comp.id, 0)).toBeNull();
    });

    it('should adjust currentHeatIndex when removing before it', async () => {
      const { comp } = await setupWithSchedule();

      await addBreak(comp.id, 'Break', undefined, 0);
      // currentHeatIndex is now 1 (adjusted by addBreak)
      const result = await removeBreak(comp.id, 0);
      expect(result!.currentHeatIndex).toBe(0);
    });
  });

  describe('updateHeatEntries', () => {
    it('should update entries for a heat', async () => {
      const { comp, event1, event2 } = await setupWithSchedule();

      // Merge both events into heat-1
      const result = await updateHeatEntries(comp.id, 'heat-1', [
        { eventId: event1.id, round: 'final' },
        { eventId: event2.id, round: 'final' },
      ]);

      expect(result).not.toBeNull();
      const heat = result!.heatOrder.find(h => h.id === 'heat-1');
      expect(heat!.entries).toHaveLength(2);
    });

    it('should return null when no schedule exists', async () => {
      expect(await updateHeatEntries(999, 'heat-1', [{ eventId: 1, round: 'final' }])).toBeNull();
    });

    it('should return null when heat not found', async () => {
      const { comp, event1 } = await setupWithSchedule();
      expect(await updateHeatEntries(comp.id, 'nonexistent', [{ eventId: event1.id, round: 'final' }])).toBeNull();
    });

    it('should return null for break heat', async () => {
      const { comp, event1 } = await setupWithSchedule();

      await addBreak(comp.id, 'Break', undefined, 0);
      const schedule = await dataService.getSchedule(comp.id);
      const breakHeatId = schedule!.heatOrder[0].id;

      expect(await updateHeatEntries(comp.id, breakHeatId, [{ eventId: event1.id, round: 'final' }])).toBeNull();
    });

    it('should return null when event does not exist', async () => {
      const { comp } = await setupWithSchedule();
      expect(await updateHeatEntries(comp.id, 'heat-1', [{ eventId: 999, round: 'final' }])).toBeNull();
    });

    it('should return null for empty entries', async () => {
      const { comp } = await setupWithSchedule();
      expect(await updateHeatEntries(comp.id, 'heat-1', [])).toBeNull();
    });

    it('should return null when total couples exceeds max', async () => {
      // Create competition with small maxCouplesPerHeat
      const comp = await dataService.addCompetition({
        name: 'Small', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 2,
      });

      const bibs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const ev1 = await dataService.addEvent('A', bibs.slice(0, 3), [], comp.id);
      const ev2 = await dataService.addEvent('B', bibs.slice(3, 6), [], comp.id);

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: ev1.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: ev2.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Trying to merge 3+3=6 > 2 max
      expect(await updateHeatEntries(comp.id, 'h1', [
        { eventId: ev1.id, round: 'final' },
        { eventId: ev2.id, round: 'final' },
      ])).toBeNull();
    });

    it('should allow merging different scoring types', async () => {
      const comp = await dataService.addCompetition({
        name: 'Mixed', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 20,
      });

      const bibs: number[] = [];
      for (let i = 0; i < 4; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const evStd = await dataService.addEvent('Standard', bibs.slice(0, 2), [], comp.id, undefined, undefined, undefined, undefined, undefined, 'standard');
      const evProf = await dataService.addEvent('Proficiency', bibs.slice(2, 4), [], comp.id, undefined, undefined, undefined, undefined, undefined, 'proficiency');

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: evStd.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: evProf.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await updateHeatEntries(comp.id, 'h1', [
        { eventId: evStd.id, round: 'final' },
        { eventId: evProf.id, round: 'final' },
      ]);
      expect(result).not.toBeNull();
      const heat = result!.heatOrder.find(h => h.id === 'h1');
      expect(heat!.entries).toHaveLength(2);
    });

    it('should allow merge with forceOverride when over couple limit', async () => {
      const comp = await dataService.addCompetition({
        name: 'Override', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 2,
      });

      const bibs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const ev1 = await dataService.addEvent('A', bibs.slice(0, 3), [], comp.id);
      const ev2 = await dataService.addEvent('B', bibs.slice(3, 6), [], comp.id);

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: ev1.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: ev2.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Without forceOverride — should reject
      expect(await updateHeatEntries(comp.id, 'h1', [
        { eventId: ev1.id, round: 'final' },
        { eventId: ev2.id, round: 'final' },
      ])).toBeNull();

      // With forceOverride — should succeed
      const result = await updateHeatEntries(comp.id, 'h1', [
        { eventId: ev1.id, round: 'final' },
        { eventId: ev2.id, round: 'final' },
      ], true);
      expect(result).not.toBeNull();
      const heat = result!.heatOrder.find(h => h.id === 'h1');
      expect(heat!.entries).toHaveLength(2);
    });

    it('should return null for incompatible styles', async () => {
      const comp = await dataService.addCompetition({
        name: 'StyleMix', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 20,
      });

      const bibs: number[] = [];
      for (let i = 0; i < 4; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const evSmooth = await dataService.addEvent('Smooth', bibs.slice(0, 2), [], comp.id, undefined, undefined, undefined, 'Smooth');
      const evRhythm = await dataService.addEvent('Rhythm', bibs.slice(2, 4), [], comp.id, undefined, undefined, undefined, 'Rhythm');

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: evSmooth.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: evRhythm.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(await updateHeatEntries(comp.id, 'h1', [
        { eventId: evSmooth.id, round: 'final' },
        { eventId: evRhythm.id, round: 'final' },
      ])).toBeNull();
    });
  });

  describe('splitRoundIntoFloorHeats', () => {
    it('should split a heat into floor heats', async () => {
      const { comp, event1 } = await setupWithSchedule();

      const result = await splitRoundIntoFloorHeats(comp.id, 'heat-1', 2);
      expect(result).not.toBeNull();
      // Should replace heat-1 with 2 floor heats
      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event1.id && e.bibSubset));
      expect(floorHeats).toHaveLength(2);
    });

    it('should return null when no schedule exists', async () => {
      expect(await splitRoundIntoFloorHeats(999, 'heat-1', 2)).toBeNull();
    });

    it('should return null for non-existent heat', async () => {
      const { comp } = await setupWithSchedule();
      expect(await splitRoundIntoFloorHeats(comp.id, 'nonexistent', 2)).toBeNull();
    });

    it('should return null for break heat', async () => {
      const { comp } = await setupWithSchedule();
      await addBreak(comp.id, 'Break', undefined, 0);
      const schedule = await dataService.getSchedule(comp.id);
      const breakId = schedule!.heatOrder[0].id;
      expect(await splitRoundIntoFloorHeats(comp.id, breakId, 2)).toBeNull();
    });

    it('should return null for already-split heat', async () => {
      const { comp } = await setupWithSchedule();

      await splitRoundIntoFloorHeats(comp.id, 'heat-1', 2);
      const schedule = await dataService.getSchedule(comp.id);
      const splitHeat = schedule!.heatOrder.find(h => h.entries.some(e => e.bibSubset));
      expect(await splitRoundIntoFloorHeats(comp.id, splitHeat!.id, 2)).toBeNull();
    });

    it('should return null when groupCount exceeds number of bibs', async () => {
      const { comp } = await setupWithSchedule();
      // event1 has 3 bibs, trying to split into 5
      expect(await splitRoundIntoFloorHeats(comp.id, 'heat-1', 5)).toBeNull();
    });
  });

  describe('unsplitFloorHeats', () => {
    it('should merge floor heats back into one', async () => {
      const { comp, event1 } = await setupWithSchedule();

      await splitRoundIntoFloorHeats(comp.id, 'heat-1', 2);
      const schedule = await dataService.getSchedule(comp.id);
      const splitHeat = schedule!.heatOrder.find(h => h.entries.some(e => e.bibSubset));

      const result = await unsplitFloorHeats(comp.id, splitHeat!.id);
      expect(result).not.toBeNull();
      // Should have merged back to single heat for this event
      const eventHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event1.id));
      expect(eventHeats).toHaveLength(1);
      expect(eventHeats[0].entries[0].bibSubset).toBeUndefined();
    });

    it('should return null when no schedule exists', async () => {
      expect(await unsplitFloorHeats(999, 'heat-1')).toBeNull();
    });

    it('should return null for non-split heat', async () => {
      const { comp } = await setupWithSchedule();
      expect(await unsplitFloorHeats(comp.id, 'heat-1')).toBeNull();
    });
  });

  describe('splitHeatEntry', () => {
    it('should return null when no schedule exists', async () => {
      expect(await splitHeatEntry(999, 'heat-1', 1, 'final')).toBeNull();
    });

    it('should return null for non-existent heat', async () => {
      const { comp } = await setupWithSchedule();
      expect(await splitHeatEntry(comp.id, 'nonexistent', 1, 'final')).toBeNull();
    });

    it('should return null for single-entry heat', async () => {
      const { comp, event1 } = await setupWithSchedule();
      expect(await splitHeatEntry(comp.id, 'heat-1', event1.id, 'final')).toBeNull();
    });

    it('should split entry from multi-entry heat', async () => {
      const { comp, event1, event2 } = await setupWithSchedule();

      // First, merge events into one heat
      await updateHeatEntries(comp.id, 'heat-1', [
        { eventId: event1.id, round: 'final' },
        { eventId: event2.id, round: 'final' },
      ]);

      // Then split event2 out
      const result = await splitHeatEntry(comp.id, 'heat-1', event2.id, 'final');
      expect(result).not.toBeNull();

      const origHeat = result!.heatOrder.find(h => h.id === 'heat-1');
      expect(origHeat!.entries).toHaveLength(1);
      expect(origHeat!.entries[0].eventId).toBe(event1.id);
    });

    it('should return null for entry not in heat', async () => {
      const { comp, event1, event2 } = await setupWithSchedule();

      // Merge events
      await updateHeatEntries(comp.id, 'heat-1', [
        { eventId: event1.id, round: 'final' },
        { eventId: event2.id, round: 'final' },
      ]);

      expect(await splitHeatEntry(comp.id, 'heat-1', 999, 'final')).toBeNull();
    });
  });

  describe('multi-dance split and merge at various scoring stages', () => {
    const DANCES = ['Waltz', 'Tango', 'Foxtrot', 'Quickstep'];

    async function setupMultiDanceWithSchedule(opts?: { coupleCount?: number; dances?: string[] }) {
      const dances = opts?.dances ?? DANCES;
      const coupleCount = opts?.coupleCount ?? 6;

      const comp = await dataService.addCompetition({
        name: 'Multi Dance Test', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 20,
      });

      const bibs: number[] = [];
      for (let i = 0; i < coupleCount; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const event = await dataService.addEvent(
        'Multi Dance Event', bibs, [], comp.id,
        undefined, undefined, undefined, 'Smooth', dances, 'standard',
      );

      // Use the actual first round name (≤6 couples → 'final', 7-14 → 'semi-final')
      const firstRound = event.heats[0].round;

      const schedule = await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'md-heat', entries: [{ eventId: event.id, round: firstRound }] },
        ],
        heatStatuses: { 'md-heat': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { comp, event, bibs, schedule, round: firstRound };
    }

    async function setupSingleDanceWithSchedule(coupleCount = 6) {
      const comp = await dataService.addCompetition({
        name: 'Single Dance Test', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 20,
      });

      const bibs: number[] = [];
      for (let i = 0; i < coupleCount; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const event = await dataService.addEvent(
        'Single Dance Event', bibs, [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      const firstRound = event.heats[0].round;

      const schedule = await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'sd-heat', entries: [{ eventId: event.id, round: firstRound }] },
        ],
        heatStatuses: { 'sd-heat': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { comp, event, bibs, schedule, round: firstRound };
    }

    /** Helper: split via splitRoundIntoFloorHeats, then mark heats for specific dances as completed */
    async function splitAndScoreDances(
      compId: number,
      eventId: number,
      round: string,
      groupCount: number,
      completedDances: string[],
    ) {
      // Split the unsplit heat
      const schedule = await dataService.getSchedule(compId);
      const unsplitHeat = schedule!.heatOrder.find(h =>
        h.entries.some(e => e.eventId === eventId && e.round === round));
      const splitResult = await splitRoundIntoFloorHeats(compId, unsplitHeat!.id, groupCount);
      expect(splitResult).not.toBeNull();

      // Mark completed dances
      const updated = await dataService.getSchedule(compId);
      for (const h of updated!.heatOrder) {
        for (const e of h.entries) {
          if (e.eventId === eventId && e.round === round && e.dance && completedDances.includes(e.dance)) {
            updated!.heatStatuses[h.id] = 'completed';
          }
        }
      }
      await dataService.saveSchedule(updated!);
      return updated!;
    }

    // --- Split scenarios ---

    it('should split single-dance into 2 groups before scoring', async () => {
      const { comp, event, bibs } = await setupSingleDanceWithSchedule(6);

      const result = await splitRoundIntoFloorHeats(comp.id, 'sd-heat', 2);
      expect(result).not.toBeNull();

      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id && e.bibSubset));
      expect(floorHeats).toHaveLength(2);

      // All bibs accounted for
      const allBibs = floorHeats.flatMap(h => h.entries[0].bibSubset || []);
      expect(allBibs.sort()).toEqual([...bibs].sort());
    });

    it('should split 4-dance event into 2 groups before scoring', async () => {
      const { comp, event } = await setupMultiDanceWithSchedule();

      const result = await splitRoundIntoFloorHeats(comp.id, 'md-heat', 2);
      expect(result).not.toBeNull();

      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id && e.bibSubset));
      // 4 dances × 2 groups = 8 heats
      expect(floorHeats).toHaveLength(8);

      // Each dance should have exactly 2 floor heats
      for (const dance of DANCES) {
        const danceHeats = floorHeats.filter(h => h.entries[0].dance === dance);
        expect(danceHeats).toHaveLength(2);
      }
    });

    it('should resplit after 1st dance scored', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 2);
      expect(result).not.toBeNull();

      // 2 completed (Waltz) + 6 new pending (3 dances × 2)
      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');
      expect(completedHeats).toHaveLength(2);
      expect(pendingHeats).toHaveLength(6);
    });

    it('should resplit after 2nd dance scored', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz', 'Tango']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 2);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');
      // 4 completed (2 dances × 2) + 4 pending (2 dances × 2)
      expect(completedHeats).toHaveLength(4);
      expect(pendingHeats).toHaveLength(4);
    });

    it('should resplit after 3rd dance scored', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz', 'Tango', 'Foxtrot']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 2);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');
      // 6 completed (3 dances × 2) + 2 pending (1 dance × 2)
      expect(completedHeats).toHaveLength(6);
      expect(pendingHeats).toHaveLength(2);
    });

    // --- Merge scenarios ---

    it('should merge single-dance heats before scoring via unsplit', async () => {
      const { comp, event } = await setupSingleDanceWithSchedule(6);

      await splitRoundIntoFloorHeats(comp.id, 'sd-heat', 2);
      const schedule = await dataService.getSchedule(comp.id);
      const splitHeat = schedule!.heatOrder.find(h => h.entries.some(e => e.bibSubset));

      const result = await unsplitFloorHeats(comp.id, splitHeat!.id);
      expect(result).not.toBeNull();

      const eventHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id));
      expect(eventHeats).toHaveLength(1);
      expect(eventHeats[0].entries[0].bibSubset).toBeUndefined();
    });

    it('should merge 4-dance heats before scoring via unsplit', async () => {
      const { comp, event } = await setupMultiDanceWithSchedule();

      await splitRoundIntoFloorHeats(comp.id, 'md-heat', 2);
      const schedule = await dataService.getSchedule(comp.id);
      const splitHeat = schedule!.heatOrder.find(h => h.entries.some(e => e.bibSubset));

      const result = await unsplitFloorHeats(comp.id, splitHeat!.id);
      expect(result).not.toBeNull();

      const eventHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id));
      // unsplit collapses all back to 1 heat
      expect(eventHeats).toHaveLength(1);
      expect(eventHeats[0].entries[0].bibSubset).toBeUndefined();
    });

    it('should merge pending heats after 1st dance scored via resplit(groupCount=1)', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 1);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');

      // 2 completed (Waltz group 1 + group 2) + 3 unsplit pending (Tango, Foxtrot, Quickstep)
      expect(completedHeats).toHaveLength(2);
      expect(pendingHeats).toHaveLength(3);

      // Pending heats should be unsplit (no bibSubset)
      for (const h of pendingHeats) {
        expect(h.entries[0].bibSubset).toBeUndefined();
        expect(h.entries[0].floorHeatIndex).toBeUndefined();
        expect(h.entries[0].totalFloorHeats).toBeUndefined();
      }

      // Pending dances should be Tango, Foxtrot, Quickstep
      const pendingDances = pendingHeats.map(h => h.entries[0].dance).sort();
      expect(pendingDances).toEqual(['Foxtrot', 'Quickstep', 'Tango']);
    });

    it('should merge pending heats after 2nd dance scored via resplit(groupCount=1)', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz', 'Tango']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 1);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');

      // 4 completed + 2 unsplit pending (Foxtrot, Quickstep)
      expect(completedHeats).toHaveLength(4);
      expect(pendingHeats).toHaveLength(2);

      for (const h of pendingHeats) {
        expect(h.entries[0].bibSubset).toBeUndefined();
      }

      const pendingDances = pendingHeats.map(h => h.entries[0].dance).sort();
      expect(pendingDances).toEqual(['Foxtrot', 'Quickstep']);
    });

    it('should merge pending heats after 3rd dance scored via resplit(groupCount=1)', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();
      await splitAndScoreDances(comp.id, event.id, round, 2, ['Waltz', 'Tango', 'Foxtrot']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 1);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');

      // 6 completed + 1 unsplit pending (Quickstep)
      expect(completedHeats).toHaveLength(6);
      expect(pendingHeats).toHaveLength(1);

      expect(pendingHeats[0].entries[0].bibSubset).toBeUndefined();
      expect(pendingHeats[0].entries[0].dance).toBe('Quickstep');
    });

    // --- Resplit between group counts ---

    it('should resplit from 2 groups to 3 (all pending)', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();

      // Split into 2 groups first
      await splitRoundIntoFloorHeats(comp.id, 'md-heat', 2);

      // Resplit into 3 groups
      const result = await resplitPendingHeats(comp.id, event.id, round, 3);
      expect(result).not.toBeNull();

      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id && e.bibSubset));
      // 4 dances × 3 groups = 12 heats
      expect(floorHeats).toHaveLength(12);

      for (const dance of DANCES) {
        const danceHeats = floorHeats.filter(h => h.entries[0].dance === dance);
        expect(danceHeats).toHaveLength(3);
      }
    });

    it('should resplit from 3 groups to 2 after 1st dance scored', async () => {
      const { comp, event, round } = await setupMultiDanceWithSchedule();

      // Split into 3 groups and score first dance
      await splitAndScoreDances(comp.id, event.id, round, 3, ['Waltz']);

      const result = await resplitPendingHeats(comp.id, event.id, round, 2);
      expect(result).not.toBeNull();

      const completedHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'completed');
      const pendingHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id) && result!.heatStatuses[h.id] === 'pending');

      // 3 completed (Waltz × 3 groups) + 6 pending (3 dances × 2 groups)
      expect(completedHeats).toHaveLength(3);
      expect(pendingHeats).toHaveLength(6);

      // Verify pending heats are for the right dances
      const pendingDances = [...new Set(pendingHeats.map(h => h.entries[0].dance))].sort();
      expect(pendingDances).toEqual(['Foxtrot', 'Quickstep', 'Tango']);
    });
  });

  describe('resplitPendingHeats', () => {
    it('should split pending single-heat into floor heats', async () => {
      const { comp, event1, bibs } = await setupWithSchedule();

      const result = await resplitPendingHeats(comp.id, event1.id, 'final', 2);
      expect(result).not.toBeNull();

      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event1.id && e.bibSubset));
      expect(floorHeats).toHaveLength(2);

      // Total bibs across floor heats should equal original
      const allBibs = floorHeats.flatMap(h => h.entries[0].bibSubset || []);
      expect(allBibs.sort()).toEqual(bibs.slice(0, 3).sort());
    });

    it('should only affect pending heats, leave completed alone', async () => {
      const { comp, event1 } = await setupWithSchedule();

      // Mark heat-1 as completed
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.heatStatuses['heat-1'] = 'completed';
      await dataService.saveSchedule(schedule!);

      const result = await resplitPendingHeats(comp.id, event1.id, 'final', 2);
      // No pending heats to resplit
      expect(result).toBeNull();
    });

    it('should return null for no pending heats', async () => {
      const { comp, event1 } = await setupWithSchedule();

      // Mark heat-1 as scoring
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.heatStatuses['heat-1'] = 'scoring';
      await dataService.saveSchedule(schedule!);

      expect(await resplitPendingHeats(comp.id, event1.id, 'final', 2)).toBeNull();
    });

    it('should return null for invalid groupCount', async () => {
      const { comp, event1 } = await setupWithSchedule();
      expect(await resplitPendingHeats(comp.id, event1.id, 'final', 0)).toBeNull();
    });

    it('should return null for non-existent event', async () => {
      const { comp } = await setupWithSchedule();
      expect(await resplitPendingHeats(comp.id, 999, 'final', 2)).toBeNull();
    });

    it('should handle multi-dance events', async () => {
      const comp = await dataService.addCompetition({
        name: 'Multi', type: 'UNAFFILIATED', date: '2026-06-01', maxCouplesPerHeat: 10,
      });

      const bibs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id });
        const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(couple!.bib);
      }

      const event = await dataService.addEvent(
        'Multi Dance', bibs, [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz', 'Tango'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'md-1', entries: [{ eventId: event.id, round: 'final' }] },
        ],
        heatStatuses: { 'md-1': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await resplitPendingHeats(comp.id, event.id, 'final', 2);
      expect(result).not.toBeNull();

      // 2 dances × 2 groups = 4 floor heats
      const floorHeats = result!.heatOrder.filter(h =>
        h.entries.some(e => e.eventId === event.id && e.bibSubset));
      expect(floorHeats).toHaveLength(4);
    });
  });
});
