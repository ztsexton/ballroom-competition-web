import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';
import { scheduleService } from '../../services/schedule';

describe('Judging API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetitionWithSchedule() {
    const comp = await dataService.addCompetition({ name: 'Test Comp', type: 'UNAFFILIATED', date: '2025-06-01' });
    const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
    const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
    const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
    const judge = await dataService.addJudge('Judge A', comp.id);
    const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], comp.id);

    // Generate a schedule
    const schedule = await scheduleService.generateSchedule(comp.id);

    return { comp, couple: couple!, judge, event, schedule };
  }

  describe('GET /api/judging/competition/:competitionId/active-heat', () => {
    it('should return current heat info with schedule set up', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/active-heat`)
        .expect(200);

      expect(response.body.competitionId).toBe(comp.id);
      expect(response.body.heatId).toBeDefined();
      expect(response.body.entries).toBeDefined();
      expect(response.body.judges).toBeDefined();
    });

    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .get('/api/judging/competition/999/active-heat')
        .expect(404);
    });
  });

  describe('GET /api/judging/competition/:competitionId/scoring-progress', () => {
    it('should return judge submission status', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      // Advance to scoring state
      await scheduleService.advanceHeat(comp.id);

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/scoring-progress`)
        .expect(200);

      expect(response.body.heatId).toBeDefined();
      expect(response.body.judges).toBeDefined();
      expect(response.body.submittedCount).toBeDefined();
      expect(response.body.totalJudges).toBeDefined();
    });

    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .get('/api/judging/competition/999/scoring-progress')
        .expect(404);
    });
  });

  describe('POST /api/judging/competition/:competitionId/submit-scores', () => {
    it('should return 400 when required fields are missing', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      await request(app)
        .post(`/api/judging/competition/${comp.id}/submit-scores`)
        .send({ judgeId: 1 })
        .expect(400);
    });

    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/judging/competition/999/submit-scores')
        .send({ judgeId: 1, eventId: 1, round: 'final', scores: [] })
        .expect(404);
    });

    it('should submit recall marks for a judge in scoring state', async () => {
      const { comp, judge, event, couple } = await setupCompetitionWithSchedule();

      // Advance to scoring state
      await scheduleService.advanceHeat(comp.id);

      const response = await request(app)
        .post(`/api/judging/competition/${comp.id}/submit-scores`)
        .send({
          judgeId: judge.id,
          eventId: event.id,
          round: event.heats[0].round,
          scores: [{ bib: couple.bib, score: 1 }],
        })
        .expect(200);

      expect(response.body.message).toBe('Scores submitted successfully');
    });
  });

  describe('GET /api/judging/competition/:competitionId/judges', () => {
    it('should return judges for a competition', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/judges`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/judging/competition/:competitionId/schedule', () => {
    it('should return schedule (read-only)', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/schedule`)
        .expect(200);

      expect(response.body.heatOrder).toBeDefined();
    });

    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .get('/api/judging/competition/999/schedule')
        .expect(404);
    });
  });

  describe('GET /api/judging/competition/:competitionId/events', () => {
    it('should return events for a competition', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/events`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /api/judging/competition/:competitionId/couples', () => {
    it('should return couples for a competition', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/couples`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/judging/competition/:competitionId/competition', () => {
    it('should return competition details', async () => {
      const { comp } = await setupCompetitionWithSchedule();

      const response = await request(app)
        .get(`/api/judging/competition/${comp.id}/competition`)
        .expect(200);

      expect(response.body.name).toBe('Test Comp');
    });

    it('should return 404 for missing competition', async () => {
      await request(app)
        .get('/api/judging/competition/999/competition')
        .expect(404);
    });
  });
});
