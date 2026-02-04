import { computeAdvancementBibs } from '../../services/scoringService';
import { EventResult } from '../../types';

// Helper to create a minimal EventResult with recall marks
function recallResult(bib: number, totalMarks: number): EventResult {
  return {
    bib,
    leaderName: `Leader ${bib}`,
    followerName: `Follower ${bib}`,
    totalMarks,
    scores: [],
    isRecall: true,
  };
}

// Helper to create a minimal EventResult with ranking
function rankResult(bib: number, totalRank: number): EventResult {
  return {
    bib,
    leaderName: `Leader ${bib}`,
    followerName: `Follower ${bib}`,
    totalRank,
    scores: [],
    isRecall: false,
  };
}

// Helper to create a minimal EventResult with proficiency score
function proficiencyResult(bib: number, totalScore: number): EventResult {
  return {
    bib,
    leaderName: `Leader ${bib}`,
    followerName: `Follower ${bib}`,
    totalScore,
    scores: [],
    isRecall: false,
  };
}

describe('computeAdvancementBibs', () => {
  describe('basic advancement (no ties)', () => {
    it('should return top N bibs from recall results', () => {
      // Sorted descending by totalMarks (higher is better)
      const results = [
        recallResult(101, 5),
        recallResult(102, 4),
        recallResult(103, 3),
        recallResult(104, 2),
        recallResult(105, 1),
      ];
      const bibs = computeAdvancementBibs(results, 3);
      expect(bibs).toEqual([101, 102, 103]);
    });

    it('should return top N bibs from ranking results', () => {
      // Sorted ascending by totalRank (lower is better)
      const results = [
        rankResult(101, 3),
        rankResult(102, 6),
        rankResult(103, 9),
        rankResult(104, 12),
      ];
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102]);
    });

    it('should return all bibs when count >= results length', () => {
      const results = [
        recallResult(101, 5),
        recallResult(102, 3),
      ];
      const bibs = computeAdvancementBibs(results, 5);
      expect(bibs).toEqual([101, 102]);
    });

    it('should return empty array for empty results', () => {
      const bibs = computeAdvancementBibs([], 6);
      expect(bibs).toEqual([]);
    });
  });

  describe('R1: tie inclusion at cut line', () => {
    it('should include tied entries at the cut line for recall marks', () => {
      // Target: 3, but bibs 103 and 104 are tied at 3 marks
      const results = [
        recallResult(101, 5),
        recallResult(102, 4),
        recallResult(103, 3),
        recallResult(104, 3), // tied at cut line
        recallResult(105, 1),
      ];
      const bibs = computeAdvancementBibs(results, 3);
      expect(bibs).toEqual([101, 102, 103, 104]);
      expect(bibs.length).toBe(4); // expanded from 3 to 4
    });

    it('should include large tie groups at cut line', () => {
      // Target: 2, but 4 entries are tied at 3 marks
      const results = [
        recallResult(101, 5),
        recallResult(102, 3),
        recallResult(103, 3),
        recallResult(104, 3),
        recallResult(105, 3),
        recallResult(106, 1),
      ];
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102, 103, 104, 105]);
      expect(bibs.length).toBe(5); // expanded from 2 to 5
    });

    it('should include ties for ranking (lower is better)', () => {
      // Target: 2, bib 102 and 103 are tied at rank 6
      const results = [
        rankResult(101, 3),
        rankResult(102, 6),
        rankResult(103, 6), // tied at cut line
        rankResult(104, 9),
      ];
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102, 103]);
    });

    it('should include ties for proficiency scores', () => {
      // Target: 2, bib 102 and 103 tied at 85.0
      const results = [
        proficiencyResult(101, 92.5),
        proficiencyResult(102, 85.0),
        proficiencyResult(103, 85.0),
        proficiencyResult(104, 70.0),
      ];
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102, 103]);
    });

    it('should not expand when no tie at cut line', () => {
      const results = [
        recallResult(101, 5),
        recallResult(102, 4),
        recallResult(103, 3),
        recallResult(104, 2),
      ];
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102]);
    });
  });

  describe('R2: no forced tie-breaks', () => {
    it('should never truncate a tie group (semi-final target 12)', () => {
      // Simulating semi-final → final: target 12 couples
      // 11 strictly above cut line, 4-way tie for 12th = 15 total
      const results: EventResult[] = [];
      for (let i = 1; i <= 11; i++) {
        results.push(recallResult(100 + i, 20 - i)); // marks 19, 18, ..., 9
      }
      // 4 entries tied at 8 marks
      results.push(recallResult(112, 8));
      results.push(recallResult(113, 8));
      results.push(recallResult(114, 8));
      results.push(recallResult(115, 8));
      // Below cut line
      results.push(recallResult(116, 5));
      results.push(recallResult(117, 3));

      const bibs = computeAdvancementBibs(results, 12);
      expect(bibs.length).toBe(15); // 11 + 4 tied
      expect(bibs).toContain(112);
      expect(bibs).toContain(113);
      expect(bibs).toContain(114);
      expect(bibs).toContain(115);
      expect(bibs).not.toContain(116);
    });
  });

  describe('R3/R4: final hard max', () => {
    it('should expand final from 6 to 8 with ties (within hard max)', () => {
      // Target: 6 for final, hard max: 8
      // 5 strictly above, 3-way tie at cut line = 8 total ≤ 8
      const results = [
        recallResult(101, 10),
        recallResult(102, 9),
        recallResult(103, 8),
        recallResult(104, 7),
        recallResult(105, 6),
        recallResult(106, 5), // cut line
        recallResult(107, 5), // tied
        recallResult(108, 5), // tied
        recallResult(109, 2),
        recallResult(110, 1),
      ];
      const bibs = computeAdvancementBibs(results, 6, { hardMax: 8 });
      expect(bibs.length).toBe(8);
      expect(bibs).toContain(106);
      expect(bibs).toContain(107);
      expect(bibs).toContain(108);
      expect(bibs).not.toContain(109);
    });

    it('should exclude tie group when it would exceed hard max', () => {
      // Target: 6 for final, hard max: 8
      // 5 strictly above, 4-way tie at cut line = 9 > 8
      // Should only advance the 5 strictly better
      const results = [
        recallResult(101, 10),
        recallResult(102, 9),
        recallResult(103, 8),
        recallResult(104, 7),
        recallResult(105, 6),
        recallResult(106, 5), // cut line — tie group of 4
        recallResult(107, 5),
        recallResult(108, 5),
        recallResult(109, 5),
        recallResult(110, 2),
      ];
      const bibs = computeAdvancementBibs(results, 6, { hardMax: 8 });
      expect(bibs.length).toBe(5); // only those strictly better than cut line
      expect(bibs).toEqual([101, 102, 103, 104, 105]);
      expect(bibs).not.toContain(106);
    });

    it('should allow exactly hardMax when tie group fits', () => {
      // Target: 6, hard max: 8
      // 6 strictly above, 2-way tie at position 7-8 = 8 total = hardMax
      const results = [
        recallResult(101, 10),
        recallResult(102, 9),
        recallResult(103, 8),
        recallResult(104, 7),
        recallResult(105, 6),
        recallResult(106, 5),
        recallResult(107, 4), // tie at cut line (position 7-8)
        recallResult(108, 4),
        recallResult(109, 2),
      ];
      // Target 6, but no tie at position 6 — exact top 6
      const bibs = computeAdvancementBibs(results, 6, { hardMax: 8 });
      expect(bibs.length).toBe(6);
      expect(bibs).toEqual([101, 102, 103, 104, 105, 106]);
    });

    it('should not apply hardMax to non-final rounds', () => {
      // No hardMax → include all ties regardless
      const results = [
        recallResult(101, 10),
        recallResult(102, 9),
        recallResult(103, 8),
        recallResult(104, 5),
        recallResult(105, 5),
        recallResult(106, 5),
        recallResult(107, 5),
        recallResult(108, 5),
        recallResult(109, 5),
        recallResult(110, 2),
      ];
      const bibs = computeAdvancementBibs(results, 6);
      // 3 strictly above + 6 tied at 5 = 9
      expect(bibs.length).toBe(9);
    });
  });

  describe('includeTies option', () => {
    it('should do exact slice when includeTies is false', () => {
      const results = [
        recallResult(101, 5),
        recallResult(102, 4),
        recallResult(103, 3),
        recallResult(104, 3), // tied but won't be included
        recallResult(105, 1),
      ];
      const bibs = computeAdvancementBibs(results, 3, { includeTies: false });
      expect(bibs).toEqual([101, 102, 103]);
      expect(bibs.length).toBe(3); // exactly 3, no tie expansion
    });

    it('should default to includeTies: true', () => {
      const results = [
        recallResult(101, 5),
        recallResult(102, 3),
        recallResult(103, 3),
        recallResult(104, 1),
      ];
      // No options passed — should default to tie inclusion
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102, 103]);
    });
  });

  describe('edge cases', () => {
    it('should handle all entries having the same score', () => {
      const results = [
        recallResult(101, 3),
        recallResult(102, 3),
        recallResult(103, 3),
        recallResult(104, 3),
      ];
      // Target 2 — all tied, no hardMax → all advance
      const bibs = computeAdvancementBibs(results, 2);
      expect(bibs).toEqual([101, 102, 103, 104]);
    });

    it('should handle all entries tied with hardMax', () => {
      const results = [
        recallResult(101, 3),
        recallResult(102, 3),
        recallResult(103, 3),
        recallResult(104, 3),
        recallResult(105, 3),
        recallResult(106, 3),
        recallResult(107, 3),
        recallResult(108, 3),
        recallResult(109, 3),
        recallResult(110, 3),
      ];
      // Target 6, hard max 8, but all 10 are tied
      // No one is "strictly better" → 0 advance
      const bibs = computeAdvancementBibs(results, 6, { hardMax: 8 });
      expect(bibs.length).toBe(0);
    });

    it('should handle target of 1', () => {
      const results = [
        recallResult(101, 5),
        recallResult(102, 5), // tied at cut line
        recallResult(103, 3),
      ];
      const bibs = computeAdvancementBibs(results, 1);
      expect(bibs).toEqual([101, 102]);
    });

    it('should handle single result', () => {
      const results = [recallResult(101, 5)];
      const bibs = computeAdvancementBibs(results, 3);
      expect(bibs).toEqual([101]);
    });

    it('should handle R4 example from scoring.md', () => {
      // "N_final = 6, If 3 entries tie at the cut line and only 5 are strictly above it
      //  → final size = 8"
      const results = [
        recallResult(101, 10),
        recallResult(102, 9),
        recallResult(103, 8),
        recallResult(104, 7),
        recallResult(105, 6),
        recallResult(106, 5), // cut line for target=6
        recallResult(107, 5), // tied
        recallResult(108, 5), // tied
        recallResult(109, 3),
        recallResult(110, 1),
      ];
      // 5 strictly above + 3 tied at 5 = 8 ≤ hardMax(8) → all 8 advance
      const bibs = computeAdvancementBibs(results, 6, { hardMax: 8 });
      expect(bibs.length).toBe(8);
      expect(bibs).toContain(106);
      expect(bibs).toContain(107);
      expect(bibs).toContain(108);
    });

    it('should handle ties with ranking (lower is better)', () => {
      // Target: 3, rankings: 3, 6, 9, 9, 12
      // Cut line at position 3 has rank 9, position 4 also has rank 9
      const results = [
        rankResult(101, 3),
        rankResult(102, 6),
        rankResult(103, 9),
        rankResult(104, 9), // tied at cut line
        rankResult(105, 12),
      ];
      const bibs = computeAdvancementBibs(results, 3);
      expect(bibs).toEqual([101, 102, 103, 104]);
    });
  });
});
