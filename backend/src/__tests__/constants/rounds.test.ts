import { getRecallCount, ROUND_CAPACITY, RECALL_ROUNDS } from '../../constants/rounds';

describe('Rounds Constants', () => {
  describe('ROUND_CAPACITY', () => {
    it('should define capacity for final round', () => {
      expect(ROUND_CAPACITY['final']).toBe(6);
    });

    it('should define capacity for semi-final', () => {
      expect(ROUND_CAPACITY['semi-final']).toBe(12);
    });
  });

  describe('RECALL_ROUNDS', () => {
    it('should include semi-final and quarter-final', () => {
      expect(RECALL_ROUNDS).toContain('semi-final');
      expect(RECALL_ROUNDS).toContain('quarter-final');
    });

    it('should not include final', () => {
      expect(RECALL_ROUNDS).not.toContain('final');
    });
  });

  describe('getRecallCount', () => {
    const heats = [
      { round: 'quarter-final' },
      { round: 'semi-final' },
      { round: 'final' },
    ];

    it('should return recall count for quarter-final (recall to semi = 12)', () => {
      expect(getRecallCount(heats, 'quarter-final')).toBe(12);
    });

    it('should return recall count for semi-final (recall to final = 6)', () => {
      expect(getRecallCount(heats, 'semi-final')).toBe(6);
    });

    it('should return undefined for final round', () => {
      expect(getRecallCount(heats, 'final')).toBeUndefined();
    });

    it('should return undefined for non-existent round', () => {
      expect(getRecallCount(heats, 'nonexistent')).toBeUndefined();
    });

    it('should distribute evenly across floor heats', () => {
      // 6 total to 2 heats = 3 each
      expect(getRecallCount(heats, 'semi-final', 2, 0)).toBe(3);
      expect(getRecallCount(heats, 'semi-final', 2, 1)).toBe(3);
    });

    it('should give extra to first heats when uneven', () => {
      // 12 total to 5 heats = 2 base, 2 remainder → first 2 get 3, rest get 2
      expect(getRecallCount(heats, 'quarter-final', 5, 0)).toBe(3);
      expect(getRecallCount(heats, 'quarter-final', 5, 1)).toBe(3);
      expect(getRecallCount(heats, 'quarter-final', 5, 2)).toBe(2);
    });

    it('should return ceiling when no floorHeatIndex given', () => {
      // 6 total to 4 heats = ceil(6/4) = 2
      expect(getRecallCount(heats, 'semi-final', 4)).toBe(2);
    });

    it('should return totalRecall when totalFloorHeats is 1', () => {
      expect(getRecallCount(heats, 'semi-final', 1)).toBe(6);
    });
  });
});
