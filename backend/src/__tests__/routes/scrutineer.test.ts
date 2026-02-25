import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Scrutineer API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupEventWithJudges() {
    const competitionId = 1;
    const leader = await dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
    const follower = await dataService.addPerson({ firstName: 'Follower', lastName: 'A', role: 'follower', status: 'student', competitionId });
    const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
    const judge1 = await dataService.addJudge('Judge A', competitionId);
    const judge2 = await dataService.addJudge('Judge B', competitionId);
    const event = await dataService.addEvent('Waltz', [couple!.bib], [judge1.id, judge2.id], competitionId);
    return { competitionId, couple: couple!, judge1, judge2, event };
  }

  describe('GET /api/scrutineer/events/:eventId/rounds/:round/judge-scores', () => {
    it('should return judges, bibs, and scores structure for single-dance event', async () => {
      const { event } = await setupEventWithJudges();

      const response = await request(app)
        .get(`/api/scrutineer/events/${event.id}/rounds/final/judge-scores`)
        .expect(200);

      expect(response.body.eventId).toBe(event.id);
      expect(response.body.round).toBe('final');
      expect(response.body.bibs).toBeDefined();
      expect(response.body.judges).toHaveLength(2);
      expect(response.body.scoresByBib).toBeDefined();
      expect(response.body.dances).toEqual([]);
    });

    it('should return 404 for missing event', async () => {
      await request(app)
        .get('/api/scrutineer/events/999/rounds/final/judge-scores')
        .expect(404);
    });

    it('should return 404 for missing round', async () => {
      const { event } = await setupEventWithJudges();

      await request(app)
        .get(`/api/scrutineer/events/${event.id}/rounds/quarter-final/judge-scores`)
        .expect(404);
    });

    it('should return danceScoresByBib for multi-dance event', async () => {
      const competitionId = 1;
      const leader = await dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'Follower', lastName: 'A', role: 'follower', status: 'student', competitionId });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      const judge = await dataService.addJudge('Judge A', competitionId);
      const event = await dataService.addEvent(
        'Multi Dance', [couple!.bib], [judge.id], competitionId,
        undefined, undefined, undefined, undefined, ['waltz', 'tango'],
      );

      const response = await request(app)
        .get(`/api/scrutineer/events/${event.id}/rounds/final/judge-scores`)
        .expect(200);

      expect(response.body.dances).toEqual(['waltz', 'tango']);
      expect(response.body.danceScoresByBib).toBeDefined();
    });
  });

  describe('POST /api/scrutineer/events/:eventId/rounds/:round/submit-scores', () => {
    it('should submit scores for one judge', async () => {
      const { event, judge1, couple } = await setupEventWithJudges();

      const response = await request(app)
        .post(`/api/scrutineer/events/${event.id}/rounds/final/submit-scores`)
        .send({
          judgeId: judge1.id,
          scores: [{ bib: couple.bib, score: 1 }],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 when judgeId is missing', async () => {
      const { event } = await setupEventWithJudges();

      await request(app)
        .post(`/api/scrutineer/events/${event.id}/rounds/final/submit-scores`)
        .send({ scores: [{ bib: 1, score: 1 }] })
        .expect(400);
    });

    it('should return 400 when scores is missing', async () => {
      const { event, judge1 } = await setupEventWithJudges();

      await request(app)
        .post(`/api/scrutineer/events/${event.id}/rounds/final/submit-scores`)
        .send({ judgeId: judge1.id })
        .expect(400);
    });
  });

  describe('POST /api/scrutineer/events/:eventId/rounds/:round/compile', () => {
    it('should compile scores and return results', async () => {
      const { event, judge1, judge2, couple } = await setupEventWithJudges();

      // Submit scores for both judges first
      await dataService.setJudgeScoresBatch(event.id, 'final', judge1.id, [{ bib: couple.bib, score: 1 }]);
      await dataService.setJudgeScoresBatch(event.id, 'final', judge2.id, [{ bib: couple.bib, score: 1 }]);

      const response = await request(app)
        .post(`/api/scrutineer/events/${event.id}/rounds/final/compile`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
    });
  });
});
