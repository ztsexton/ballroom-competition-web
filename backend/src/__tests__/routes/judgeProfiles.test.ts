import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Judge Profiles API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/judge-profiles', () => {
    it('should return empty array by default', async () => {
      const res = await request(app).get('/api/judge-profiles').expect(200);
      expect(res.body).toEqual([]);
    });

    it('should return all profiles', async () => {
      await dataService.addJudgeProfile({ firstName: 'John', lastName: 'Doe', certifications: {} });
      await dataService.addJudgeProfile({ firstName: 'Jane', lastName: 'Smith', certifications: {} });
      const res = await request(app).get('/api/judge-profiles').expect(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST /api/judge-profiles', () => {
    it('should create a profile with required fields', async () => {
      const res = await request(app)
        .post('/api/judge-profiles')
        .send({ firstName: 'John', lastName: 'Doe' })
        .expect(201);
      expect(res.body.firstName).toBe('John');
      expect(res.body.lastName).toBe('Doe');
      expect(res.body.id).toBeDefined();
      expect(res.body.certifications).toEqual({});
    });

    it('should create a profile with certifications', async () => {
      const certs = { Smooth: ['Gold', 'Novice'], Latin: ['Gold'] };
      const res = await request(app)
        .post('/api/judge-profiles')
        .send({ firstName: 'Jane', lastName: 'Smith', certifications: certs })
        .expect(201);
      expect(res.body.certifications).toEqual(certs);
    });

    it('should create a profile with email', async () => {
      const res = await request(app)
        .post('/api/judge-profiles')
        .send({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' })
        .expect(201);
      expect(res.body.email).toBe('john@example.com');
    });

    it('should reject missing firstName', async () => {
      await request(app)
        .post('/api/judge-profiles')
        .send({ lastName: 'Doe' })
        .expect(400);
    });

    it('should reject missing lastName', async () => {
      await request(app)
        .post('/api/judge-profiles')
        .send({ firstName: 'John' })
        .expect(400);
    });
  });

  describe('GET /api/judge-profiles/:id', () => {
    it('should get a profile by id', async () => {
      const profile = await dataService.addJudgeProfile({ firstName: 'John', lastName: 'Doe', certifications: {} });
      const res = await request(app).get(`/api/judge-profiles/${profile.id}`).expect(200);
      expect(res.body.firstName).toBe('John');
    });

    it('should return 404 for non-existent profile', async () => {
      await request(app).get('/api/judge-profiles/999').expect(404);
    });
  });

  describe('PATCH /api/judge-profiles/:id', () => {
    it('should update profile fields', async () => {
      const profile = await dataService.addJudgeProfile({ firstName: 'John', lastName: 'Doe', certifications: {} });
      const res = await request(app)
        .patch(`/api/judge-profiles/${profile.id}`)
        .send({ firstName: 'Johnny', email: 'john@example.com' })
        .expect(200);
      expect(res.body.firstName).toBe('Johnny');
      expect(res.body.email).toBe('john@example.com');
    });

    it('should update certifications', async () => {
      const profile = await dataService.addJudgeProfile({ firstName: 'John', lastName: 'Doe', certifications: {} });
      const certs = { Smooth: ['Gold'] };
      const res = await request(app)
        .patch(`/api/judge-profiles/${profile.id}`)
        .send({ certifications: certs })
        .expect(200);
      expect(res.body.certifications).toEqual(certs);
    });

    it('should return 404 for non-existent profile', async () => {
      await request(app)
        .patch('/api/judge-profiles/999')
        .send({ firstName: 'X' })
        .expect(404);
    });
  });

  describe('DELETE /api/judge-profiles/:id', () => {
    it('should delete an existing profile', async () => {
      const profile = await dataService.addJudgeProfile({ firstName: 'John', lastName: 'Doe', certifications: {} });
      await request(app).delete(`/api/judge-profiles/${profile.id}`).expect(204);
      const profiles = await dataService.getJudgeProfiles();
      expect(profiles).toHaveLength(0);
    });

    it('should return 404 for non-existent profile', async () => {
      await request(app).delete('/api/judge-profiles/999').expect(404);
    });
  });
});
