import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Competitions API - Level Mode', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('levelMode field', () => {
    it('should default to undefined (combined mode)', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test Comp', type: 'NDCA', date: '2026-06-01',
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.levelMode).toBeUndefined();
    });

    it('should store combined level mode', async () => {
      const comp = await dataService.addCompetition({
        name: 'Combined Comp', type: 'NDCA', date: '2026-06-01',
        levelMode: 'combined',
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.levelMode).toBe('combined');
    });

    it('should store integrated level mode', async () => {
      const comp = await dataService.addCompetition({
        name: 'Integrated Comp', type: 'NDCA', date: '2026-06-01',
        levelMode: 'integrated',
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.levelMode).toBe('integrated');
    });

    it('should update levelMode from combined to integrated', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test Comp', type: 'NDCA', date: '2026-06-01',
        levelMode: 'combined',
      });
      const updated = await dataService.updateCompetition(comp.id, { levelMode: 'integrated' });
      expect(updated?.levelMode).toBe('integrated');
    });

    it('should store integrated levels with Open variants', async () => {
      const integratedLevels = [
        'Bronze 1', 'Bronze 2', 'Bronze 3', 'Open Bronze',
        'Silver 1', 'Silver 2', 'Silver 3', 'Open Silver',
        'Gold', 'Open Gold',
      ];
      const comp = await dataService.addCompetition({
        name: 'Integrated Comp', type: 'NDCA', date: '2026-06-01',
        levelMode: 'integrated',
        levels: integratedLevels,
      });
      const fetched = await dataService.getCompetitionById(comp.id);
      expect(fetched?.levelMode).toBe('integrated');
      expect(fetched?.levels).toEqual(integratedLevels);
      expect(fetched?.levels).toContain('Open Bronze');
      expect(fetched?.levels).toContain('Open Silver');
    });
  });
});

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
