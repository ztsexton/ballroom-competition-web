import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Studios API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/studios', () => {
    it('should return empty array when no studios exist', async () => {
      const res = await request(app).get('/api/studios').expect(200);
      expect(res.body).toEqual([]);
    });

    it('should return all studios', async () => {
      await dataService.addStudio({ name: 'Studio A', location: 'NYC' });
      await dataService.addStudio({ name: 'Studio B', location: 'LA' });

      const res = await request(app).get('/api/studios').expect(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /api/studios/:id', () => {
    it('should return a studio by id', async () => {
      const studio = await dataService.addStudio({ name: 'Test Studio', location: 'Chicago' });

      const res = await request(app).get(`/api/studios/${studio.id}`).expect(200);
      expect(res.body.name).toBe('Test Studio');
      expect(res.body.location).toBe('Chicago');
    });

    it('should return 404 for non-existent studio', async () => {
      await request(app).get('/api/studios/999').expect(404);
    });
  });

  describe('POST /api/studios', () => {
    it('should create a new studio', async () => {
      const res = await request(app)
        .post('/api/studios')
        .send({ name: 'New Studio', location: 'Boston', contactInfo: 'info@studio.com' })
        .expect(201);

      expect(res.body.name).toBe('New Studio');
      expect(res.body.location).toBe('Boston');
      expect(res.body.id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      await request(app)
        .post('/api/studios')
        .send({ location: 'NYC' })
        .expect(400);
    });
  });

  describe('PUT /api/studios/:id', () => {
    it('should update a studio', async () => {
      const studio = await dataService.addStudio({ name: 'Old Name' });

      const res = await request(app)
        .put(`/api/studios/${studio.id}`)
        .send({ name: 'New Name', location: 'Updated' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('should return 404 for non-existent studio', async () => {
      await request(app)
        .put('/api/studios/999')
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/studios/:id', () => {
    it('should delete a studio', async () => {
      const studio = await dataService.addStudio({ name: 'To Delete' });

      await request(app).delete(`/api/studios/${studio.id}`).expect(204);

      const all = await dataService.getStudios();
      expect(all.find(s => s.id === studio.id)).toBeUndefined();
    });

    it('should return 404 for non-existent studio', async () => {
      await request(app).delete('/api/studios/999').expect(404);
    });
  });
});
