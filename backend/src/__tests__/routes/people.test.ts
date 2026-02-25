import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('People API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/people', () => {
    it('should return empty array when no people exist', async () => {
      const response = await request(app)
        .get('/api/people')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all people', async () => {
      const competitionId = 1;
      await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId });
      await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId });

      const response = await request(app)
        .get('/api/people')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should filter by competitionId', async () => {
      const comp1 = await dataService.addCompetition({ name: 'Comp 1', type: 'UNAFFILIATED', date: '2025-01-01' });
      const comp2 = await dataService.addCompetition({ name: 'Comp 2', type: 'UNAFFILIATED', date: '2025-02-01' });

      await dataService.addPerson({ firstName: 'A', lastName: 'B', role: 'leader', status: 'student', competitionId: comp1.id });
      await dataService.addPerson({ firstName: 'C', lastName: 'D', role: 'leader', status: 'student', competitionId: comp2.id });
      await dataService.addPerson({ firstName: 'E', lastName: 'F', role: 'follower', status: 'student', competitionId: comp2.id });

      const response = await request(app)
        .get(`/api/people?competitionId=${comp2.id}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/people/:id', () => {
    it('should return person by ID', async () => {
      const person = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: 1 });

      const response = await request(app)
        .get(`/api/people/${person.id}`)
        .expect(200);

      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
    });

    it('should return 404 for missing person', async () => {
      await request(app)
        .get('/api/people/999')
        .expect(404);
    });
  });

  describe('POST /api/people', () => {
    it('should create a person', async () => {
      const response = await request(app)
        .post('/api/people')
        .send({ firstName: 'John', lastName: 'Doe', role: 'leader', competitionId: 1 })
        .expect(201);

      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
      expect(response.body.role).toBe('leader');
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 when required fields are missing', async () => {
      await request(app)
        .post('/api/people')
        .send({ firstName: 'John' })
        .expect(400);
    });

    it('should return 400 for invalid role', async () => {
      await request(app)
        .post('/api/people')
        .send({ firstName: 'John', lastName: 'Doe', role: 'invalid', competitionId: 1 })
        .expect(400);
    });
  });

  describe('PATCH /api/people/:id', () => {
    it('should update person', async () => {
      const person = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: 1 });

      const response = await request(app)
        .patch(`/api/people/${person.id}`)
        .send({ firstName: 'Jane' })
        .expect(200);

      expect(response.body.firstName).toBe('Jane');
      expect(response.body.lastName).toBe('Doe');
    });

    it('should return 404 for missing person', async () => {
      await request(app)
        .patch('/api/people/999')
        .send({ firstName: 'Jane' })
        .expect(404);
    });
  });

  describe('DELETE /api/people/:id', () => {
    it('should delete person', async () => {
      const person = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: 1 });

      await request(app)
        .delete(`/api/people/${person.id}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/people/${person.id}`)
        .expect(404);
    });

    it('should fail when person is in a couple', async () => {
      const competitionId = 1;
      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
      await dataService.addCouple(leader.id, follower.id, competitionId);

      await request(app)
        .delete(`/api/people/${leader.id}`)
        .expect(400);
    });

    it('should return 404 for missing person', async () => {
      await request(app)
        .delete('/api/people/999')
        .expect(404);
    });
  });
});
