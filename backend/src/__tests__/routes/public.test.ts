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
      // resultsPublic should be included (defaults to true)
      expect(comp.resultsPublic).toBe(true);
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

    it('should include place in heats when results are available for finals', async () => {
      const comp = await dataService.addCompetition({
        name: 'Scored', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
        heatListsPublished: true,
        resultsPublic: true,
      });

      // Create 3 couples
      const bibs: number[] = [];
      for (let i = 0; i < 3; i++) {
        const leader = await dataService.addPerson({ firstName: `L${i}`, lastName: 'Test', role: 'leader', status: 'student', competitionId: comp.id });
        const follower = await dataService.addPerson({ firstName: `F${i}`, lastName: 'Test', role: 'follower', status: 'student', competitionId: comp.id });
        const c = await dataService.addCouple(leader.id, follower.id, comp.id);
        bibs.push(c!.bib);
      }

      const judge = await dataService.addJudge('Judge1', comp.id);
      const event = await dataService.addEvent('Waltz Final', bibs, [judge.id], comp.id);

      // Submit final round scores: judge ranks bib[0]=1, bib[1]=2, bib[2]=3
      await request(app)
        .post(`/api/events/${event.id}/scores/final`)
        .send({
          scores: bibs.map((bib, idx) => ({ judgeIndex: 0, bib, score: idx + 1 })),
        })
        .expect(200);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/heats`)
        .expect(200);

      const heatCouples = res.body[0].heats[0].couples;
      // With results, couples should be sorted by placement
      expect(heatCouples[0].place).toBe(1);
      expect(heatCouples[0].bib).toBe(bibs[0]);
      expect(heatCouples[1].place).toBe(2);
      expect(heatCouples[2].place).toBe(3);
    });

    it('should not include results when resultsPublic is false', async () => {
      const comp = await dataService.addCompetition({
        name: 'No Results', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
        heatListsPublished: true,
        resultsPublic: false,
      });

      const leader = await dataService.addPerson({ firstName: 'L', lastName: 'Test', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'F', lastName: 'Test', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const judge = await dataService.addJudge('Judge1', comp.id);
      const event = await dataService.addEvent('Waltz', [couple!.bib], [judge.id], comp.id);

      // Submit scores
      await request(app)
        .post(`/api/events/${event.id}/scores/final`)
        .send({ scores: [{ judgeIndex: 0, bib: couple!.bib, score: 1 }] })
        .expect(200);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/heats`)
        .expect(200);

      // Results should NOT be included
      expect(res.body[0].heats[0].couples[0].place).toBeUndefined();
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

  describe('results visibility filtering', () => {
    it('should return 403 for event results when category is hidden', async () => {
      const comp = await dataService.addCompetition({
        name: 'Selective', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: true,
        resultsVisibility: {
          singleDanceProficiency: false,
          singleDanceStandard: true,
          multiDanceStandard: true,
          multiDanceProficiency: true,
          scholarship: true,
        },
      });

      // Single dance proficiency event (hidden)
      const event = await dataService.addEvent(
        'Bronze Waltz', [], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'proficiency'
      );

      await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(403);
    });

    it('should allow results for visible category', async () => {
      const comp = await dataService.addCompetition({
        name: 'Selective', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: true,
        resultsVisibility: {
          singleDanceProficiency: false,
          singleDanceStandard: true,
          multiDanceStandard: true,
          multiDanceProficiency: true,
          scholarship: true,
        },
      });

      // Multi-dance standard event (visible)
      const event = await dataService.addEvent(
        'Smooth Championship', [], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz', 'Tango'], 'standard'
      );

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter hidden events from person results', async () => {
      const comp = await dataService.addCompetition({
        name: 'Selective', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: true,
        resultsVisibility: {
          singleDanceProficiency: false,
          singleDanceStandard: true,
          multiDanceStandard: true,
          multiDanceProficiency: true,
          scholarship: true,
        },
      });

      const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      const judge = await dataService.addJudge('J1', comp.id);

      // Hidden: single proficiency
      const hiddenEvent = await dataService.addEvent(
        'Bronze Waltz', [couple!.bib], [judge.id], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'proficiency'
      );

      // Visible: single standard
      const visibleEvent = await dataService.addEvent(
        'Gold Waltz', [couple!.bib], [judge.id], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard'
      );

      // Score both events
      await request(app)
        .post(`/api/events/${hiddenEvent.id}/scores/final`)
        .send({ scores: [{ judgeIndex: 0, bib: couple!.bib, score: 85 }] })
        .expect(200);
      await request(app)
        .post(`/api/events/${visibleEvent.id}/scores/final`)
        .send({ scores: [{ judgeIndex: 0, bib: couple!.bib, score: 1 }] })
        .expect(200);

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/people/${leader.id}/results`)
        .expect(200);

      // Should only include the visible event
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].eventName).toBe('Gold Waltz');
    });

    it('should allow all results when resultsVisibility is not set', async () => {
      const comp = await dataService.addCompetition({
        name: 'Default', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: true,
      });

      const event = await dataService.addEvent(
        'Bronze Waltz', [], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'proficiency'
      );

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should hide scholarship results when scholarship is false', async () => {
      const comp = await dataService.addCompetition({
        name: 'No Scholarship', type: 'STUDIO', date: '2026-06-01',
        resultsPublic: true,
        resultsVisibility: {
          singleDanceProficiency: true,
          singleDanceStandard: true,
          multiDanceStandard: true,
          multiDanceProficiency: true,
          scholarship: false,
        },
      });

      const event = await dataService.addEvent(
        'Scholarship Smooth', [], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz', 'Tango'], 'standard', true
      );

      await request(app)
        .get(`/api/public/competitions/${comp.id}/events/${event.id}/results/final`)
        .expect(403);
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

  describe('GET /api/public/competitions/:id/people/:personId/heatlists', () => {
    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .get('/api/public/competitions/999/people/1/heatlists')
        .expect(404);
    });

    it('should return 404 for hidden competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Hidden', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: false,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/people/1/heatlists`)
        .expect(404);
    });

    it('should return 403 when heat lists are not published', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true,
        heatListsPublished: false,
      });
      const person = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/people/${person.id}/heatlists`)
        .expect(403);
    });

    it('should return 404 for person not in this competition', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true, heatListsPublished: true,
      });

      await request(app)
        .get(`/api/public/competitions/${comp.id}/people/999/heatlists`)
        .expect(404);
    });

    it('should return person heatlist grouped by partner when schedule exists', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true, heatListsPublished: true,
      });
      const leader1 = await dataService.addPerson({ firstName: 'Travis', lastName: 'Tuft', role: 'leader', status: 'student', competitionId: comp.id });
      const leader2 = await dataService.addPerson({ firstName: 'Mike', lastName: 'Jones', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Zina', lastName: 'M', role: 'follower', status: 'student', competitionId: comp.id });
      const couple1 = await dataService.addCouple(leader1.id, follower.id, comp.id);
      const couple2 = await dataService.addCouple(leader2.id, follower.id, comp.id);
      const event1 = await dataService.addEvent('Silver Waltz', [couple1!.bib], [], comp.id, undefined, undefined, undefined, 'Smooth');
      const event2 = await dataService.addEvent('Gold Tango', [couple2!.bib], [], comp.id, undefined, undefined, undefined, 'Rhythm');

      // Create a schedule with both events
      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          {
            id: 'h1',
            entries: [{ eventId: event1.id, round: 'final' }],
            estimatedStartTime: '2026-06-01T09:00:00.000Z',
          },
          {
            id: 'h2',
            entries: [{ eventId: event2.id, round: 'final' }],
            estimatedStartTime: '2026-06-01T09:05:00.000Z',
          },
        ],
        styleOrder: [],
        levelOrder: [],
        currentHeatIndex: 0,
        heatStatuses: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Query by follower (shared person across two couples with different leaders/bibs)
      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/people/${follower.id}/heatlists`)
        .expect(200);

      expect(res.body.personId).toBe(follower.id);
      expect(res.body.firstName).toBe('Zina');
      expect(res.body.lastName).toBe('M');
      expect(res.body.partnerships).toHaveLength(2);

      // Check first partnership
      const p1 = res.body.partnerships.find((p: { bib: number }) => p.bib === couple1!.bib);
      expect(p1).toBeDefined();
      expect(p1.partnerName).toBe('Travis Tuft');
      expect(p1.heats).toHaveLength(1);
      expect(p1.heats[0].heatNumber).toBe(1);
      expect(p1.heats[0].eventName).toBe('Silver Waltz');
      expect(p1.heats[0].style).toBe('Smooth');
      expect(p1.heats[0].estimatedTime).toBeDefined();

      // Check second partnership
      const p2 = res.body.partnerships.find((p: { bib: number }) => p.bib === couple2!.bib);
      expect(p2).toBeDefined();
      expect(p2.partnerName).toBe('Mike Jones');
      expect(p2.heats).toHaveLength(1);
      expect(p2.heats[0].heatNumber).toBe(2);
      expect(p2.heats[0].eventName).toBe('Gold Tango');
      expect(p2.heats[0].style).toBe('Rhythm');
    });

    it('should return person data with empty partnerships when no schedule exists', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true, heatListsPublished: true,
      });
      const person = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id,
      });

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/people/${person.id}/heatlists`)
        .expect(200);

      expect(res.body.personId).toBe(person.id);
      expect(res.body.firstName).toBe('John');
      expect(res.body.partnerships).toEqual([]);
    });

    it('should skip break heats in heatlist numbering', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        publiclyVisible: true, heatListsPublished: true,
      });
      const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
      const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      const event1 = await dataService.addEvent('Event A', [couple!.bib], [], comp.id);
      const event2 = await dataService.addEvent('Event B', [couple!.bib], [], comp.id);

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: event1.id, round: 'final' }] },
          { id: 'break1', entries: [], isBreak: true, breakLabel: 'Lunch' },
          { id: 'h2', entries: [{ eventId: event2.id, round: 'final' }] },
        ],
        styleOrder: [],
        levelOrder: [],
        currentHeatIndex: 0,
        heatStatuses: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .get(`/api/public/competitions/${comp.id}/people/${leader.id}/heatlists`)
        .expect(200);

      const heats = res.body.partnerships[0].heats;
      expect(heats).toHaveLength(2);
      // Heat numbers should skip the break: 1, 3 (not 1, 2)
      expect(heats[0].heatNumber).toBe(1);
      expect(heats[1].heatNumber).toBe(3);
    });
  });
});
