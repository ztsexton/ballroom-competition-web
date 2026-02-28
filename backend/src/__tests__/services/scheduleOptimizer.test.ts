import { dataService } from '../../services/dataService';
import { analyzeSchedule, applySuggestions } from '../../services/schedule/scheduleOptimizer';

describe('Schedule Optimizer', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetition(opts?: {
    maxCouplesPerHeat?: number;
    dayConfigs?: Array<{ day: number; startTime: string; endTime: string }>;
    timingSettings?: Record<string, unknown>;
  }) {
    const comp = await dataService.addCompetition({
      name: 'Test',
      type: 'UNAFFILIATED',
      date: '2026-06-01',
      maxCouplesPerHeat: opts?.maxCouplesPerHeat ?? 10,
      scheduleDayConfigs: opts?.dayConfigs,
      timingSettings: opts?.timingSettings as any,
    });

    const bibs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const leader = await dataService.addPerson({
        firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      bibs.push(couple!.bib);
    }

    return { comp, bibs };
  }

  describe('analyzeSchedule', () => {
    it('should return fitsInWindow true when no day configs', async () => {
      const { comp, bibs } = await setupCompetition();

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      expect(analysis.fitsInWindow).toBe(true);
      expect(analysis.availableMinutes).toBeNull();
      expect(analysis.suggestions).toHaveLength(0);
    });

    it('should return fitsInWindow true when schedule fits in window', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '17:00' }], // 540 min
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      expect(analysis.fitsInWindow).toBe(true);
      expect(analysis.availableMinutes).toBe(540);
      expect(analysis.overflowMinutes).toBe(0);
    });

    it('should return fitsInWindow false when schedule overflows', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '08:01' }], // 1 minute
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Tango', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Tango'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
          { id: 'heat-2', entries: [{ eventId: event2.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending', 'heat-2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      expect(analysis.fitsInWindow).toBe(false);
      expect(analysis.overflowMinutes).toBeGreaterThan(0);
    });

    it('should suggest merging compatible adjacent heats when overflowing', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '08:01' }], // 1 minute
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Tango', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Tango'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
          { id: 'heat-2', entries: [{ eventId: event2.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending', 'heat-2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      const mergeSuggestions = analysis.suggestions.filter(s => s.type === 'merge');
      expect(mergeSuggestions.length).toBeGreaterThan(0);
      expect(mergeSuggestions[0].details.sourceIndex).toBe(0);
      expect(mergeSuggestions[0].details.targetIndex).toBe(1);
    });

    it('should return empty suggestions when already optimal', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '17:00' }],
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      expect(analysis.suggestions).toHaveLength(0);
    });

    it('should handle non-existent competition gracefully', async () => {
      const analysis = await analyzeSchedule(999);
      expect(analysis.fitsInWindow).toBe(true);
      expect(analysis.estimatedDurationMinutes).toBe(0);
    });

    it('should handle no schedule gracefully', async () => {
      const { comp } = await setupCompetition();
      const analysis = await analyzeSchedule(comp.id);
      expect(analysis.fitsInWindow).toBe(true);
      expect(analysis.estimatedDurationMinutes).toBe(0);
    });

    it('should suggest merges even for different scoring types', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '08:01' }], // 1 minute — overflow
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const evStd = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      const evProf = await dataService.addEvent(
        'Proficiency', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'proficiency',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: evStd.id, round: 'final' }] },
          { id: 'heat-2', entries: [{ eventId: evProf.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending', 'heat-2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const analysis = await analyzeSchedule(comp.id);
      const mergeSuggestions = analysis.suggestions.filter(s => s.type === 'merge');
      expect(mergeSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('applySuggestions', () => {
    it('should return schedule unchanged for empty suggestions', async () => {
      const { comp, bibs } = await setupCompetition();

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await applySuggestions(comp.id, []);
      expect(result).not.toBeNull();
      expect(result!.heatOrder).toHaveLength(1);
    });

    it('should apply merge suggestions correctly', async () => {
      const { comp, bibs } = await setupCompetition({
        dayConfigs: [{ day: 1, startTime: '08:00', endTime: '08:01' }],
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });

      const event1 = await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Tango', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Tango'], 'standard',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'heat-1', entries: [{ eventId: event1.id, round: 'final' }] },
          { id: 'heat-2', entries: [{ eventId: event2.id, round: 'final' }] },
        ],
        heatStatuses: { 'heat-1': 'pending', 'heat-2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: ['Smooth'],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Apply the first suggestion (merge heat-1 and heat-2)
      const result = await applySuggestions(comp.id, [0]);
      expect(result).not.toBeNull();
      // After merge, one heat should have 2 entries
      const mergedHeat = result!.heatOrder.find(h => h.entries.length === 2);
      expect(mergedHeat).toBeDefined();
    });
  });
});
