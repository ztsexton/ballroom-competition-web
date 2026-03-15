import { scoringService } from '../../services/scoringService';
import { dataService } from '../../services/dataService';

describe('ScoringService', () => {
  let competitionId: number;

  beforeEach(async () => {
    // Reset data before each test
    await dataService.resetAllData();
    const comp = await dataService.addCompetition({ name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01' });
    competitionId = comp.id;
  });

  describe('calculateResults', () => {
    it('should calculate results for a final round correctly', async () => {
      // Setup: Create people, couples, judges, and event
      const leader1 = await dataService.addPerson({ firstName: 'Leader', lastName: '1', role: 'leader', status: 'student', competitionId });
      const follower1 = await dataService.addPerson({ firstName: 'Follower', lastName: '1', role: 'follower', status: 'student', competitionId });
      const leader2 = await dataService.addPerson({ firstName: 'Leader', lastName: '2', role: 'leader', status: 'student', competitionId });
      const follower2 = await dataService.addPerson({ firstName: 'Follower', lastName: '2', role: 'follower', status: 'student', competitionId });
      const couple1 = await dataService.addCouple(leader1.id, follower1.id, competitionId);
      const couple2 = await dataService.addCouple(leader2.id, follower2.id, competitionId);
      const event = await dataService.addEvent('Test Waltz', [couple1!.bib, couple2!.bib], [], competitionId);

      // Add scores: couple1 gets ranks [1, 2, 1] = 4 total
      //             couple2 gets ranks [2, 1, 2] = 5 total
      await dataService.setScores(event.id, 'final', couple1!.bib, [1, 2, 1]);
      await dataService.setScores(event.id, 'final', couple2!.bib, [2, 1, 2]);

      // Act: Calculate results
      const results = await scoringService.calculateResults(event.id, 'final');

      // Assert: couple1 should be first (skating: 2/3 judges ranked 1st = majority)
      expect(results).toHaveLength(2);
      expect(results[0].bib).toBe(couple1!.bib);
      expect(results[0].totalRank).toBe(1);
      expect(results[0].place).toBe(1);
      expect(results[0].isRecall).toBe(false);
      expect(results[1].bib).toBe(couple2!.bib);
      expect(results[1].totalRank).toBe(2);
      expect(results[1].place).toBe(2);
    });

    it('should calculate results for a recall round correctly', async () => {
      // Setup
      const leader = await dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);

      // Create event with 15 couples to trigger quarter-final
      const allBibs = [couple!.bib];
      for (let i = 0; i < 14; i++) {
        const l = await dataService.addPerson({ firstName: `Leader`, lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const f = await dataService.addPerson({ firstName: `Follower`, lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const c = await dataService.addCouple(l.id, f.id, competitionId);
        allBibs.push(c!.bib);
      }

      const event = await dataService.addEvent('Big Event', allBibs, [], competitionId);

      // Add recall marks: couple gets [1, 1, 0] = 2 total marks
      await dataService.setScores(event.id, 'quarter-final', couple!.bib, [1, 1, 0]);

      // Act
      const results = await scoringService.calculateResults(event.id, 'quarter-final');

      // Assert
      const coupleResult = results.find(r => r.bib === couple!.bib);
      expect(coupleResult).toBeDefined();
      expect(coupleResult!.totalMarks).toBe(2);
      expect(coupleResult!.isRecall).toBe(true);
    });

    it('should return empty array for non-existent event', async () => {
      const results = await scoringService.calculateResults(999, 'final');
      expect(results).toEqual([]);
    });
  });

  describe('getTopCouples', () => {
    it('should return top N couples based on scores', async () => {
      // Setup: Create 4 couples with different scores
      const couples = [];
      for (let i = 0; i < 4; i++) {
        const leader = await dataService.addPerson({ firstName: 'Leader', lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const follower = await dataService.addPerson({ firstName: 'Follower', lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
        couples.push(couple!);
      }
      const event = await dataService.addEvent('Test', couples.map(c => c.bib), [], competitionId);

      // Set scores: lower is better
      await dataService.setScores(event.id, 'final', couples[0].bib, [1, 1, 1]); // 3
      await dataService.setScores(event.id, 'final', couples[1].bib, [2, 2, 2]); // 6
      await dataService.setScores(event.id, 'final', couples[2].bib, [3, 3, 3]); // 9
      await dataService.setScores(event.id, 'final', couples[3].bib, [4, 4, 4]); // 12

      // Act: Get top 2
      const topBibs = await scoringService.getTopCouples(event.id, 'final', 2);

      // Assert
      expect(topBibs).toEqual([couples[0].bib, couples[1].bib]);
    });
  });

  describe('scoreEvent', () => {
    it('should successfully score an event and advance to next round', async () => {
      // Setup: Create event with 10 couples (should have semi-final and final)
      const couples = [];
      for (let i = 0; i < 10; i++) {
        const leader = await dataService.addPerson({ firstName: 'Leader', lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const follower = await dataService.addPerson({ firstName: 'Follower', lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
        couples.push(couple!);
      }
      const event = await dataService.addEvent('Test', couples.map(c => c.bib), [], competitionId);

      // Verify rounds were created
      expect(event.heats).toHaveLength(2);
      expect(event.heats[0].round).toBe('semi-final');
      expect(event.heats[1].round).toBe('final');

      // Score semi-final with recall marks
      const scores = couples.map((couple, index) => ({
        judgeIndex: 0,
        bib: couple.bib,
        score: index < 6 ? 1 : 0, // Top 6 get marks
      }));

      // Act
      const success = await scoringService.scoreEvent(event.id, 'semi-final', scores);

      // Assert
      expect(success).toBe(true);

      // Check that top 6 advanced to final
      const updatedEvent = await dataService.getEventById(event.id);
      const finalHeat = updatedEvent!.heats.find(h => h.round === 'final');
      expect(finalHeat!.bibs).toHaveLength(6);
      expect(finalHeat!.bibs).toEqual(couples.slice(0, 6).map(c => c.bib));
    });

    it('should return false for non-existent event', async () => {
      const success = await scoringService.scoreEvent(999, 'final', []);
      expect(success).toBe(false);
    });

    it('should return false for non-existent round', async () => {
      const event = await dataService.addEvent('Test', [], [], competitionId);
      const success = await scoringService.scoreEvent(event.id, 'nonexistent', []);
      expect(success).toBe(false);
    });
  });

  describe('submitJudgeScores', () => {
    it('should submit judge scores', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);
      const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], competitionId);

      const result = await scoringService.submitJudgeScores(
        event.id, 'final', judge.id,
        [{ bib: couple!.bib, score: 1 }],
      );

      expect(result.success).toBe(true);
    });

    it('should return false for non-existent event', async () => {
      const result = await scoringService.submitJudgeScores(999, 'final', 1, []);
      expect(result.success).toBe(false);
    });

    it('should return false for non-existent round', async () => {
      const event = await dataService.addEvent('Test', [], [], competitionId);
      const result = await scoringService.submitJudgeScores(event.id, 'nonexistent', 1, []);
      expect(result.success).toBe(false);
    });

    it('should return false for judge not assigned to event', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);
      const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], competitionId);

      const result = await scoringService.submitJudgeScores(
        event.id, 'final', 999, // wrong judge
        [{ bib: couple!.bib, score: 1 }],
      );

      expect(result.success).toBe(false);
    });

    it('should report allSubmitted when all judges have submitted', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);
      const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], competitionId);

      const result = await scoringService.submitJudgeScores(
        event.id, 'final', judge.id,
        [{ bib: couple!.bib, score: 1 }],
      );

      expect(result.success).toBe(true);
      expect(result.allSubmitted).toBe(true);
    });
  });

  describe('compileJudgeScores', () => {
    it('should compile judge scores into final format', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);
      const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], competitionId);

      // Submit judge scores first
      await scoringService.submitJudgeScores(
        event.id, 'final', judge.id,
        [{ bib: couple!.bib, score: 1 }],
      );

      const result = await scoringService.compileJudgeScores(event.id, 'final');
      expect(result).toBe(true);
    });

    it('should return false for non-existent event', async () => {
      const result = await scoringService.compileJudgeScores(999, 'final');
      expect(result).toBe(false);
    });

    it('should return false for non-existent round', async () => {
      const event = await dataService.addEvent('Test', [], [], competitionId);
      const result = await scoringService.compileJudgeScores(event.id, 'nonexistent');
      expect(result).toBe(false);
    });

    it('should skip auto-advancement when bibSubset is provided', async () => {

      const couples = [];
      for (let i = 0; i < 10; i++) {
        const l = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId });
        const f = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId });
        couples.push(await dataService.addCouple(l.id, f.id, competitionId));
      }

      const bibs = couples.map(c => c!.bib);
      const judge = await dataService.addJudge('Judge 1', competitionId);
      const event = await dataService.addEvent('Test', bibs, [judge.id], competitionId);

      // Submit scores for a subset
      const subset = bibs.slice(0, 5);
      for (const bib of subset) {
        await scoringService.submitJudgeScores(
          event.id, 'semi-final', judge.id,
          [{ bib, score: 1 }],
        );
      }

      // Compile with bibSubset — should not auto-advance
      const result = await scoringService.compileJudgeScores(event.id, 'semi-final', subset);
      expect(result).toBe(true);

      // Final round should still be empty (no auto-advance)
      const updated = await dataService.getEventById(event.id);
      const finalHeat = updated!.heats.find(h => h.round === 'final');
      expect(finalHeat!.bibs).toHaveLength(0);
    });
  });

  describe('enrichRecallStatus', () => {
    it('should mark recalled bibs', async () => {

      const couples = [];
      for (let i = 0; i < 10; i++) {
        const l = await dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId });
        const f = await dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId });
        couples.push(await dataService.addCouple(l.id, f.id, competitionId));
      }

      const bibs = couples.map(c => c!.bib);
      const event = await dataService.addEvent('Test', bibs, [], competitionId);

      // Score semi-final to advance some couples
      const scores = bibs.map((bib, i) => ({
        judgeIndex: 0, bib, score: i < 6 ? 1 : 0,
      }));
      await scoringService.scoreEvent(event.id, 'semi-final', scores);

      // Get results and enrich
      const results = await scoringService.calculateResults(event.id, 'semi-final');
      await scoringService.enrichRecallStatus(results, event.id, 'semi-final');

      const recalled = results.filter(r => r.recalled);
      expect(recalled.length).toBe(6);
    });

    it('should not fail for non-existent event', async () => {
      await scoringService.enrichRecallStatus([], 999, 'final');
    });

    it('should not fail for final round (no next round)', async () => {
      const event = await dataService.addEvent('Test', [], [], competitionId);
      await scoringService.enrichRecallStatus([], event.id, 'final');
    });
  });

  describe('calculateResults - proficiency scoring', () => {
    it('should calculate proficiency scores as averages', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);

      const event = await dataService.addEvent(
        'Prof Test', [couple!.bib], [judge.id], competitionId,
        undefined, undefined, undefined, undefined, undefined, 'proficiency',
      );

      // Set scores (proficiency scores are numeric)
      await dataService.setScores(event.id, 'final', couple!.bib, [85, 90]);

      const results = await scoringService.calculateResults(event.id, 'final');
      expect(results).toHaveLength(1);
      expect(results[0].bib).toBe(couple!.bib);
    });
  });

  describe('calculateResults - multi-dance', () => {
    it('should calculate multi-dance final results', async () => {

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge 1', competitionId);

      const event = await dataService.addEvent(
        'Multi Dance', [couple!.bib], [judge.id], competitionId,
        undefined, undefined, undefined, 'Smooth', ['Waltz', 'Tango'], 'standard',
      );

      // Set per-dance scores
      await dataService.setScores(event.id, 'final', couple!.bib, [1], 'Waltz');
      await dataService.setScores(event.id, 'final', couple!.bib, [1], 'Tango');

      const results = await scoringService.calculateResults(event.id, 'final');
      expect(results).toHaveLength(1);
      expect(results[0].bib).toBe(couple!.bib);
    });
  });
});
