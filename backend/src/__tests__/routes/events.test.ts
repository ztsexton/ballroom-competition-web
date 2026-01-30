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
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      dataService.addEvent('Waltz', [couple!.bib], [], competitionId);

      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(Object.keys(response.body)).toHaveLength(1);
      expect(response.body[1].name).toBe('Waltz');
    });

    it('should filter events by competitionId', async () => {
      const comp1 = dataService.addCompetition({ name: 'Comp 1', type: 'UNAFFILIATED', date: '2025-01-01' });
      const comp2 = dataService.addCompetition({ name: 'Comp 2', type: 'UNAFFILIATED', date: '2025-02-01' });

      const l1 = dataService.addPerson({ firstName: 'L1', lastName: 'A', role: 'leader', status: 'student', competitionId: comp1.id });
      const f1 = dataService.addPerson({ firstName: 'F1', lastName: 'A', role: 'follower', status: 'student', competitionId: comp1.id });
      const c1 = dataService.addCouple(l1.id, f1.id, comp1.id);

      const l2 = dataService.addPerson({ firstName: 'L2', lastName: 'B', role: 'leader', status: 'student', competitionId: comp2.id });
      const f2 = dataService.addPerson({ firstName: 'F2', lastName: 'B', role: 'follower', status: 'student', competitionId: comp2.id });
      const c2 = dataService.addCouple(l2.id, f2.id, comp2.id);

      dataService.addEvent('Waltz', [c1!.bib], [], comp1.id);
      dataService.addEvent('Tango', [c2!.bib], [], comp2.id);
      dataService.addEvent('Foxtrot', [c2!.bib], [], comp2.id);

      // Without filter: all 3 events
      const allRes = await request(app).get('/api/events').expect(200);
      expect(Object.keys(allRes.body)).toHaveLength(3);

      // Filter by comp1: 1 event
      const comp1Res = await request(app).get(`/api/events?competitionId=${comp1.id}`).expect(200);
      expect(Object.keys(comp1Res.body)).toHaveLength(1);
      expect(Object.values(comp1Res.body)[0]).toMatchObject({ name: 'Waltz' });

      // Filter by comp2: 2 events
      const comp2Res = await request(app).get(`/api/events?competitionId=${comp2.id}`).expect(200);
      expect(Object.keys(comp2Res.body)).toHaveLength(2);
      const comp2Names = Object.values(comp2Res.body).map((e: any) => e.name).sort();
      expect(comp2Names).toEqual(['Foxtrot', 'Tango']);
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      
      const response = await request(app)
        .post('/api/events')
        .send({
          name: 'Foxtrot',
          bibs: [couple!.bib],
          judgeIds: [],
          competitionId
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
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      const event = dataService.addEvent('Tango', [couple!.bib], [], competitionId);
      
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
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      const event = dataService.addEvent('Quickstep', [couple!.bib], [], competitionId);
      
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
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      const event = dataService.addEvent('Viennese Waltz', [couple!.bib], [], competitionId);
      
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
      const competitionId = 1;
      const leader = dataService.addPerson({ firstName: 'Test', lastName: 'Leader', role: 'leader', status: 'student', competitionId });
      const follower = dataService.addPerson({ firstName: 'Test', lastName: 'Follower', role: 'follower', status: 'student', competitionId });
      const couple = dataService.addCouple(leader.id, follower.id, competitionId);
      const event = dataService.addEvent('Samba', [couple!.bib], [], competitionId);

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

  describe('PATCH /api/events/:id', () => {
    const setupEvent = () => {
      const competitionId = 1;
      const l1 = dataService.addPerson({ firstName: 'L1', lastName: 'A', role: 'leader', status: 'student', competitionId });
      const f1 = dataService.addPerson({ firstName: 'F1', lastName: 'A', role: 'follower', status: 'student', competitionId });
      const l2 = dataService.addPerson({ firstName: 'L2', lastName: 'B', role: 'leader', status: 'student', competitionId });
      const f2 = dataService.addPerson({ firstName: 'F2', lastName: 'B', role: 'follower', status: 'student', competitionId });
      const c1 = dataService.addCouple(l1.id, f1.id, competitionId);
      const c2 = dataService.addCouple(l2.id, f2.id, competitionId);
      const judge = dataService.addJudge('Judge 1', competitionId);
      const event = dataService.addEvent('Waltz', [c1!.bib, c2!.bib], [judge.id], competitionId);
      return { competitionId, c1: c1!, c2: c2!, judge, event };
    };

    it('should update non-structural fields without warning', async () => {
      const { event } = setupEvent();

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ name: 'Updated Waltz', level: 'Gold' })
        .expect(200);

      expect(response.body.name).toBe('Updated Waltz');
      expect(response.body.level).toBe('Gold');
      // Heats unchanged
      expect(response.body.heats).toHaveLength(1);
    });

    it('should return 409 warning when changing bibs with existing scores', async () => {
      const { event, c1 } = setupEvent();
      dataService.setScores(event.id, 'final', c1.bib, [1, 2]);

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ bibs: [c1.bib] }) // removing c2
        .expect(409);

      expect(response.body.warning).toBe(true);
      expect(response.body.changes.bibs).toBe(true);
    });

    it('should return 409 warning when changing judges with existing scores', async () => {
      const { event, c1, competitionId } = setupEvent();
      dataService.setScores(event.id, 'final', c1.bib, [3]);
      const judge2 = dataService.addJudge('Judge 2', competitionId);

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ judgeIds: [judge2.id] })
        .expect(409);

      expect(response.body.warning).toBe(true);
      expect(response.body.changes.judges).toBe(true);
    });

    it('should return 409 warning when changing scoringType with existing scores', async () => {
      const { event, c1 } = setupEvent();
      dataService.setScores(event.id, 'final', c1.bib, [1]);

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ scoringType: 'proficiency' })
        .expect(409);

      expect(response.body.warning).toBe(true);
      expect(response.body.changes.scoringType).toBe(true);
    });

    it('should clear scores and rebuild heats when confirmed', async () => {
      const { event, c1, c2, judge } = setupEvent();
      dataService.setScores(event.id, 'final', c1.bib, [1]);
      dataService.setScores(event.id, 'final', c2.bib, [2]);

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ bibs: [c1.bib], judgeIds: [judge.id], scoringType: 'proficiency', clearScores: true })
        .expect(200);

      expect(response.body.scoringType).toBe('proficiency');
      expect(response.body.heats).toHaveLength(1);
      expect(response.body.heats[0].round).toBe('final');
      expect(response.body.heats[0].bibs).toEqual([c1.bib]);

      // Scores should be cleared
      expect(dataService.getScores(event.id, 'final', c1.bib)).toEqual([]);
      expect(dataService.getScores(event.id, 'final', c2.bib)).toEqual([]);
    });

    it('should allow structural changes without warning when no scores exist', async () => {
      const { event, c1, judge } = setupEvent();

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ bibs: [c1.bib], judgeIds: [judge.id] })
        .expect(200);

      expect(response.body.heats[0].bibs).toEqual([c1.bib]);
    });

    it('should rebuild heats with correct rounds when switching to standard with many couples', async () => {
      const competitionId = 1;
      const bibs: number[] = [];
      for (let i = 0; i < 10; i++) {
        const l = dataService.addPerson({ firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId });
        const f = dataService.addPerson({ firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId });
        const c = dataService.addCouple(l.id, f.id, competitionId);
        bibs.push(c!.bib);
      }
      const event = dataService.addEvent('Prof', bibs, [], competitionId, undefined, undefined, undefined, undefined, undefined, 'proficiency');
      expect(event.heats).toHaveLength(1);

      const response = await request(app)
        .patch(`/api/events/${event.id}`)
        .send({ bibs, scoringType: 'standard' })
        .expect(200);

      // 10 couples standard = semi-final + final
      expect(response.body.heats).toHaveLength(2);
      expect(response.body.heats[0].round).toBe('semi-final');
      expect(response.body.heats[1].round).toBe('final');
      expect(response.body.scoringType).toBe('standard');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app)
        .patch('/api/events/999')
        .send({ name: 'Nope' })
        .expect(404);
    });
  });
});
