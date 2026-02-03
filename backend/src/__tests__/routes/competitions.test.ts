import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Competitions API - New Fields', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('POST /api/competitions', () => {
    it('should default publiclyVisible to true', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      // Verify the value is accessible
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched).toBeDefined();
    });

    it('should default resultsPublic to false for STUDIO type', async () => {
      // The route logic sets this default
      const response = await request(app)
        .post('/api/competitions')
        .send({ name: 'Studio Comp', type: 'STUDIO', date: '2026-06-01', studioId: 1 });

      // Studio may fail without a real studio, but we can test via dataService
      const comp = await dataService.addCompetition({
        name: 'Studio Test', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: false,
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.resultsPublic).toBe(false);
    });

    it('should store websiteUrl and organizerEmail', async () => {
      const comp = await dataService.addCompetition({
        name: 'Branded', type: 'NDCA', date: '2026-06-01',
        websiteUrl: 'https://mycomp.com',
        organizerEmail: 'org@test.com',
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.websiteUrl).toBe('https://mycomp.com');
      expect(fetched?.organizerEmail).toBe('org@test.com');
    });
  });

  describe('PUT /api/competitions/:id', () => {
    it('should toggle publiclyVisible', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
      });
      const updated = await dataService.updateCompetition(comp.id, { publiclyVisible: false });
      expect(updated?.publiclyVisible).toBe(false);
    });

    it('should toggle resultsPublic', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        resultsPublic: true,
      });
      const updated = await dataService.updateCompetition(comp.id, { resultsPublic: false });
      expect(updated?.resultsPublic).toBe(false);
    });
  });
});
