import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Public API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/public/competitions', () => {
    it('should return empty array when no competitions exist', async () => {
      const res = await request(app).get('/api/public/competitions').expect(200);
      expect(res.body).toEqual([]);
    });

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

    it('should filter upcoming competitions with scope=upcoming', async () => {
      await dataService.addCompetition({
        name: 'Past Comp', type: 'NDCA', date: '2020-01-01', publiclyVisible: true,
      });
      await dataService.addCompetition({
        name: 'Future Comp', type: 'NDCA', date: '2099-12-31', publiclyVisible: true,
      });

      const res = await request(app)
        .get('/api/public/competitions?scope=upcoming')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Future Comp');
    });

    it('should filter recent competitions with scope=recent', async () => {
      await dataService.addCompetition({
        name: 'Past Comp', type: 'NDCA', date: '2020-01-01', publiclyVisible: true,
      });
      await dataService.addCompetition({
        name: 'Future Comp', type: 'NDCA', date: '2099-12-31', publiclyVisible: true,
      });

      const res = await request(app)
        .get('/api/public/competitions?scope=recent')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Past Comp');
    });

    it('should return all competitions sorted by date desc without scope', async () => {
      await dataService.addCompetition({
        name: 'Older', type: 'NDCA', date: '2025-01-01', publiclyVisible: true,
      });
      await dataService.addCompetition({
        name: 'Newer', type: 'NDCA', date: '2025-06-01', publiclyVisible: true,
      });

      const res = await request(app)
        .get('/api/public/competitions')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Newer');
      expect(res.body[1].name).toBe('Older');
    });

    it('should sanitize competitions (exclude internal fields)', async () => {
      await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2025-06-01', publiclyVisible: true,
      });

      const res = await request(app)
        .get('/api/public/competitions')
        .expect(200);

      const comp = res.body[0];
      expect(comp.name).toBe('Test');
      expect(comp.id).toBeDefined();
      // Should not include sensitive fields
      expect(comp.resultsPublic).toBeUndefined();
    });
  });

  describe('GET /api/public/competitions/:id', () => {
    it('should return a visible competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Visible', type: 'NDCA', date: '2026-06-01', publiclyVisible: true,
      });

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}`)
        .expect(200);

      expect(res.body.name).toBe('Visible');
    });

    it('should return 404 for competition with publiclyVisible=false', async () => {
      const comp = await dataService.addCompetition({
        name: 'Hidden', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: false,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}`)
        .expect(404);
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999')
        .expect(404);
    });
  });

  describe('GET /api/public/competitions/:id/events', () => {
    it('should return events for a competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/events`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Waltz');
    });

    it('should return empty array when competition has no events', async () => {
      const comp = await dataService.addCompetition({
        name: 'Empty', type: 'NDCA', date: '2026-06-01',
      });

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/events`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999/events')
        .expect(404);
    });

    it('should sanitize events (exclude internal data)', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      await dataService.addEvent('Waltz', [], [], comp.id);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/events`)
        .expect(200);

      const event = res.body[0];
      expect(event.name).toBe('Waltz');
      expect(event.id).toBeDefined();
      // Should not include raw heats data
      expect(event.heats).toBeUndefined();
    });
  });

  describe('GET /api/public/competitions/:id/heats', () => {
    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999/heats')
        .expect(404);
    });

    it('should return 404 for hidden competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Hidden', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: false,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/heats`)
        .expect(404);
    });

    it('should return 403 when heat lists are not published', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
        heatListsPublished: false,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/heats`)
        .expect(403);
    });

    it('should return events with heat details when heat lists are published', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
        heatListsPublished: true,
      });

      const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/heats`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].heats).toBeDefined();
      expect(res.body[0].heats[0].couples).toBeDefined();
      expect(res.body[0].heats[0].couples[0].bib).toBe(couple!.bib);
    });
  });

  describe('GET /api/public/competitions/:id/events/:eventId/results/:round', () => {
    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999/events/1/results/final')
        .expect(404);
    });

    it('should return 403 when resultsPublic is false', async () => {
      const comp = await dataService.addCompetition({
        name: 'Private Results', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: false,
      });

      const event = await dataService.addEvent('Test Event', [], [], comp.id);

      await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(403);
    });

    it('should allow results when resultsPublic is true', async () => {
      const comp = await dataService.addCompetition({
        name: 'Public Results', type: 'NDCA', date: '2026-06-01',
        resultsPublic: true,
      });

      const event = await dataService.addEvent('Test Event', [], [], comp.id);

      const response = await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 404 for non-existent event', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        resultsPublic: true,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/events/999/results/final`)
        .expect(404);
    });

    it('should return detailed results with detail=true', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        resultsPublic: true,
      });

      const event = await dataService.addEvent('Waltz', [], [], comp.id);

      const response = await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final?detail=true`)
        .expect(200);

      expect(response.body.eventName).toBe('Waltz');
      expect(response.body.round).toBe('final');
      expect(response.body.judges).toBeDefined();
      expect(response.body.results).toBeDefined();
    });
  });

  describe('GET /api/public/competitions/:id/search', () => {
    it('should return 400 when dancerName is missing', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/search`)
        .expect(400);
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999/search?dancerName=John')
        .expect(404);
    });

    it('should find events by dancer name', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/search?dancerName=John`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Waltz');
      expect(res.body[0].matchingCouples).toHaveLength(1);
    });

    it('should return empty when no matches found', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/search?dancerName=Nobody`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should search case-insensitively', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/search?dancerName=john`)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });
});
