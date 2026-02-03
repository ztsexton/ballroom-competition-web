import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Organizations API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/organizations', () => {
    it('should return empty array when no organizations exist', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all organizations', async () => {
      await dataService.addOrganization({ name: 'Org A', rulePresetKey: 'ndca', settings: {} });
      await dataService.addOrganization({ name: 'Org B', rulePresetKey: 'custom', settings: {} });

      const response = await request(app)
        .get('/api/organizations')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/organizations/:id', () => {
    it('should return organization by ID', async () => {
      const org = await dataService.addOrganization({ name: 'Test Org', rulePresetKey: 'ndca', settings: {} });

      const response = await request(app)
        .get(`/api/organizations/${org.id}`)
        .expect(200);

      expect(response.body.name).toBe('Test Org');
      expect(response.body.rulePresetKey).toBe('ndca');
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app)
        .get('/api/organizations/999')
        .expect(404);
    });
  });

  describe('POST /api/organizations', () => {
    it('should create an organization with NDCA preset defaults', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'NDCA Region 1', rulePresetKey: 'ndca' })
        .expect(201);

      expect(response.body.name).toBe('NDCA Region 1');
      expect(response.body.rulePresetKey).toBe('ndca');
      expect(response.body.settings.defaultLevels).toEqual(
        ['Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Champ', 'Championship']
      );
      expect(response.body.settings.defaultScoringType).toBe('standard');
      expect(response.body.settings.defaultMaxCouplesPerHeat).toBe(7);
    });

    it('should create an organization with USA Dance preset defaults', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'USA Dance Chapter', rulePresetKey: 'usadance' })
        .expect(201);

      expect(response.body.settings.defaultLevels).toEqual(
        ['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship']
      );
      expect(response.body.settings.defaultMaxCouplesPerHeat).toBe(6);
    });

    it('should create a custom organization with empty settings', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'My Studio Comp', rulePresetKey: 'custom' })
        .expect(201);

      expect(response.body.settings).toEqual({});
    });

    it('should allow user settings to override preset defaults', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({
          name: 'Custom NDCA',
          rulePresetKey: 'ndca',
          settings: { defaultMaxCouplesPerHeat: 8 },
        })
        .expect(201);

      expect(response.body.settings.defaultMaxCouplesPerHeat).toBe(8);
      // Other defaults still applied
      expect(response.body.settings.defaultLevels).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ rulePresetKey: 'ndca' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when rulePresetKey is missing', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'No Preset' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid rulePresetKey', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Bad Preset', rulePresetKey: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Invalid rulePresetKey');
    });
  });

  describe('PUT /api/organizations/:id', () => {
    it('should update an organization', async () => {
      const org = await dataService.addOrganization({ name: 'Old Name', rulePresetKey: 'custom', settings: {} });

      const response = await request(app)
        .put(`/api/organizations/${org.id}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.name).toBe('New Name');
      expect(response.body.rulePresetKey).toBe('custom');
    });

    it('should return 400 for invalid rulePresetKey on update', async () => {
      const org = await dataService.addOrganization({ name: 'Test', rulePresetKey: 'custom', settings: {} });

      await request(app)
        .put(`/api/organizations/${org.id}`)
        .send({ rulePresetKey: 'invalid' })
        .expect(400);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app)
        .put('/api/organizations/999')
        .send({ name: 'Nope' })
        .expect(404);
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    it('should delete an organization', async () => {
      const org = await dataService.addOrganization({ name: 'Delete Me', rulePresetKey: 'custom', settings: {} });

      await request(app)
        .delete(`/api/organizations/${org.id}`)
        .expect(204);

      // Verify it's gone
      await request(app)
        .get(`/api/organizations/${org.id}`)
        .expect(404);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app)
        .delete('/api/organizations/999')
        .expect(404);
    });
  });
});
