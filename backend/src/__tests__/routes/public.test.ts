import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Public API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/public/competitions', () => {
    it('should exclude competitions with publiclyVisible=false', async () => {
      await dataService.addCompetition({
        name: 'Visible Comp', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
      });
      await dataService.addCompetition({
        name: 'Hidden Comp', type: 'NDCA', date: '2026-06-02',
        publiclyVisible: false,
      });

      const response = await request(app)
        .get('/api/public/competitions')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Visible Comp');
    });

    it('should include competitions without publiclyVisible set (backwards compat)', async () => {
      await dataService.addCompetition({
        name: 'Legacy Comp', type: 'NDCA', date: '2026-06-01',
      });

      const response = await request(app)
        .get('/api/public/competitions')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Legacy Comp');
    });

    it('should include websiteUrl and organizerEmail in response', async () => {
      await dataService.addCompetition({
        name: 'Branded Comp', type: 'NDCA', date: '2026-06-01',
        websiteUrl: 'https://example.com',
        organizerEmail: 'organizer@example.com',
      });

      const response = await request(app)
        .get('/api/public/competitions')
        .expect(200);

      expect(response.body[0].websiteUrl).toBe('https://example.com');
      expect(response.body[0].organizerEmail).toBe('organizer@example.com');
    });
  });

  describe('GET /api/public/competitions/:id', () => {
    it('should return 404 for competition with publiclyVisible=false', async () => {
      const comp = await dataService.addCompetition({
        name: 'Hidden', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: false,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}`)
        .expect(404);
    });
  });

  describe('GET /api/public/competitions/:id/events/:eventId/results/:round', () => {
    it('should return 403 when resultsPublic is false', async () => {
      const comp = await dataService.addCompetition({
        name: 'Private Results', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: false,
      });

      const event = await dataService.addEvent(
        'Test Event', [], [], comp.id,
      );

      await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(403);
    });

    it('should allow results when resultsPublic is true', async () => {
      const comp = await dataService.addCompetition({
        name: 'Public Results', type: 'NDCA', date: '2026-06-01',
        resultsPublic: true,
      });

      const event = await dataService.addEvent(
        'Test Event', [], [], comp.id,
      );

      const response = await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
