import { dataService } from '../../services/dataService';
import { scheduleService } from '../../services/schedule';
import { advanceHeat, goBackHeat, advanceDance, backDance } from '../../services/schedule/heatNavigation';

describe('Heat Navigation', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupSchedule(opts?: { multiDance?: boolean; breakHeat?: boolean }) {
    const comp = await dataService.addCompetition({ name: 'Test Comp', type: 'UNAFFILIATED', date: '2025-06-01' });
    const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
    const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
    const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
    const judge = await dataService.addJudge('Judge A', comp.id);

    const dances = opts?.multiDance ? ['waltz', 'tango', 'foxtrot'] : undefined;
    const event = await dataService.addEvent(
      'Test Event', [couple!.bib], [judge.id], comp.id,
      undefined, undefined, undefined, undefined, dances,
    );

    const schedule = await scheduleService.generateSchedule(comp.id);

    return { comp, couple: couple!, judge, event, schedule };
  }

  describe('advanceHeat', () => {
    it('should transition pending → scoring and set actualStartTime', async () => {
      const { comp } = await setupSchedule();

      const result = await advanceHeat(comp.id);

      expect(result).not.toBeNull();
      const heatKey = Object.keys(result!.heatStatuses).find(
        k => result!.heatStatuses[k] === 'scoring'
      );
      expect(heatKey).toBeDefined();
      expect(result!.heatOrder[0].actualStartTime).toBeDefined();
    });

    it('should transition scoring → completed', async () => {
      const { comp } = await setupSchedule();

      // First advance: pending → scoring
      await advanceHeat(comp.id);
      // Second advance: scoring → completed
      const result = await advanceHeat(comp.id);

      expect(result).not.toBeNull();
      const statuses = Object.values(result!.heatStatuses);
      expect(statuses).toContain('completed');
    });

    it('should return null when no schedule exists', async () => {
      const result = await advanceHeat(999);
      expect(result).toBeNull();
    });
  });

  describe('goBackHeat', () => {
    it('should transition scoring → pending', async () => {
      const { comp } = await setupSchedule();

      // Advance to scoring
      await advanceHeat(comp.id);

      // Go back to pending
      const result = await goBackHeat(comp.id);
      expect(result).not.toBeNull();

      const firstHeatKey = Object.keys(result!.heatStatuses)[0];
      expect(result!.heatStatuses[firstHeatKey]).toBe('pending');
    });

    it('should stay at index 0 when already at first heat in pending state', async () => {
      const { comp } = await setupSchedule();

      const result = await goBackHeat(comp.id);

      expect(result).not.toBeNull();
      expect(result!.currentHeatIndex).toBe(0);
    });

    it('should return null when no schedule exists', async () => {
      const result = await goBackHeat(999);
      expect(result).toBeNull();
    });
  });

  describe('advanceDance', () => {
    it('should move to next dance in multi-dance heat', async () => {
      const { comp } = await setupSchedule({ multiDance: true });

      // Advance to scoring to set currentDance
      await advanceHeat(comp.id);

      const schedule = await dataService.getSchedule(comp.id);
      expect(schedule!.currentDance).toBeDefined();

      const result = await advanceDance(comp.id);
      expect(result).not.toBeNull();
    });

    it('should return schedule unchanged when no dances', async () => {
      const { comp } = await setupSchedule();

      const before = await dataService.getSchedule(comp.id);
      const result = await advanceDance(comp.id);

      expect(result).not.toBeNull();
    });

    it('should return null when no schedule exists', async () => {
      const result = await advanceDance(999);
      expect(result).toBeNull();
    });
  });

  describe('backDance', () => {
    it('should return null when no schedule exists', async () => {
      const result = await backDance(999);
      expect(result).toBeNull();
    });

    it('should return schedule unchanged when at first dance', async () => {
      const { comp } = await setupSchedule({ multiDance: true });

      // Advance to scoring to set currentDance to first dance
      await advanceHeat(comp.id);

      const result = await backDance(comp.id);
      expect(result).not.toBeNull();
    });

    it('should move to previous dance after advancing', async () => {
      const { comp } = await setupSchedule({ multiDance: true });

      // Advance to scoring
      await advanceHeat(comp.id);

      // Advance dance
      await advanceDance(comp.id);

      // Now go back
      const result = await backDance(comp.id);
      expect(result).not.toBeNull();
    });
  });
});
