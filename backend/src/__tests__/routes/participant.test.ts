import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Participant API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  // Note: In test environment, auth middleware auto-sets req.user = { uid: 'test-user-id', email: 'test@example.com', isAdmin: true }

  async function setupOpenCompetition() {
    const comp = await dataService.addCompetition({
      name: 'Open Comp',
      type: 'UNAFFILIATED',
      date: '2025-06-01',
      registrationOpen: true,
    });
    return comp;
  }

  describe('GET /api/participant/competitions', () => {
    it('should return only open-registration competitions', async () => {
      await dataService.addCompetition({ name: 'Open', type: 'UNAFFILIATED', date: '2025-01-01', registrationOpen: true });
      await dataService.addCompetition({ name: 'Closed', type: 'UNAFFILIATED', date: '2025-02-01', registrationOpen: false });

      const response = await request(app)
        .get('/api/participant/competitions')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Open');
    });

    it('should return empty when no competitions are open', async () => {
      await dataService.addCompetition({ name: 'Closed', type: 'UNAFFILIATED', date: '2025-01-01', registrationOpen: false });

      const response = await request(app)
        .get('/api/participant/competitions')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/participant/competitions/:id', () => {
    it('should return an open competition', async () => {
      const comp = await setupOpenCompetition();

      const response = await request(app)
        .get(`/api/participant/competitions/${comp.id}`)
        .expect(200);

      expect(response.body.name).toBe('Open Comp');
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({ name: 'Closed', type: 'UNAFFILIATED', date: '2025-01-01', registrationOpen: false });

      await request(app)
        .get(`/api/participant/competitions/${comp.id}`)
        .expect(404);
    });
  });

  describe('POST /api/participant/competitions/:id/register', () => {
    it('should create person linked to user', async () => {
      const comp = await setupOpenCompetition();

      const response = await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'John Doe', role: 'leader' })
        .expect(201);

      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
      expect(response.body.userId).toBe('test-user-id');
    });

    it('should return 400 when name is missing', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ role: 'leader' })
        .expect(400);
    });

    it('should return 400 when role is missing', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'John Doe' })
        .expect(400);
    });

    it('should return 409 when already registered', async () => {
      const comp = await setupOpenCompetition();

      // Register first time
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'John Doe', role: 'leader' })
        .expect(201);

      // Register again
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'John Doe', role: 'leader' })
        .expect(409);
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({ name: 'Closed', type: 'UNAFFILIATED', date: '2025-01-01', registrationOpen: false });

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'John Doe', role: 'leader' })
        .expect(404);
    });
  });

  describe('POST /api/participant/competitions/:id/partner', () => {
    it('should create partner and auto-create couple', async () => {
      const comp = await setupOpenCompetition();

      // Register self first
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader' });

      // Add partner
      const response = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower' })
        .expect(201);

      expect(response.body.partner).toBeDefined();
      expect(response.body.couple).toBeDefined();
      expect(response.body.couple.bib).toBeDefined();
    });

    it('should return 400 when not registered first', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Partner', role: 'follower' })
        .expect(400);
    });

    it('should return 400 when name is missing', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ role: 'follower' })
        .expect(400);
    });
  });

  describe('GET /api/participant/competitions/:id/my-entries', () => {
    it('should return entries for current user', async () => {
      const comp = await setupOpenCompetition();

      // Register and add partner
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader' });

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower' });

      const response = await request(app)
        .get(`/api/participant/competitions/${comp.id}/my-entries`)
        .expect(200);

      expect(response.body.person).toBeDefined();
      expect(response.body.couples).toBeDefined();
    });

    it('should return empty when user not registered', async () => {
      const comp = await setupOpenCompetition();

      const response = await request(app)
        .get(`/api/participant/competitions/${comp.id}/my-entries`)
        .expect(200);

      expect(response.body.person).toBeNull();
      expect(response.body.couples).toEqual([]);
    });
  });

  describe('GET /api/participant/competitions/:id/allowed-levels/:bib', () => {
    it('should return level restrictions when couple belongs to user', async () => {
      const comp = await setupOpenCompetition();

      // Register self and add partner
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader' });

      const partnerRes = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower' });

      const bib = partnerRes.body.couple.bib;

      const response = await request(app)
        .get(`/api/participant/competitions/${comp.id}/allowed-levels/${bib}`)
        .expect(200);

      expect(response.body.validationEnabled).toBeDefined();
      expect(response.body.allLevels).toBeDefined();
    });
  });

  describe('POST /api/participant/competitions/:id/register - email claim', () => {
    it('should claim existing person record by email match', async () => {
      const comp = await setupOpenCompetition();

      // Create a person with matching email but no userId
      await dataService.addPerson({
        firstName: 'Existing', lastName: 'User',
        email: 'test@example.com',
        role: 'leader', status: 'student',
        competitionId: comp.id,
      });

      const response = await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Other Name', role: 'leader' })
        .expect(200);

      // Should claim the existing record, not create new
      expect(response.body.firstName).toBe('Existing');
      expect(response.body.userId).toBe('test-user-id');
    });
  });

  describe('POST /api/participant/competitions/:id/partner - follower registers leader partner', () => {
    it('should set partner as leader when user is follower', async () => {
      const comp = await setupOpenCompetition();

      // Register as follower
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Follower Person', role: 'follower' })
        .expect(201);

      // Add leader partner
      const res = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Leader Partner', role: 'leader' })
        .expect(201);

      expect(res.body.couple).toBeDefined();
      expect(res.body.couple.bib).toBeDefined();
    });
  });

  describe('POST /api/participant/competitions/:id/entries - ownership validation', () => {
    it('should return 403 when couple does not belong to user', async () => {
      const comp = await setupOpenCompetition();

      // Register user
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test User', role: 'leader' })
        .expect(201);

      // Create a couple with different people (not owned by test user)
      const otherLeader = await dataService.addPerson({
        firstName: 'Other', lastName: 'Leader', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const otherFollower = await dataService.addPerson({
        firstName: 'Other', lastName: 'Follower', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const otherCouple = await dataService.addCouple(otherLeader.id, otherFollower.id, comp.id);

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/entries`)
        .send({ bib: otherCouple!.bib, style: 'Smooth' })
        .expect(403);
    });
  });

  describe('DELETE /api/participant/competitions/:id/entries - ownership validation', () => {
    it('should return 403 when couple does not belong to user', async () => {
      const comp = await setupOpenCompetition();

      // Register user
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test User', role: 'leader' })
        .expect(201);

      // Create unowned couple
      const otherLeader = await dataService.addPerson({
        firstName: 'X', lastName: 'Y', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const otherFollower = await dataService.addPerson({
        firstName: 'A', lastName: 'Z', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const otherCouple = await dataService.addCouple(otherLeader.id, otherFollower.id, comp.id);

      await request(app)
        .delete(`/api/participant/competitions/${comp.id}/entries/1/${otherCouple!.bib}`)
        .expect(403);
    });
  });

  describe('GET /api/participant/competitions/:id/allowed-levels/:bib - with validation enabled', () => {
    it('should return allowed levels when entry validation is enabled', async () => {
      const comp = await dataService.addCompetition({
        name: 'Validated Comp', type: 'UNAFFILIATED', date: '2025-06-01',
        registrationOpen: true,
        levels: ['Bronze', 'Silver', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });

      // Register and create couple
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader', level: 'Bronze' });

      const partnerRes = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower', level: 'Bronze' });

      const bib = partnerRes.body.couple.bib;

      const response = await request(app)
        .get(`/api/participant/competitions/${comp.id}/allowed-levels/${bib}`)
        .expect(200);

      expect(response.body.validationEnabled).toBe(true);
      expect(response.body.allowedLevels).toBeDefined();
      expect(response.body.coupleLevel).toBeDefined();
    });

    it('should return 403 for non-existent couple', async () => {
      const comp = await setupOpenCompetition();

      // Register user
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test User', role: 'leader' });

      await request(app)
        .get(`/api/participant/competitions/${comp.id}/allowed-levels/999`)
        .expect(403);
    });
  });

  describe('GET /api/participant/profile', () => {
    it('should return person records for current user', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test User', role: 'leader' });

      const response = await request(app)
        .get('/api/participant/profile')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/participant/competitions/:id/register', () => {
    it('should return 400 when name is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ role: 'leader' })
        .expect(400);
    });

    it('should return 400 when role is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test' })
        .expect(400);
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Closed', type: 'UNAFFILIATED', date: '2025-06-01', registrationOpen: false,
      });
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test', role: 'leader' })
        .expect(404);
    });

    it('should return 409 when already registered', async () => {
      const comp = await setupOpenCompetition();

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test User', role: 'leader' })
        .expect(201);

      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Test Again', role: 'leader' })
        .expect(409);
    });
  });

  describe('POST /api/participant/competitions/:id/partner', () => {
    it('should return 400 when name is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ role: 'follower' })
        .expect(400);
    });

    it('should return 400 when role is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Partner' })
        .expect(400);
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Closed', type: 'UNAFFILIATED', date: '2025-06-01', registrationOpen: false,
      });
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Partner', role: 'follower' })
        .expect(404);
    });

    it('should return 400 when user is not registered yet', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Partner', role: 'follower' })
        .expect(400);
    });

    it('should create partner with follower role when user is leader', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader' })
        .expect(201);

      const res = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower' })
        .expect(201);

      expect(res.body.partner).toBeDefined();
      expect(res.body.couple).toBeDefined();
      expect(res.body.couple.bib).toBeDefined();
    });
  });

  describe('GET /api/participant/competitions/:id/my-entries', () => {
    it('should return empty when user is not registered', async () => {
      const comp = await setupOpenCompetition();
      const res = await request(app)
        .get(`/api/participant/competitions/${comp.id}/my-entries`)
        .expect(200);

      expect(res.body.person).toBeNull();
      expect(res.body.couples).toEqual([]);
    });

    it('should return entries when user is registered with events', async () => {
      const comp = await setupOpenCompetition();

      // Register and add partner
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/register`)
        .send({ name: 'Leader Person', role: 'leader' });

      const partnerRes = await request(app)
        .post(`/api/participant/competitions/${comp.id}/partner`)
        .send({ name: 'Follower Person', role: 'follower' });

      const bib = partnerRes.body.couple.bib;

      // Add couple to an event
      await dataService.addEvent('Waltz', [bib], [], comp.id);

      const res = await request(app)
        .get(`/api/participant/competitions/${comp.id}/my-entries`)
        .expect(200);

      expect(res.body.person).toBeDefined();
      expect(res.body.couples.length).toBeGreaterThan(0);
      expect(res.body.entries.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/participant/competitions/:id/entries', () => {
    it('should return 400 when bib is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/entries`)
        .send({ style: 'Smooth' })
        .expect(400);
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Closed', type: 'UNAFFILIATED', date: '2025-06-01', registrationOpen: false,
      });
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/entries`)
        .send({ bib: 1 })
        .expect(404);
    });

    it('should return 403 when user is not registered in competition', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/entries`)
        .send({ bib: 1 })
        .expect(403);
    });
  });

  describe('DELETE /api/participant/competitions/:id/entries/:eventId/:bib', () => {
    it('should return 403 when user is not registered', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .delete(`/api/participant/competitions/${comp.id}/entries/1/1`)
        .expect(403);
    });
  });

  describe('POST /api/participant/competitions/:id/validate', () => {
    it('should return 400 when bib is missing', async () => {
      const comp = await setupOpenCompetition();
      await request(app)
        .post(`/api/participant/competitions/${comp.id}/validate`)
        .send({})
        .expect(400);
    });

    it('should validate an entry', async () => {
      const comp = await setupOpenCompetition();
      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const res = await request(app)
        .post(`/api/participant/competitions/${comp.id}/validate`)
        .send({ bib: couple!.bib, level: 'Bronze' })
        .expect(200);

      expect(res.body.valid).toBeDefined();
    });
  });

  describe('GET /api/participant/competitions/:id/age-categories', () => {
    it('should return age categories for a competition', async () => {
      const comp = await setupOpenCompetition();
      const res = await request(app)
        .get(`/api/participant/competitions/${comp.id}/age-categories`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 404 for closed competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Closed', type: 'UNAFFILIATED', date: '2025-06-01', registrationOpen: false,
      });
      await request(app)
        .get(`/api/participant/competitions/${comp.id}/age-categories`)
        .expect(404);
    });
  });
});
