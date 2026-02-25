import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Couples API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function createCouple(competitionId = 1) {
    const leader = await dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
    const follower = await dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
    const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
    return { leader, follower, couple: couple! };
  }

  describe('GET /api/couples', () => {
    it('should return empty array when no couples exist', async () => {
      const response = await request(app)
        .get('/api/couples')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all couples', async () => {
      await createCouple();

      const response = await request(app)
        .get('/api/couples')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].bib).toBeDefined();
      expect(response.body[0].leaderName).toBe('Leader A');
      expect(response.body[0].followerName).toBe('Follower B');
    });

    it('should filter by competitionId', async () => {
      const comp1 = await dataService.addCompetition({ name: 'Comp 1', type: 'UNAFFILIATED', date: '2025-01-01' });
      const comp2 = await dataService.addCompetition({ name: 'Comp 2', type: 'UNAFFILIATED', date: '2025-02-01' });

      await createCouple(comp1.id);
      await createCouple(comp2.id);
      await createCouple(comp2.id);

      const response = await request(app)
        .get(`/api/couples?competitionId=${comp2.id}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/couples/:bib', () => {
    it('should return couple by bib', async () => {
      const { couple } = await createCouple();

      const response = await request(app)
        .get(`/api/couples/${couple.bib}`)
        .expect(200);

      expect(response.body.bib).toBe(couple.bib);
    });

    it('should return 404 for missing couple', async () => {
      await request(app)
        .get('/api/couples/999')
        .expect(404);
    });
  });

  describe('POST /api/couples', () => {
    it('should create couple with auto-assigned bib', async () => {
      const competitionId = 1;
      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });

      const response = await request(app)
        .post('/api/couples')
        .send({ leaderId: leader.id, followerId: follower.id, competitionId })
        .expect(201);

      expect(response.body.bib).toBeDefined();
      expect(response.body.leaderId).toBe(leader.id);
      expect(response.body.followerId).toBe(follower.id);
    });

    it('should return 400 when required fields are missing', async () => {
      await request(app)
        .post('/api/couples')
        .send({ leaderId: 1 })
        .expect(400);
    });
  });

  describe('GET /api/couples/:bib/events', () => {
    it('should return events for a couple', async () => {
      const { couple } = await createCouple();
      await dataService.addEvent('Waltz', [couple.bib], [], couple.competitionId);

      const response = await request(app)
        .get(`/api/couples/${couple.bib}/events`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Waltz');
    });

    it('should return 404 for missing couple', async () => {
      await request(app)
        .get('/api/couples/999/events')
        .expect(404);
    });
  });

  describe('POST /api/couples - addCouple returns null', () => {
    it('should return 400 when leader/follower are invalid', async () => {
      const response = await request(app)
        .post('/api/couples')
        .send({ leaderId: 9999, followerId: 9998, competitionId: 1 })
        .expect(400);

      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('GET /api/couples/:bib/eligible-categories', () => {
    it('should return 400 when competitionId is missing', async () => {
      const { couple } = await createCouple();

      const response = await request(app)
        .get(`/api/couples/${couple.bib}/eligible-categories`)
        .expect(400);

      expect(response.body.error).toContain('competitionId');
    });

    it('should return 404 for non-existent couple', async () => {
      await request(app)
        .get('/api/couples/999/eligible-categories?competitionId=1')
        .expect(404);
    });

    it('should return categories when couple exists with DOB', async () => {
      const org = await dataService.addOrganization({
        name: 'Test Org',
        rulePresetKey: 'custom',
        settings: {
          ageCategories: [
            { name: 'Adult', minAge: 18 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01', organizationId: org.id,
      });
      const leader = await dataService.addPerson({
        firstName: 'L', lastName: 'A', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2000-01-01',
      });
      const follower = await dataService.addPerson({
        firstName: 'F', lastName: 'B', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '2000-06-01',
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const response = await request(app)
        .get(`/api/couples/${couple!.bib}/eligible-categories?competitionId=${comp.id}`)
        .expect(200);

      expect(response.body.categories).toBeDefined();
      expect(response.body.leaderAge).toBeDefined();
      expect(response.body.followerAge).toBeDefined();
    });

    it('should return categories without ages when DOB is missing', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const response = await request(app)
        .get(`/api/couples/${couple!.bib}/eligible-categories?competitionId=${comp.id}`)
        .expect(200);

      expect(response.body.categories).toBeDefined();
    });
  });

  describe('DELETE /api/couples/:bib', () => {
    it('should delete couple', async () => {
      const { couple } = await createCouple();

      await request(app)
        .delete(`/api/couples/${couple.bib}`)
        .expect(204);

      // Verify deleted
      await request(app)
        .get(`/api/couples/${couple.bib}`)
        .expect(404);
    });

    it('should fail when couple is in an event', async () => {
      const { couple } = await createCouple();
      await dataService.addEvent('Waltz', [couple.bib], [], couple.competitionId);

      await request(app)
        .delete(`/api/couples/${couple.bib}`)
        .expect(400);
    });

    it('should return 404 for missing couple', async () => {
      await request(app)
        .delete('/api/couples/999')
        .expect(404);
    });
  });
});
