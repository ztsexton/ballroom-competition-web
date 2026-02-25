import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Database API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/database/health', () => {
    it('should return connected: true', async () => {
      const res = await request(app).get('/api/database/health');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });
  });

  describe('POST /api/database/seed', () => {
    it('should return 400 when postgres is not configured', async () => {
      const res = await request(app).post('/api/database/seed');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Postgres not configured/);
    });
  });

  describe('POST /api/database/migrate', () => {
    it('should return success when no migration needed (non-postgres)', async () => {
      const res = await request(app).post('/api/database/migrate');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
