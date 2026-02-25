import { splitBibsEvenly, heatKey, migrateSchedule } from '../../services/schedule/helpers';
import { ScheduledHeat, CompetitionSchedule } from '../../types';

describe('Schedule Helpers', () => {
  describe('heatKey', () => {
    it('should return the heat id', () => {
      const heat: ScheduledHeat = {
        id: 'heat-123',
        entries: [{ eventId: 1, round: 'final' }],
      };
      expect(heatKey(heat)).toBe('heat-123');
    });
  });

  describe('splitBibsEvenly', () => {
    it('should split bibs into equal groups', () => {
      const result = splitBibsEvenly([1, 2, 3, 4, 5, 6], 3);
      expect(result).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    it('should handle uneven splits with remainder distributed to first groups', () => {
      const result = splitBibsEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
      // 10/3 = 3 remainder 1: first group gets 4, rest get 3
      expect(result).toEqual([[1, 2, 3, 4], [5, 6, 7], [8, 9, 10]]);
    });

    it('should sort bibs numerically', () => {
      const result = splitBibsEvenly([10, 5, 1, 8, 3], 2);
      expect(result).toEqual([[1, 3, 5], [8, 10]]);
    });

    it('should handle single group', () => {
      const result = splitBibsEvenly([3, 1, 2], 1);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it('should handle empty bibs', () => {
      const result = splitBibsEvenly([], 3);
      expect(result).toEqual([[], [], []]);
    });

    it('should handle single bib into multiple groups', () => {
      const result = splitBibsEvenly([5], 3);
      expect(result).toEqual([[5], [], []]);
    });

    it('should handle 7 bibs into 3 groups (remainder 1)', () => {
      const result = splitBibsEvenly([1, 2, 3, 4, 5, 6, 7], 3);
      // 7/3 = 2 r 1: first group gets 3, rest get 2
      expect(result).toEqual([[1, 2, 3], [4, 5], [6, 7]]);
    });
  });

  describe('migrateSchedule', () => {
    const baseSchedule = {
      styleOrder: [],
      levelOrder: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should return schedule unchanged if already new format', () => {
      const schedule: CompetitionSchedule = {
        ...baseSchedule,
        competitionId: 1,
        heatOrder: [{
          id: 'heat-1',
          entries: [{ eventId: 1, round: 'final' }],
        }],
        heatStatuses: { 'heat-1': 'pending' },
        currentHeatIndex: 0,
      };

      const result = migrateSchedule(schedule);
      expect(result.heatOrder[0].id).toBe('heat-1');
      expect(result.heatOrder[0].entries).toHaveLength(1);
    });

    it('should return empty schedule unchanged', () => {
      const schedule: CompetitionSchedule = {
        ...baseSchedule,
        competitionId: 1,
        heatOrder: [],
        heatStatuses: {},
        currentHeatIndex: 0,
      };

      const result = migrateSchedule(schedule);
      expect(result.heatOrder).toEqual([]);
    });

    it('should migrate old format to new format', () => {
      const schedule: CompetitionSchedule = {
        ...baseSchedule,
        competitionId: 1,
        heatOrder: [
          { eventId: 1, round: 'final' } as any,
          { isBreak: true, breakLabel: 'Lunch' } as any,
          { eventId: 2, round: 'semi-final' } as any,
        ],
        heatStatuses: {
          '1:final': 'completed',
          '2:semi-final': 'pending',
        },
        currentHeatIndex: 0,
      };

      const result = migrateSchedule(schedule);
      expect(result.heatOrder).toHaveLength(3);

      // First heat: should have id and entries array
      expect(result.heatOrder[0].id).toContain('heat-migrated-');
      expect(result.heatOrder[0].entries).toEqual([{ eventId: 1, round: 'final' }]);

      // Break: entries should be empty
      expect(result.heatOrder[1].isBreak).toBe(true);
      expect(result.heatOrder[1].breakLabel).toBe('Lunch');
      expect(result.heatOrder[1].entries).toEqual([]);

      // Statuses should be migrated
      const firstKey = result.heatOrder[0].id;
      expect(result.heatStatuses[firstKey]).toBe('completed');
    });
  });
});
