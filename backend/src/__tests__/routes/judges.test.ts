import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Judges API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/judges', () => {
    it('should return empty array when no judges exist', async () => {
      const response = await request(app)
        .get('/api/judges')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all judges with auto-assigned numbers', async () => {
      const competitionId = 1;
      await dataService.addJudge('Judge A', competitionId);
      await dataService.addJudge('Judge B', competitionId);

      const response = await request(app)
        .get('/api/judges')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Judge A');
      expect(response.body[1].name).toBe('Judge B');
    });

    it('should filter by competitionId', async () => {
      const comp1 = await dataService.addCompetition({ name: 'Comp 1', type: 'UNAFFILIATED', date: '2025-01-01' });
      const comp2 = await dataService.addCompetition({ name: 'Comp 2', type: 'UNAFFILIATED', date: '2025-02-01' });

      await dataService.addJudge('A', comp1.id);
      await dataService.addJudge('B', comp2.id);
      await dataService.addJudge('C', comp2.id);

      const response = await request(app)
        .get(`/api/judges?competitionId=${comp2.id}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/judges/:id', () => {
    it('should return judge by ID', async () => {
      const judge = await dataService.addJudge('Judge A', 1);

      const response = await request(app)
        .get(`/api/judges/${judge.id}`)
        .expect(200);

      expect(response.body.name).toBe('Judge A');
    });

    it('should return 404 for missing judge', async () => {
      await request(app)
        .get('/api/judges/999')
        .expect(404);
    });
  });

  describe('POST /api/judges', () => {
    it('should create a judge', async () => {
      const response = await request(app)
        .post('/api/judges')
        .send({ name: 'New Judge', competitionId: 1 })
        .expect(201);

      expect(response.body.name).toBe('New Judge');
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      await request(app)
        .post('/api/judges')
        .send({ competitionId: 1 })
        .expect(400);
    });

    it('should return 400 when competitionId is missing', async () => {
      await request(app)
        .post('/api/judges')
        .send({ name: 'Judge A' })
        .expect(400);
    });
  });

  describe('PATCH /api/judges/:id', () => {
    it('should update judge name', async () => {
      const judge = await dataService.addJudge('Old Name', 1);

      const response = await request(app)
        .patch(`/api/judges/${judge.id}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 for missing judge', async () => {
      await request(app)
        .patch('/api/judges/999')
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('DELETE /api/judges/:id', () => {
    it('should delete judge', async () => {
      const judge = await dataService.addJudge('Judge A', 1);

      await request(app)
        .delete(`/api/judges/${judge.id}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/judges/${judge.id}`)
        .expect(404);
    });

    it('should return 404 for missing judge', async () => {
      await request(app)
        .delete('/api/judges/999')
        .expect(404);
    });
  });
});
