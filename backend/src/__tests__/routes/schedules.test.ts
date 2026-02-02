import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Schedules API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  /**
   * Helper: create a competition, N couples, and return their bibs.
   */
  async function setupCompetition(opts?: { maxCouplesPerHeat?: number }) {
    const comp = await dataService.addCompetition({
      name: 'Test Comp',
      type: 'UNAFFILIATED',
      date: '2026-06-01',
      maxCouplesPerHeat: opts?.maxCouplesPerHeat ?? 7,
    });
    return comp;
  }

  async function createCouples(competitionId: number, count: number) {
    const bibs: number[] = [];
    for (let i = 0; i < count; i++) {
      const leader = await dataService.addPerson({
        firstName: `L${i}`, lastName: `Leader`, role: 'leader', status: 'student', competitionId,
      });
      const follower = await dataService.addPerson({
        firstName: `F${i}`, lastName: `Follower`, role: 'follower', status: 'student', competitionId,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, competitionId);
      bibs.push(couple!.bib);
    }
    return bibs;
  }

  describe('POST /:competitionId/generate', () => {
    it('should combine compatible events into multi-entry heats', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 7 });
      const bibs = await createCouples(comp.id, 6);

      // Create two compatible events: same style, same dances, same scoringType
      // Each has 3 couples — together they fit in one heat (3+3 ≤ 7)
      await dataService.addEvent(
        'Bronze Smooth Waltz A', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Waltz B', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const schedule = res.body;
      expect(schedule.heatOrder.length).toBeGreaterThanOrEqual(1);

      // Find a multi-entry heat
      const multiHeat = schedule.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.length > 1,
      );
      expect(multiHeat).toBeDefined();
      expect(multiHeat.entries).toHaveLength(2);

      // Verify events API returns bibs for both events
      const eventsRes = await request(app)
        .get(`/api/events?competitionId=${comp.id}`)
        .expect(200);

      for (const entry of multiHeat.entries) {
        const event = eventsRes.body[entry.eventId];
        expect(event).toBeDefined();

        // The first heat (index 0) always has bibs populated
        const allBibs = new Set<number>();
        for (const heat of event.heats) {
          for (const bib of heat.bibs) allBibs.add(bib);
        }
        expect(allBibs.size).toBeGreaterThan(0);
      }
    });

    it('should not combine incompatible events (different styles)', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 7 });
      const bibs = await createCouples(comp.id, 6);

      await dataService.addEvent(
        'Smooth Waltz', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Rhythm Cha Cha', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Rhythm', ['Cha Cha'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // All heats should be single-entry (different styles can't combine)
      for (const heat of res.body.heatOrder) {
        if (!heat.isBreak) {
          expect(heat.entries).toHaveLength(1);
        }
      }
    });

    it('multi-entry heat entries should have accessible couple counts via event heats', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 9);

      // Three compatible events with 3 couples each → should combine into one heat
      const event1 = await dataService.addEvent(
        'Gold Smooth Waltz A', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Open', 'Gold', 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Gold Smooth Waltz B', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Open', 'Gold', 'Smooth', ['Waltz'], 'standard',
      );
      const event3 = await dataService.addEvent(
        'Gold Smooth Waltz C', bibs.slice(6, 9), [], comp.id,
        'Pro-Am', 'Open', 'Gold', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const multiHeat = res.body.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.length > 1,
      );
      expect(multiHeat).toBeDefined();

      // Fetch events and verify couple counts are accessible for each entry
      const eventsRes = await request(app)
        .get(`/api/events?competitionId=${comp.id}`)
        .expect(200);

      const expectedCounts: Record<number, number> = {
        [event1.id]: 3,
        [event2.id]: 3,
        [event3.id]: 3,
      };

      for (const entry of multiHeat.entries) {
        const event = eventsRes.body[entry.eventId];
        expect(event).toBeDefined();

        // Aggregate bibs across all heats (same pattern as frontend fix)
        const allBibs = new Set<number>();
        for (const heat of event.heats) {
          for (const bib of heat.bibs) allBibs.add(bib);
        }
        expect(allBibs.size).toBe(expectedCounts[entry.eventId]);
      }
    });

    it('multi-round events should have bibs on first round only', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 20 });
      const bibs = await createCouples(comp.id, 16);

      // Two events with 8 couples each → each gets semi-final + final
      // Semi-finals have bibs, finals have empty bibs
      await dataService.addEvent(
        'Champ Smooth Waltz A', bibs.slice(0, 8), [], comp.id,
        'Pro-Am', 'Open', 'Championship', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Champ Smooth Waltz B', bibs.slice(8, 16), [], comp.id,
        'Pro-Am', 'Open', 'Championship', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const eventsRes = await request(app)
        .get(`/api/events?competitionId=${comp.id}`)
        .expect(200);

      // Check that later-round combined heats still allow couple count lookup
      // via first-round bibs aggregation
      for (const heat of res.body.heatOrder) {
        if (heat.isBreak) continue;

        for (const entry of heat.entries) {
          const event = eventsRes.body[entry.eventId];
          expect(event).toBeDefined();

          // Direct round lookup may return 0 for later rounds
          const roundHeat = event.heats.find((h: any) => h.round === entry.round);
          expect(roundHeat).toBeDefined();

          // Aggregated bibs should always show the full count
          const allBibs = new Set<number>();
          for (const h of event.heats) {
            for (const bib of h.bibs) allBibs.add(bib);
          }
          expect(allBibs.size).toBe(8);

          // First-round heats have bibs, later rounds don't
          if (event.heats.indexOf(roundHeat!) === 0) {
            expect(roundHeat!.bibs.length).toBe(8);
          } else {
            expect(roundHeat!.bibs.length).toBe(0);
          }
        }
      }
    });

    it('should not combine events whose total couples exceed maxCouplesPerHeat', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 6 });
      const bibs = await createCouples(comp.id, 8);

      // Two events with 4 couples each (4+4=8 > 6) — should NOT combine
      await dataService.addEvent(
        'Waltz A', bibs.slice(0, 4), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Waltz B', bibs.slice(4, 8), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Should be 2 separate heats, not combined
      const nonBreakHeats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      expect(nonBreakHeats).toHaveLength(2);
      for (const heat of nonBreakHeats) {
        expect(heat.entries).toHaveLength(1);
      }
    });

    it('should not combine later-round entries of large events', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 16);

      // Two events with 8 couples each → semi-final + final
      // Even though final round bibs are empty, they should NOT combine
      // because total event couple count (8+8=16) exceeds maxCouplesPerHeat
      await dataService.addEvent(
        'Champ Waltz A', bibs.slice(0, 8), [], comp.id,
        'Pro-Am', 'Open', 'Championship', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Champ Waltz B', bibs.slice(8, 16), [], comp.id,
        'Pro-Am', 'Open', 'Championship', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // All heats should be single-entry — multi-round events never combine
      for (const heat of res.body.heatOrder) {
        if (!heat.isBreak) {
          expect(heat.entries).toHaveLength(1);
        }
      }
    });

    it('should never combine multi-round events even with high maxCouplesPerHeat', async () => {
      // Set maxCouplesPerHeat very high — multi-round events still must not combine
      const comp = await setupCompetition({ maxCouplesPerHeat: 100 });
      const bibs = await createCouples(comp.id, 14);

      // Two events with 7 couples each → each gets semi-final + final
      // Same style, same dances, same scoringType — but should NOT combine
      await dataService.addEvent(
        'Bronze Smooth Waltz A', bibs.slice(0, 7), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Waltz B', bibs.slice(7, 14), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Should produce 4 single-entry heats (semi+final for each event)
      const nonBreakHeats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      expect(nonBreakHeats).toHaveLength(4);
      for (const heat of nonBreakHeats) {
        expect(heat.entries).toHaveLength(1);
      }
    });

    it('should use default maxCouplesPerHeat of 6 when not configured', async () => {
      // Create competition without specifying maxCouplesPerHeat
      const comp = await dataService.addCompetition({
        name: 'No Max Set',
        type: 'UNAFFILIATED',
        date: '2026-06-01',
      });
      const bibs = await createCouples(comp.id, 8);

      // Two events with 4 couples each (4+4=8 > default 6) — should NOT combine
      await dataService.addEvent(
        'Waltz A', bibs.slice(0, 4), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Waltz B', bibs.slice(4, 8), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // 4+4=8 > 6 (default), so should be separate heats
      const nonBreakHeats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      expect(nonBreakHeats).toHaveLength(2);
      for (const heat of nonBreakHeats) {
        expect(heat.entries).toHaveLength(1);
      }
    });
  });

  describe('POST /:competitionId/heat/:heatId/split', () => {
    it('should split an entry out of a multi-entry heat', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 7 });
      const bibs = await createCouples(comp.id, 6);

      const event1 = await dataService.addEvent(
        'Waltz A', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Waltz B', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      // Generate schedule — should combine
      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const multiHeat = genRes.body.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.length > 1,
      );
      expect(multiHeat).toBeDefined();

      // Split the second event out
      const splitEntry = multiHeat.entries.find(
        (e: any) => e.eventId === event2.id,
      );

      const splitRes = await request(app)
        .post(`/api/schedules/${comp.id}/heat/${multiHeat.id}/split`)
        .send({ eventId: splitEntry.eventId, round: splitEntry.round })
        .expect(200);

      // Original heat should now have 1 entry
      const originalHeat = splitRes.body.heatOrder.find(
        (h: any) => h.id === multiHeat.id,
      );
      expect(originalHeat.entries).toHaveLength(1);
      expect(originalHeat.entries[0].eventId).toBe(event1.id);

      // New heat should have the split entry
      const newHeat = splitRes.body.heatOrder.find(
        (h: any) => h.id !== multiHeat.id && !h.isBreak && h.entries.some((e: any) => e.eventId === event2.id),
      );
      expect(newHeat).toBeDefined();
      expect(newHeat.entries).toHaveLength(1);
    });
  });
});
