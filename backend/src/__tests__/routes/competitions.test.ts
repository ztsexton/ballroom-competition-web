import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';
import { PendingEntry } from '../../types';

describe('Competitions API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/competitions', () => {
    it('should return empty array when no competitions exist', async () => {
      const res = await request(app).get('/api/competitions').expect(200);
      expect(res.body).toEqual([]);
    });

    it('should return all competitions', async () => {
      await dataService.addCompetition({ name: 'Comp A', type: 'NDCA', date: '2025-03-01' });
      await dataService.addCompetition({ name: 'Comp B', type: 'USA_DANCE', date: '2025-04-01' });

      const res = await request(app).get('/api/competitions').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((c: any) => c.name)).toEqual(expect.arrayContaining(['Comp A', 'Comp B']));
    });
  });

  describe('GET /api/competitions/:id', () => {
    it('should return a competition by id', async () => {
      const comp = await dataService.addCompetition({ name: 'Test Comp', type: 'NDCA', date: '2025-03-01' });

      const res = await request(app).get(`/api/competitions/${comp.id}`).expect(200);
      expect(res.body.name).toBe('Test Comp');
      expect(res.body.type).toBe('NDCA');
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app).get('/api/competitions/999').expect(404);
    });
  });

  describe('POST /api/competitions', () => {
    it('should create a new competition', async () => {
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'New Comp', type: 'NDCA', date: '2025-06-01', location: 'NYC' })
        .expect(201);

      expect(res.body.name).toBe('New Comp');
      expect(res.body.type).toBe('NDCA');
      expect(res.body.location).toBe('NYC');
      expect(res.body.id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      await request(app)
        .post('/api/competitions')
        .send({ type: 'NDCA', date: '2025-06-01' })
        .expect(400);
    });

    it('should return 400 when type is missing', async () => {
      await request(app)
        .post('/api/competitions')
        .send({ name: 'Test', date: '2025-06-01' })
        .expect(400);
    });

    it('should return 400 when date is missing', async () => {
      await request(app)
        .post('/api/competitions')
        .send({ name: 'Test', type: 'NDCA' })
        .expect(400);
    });

    it('should return 400 for invalid competition type', async () => {
      await request(app)
        .post('/api/competitions')
        .send({ name: 'Test', type: 'INVALID', date: '2025-06-01' })
        .expect(400);
    });

    it('should return 400 for STUDIO type without studioId', async () => {
      await request(app)
        .post('/api/competitions')
        .send({ name: 'Studio Comp', type: 'STUDIO', date: '2025-06-01' })
        .expect(400);
    });

    it('should create STUDIO competition with studioId', async () => {
      const studio = await dataService.addStudio({ name: 'Test Studio' });

      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Studio Comp', type: 'STUDIO', date: '2025-06-01', studioId: studio.id })
        .expect(201);

      expect(res.body.type).toBe('STUDIO');
      expect(res.body.studioId).toBe(studio.id);
    });

    it('should default publiclyVisible to true', async () => {
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Test', type: 'NDCA', date: '2025-06-01' })
        .expect(201);

      expect(res.body.publiclyVisible).toBe(true);
    });

    it('should default resultsPublic to false for STUDIO type', async () => {
      const studio = await dataService.addStudio({ name: 'Test Studio' });

      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Studio Comp', type: 'STUDIO', date: '2025-06-01', studioId: studio.id })
        .expect(201);

      expect(res.body.resultsPublic).toBe(false);
    });

    it('should default resultsPublic to true for non-STUDIO type', async () => {
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Test', type: 'NDCA', date: '2025-06-01' })
        .expect(201);

      expect(res.body.resultsPublic).toBe(true);
    });

    it('should accept all valid competition types', async () => {
      const types = ['NDCA', 'USA_DANCE', 'WDC', 'WDSF', 'UNAFFILIATED'];
      for (const type of types) {
        const res = await request(app)
          .post('/api/competitions')
          .send({ name: `${type} Comp`, type, date: '2025-06-01' })
          .expect(201);
        expect(res.body.type).toBe(type);
      }
    });

    it('should default levels for NDCA competition', async () => {
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'NDCA Comp', type: 'NDCA', date: '2025-06-01' })
        .expect(201);

      expect(res.body.levels).toEqual([
        'Newcomer', 'Bronze', 'Silver', 'Gold',
        'Novice', 'Pre-Championship', 'Championship',
      ]);
    });

    it('should default levels for STUDIO competition to simplified', async () => {
      const studio = await dataService.addStudio({ name: 'Test Studio 2' });
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Studio Comp', type: 'STUDIO', date: '2025-06-01', studioId: studio.id })
        .expect(201);

      expect(res.body.levels).toEqual(['Bronze', 'Silver', 'Gold']);
    });

    it('should use explicitly provided levels over defaults', async () => {
      const customLevels = ['Beginner', 'Intermediate', 'Advanced'];
      const res = await request(app)
        .post('/api/competitions')
        .send({ name: 'Custom Comp', type: 'NDCA', date: '2025-06-01', levels: customLevels })
        .expect(201);

      expect(res.body.levels).toEqual(customLevels);
    });

    it('should store optional fields', async () => {
      const res = await request(app)
        .post('/api/competitions')
        .send({
          name: 'Full Comp',
          type: 'NDCA',
          date: '2025-06-01',
          location: 'NYC',
          description: 'A great competition',
          websiteUrl: 'https://example.com',
          organizerEmail: 'org@test.com',
        })
        .expect(201);

      expect(res.body.description).toBe('A great competition');
      expect(res.body.websiteUrl).toBe('https://example.com');
      expect(res.body.organizerEmail).toBe('org@test.com');
    });
  });

  describe('PUT /api/competitions/:id', () => {
    it('should update a competition', async () => {
      const comp = await dataService.addCompetition({ name: 'Old Name', type: 'NDCA', date: '2025-03-01' });

      const res = await request(app)
        .put(`/api/competitions/${comp.id}`)
        .send({ name: 'New Name', location: 'Updated Location' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
      expect(res.body.location).toBe('Updated Location');
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .put('/api/competitions/999')
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/competitions/:id', () => {
    it('should delete a competition', async () => {
      const comp = await dataService.addCompetition({ name: 'To Delete', type: 'NDCA', date: '2025-03-01' });

      await request(app).delete(`/api/competitions/${comp.id}`).expect(204);

      const all = await dataService.getCompetitions();
      expect(all.find(c => c.id === comp.id)).toBeUndefined();
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app).delete('/api/competitions/999').expect(404);
    });
  });

  describe('GET /api/competitions/:id/pending-entries', () => {
    it('should return pending entries for a competition', async () => {
      const comp = await dataService.addCompetition({ name: 'PE Comp', type: 'NDCA', date: '2025-06-01' });

      await dataService.addPendingEntry({
        id: 'pe-1', bib: 10, competitionId: comp.id,
        combination: { level: 'Gold', style: 'Smooth' },
        reason: 'Level too high',
        requestedAt: new Date().toISOString(),
      });
      await dataService.addPendingEntry({
        id: 'pe-2', bib: 20, competitionId: comp.id,
        combination: { level: 'Silver', style: 'Rhythm' },
        reason: 'Needs approval',
        requestedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .get(`/api/competitions/${comp.id}/pending-entries`)
        .expect(200);

      expect(res.body.pendingEntries).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should return empty array when no pending entries', async () => {
      const comp = await dataService.addCompetition({ name: 'Clean', type: 'NDCA', date: '2025-06-01' });

      const res = await request(app)
        .get(`/api/competitions/${comp.id}/pending-entries`)
        .expect(200);

      expect(res.body.pendingEntries).toEqual([]);
      expect(res.body.count).toBe(0);
    });
  });

  describe('POST /api/competitions/:id/pending-entries/:entryId/approve', () => {
    it('should approve pending entry, create event, and remove from queue', async () => {
      const comp = await dataService.addCompetition({
        name: 'Approve Test', type: 'NDCA', date: '2025-06-01',
        registrationOpen: true,
      });

      const leader = await dataService.addPerson({
        firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      const judge = await dataService.addJudge('Judge', comp.id);

      await dataService.addPendingEntry({
        id: 'approve-pe-1', bib: couple!.bib, competitionId: comp.id,
        combination: { level: 'Gold', style: 'Smooth', designation: 'Pro-Am' },
        reason: 'Needs approval',
        requestedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post(`/api/competitions/${comp.id}/pending-entries/approve-pe-1/approve`)
        .expect(200);

      expect(res.body.event).toBeDefined();

      // Verify pending entry was removed
      const remaining = await dataService.getPendingEntries(comp.id);
      expect(remaining).toEqual([]);
    });

    it('should return 404 for non-existent pending entry', async () => {
      const comp = await dataService.addCompetition({ name: 'C', type: 'NDCA', date: '2025-06-01' });

      await request(app)
        .post(`/api/competitions/${comp.id}/pending-entries/nonexistent/approve`)
        .expect(404);
    });
  });

  describe('DELETE /api/competitions/:id/pending-entries/:entryId', () => {
    it('should reject (remove) a pending entry', async () => {
      const comp = await dataService.addCompetition({ name: 'Reject Test', type: 'NDCA', date: '2025-06-01' });

      await dataService.addPendingEntry({
        id: 'reject-pe-1', bib: 10, competitionId: comp.id,
        combination: { level: 'Gold', style: 'Smooth' },
        reason: 'Test',
        requestedAt: new Date().toISOString(),
      });

      await request(app)
        .delete(`/api/competitions/${comp.id}/pending-entries/reject-pe-1`)
        .expect(204);

      const remaining = await dataService.getPendingEntries(comp.id);
      expect(remaining).toEqual([]);
    });

    it('should return 404 for non-existent pending entry', async () => {
      const comp = await dataService.addCompetition({ name: 'C', type: 'NDCA', date: '2025-06-01' });

      await request(app)
        .delete(`/api/competitions/${comp.id}/pending-entries/nonexistent`)
        .expect(404);
    });
  });
});
