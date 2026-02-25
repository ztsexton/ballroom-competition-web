import request from 'supertest';
import app from '../server';
import { dataService } from '../services/dataService';

describe('Performance Tests', () => {
  let compId: number;

  beforeEach(async () => {
    await dataService.resetAllData();
    const comp = await dataService.addCompetition({ name: 'Perf Test', type: 'NDCA', date: '2026-03-01' });
    compId = comp.id;
  });

  describe('scoring-progress endpoint', () => {
    it('should respond quickly with multiple couples and judges', async () => {
      // Setup: 10 couples, 5 judges, 3 dances
      const leaders = [];
      const followers = [];
      for (let i = 0; i < 10; i++) {
        const leader = await dataService.addPerson({
          firstName: `Leader${i}`, lastName: 'Test', role: 'leader', status: 'student', competitionId: compId,
        });
        const follower = await dataService.addPerson({
          firstName: `Follower${i}`, lastName: 'Test', role: 'follower', status: 'student', competitionId: compId,
        });
        leaders.push(leader);
        followers.push(follower);
      }

      const couples = [];
      for (let i = 0; i < 10; i++) {
        const couple = await dataService.addCouple(leaders[i].id, followers[i].id, compId);
        couples.push(couple!);
      }
      const bibs = couples.map(c => c.bib);

      const judgeIds = [];
      for (let i = 0; i < 5; i++) {
        const judge = await dataService.addJudge(`Judge${i}`, compId);
        judgeIds.push(judge.id);
      }

      const event = await dataService.addEvent(
        'Multi Dance Event', bibs, judgeIds, compId,
        undefined, undefined, undefined, undefined, ['Waltz', 'Tango', 'Foxtrot'],
      );

      // Have 3 judges submit scores
      for (let j = 0; j < 3; j++) {
        for (const dance of ['Waltz', 'Tango', 'Foxtrot']) {
          await dataService.setJudgeScoresBatch(
            event.id, 'final', judgeIds[j],
            bibs.map((bib, i) => ({ bib, score: i + 1 })),
            dance,
          );
        }
      }

      // Create schedule with this heat
      const now = new Date().toISOString();
      await dataService.saveSchedule({
        competitionId: compId,
        heatOrder: [{
          id: 'heat-1',
          entries: [{ eventId: event.id, round: 'final' }],
        }],
        styleOrder: [],
        levelOrder: [],
        currentHeatIndex: 0,
        heatStatuses: { 'heat-1': 'scoring' },
        createdAt: now,
        updatedAt: now,
      });

      const start = Date.now();
      const res = await request(app)
        .get(`/api/judging/competition/${compId}/scoring-progress`)
        .expect(200);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.judges).toHaveLength(5);
    });
  });

  describe('setJudgeScoresBatch speed', () => {
    it('should handle batch writes quickly', async () => {
      const judge = await dataService.addJudge('Fast Judge', compId);
      const bibs = Array.from({ length: 20 }, (_, i) => i + 1);
      const event = await dataService.addEvent('Batch Event', bibs, [judge.id], compId);

      const entries = bibs.map((bib, i) => ({ bib, score: i + 1 }));

      const start = Date.now();
      await dataService.setJudgeScoresBatch(event.id, 'final', judge.id, entries);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);

      // Verify all scores saved
      const scores = await dataService.getJudgeScores(event.id, 'final', 1);
      expect(scores[judge.id]).toBe(1);
    });
  });

  describe('competition summary speed', () => {
    it('should respond quickly with populated competition', async () => {
      // Setup: 10 people, 5 couples, 1 judge, 1 event
      for (let i = 0; i < 5; i++) {
        const leader = await dataService.addPerson({
          firstName: `L${i}`, lastName: 'T', role: 'leader', status: 'student', competitionId: compId,
        });
        const follower = await dataService.addPerson({
          firstName: `F${i}`, lastName: 'T', role: 'follower', status: 'student', competitionId: compId,
        });
        await dataService.addCouple(leader.id, follower.id, compId);
      }
      await dataService.addJudge('Judge', compId);

      const couples = await dataService.getCouples(compId);
      const bibs = couples.map(c => c.bib);
      await dataService.addEvent('Event 1', bibs, [], compId);

      const start = Date.now();
      const res = await request(app)
        .get(`/api/competitions/${compId}/summary`)
        .expect(200);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(res.body.competition.name).toBe('Perf Test');
      expect(res.body.counts.people).toBe(10);
      expect(res.body.counts.couples).toBe(5);
      expect(res.body.counts.judges).toBe(1);
      expect(res.body.counts.events).toBe(1);
      expect(res.body.counts.totalEntries).toBe(5);
    });
  });

  describe('deleteCouple scoped', () => {
    it('should be fast when other competitions have many events', async () => {
      // Create couple in compId
      const leader = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student', competitionId: compId,
      });
      const follower = await dataService.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student', competitionId: compId,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, compId);

      // Create another competition with 20 events
      const comp2 = await dataService.addCompetition({ name: 'Big Comp', type: 'NDCA', date: '2026-04-01' });
      for (let i = 0; i < 20; i++) {
        await dataService.addEvent(`Event${i}`, [100 + i], [], comp2.id);
      }

      const start = Date.now();
      const res = await request(app)
        .delete(`/api/couples/${couple!.bib}`)
        .expect(204);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('active-heat speed', () => {
    it('should respond quickly with multiple couples and judges', async () => {
      const leaders = [];
      const followers = [];
      for (let i = 0; i < 10; i++) {
        const leader = await dataService.addPerson({
          firstName: `L${i}`, lastName: 'T', role: 'leader', status: 'student', competitionId: compId,
        });
        const follower = await dataService.addPerson({
          firstName: `F${i}`, lastName: 'T', role: 'follower', status: 'student', competitionId: compId,
        });
        leaders.push(leader);
        followers.push(follower);
      }

      const couples = [];
      for (let i = 0; i < 10; i++) {
        const couple = await dataService.addCouple(leaders[i].id, followers[i].id, compId);
        couples.push(couple!);
      }
      const bibs = couples.map(c => c.bib);

      const judgeIds = [];
      for (let i = 0; i < 5; i++) {
        const judge = await dataService.addJudge(`Judge${i}`, compId);
        judgeIds.push(judge.id);
      }

      const event = await dataService.addEvent('Event', bibs, judgeIds, compId);

      const now = new Date().toISOString();
      await dataService.saveSchedule({
        competitionId: compId,
        heatOrder: [{
          id: 'heat-1',
          entries: [{ eventId: event.id, round: 'final' }],
        }],
        styleOrder: [],
        levelOrder: [],
        currentHeatIndex: 0,
        heatStatuses: { 'heat-1': 'scoring' },
        createdAt: now,
        updatedAt: now,
      });

      const start = Date.now();
      const res = await request(app)
        .get(`/api/judging/competition/${compId}/active-heat`)
        .expect(200);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.judges).toHaveLength(5);
    });
  });
});
