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
});
