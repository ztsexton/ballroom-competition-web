import { scoringService } from '../../services/scoringService';
import { dataService } from '../../services/dataService';

describe('ScoringService', () => {
  beforeEach(() => {
    // Reset data before each test
    dataService.resetAllData();
  });

  describe('calculateResults', () => {
    it('should calculate results for a final round correctly', () => {
      // Setup: Create people, couples, judges, and event
      const competitionId = 1;
      const leader1 = dataService.addPerson({ firstName: 'Leader', lastName: '1', role: 'leader', status: 'student', competitionId });
      const follower1 = dataService.addPerson({ firstName: 'Follower', lastName: '1', role: 'follower', status: 'student', competitionId });
      const leader2 = dataService.addPerson({ firstName: 'Leader', lastName: '2', role: 'leader', status: 'student', competitionId });
      const follower2 = dataService.addPerson({ firstName: 'Follower', lastName: '2', role: 'follower', status: 'student', competitionId });
      const couple1 = dataService.addCouple(leader1.id, follower1.id, competitionId);
      const couple2 = dataService.addCouple(leader2.id, follower2.id, competitionId);
      const event = dataService.addEvent('Test Waltz', [couple1!.bib, couple2!.bib], [], competitionId);
      
      // Add scores: couple1 gets ranks [1, 2, 1] = 4 total
      //             couple2 gets ranks [2, 1, 2] = 5 total
      dataService.setScores(event.id, 'final', couple1!.bib, [1, 2, 1]);
      dataService.setScores(event.id, 'final', couple2!.bib, [2, 1, 2]);
      
      // Act: Calculate results
      const results = scoringService.calculateResults(event.id, 'final');
      
      // Assert: couple1 should be first with total rank 4
      expect(results).toHaveLength(2);
      expect(results[0].bib).toBe(couple1!.bib);
      expect(results[0].totalRank).toBe(4);
      expect(results[0].isRecall).toBe(false);
      expect(results[1].bib).toBe(couple2!.bib);
      expect(results[1].totalRank).toBe(5);
    });

    it('should calculate results for a recall round correctly', () => {
      // Setup
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      
      // Create event with 15 couples to trigger quarter-final
      const allBibs = [couple!.bib];
      for (let i = 0; i < 14; i++) {
        const l = dataService.addPerson({ firstName: `Leader`, lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const f = dataService.addPerson({ firstName: `Follower`, lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const c = dataService.addCouple(l.id, f.id, competitionId);
        allBibs.push(c!.bib);
      }
      
      const event = dataService.addEvent('Big Event', allBibs, [], competitionId);
      
      // Add recall marks: couple gets [1, 1, 0] = 2 total marks
      dataService.setScores(event.id, 'quarter-final', couple!.bib, [1, 1, 0]);
      
      // Act
      const results = scoringService.calculateResults(event.id, 'quarter-final');
      
      // Assert
      const coupleResult = results.find(r => r.bib === couple!.bib);
      expect(coupleResult).toBeDefined();
      expect(coupleResult!.totalMarks).toBe(2);
      expect(coupleResult!.isRecall).toBe(true);
    });

    it('should return empty array for non-existent event', () => {
      const results = scoringService.calculateResults(999, 'final');
      expect(results).toEqual([]);
    });
  });

  describe('getTopCouples', () => {
    it('should return top N couples based on scores', () => {
      // Setup: Create 4 couples with different scores
      const competitionId = 1;
      const couples = [];
      for (let i = 0; i < 4; i++) {
        const leader = dataService.addPerson({ firstName: 'Leader', lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const follower = dataService.addPerson({ firstName: 'Follower', lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const couple = dataService.addCouple(leader.id, follower.id, competitionId);
        couples.push(couple!);
      }
      const event = dataService.addEvent('Test', couples.map(c => c.bib), [], competitionId);
      
      // Set scores: lower is better
      dataService.setScores(event.id, 'final', couples[0].bib, [1, 1, 1]); // 3
      dataService.setScores(event.id, 'final', couples[1].bib, [2, 2, 2]); // 6
      dataService.setScores(event.id, 'final', couples[2].bib, [3, 3, 3]); // 9
      dataService.setScores(event.id, 'final', couples[3].bib, [4, 4, 4]); // 12
      
      // Act: Get top 2
      const topBibs = scoringService.getTopCouples(event.id, 'final', 2);
      
      // Assert
      expect(topBibs).toEqual([couples[0].bib, couples[1].bib]);
    });
  });

  describe('scoreEvent', () => {
    it('should successfully score an event and advance to next round', () => {
      // Setup: Create event with 10 couples (should have semi-final and final)
      const couples = [];
      const competitionId = 1;
      for (let i = 0; i < 10; i++) {
        const leader = dataService.addPerson({ firstName: 'Leader', lastName: `${i}`, role: 'leader', status: 'student', competitionId });
        const follower = dataService.addPerson({ firstName: 'Follower', lastName: `${i}`, role: 'follower', status: 'student', competitionId });
        const couple = dataService.addCouple(leader.id, follower.id, competitionId);
        couples.push(couple!);
      }
      const event = dataService.addEvent('Test', couples.map(c => c.bib), [], competitionId);
      
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
      const success = scoringService.scoreEvent(event.id, 'semi-final', scores);
      
      // Assert
      expect(success).toBe(true);
      
      // Check that top 6 advanced to final
      const updatedEvent = dataService.getEventById(event.id);
      const finalHeat = updatedEvent!.heats.find(h => h.round === 'final');
      expect(finalHeat!.bibs).toHaveLength(6);
      expect(finalHeat!.bibs).toEqual(couples.slice(0, 6).map(c => c.bib));
    });

    it('should return false for non-existent event', () => {
      const success = scoringService.scoreEvent(999, 'final', []);
      expect(success).toBe(false);
    });
  });
});
