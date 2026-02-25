import { dataService } from '../../services/dataService';
import { jumpToHeat, resetToHeat, rerunHeat } from '../../services/schedule/heatStatus';

describe('Heat Status Functions', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupScheduleWithHeats() {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01',
    });

    const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
    const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
    const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
    const event = await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);

    const schedule = await dataService.saveSchedule({
      competitionId: comp.id,
      heatOrder: [
        { id: 'heat-1', entries: [{ eventId: event.id, round: 'final' }] },
        { id: 'heat-2', entries: [{ eventId: event.id, round: 'final' }] },
        { id: 'heat-3', entries: [{ eventId: event.id, round: 'final' }] },
      ],
      heatStatuses: {
        'heat-1': 'completed',
        'heat-2': 'scoring',
        'heat-3': 'pending',
      },
      currentHeatIndex: 1,
      styleOrder: [],
      levelOrder: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { comp, event, schedule };
  }

  describe('jumpToHeat', () => {
    it('should jump to a valid heat index', async () => {
      const { comp } = await setupScheduleWithHeats();

      const result = await jumpToHeat(comp.id, 2);
      expect(result).not.toBeNull();
      expect(result!.currentHeatIndex).toBe(2);
    });

    it('should return null for non-existent schedule', async () => {
      const result = await jumpToHeat(999, 0);
      expect(result).toBeNull();
    });

    it('should return null for negative index', async () => {
      const { comp } = await setupScheduleWithHeats();
      const result = await jumpToHeat(comp.id, -1);
      expect(result).toBeNull();
    });

    it('should return null for out-of-bounds index', async () => {
      const { comp } = await setupScheduleWithHeats();
      const result = await jumpToHeat(comp.id, 10);
      expect(result).toBeNull();
    });
  });

  describe('resetToHeat', () => {
    it('should reset from target heat through current', async () => {
      const { comp } = await setupScheduleWithHeats();

      const result = await resetToHeat(comp.id, 0);
      expect(result).not.toBeNull();
      expect(result!.currentHeatIndex).toBe(0);
      expect(result!.heatStatuses['heat-1']).toBe('pending');
      expect(result!.heatStatuses['heat-2']).toBe('pending');
    });

    it('should clear currentDance', async () => {
      const { comp } = await setupScheduleWithHeats();
      // Set a currentDance first
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.currentDance = 'Waltz';
      await dataService.saveSchedule(schedule!);

      const result = await resetToHeat(comp.id, 0);
      expect(result!.currentDance).toBeUndefined();
    });

    it('should return null for non-existent schedule', async () => {
      const result = await resetToHeat(999, 0);
      expect(result).toBeNull();
    });

    it('should return null for invalid index', async () => {
      const { comp } = await setupScheduleWithHeats();
      const result = await resetToHeat(comp.id, -1);
      expect(result).toBeNull();
    });

    it('should handle resetting a break heat without clearing scores', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01',
      });

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'break-1', entries: [], isBreak: true, breakLabel: 'Lunch' },
        ],
        heatStatuses: { 'break-1': 'completed' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await resetToHeat(comp.id, 0);
      expect(result).not.toBeNull();
      expect(result!.heatStatuses['break-1']).toBe('pending');
    });
  });

  describe('rerunHeat', () => {
    it('should reset a single heat to pending', async () => {
      const { comp } = await setupScheduleWithHeats();

      const result = await rerunHeat(comp.id, 0);
      expect(result).not.toBeNull();
      expect(result!.currentHeatIndex).toBe(0);
      expect(result!.heatStatuses['heat-1']).toBe('pending');
      // Other heats remain unchanged
      expect(result!.heatStatuses['heat-2']).toBe('scoring');
    });

    it('should clear currentDance', async () => {
      const { comp } = await setupScheduleWithHeats();
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.currentDance = 'Tango';
      await dataService.saveSchedule(schedule!);

      const result = await rerunHeat(comp.id, 0);
      expect(result!.currentDance).toBeUndefined();
    });

    it('should return null for non-existent schedule', async () => {
      const result = await rerunHeat(999, 0);
      expect(result).toBeNull();
    });

    it('should return null for invalid index', async () => {
      const { comp } = await setupScheduleWithHeats();
      const result = await rerunHeat(comp.id, 10);
      expect(result).toBeNull();
    });

    it('should not change a heat already in pending status', async () => {
      const { comp } = await setupScheduleWithHeats();

      const result = await rerunHeat(comp.id, 2); // heat-3 is already pending
      expect(result).not.toBeNull();
      expect(result!.heatStatuses['heat-3']).toBe('pending');
    });
  });
});
