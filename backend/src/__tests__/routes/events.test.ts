import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Events API', () => {
  beforeEach(() => {
    dataService.resetAllData();
  });

  describe('GET /api/events', () => {
    it('should return empty object when no events exist', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      expect(response.body).toEqual({});
    });

    it('should return all events', async () => {
      // Create test data
      const leader = dataService.addPerson({ name: 'Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      dataService.addEvent('Waltz', [couple!.bib], []);
      
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      expect(Object.keys(response.body)).toHaveLength(1);
      expect(response.body[1].name).toBe('Waltz');
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const leader = dataService.addPerson({ name: 'Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      
      const response = await request(app)
        .post('/api/events')
        .send({
          name: 'Foxtrot',
          bibs: [couple!.bib],
          judgeIds: [],
        })
        .expect(201);
      
      expect(response.body.name).toBe('Foxtrot');
      expect(response.body.heats).toBeDefined();
      expect(response.body.heats[0].bibs).toContain(couple!.bib);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ bibs: [1] })
        .expect(400);
      
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return event by ID', async () => {
      const leader = dataService.addPerson({ name: 'Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      const event = dataService.addEvent('Tango', [couple!.bib], []);
      
      const response = await request(app)
        .get(`/api/events/${event.id}`)
        .expect(200);
      
      expect(response.body.name).toBe('Tango');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app)
        .get('/api/events/999')
        .expect(404);
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete an event', async () => {
      const leader = dataService.addPerson({ name: 'Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      const event = dataService.addEvent('Quickstep', [couple!.bib], []);
      
      await request(app)
        .delete(`/api/events/${event.id}`)
        .expect(204);
      
      const checkResponse = await request(app)
        .get(`/api/events/${event.id}`)
        .expect(404);
    });
  });

  describe('POST /api/events/:id/scores/:round', () => {
    it('should submit scores for an event round', async () => {
      const leader = dataService.addPerson({ name: 'Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      const event = dataService.addEvent('Viennese Waltz', [couple!.bib], []);
      
      const response = await request(app)
        .post(`/api/events/${event.id}/scores/final`)
        .send({
          scores: [
            { judgeIndex: 0, bib: couple!.bib, score: 1 },
          ],
        })
        .expect(200);
      
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/events/:id/results/:round', () => {
    it('should return results for a scored round', async () => {
      const leader = dataService.addPerson({ name: 'Test Leader', role: 'leader', status: 'student' });
      const follower = dataService.addPerson({ name: 'Test Follower', role: 'follower', status: 'student' });
      const couple = dataService.addCouple(leader.id, follower.id);
      const event = dataService.addEvent('Samba', [couple!.bib], []);
      
      // Add scores
      dataService.setScores(event.id, 'final', couple!.bib, [1, 1, 1]);
      
      const response = await request(app)
        .get(`/api/events/${event.id}/results/final`)
        .expect(200);
      
      expect(response.body).toHaveLength(1);
      expect(response.body[0].bib).toBe(couple!.bib);
      expect(response.body[0].leaderName).toBe('Test Leader');
      expect(response.body[0].followerName).toBe('Test Follower');
    });
  });
});
