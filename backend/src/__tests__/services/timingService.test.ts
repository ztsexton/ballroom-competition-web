import { TimingService, DEFAULT_TIMING } from '../../services/timingService';
import { ScheduledHeat, Event, TimingSettings } from '../../types';

describe('TimingService', () => {
  const service = new TimingService();

  function makeHeat(overrides: Partial<ScheduledHeat> = {}): ScheduledHeat {
    return {
      id: 'heat-1',
      entries: [{ eventId: 1, round: 'final' }],
      ...overrides,
    } as ScheduledHeat;
  }

  function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
      id: 1,
      name: 'Test',
      competitionId: 1,
      heats: [{ round: 'final', bibs: [1], judges: [] }],
      ...overrides,
    } as Event;
  }

  describe('calculateHeatDuration', () => {
    it('should calculate duration for a regular single-dance heat', () => {
      const heat = makeHeat();
      const events: Record<number, Event> = { 1: makeEvent() };

      const duration = service.calculateHeatDuration(heat, events, DEFAULT_TIMING);

      // 1 dance * 75 seconds = 75
      expect(duration).toBe(75);
    });

    it('should calculate duration for a heat with 3 dances', () => {
      const heat = makeHeat();
      const events: Record<number, Event> = {
        1: makeEvent({ dances: ['waltz', 'tango', 'foxtrot'] }),
      };

      const duration = service.calculateHeatDuration(heat, events, DEFAULT_TIMING);

      // 3 dances * 75 + 2 gaps * 35 = 225 + 70 = 295
      expect(duration).toBe(295);
    });

    it('should return break duration in seconds for break heats', () => {
      const heat = makeHeat({ isBreak: true, breakDuration: 5, entries: [] });
      const events: Record<number, Event> = {};

      const duration = service.calculateHeatDuration(heat, events, DEFAULT_TIMING);

      // 5 minutes * 60 = 300 seconds
      expect(duration).toBe(300);
    });

    it('should use scholarship duration for scholarship events', () => {
      const heat = makeHeat();
      const events: Record<number, Event> = {
        1: makeEvent({ isScholarship: true }),
      };

      const duration = service.calculateHeatDuration(heat, events, DEFAULT_TIMING);

      // 1 dance * 90 seconds = 90
      expect(duration).toBe(90);
    });

    it('should use level duration override when set', () => {
      const heat = makeHeat();
      const events: Record<number, Event> = {
        1: makeEvent({ level: 'Bronze' }),
      };
      const settings: TimingSettings = {
        ...DEFAULT_TIMING,
        levelDurationOverrides: { 'Bronze': 60 },
      };

      const duration = service.calculateHeatDuration(heat, events, settings);

      expect(duration).toBe(60);
    });
  });

  describe('calculateEstimatedTimes', () => {
    it('should populate start times on heat order', () => {
      const heatOrder: ScheduledHeat[] = [
        makeHeat({ id: 'h1' }),
        makeHeat({ id: 'h2' }),
      ];
      const events: Record<number, Event> = { 1: makeEvent() };
      const settings: TimingSettings = {
        ...DEFAULT_TIMING,
        startTime: '2025-06-01T09:00:00.000Z',
      };

      const totalDuration = service.calculateEstimatedTimes(heatOrder, events, settings);

      expect(heatOrder[0].estimatedStartTime).toBeDefined();
      expect(heatOrder[1].estimatedStartTime).toBeDefined();
      expect(heatOrder[0].estimatedDurationSeconds).toBe(75);
      expect(totalDuration).toBeGreaterThan(0);

      // Second heat starts after first heat + between-heat gap
      const start0 = new Date(heatOrder[0].estimatedStartTime!).getTime();
      const start1 = new Date(heatOrder[1].estimatedStartTime!).getTime();
      expect(start1 - start0).toBe((75 + DEFAULT_TIMING.betweenHeatSeconds) * 1000);
    });

    it('should return 0 when no startTime is set', () => {
      const heatOrder: ScheduledHeat[] = [makeHeat()];
      const events: Record<number, Event> = { 1: makeEvent() };

      const totalDuration = service.calculateEstimatedTimes(heatOrder, events, DEFAULT_TIMING);

      expect(totalDuration).toBe(0);
    });
  });

  describe('recalculateFromIndex', () => {
    it('should update future heats from anchor time', () => {
      const heatOrder: ScheduledHeat[] = [
        makeHeat({ id: 'h1' }),
        makeHeat({ id: 'h2' }),
        makeHeat({ id: 'h3' }),
      ];
      const events: Record<number, Event> = { 1: makeEvent() };
      const anchorTime = '2025-06-01T10:00:00.000Z';

      service.recalculateFromIndex(heatOrder, 1, events, DEFAULT_TIMING, anchorTime);

      expect(heatOrder[1].estimatedStartTime).toBeDefined();
      expect(heatOrder[2].estimatedStartTime).toBeDefined();
      expect(new Date(heatOrder[1].estimatedStartTime!).toISOString()).toBe(anchorTime);
    });

    it('should use actualStartTime when present at fromIndex', () => {
      const actualStart = '2025-06-01T10:05:00.000Z';
      const heatOrder: ScheduledHeat[] = [
        makeHeat({ id: 'h1', actualStartTime: actualStart }),
        makeHeat({ id: 'h2' }),
      ];
      const events: Record<number, Event> = { 1: makeEvent() };

      service.recalculateFromIndex(heatOrder, 0, events, DEFAULT_TIMING);

      // h2 should start after h1 actual start + duration + gap
      expect(heatOrder[1].estimatedStartTime).toBeDefined();
      const start1 = new Date(heatOrder[1].estimatedStartTime!).getTime();
      const expected = new Date(actualStart).getTime() + (75 + DEFAULT_TIMING.betweenHeatSeconds) * 1000;
      expect(start1).toBe(expected);
    });
  });
});
