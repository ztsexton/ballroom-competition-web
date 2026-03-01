import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Settings API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/settings', () => {
    it('should return empty settings by default', async () => {
      const res = await request(app).get('/api/settings').expect(200);
      expect(res.body).toEqual({});
    });

    it('should return previously saved settings', async () => {
      await dataService.updateSiteSettings({ maxJudgeHoursWithoutBreak: 4.5 });
      const res = await request(app).get('/api/settings').expect(200);
      expect(res.body.maxJudgeHoursWithoutBreak).toBe(4.5);
    });
  });

  describe('PATCH /api/settings', () => {
    it('should update maxJudgeHoursWithoutBreak', async () => {
      const res = await request(app)
        .patch('/api/settings')
        .send({ maxJudgeHoursWithoutBreak: 5 })
        .expect(200);
      expect(res.body.maxJudgeHoursWithoutBreak).toBe(5);
    });

    it('should reject value below 0.5', async () => {
      await request(app)
        .patch('/api/settings')
        .send({ maxJudgeHoursWithoutBreak: 0.1 })
        .expect(400);
    });

    it('should reject value above 24', async () => {
      await request(app)
        .patch('/api/settings')
        .send({ maxJudgeHoursWithoutBreak: 25 })
        .expect(400);
    });

    it('should allow clearing the setting with null', async () => {
      await dataService.updateSiteSettings({ maxJudgeHoursWithoutBreak: 5 });
      const res = await request(app)
        .patch('/api/settings')
        .send({ maxJudgeHoursWithoutBreak: null })
        .expect(200);
      expect(res.body.maxJudgeHoursWithoutBreak).toBeUndefined();
    });
  });
});
