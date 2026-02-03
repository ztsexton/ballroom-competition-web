import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

/**
 * Performance + Concurrency tests.
 * Verifies data consistency when multiple judges submit scores
 * simultaneously and when audience members read heat sheets concurrently.
 */
describe('Concurrency & Performance', () => {
  let competitionId: number;
  let eventId: number;
  const NUM_JUDGES = 5;
  const NUM_COUPLES = 6; // ≤6 couples = final-only round
  const judgeIds: number[] = [];
  const bibs: number[] = [];

  beforeAll(async () => {
    await dataService.resetAllData();

    // Create competition
    const comp = await dataService.addCompetition({
      name: 'Concurrency Test', type: 'NDCA', date: '2026-06-01',
    });
    competitionId = comp.id;

    // Create couples
    for (let i = 0; i < NUM_COUPLES; i++) {
      const leader = await dataService.addPerson({
        firstName: `Leader${i}`, lastName: 'Test',
        role: 'leader', status: 'student', competitionId,
      });
      const follower = await dataService.addPerson({
        firstName: `Follower${i}`, lastName: 'Test',
        role: 'follower', status: 'student', competitionId,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      bibs.push(couple!.bib);
    }

    // Create judges
    for (let i = 0; i < NUM_JUDGES; i++) {
      const judge = await dataService.addJudge(`Judge ${i}`, competitionId);
      judgeIds.push(judge.id);
    }

    // Create event with all couples and judges in a final round
    const event = await dataService.addEvent(
      'Concurrent Scoring Event', bibs, judgeIds, competitionId,
    );
    eventId = event.id;

    // Create and save a schedule with this heat in 'scoring' status
    await dataService.saveSchedule({
      competitionId,
      heatOrder: [
        {
          id: 'heat-1',
          entries: [{ eventId, round: 'final' }],
        },
      ],
      currentHeatIndex: 0,
      heatStatuses: { 'heat-1': 'scoring' },
      styleOrder: [],
      levelOrder: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await dataService.resetAllData();
  });

  describe('Concurrent judge score submission', () => {
    it('should preserve all scores when judges submit simultaneously', async () => {
      // All judges submit scores at the same time
      const submissions = judgeIds.map((judgeId, jIdx) => {
        const scores = bibs.map((bib, bIdx) => ({
          bib,
          score: bIdx + 1, // rank 1 through NUM_COUPLES
        }));

        return request(app)
          .post(`/api/judging/competition/${competitionId}/submit-scores`)
          .send({ judgeId, eventId, round: 'final', scores });
      });

      const results = await Promise.all(submissions);

      // All submissions should succeed
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Scores submitted successfully');
      }

      // Verify every judge's scores are preserved for every couple
      for (const bib of bibs) {
        const judgeScores = await dataService.getJudgeScores(eventId, 'final', bib);
        expect(Object.keys(judgeScores)).toHaveLength(NUM_JUDGES);
        for (const judgeId of judgeIds) {
          expect(judgeScores[judgeId]).toBeDefined();
        }
      }
    });

    it('should report allJudgesSubmitted correctly after all submit', async () => {
      // Clear and re-submit to test the allSubmitted flag
      await dataService.clearJudgeScores(eventId, 'final');

      // Submit one at a time — last one should report allSubmitted=true
      for (let i = 0; i < judgeIds.length; i++) {
        const scores = bibs.map(bib => ({ bib, score: 1 }));
        const res = await request(app)
          .post(`/api/judging/competition/${competitionId}/submit-scores`)
          .send({ judgeId: judgeIds[i], eventId, round: 'final', scores });

        expect(res.status).toBe(200);
        if (i < judgeIds.length - 1) {
          expect(res.body.allJudgesSubmitted).toBe(false);
        } else {
          expect(res.body.allJudgesSubmitted).toBe(true);
        }
      }
    });
  });

  describe('Concurrent heat sheet reads', () => {
    it('should handle many simultaneous schedule reads', async () => {
      const NUM_READERS = 20;

      const reads = Array.from({ length: NUM_READERS }, () =>
        request(app).get(`/api/judging/competition/${competitionId}/schedule`)
      );

      const results = await Promise.all(reads);

      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.heatOrder).toHaveLength(1);
        expect(res.body.currentHeatIndex).toBe(0);
      }
    });

    it('should handle simultaneous public competition reads', async () => {
      const NUM_READERS = 20;

      const reads = Array.from({ length: NUM_READERS }, () =>
        request(app).get('/api/public/competitions')
      );

      const results = await Promise.all(reads);

      for (const res of results) {
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('should handle simultaneous active-heat reads', async () => {
      const NUM_READERS = 15;

      const reads = Array.from({ length: NUM_READERS }, () =>
        request(app).get(`/api/judging/competition/${competitionId}/active-heat`)
      );

      const results = await Promise.all(reads);

      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.heatId).toBe('heat-1');
        expect(res.body.entries).toHaveLength(1);
        expect(res.body.judges).toHaveLength(NUM_JUDGES);
      }
    });
  });

  describe('Concurrent reads and writes', () => {
    it('should return consistent scoring progress while judges submit', async () => {
      // Clear scores first
      await dataService.clearJudgeScores(eventId, 'final');

      // Submit scores from 3 judges while simultaneously reading progress
      const writes = judgeIds.slice(0, 3).map(judgeId => {
        const scores = bibs.map(bib => ({ bib, score: 1 }));
        return request(app)
          .post(`/api/judging/competition/${competitionId}/submit-scores`)
          .send({ judgeId, eventId, round: 'final', scores });
      });

      const reads = Array.from({ length: 5 }, () =>
        request(app).get(`/api/judging/competition/${competitionId}/scoring-progress`)
      );

      const allResults = await Promise.all([...writes, ...reads]);

      const writeResults = allResults.slice(0, 3);
      const readResults = allResults.slice(3);

      // All writes should succeed
      for (const res of writeResults) {
        expect(res.status).toBe(200);
      }

      // All reads should succeed and return valid progress data
      for (const res of readResults) {
        expect(res.status).toBe(200);
        expect(res.body.heatId).toBe('heat-1');
        expect(res.body.totalJudges).toBe(NUM_JUDGES);
        // submittedCount should be between 0 and NUM_JUDGES
        expect(res.body.submittedCount).toBeGreaterThanOrEqual(0);
        expect(res.body.submittedCount).toBeLessThanOrEqual(NUM_JUDGES);
      }
    });

    it('should maintain data consistency after concurrent operations', async () => {
      // Clear and do a full concurrent run
      await dataService.clearJudgeScores(eventId, 'final');

      // All judges submit with distinct rankings
      const submissions = judgeIds.map((judgeId, jIdx) => {
        const scores = bibs.map((bib, bIdx) => ({
          bib,
          // Each judge gives a different ranking to make scores unique
          score: ((bIdx + jIdx) % NUM_COUPLES) + 1,
        }));
        return request(app)
          .post(`/api/judging/competition/${competitionId}/submit-scores`)
          .send({ judgeId, eventId, round: 'final', scores });
      });

      await Promise.all(submissions);

      // Verify data consistency: each couple should have scores from all judges
      for (const bib of bibs) {
        const judgeScores = await dataService.getJudgeScores(eventId, 'final', bib);
        const judgeCount = Object.keys(judgeScores).length;
        expect(judgeCount).toBe(NUM_JUDGES);

        // Each score should be a valid rank (1 to NUM_COUPLES)
        for (const score of Object.values(judgeScores)) {
          expect(score).toBeGreaterThanOrEqual(1);
          expect(score).toBeLessThanOrEqual(NUM_COUPLES);
        }
      }

      // Verify submission status is complete
      const status = await dataService.getJudgeSubmissionStatus(eventId, 'final');
      for (const judgeId of judgeIds) {
        expect(status[judgeId]).toBe(true);
      }
    });
  });
});
