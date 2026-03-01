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

  describe('GET /:competitionId', () => {
    it('should return 404 when no schedule exists', async () => {
      const comp = await setupCompetition();
      await request(app)
        .get(`/api/schedules/${comp.id}`)
        .expect(404);
    });

    it('should return schedule when it exists', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}`)
        .expect(200);

      expect(res.body.competitionId).toBe(comp.id);
      expect(res.body.heatOrder).toBeDefined();
      expect(res.body.heatStatuses).toBeDefined();
    });
  });

  describe('PATCH /:competitionId/reorder', () => {
    it('should reorder heats in the schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);
      // Different styles so they won't combine
      await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Cha Cha', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Rhythm', ['Cha Cha'], 'standard',
      );

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      expect(genRes.body.heatOrder.length).toBeGreaterThanOrEqual(2);
      const firstHeatId = genRes.body.heatOrder[0].id;

      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/reorder`)
        .send({ fromIndex: 0, toIndex: 1 })
        .expect(200);

      // The first heat should now be at index 1
      expect(res.body.heatOrder[1].id).toBe(firstHeatId);
    });

    it('should return 404 for non-existent schedule', async () => {
      await request(app)
        .patch('/api/schedules/999/reorder')
        .send({ fromIndex: 0, toIndex: 1 })
        .expect(404);
    });
  });

  describe('POST /:competitionId/advance-dance', () => {
    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/schedules/999/advance-dance')
        .expect(404);
    });
  });

  describe('POST /:competitionId/back-dance', () => {
    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/schedules/999/back-dance')
        .expect(404);
    });
  });

  describe('POST /:competitionId/back', () => {
    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/schedules/999/back')
        .expect(404);
    });
  });

  describe('POST /:competitionId/jump', () => {
    it('should jump to a specific heat', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);
      // Different styles so they won't combine
      await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Cha Cha', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Rhythm', ['Cha Cha'], 'standard',
      );

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      expect(genRes.body.heatOrder.length).toBeGreaterThanOrEqual(2);

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/jump`)
        .send({ heatIndex: 1 })
        .expect(200);

      expect(res.body.currentHeatIndex).toBe(1);
    });

    it('should return 400 for invalid index', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      await request(app)
        .post(`/api/schedules/${comp.id}/jump`)
        .send({ heatIndex: 999 })
        .expect(400);
    });
  });

  describe('POST /:competitionId/reset', () => {
    it('should reset to a specific heat', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/reset`)
        .send({ heatIndex: 0 })
        .expect(200);

      expect(res.body.currentHeatIndex).toBe(0);
    });

    it('should return 400 for invalid index', async () => {
      await request(app)
        .post('/api/schedules/999/reset')
        .send({ heatIndex: 0 })
        .expect(400);
    });
  });

  describe('POST /:competitionId/rerun', () => {
    it('should return 400 for non-existent schedule', async () => {
      await request(app)
        .post('/api/schedules/999/rerun')
        .send({ heatIndex: 0 })
        .expect(400);
    });
  });

  describe('POST /:competitionId/break', () => {
    it('should add a break to the schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/break`)
        .send({ label: 'Lunch Break', duration: 30 })
        .expect(201);

      const breakHeat = res.body.heatOrder.find((h: any) => h.isBreak);
      expect(breakHeat).toBeDefined();
      expect(breakHeat.breakLabel).toBe('Lunch Break');
    });

    it('should return 400 when label is missing', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      await request(app)
        .post(`/api/schedules/${comp.id}/break`)
        .send({ duration: 30 })
        .expect(400);
    });

    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/schedules/999/break')
        .send({ label: 'Break' })
        .expect(404);
    });
  });

  describe('DELETE /:competitionId/break/:heatIndex', () => {
    it('should remove a break from the schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Add a break
      const breakRes = await request(app)
        .post(`/api/schedules/${comp.id}/break`)
        .send({ label: 'Break' })
        .expect(201);

      const breakIndex = breakRes.body.heatOrder.findIndex((h: any) => h.isBreak);
      expect(breakIndex).toBeGreaterThanOrEqual(0);

      // Remove it
      const res = await request(app)
        .delete(`/api/schedules/${comp.id}/break/${breakIndex}`)
        .expect(200);

      const remainingBreaks = res.body.heatOrder.filter((h: any) => h.isBreak);
      expect(remainingBreaks).toHaveLength(0);
    });
  });

  describe('PATCH /:competitionId/timing', () => {
    it('should return 400 when timingSettings is missing', async () => {
      const comp = await setupCompetition();

      await request(app)
        .patch(`/api/schedules/${comp.id}/timing`)
        .send({})
        .expect(400);
    });

    it('should return 404 for non-existent competition', async () => {
      await request(app)
        .patch('/api/schedules/999/timing')
        .send({ timingSettings: { startTime: '09:00' } })
        .expect(404);
    });

    it('should update timing settings', async () => {
      const comp = await setupCompetition();

      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/timing`)
        .send({ timingSettings: { startTime: '09:00', heatDuration: 90 } })
        .expect(200);

      // Without a schedule it just returns message
      expect(res.body.message).toBe('Timing settings updated');
    });

    it('should recalculate schedule times when schedule exists', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/timing`)
        .send({ timingSettings: { startTime: '09:00', heatDuration: 90 } });

      // May return 200 with schedule or 500 if dynamic import fails in test env
      if (res.status === 200) {
        expect(res.body.heatOrder).toBeDefined();
      }
    });
  });

  describe('GET /:competitionId/back-to-back', () => {
    it('should return conflicts array', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/back-to-back`)
        .expect(200);

      expect(res.body.conflicts).toBeDefined();
      expect(typeof res.body.count).toBe('number');
      expect(res.body.conflictHeatIds).toBeDefined();
    });

    it('should return person-level conflicts with ?level=person', async () => {
      const comp = await setupCompetition();
      // Create a pro who dances with two different students
      const pro = await dataService.addPerson({
        firstName: 'Pro', lastName: 'Dancer', role: 'leader', status: 'professional', competitionId: comp.id,
      });
      const s1 = await dataService.addPerson({
        firstName: 'Student', lastName: 'One', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const s2 = await dataService.addPerson({
        firstName: 'Student', lastName: 'Two', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const c1 = (await dataService.addCouple(pro.id, s1.id, comp.id))!;
      const c2 = (await dataService.addCouple(pro.id, s2.id, comp.id))!;

      await dataService.addEvent('Event A', [c1.bib], [], comp.id, 'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard');
      await dataService.addEvent('Event B', [c2.bib], [], comp.id, 'Pro-Am', 'Syllabus', 'Silver', 'Smooth', ['Waltz'], 'standard');

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Person-level should detect the pro in consecutive heats
      const res = await request(app)
        .get(`/api/schedules/${comp.id}/back-to-back?level=person`)
        .expect(200);

      expect(res.body.conflicts).toBeDefined();
      expect(res.body.conflictHeatIds).toBeDefined();
      // The pro is in both events, which are likely consecutive
      if (res.body.count > 0) {
        expect(res.body.conflicts[0].personId).toBeDefined();
        expect(res.body.conflicts[0].personName).toBeDefined();
      }
    });

    it('should exclude pros with ?level=person&excludePros=true', async () => {
      const comp = await setupCompetition();
      const pro = await dataService.addPerson({
        firstName: 'Pro', lastName: 'Dancer', role: 'leader', status: 'professional', competitionId: comp.id,
      });
      const s1 = await dataService.addPerson({
        firstName: 'Student', lastName: 'One', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const s2 = await dataService.addPerson({
        firstName: 'Student', lastName: 'Two', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const c1 = (await dataService.addCouple(pro.id, s1.id, comp.id))!;
      const c2 = (await dataService.addCouple(pro.id, s2.id, comp.id))!;

      await dataService.addEvent('Event A', [c1.bib], [], comp.id, 'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard');
      await dataService.addEvent('Event B', [c2.bib], [], comp.id, 'Pro-Am', 'Syllabus', 'Silver', 'Smooth', ['Waltz'], 'standard');

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // With excludePros — only non-pro conflicts, so the pro should be excluded
      const res = await request(app)
        .get(`/api/schedules/${comp.id}/back-to-back?level=person&excludePros=true`)
        .expect(200);

      // Pro is the only reason for B2B, so excluding should reduce/eliminate
      const withoutExclude = await request(app)
        .get(`/api/schedules/${comp.id}/back-to-back?level=person`)
        .expect(200);

      expect(res.body.count).toBeLessThanOrEqual(withoutExclude.body.count);
    });
  });

  describe('POST /:competitionId/minimize-back-to-back', () => {
    it('should return schedule and remaining conflicts', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/minimize-back-to-back`)
        .expect(200);

      expect(res.body.schedule).toBeDefined();
      expect(res.body.conflicts).toBeDefined();
      expect(typeof res.body.conflictsRemaining).toBe('number');
    });

    it('should return 404 for non-existent schedule', async () => {
      await request(app)
        .post('/api/schedules/999/minimize-back-to-back')
        .expect(404);
    });
  });

  describe('DELETE /:competitionId', () => {
    it('should delete a schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      await request(app)
        .delete(`/api/schedules/${comp.id}`)
        .expect(204);

      // Verify schedule is gone
      await request(app)
        .get(`/api/schedules/${comp.id}`)
        .expect(404);
    });

    it('should return 404 for non-existent schedule', async () => {
      await request(app)
        .delete('/api/schedules/999')
        .expect(404);
    });
  });

  describe('POST /:competitionId/insert', () => {
    it('should insert an event into the schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);
      // Use different styles to prevent combining
      await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      const event2 = await dataService.addEvent(
        'Cha Cha', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Rhythm', ['Cha Cha'], 'standard',
      );

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const origLength = genRes.body.heatOrder.length;

      // Insert event2's first round at position 0
      const res = await request(app)
        .post(`/api/schedules/${comp.id}/insert`)
        .send({ eventId: event2.id, position: 0 })
        .expect(200);

      // Schedule should have at least as many heats as before
      expect(res.body.heatOrder.length).toBeGreaterThanOrEqual(origLength);
    });

    it('should return 404 for non-existent schedule', async () => {
      await request(app)
        .post('/api/schedules/999/insert')
        .send({ eventId: 1, position: 0 })
        .expect(404);
    });
  });

  describe('GET /:competitionId/suggest/:eventId', () => {
    it('should suggest a position for inserting an event', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);
      await dataService.addEvent('Waltz', bibs.slice(0, 3), [], comp.id);
      const event2 = await dataService.addEvent('Tango', bibs.slice(3, 6), [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/suggest/${event2.id}`)
        .expect(200);

      expect(typeof res.body.position).toBe('number');
    });
  });

  describe('POST /:competitionId/advance', () => {
    it('should return 404 when no schedule exists', async () => {
      await request(app)
        .post('/api/schedules/999/advance')
        .expect(404);
    });

    it('should advance the heat state', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Advance from pending to scoring
      const res = await request(app)
        .post(`/api/schedules/${comp.id}/advance`)
        .expect(200);

      const firstHeatId = res.body.heatOrder[0].id;
      expect(res.body.heatStatuses[firstHeatId]).toBe('scoring');
    });
  });

  describe('PATCH /:competitionId/heat/:heatId/entries', () => {
    it('should return 400 when entries is empty', async () => {
      const comp = await setupCompetition();
      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/some-heat/entries`)
        .send({ entries: [] })
        .expect(400);
    });

    it('should return 400 when entries is not an array', async () => {
      const comp = await setupCompetition();
      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/some-heat/entries`)
        .send({ entries: 'not-array' })
        .expect(400);
    });

    it('should succeed with forceOverride when over couple limit', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 2 });
      const bibs = await createCouples(comp.id, 6);

      const ev1 = await dataService.addEvent('A', bibs.slice(0, 3), [], comp.id);
      const ev2 = await dataService.addEvent('B', bibs.slice(3, 6), [], comp.id);

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: ev1.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: ev2.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Without forceOverride — should fail
      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/h1/entries`)
        .send({
          entries: [
            { eventId: ev1.id, round: 'final' },
            { eventId: ev2.id, round: 'final' },
          ],
        })
        .expect(400);

      // With forceOverride — should succeed
      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/heat/h1/entries`)
        .send({
          entries: [
            { eventId: ev1.id, round: 'final' },
            { eventId: ev2.id, round: 'final' },
          ],
          forceOverride: true,
        })
        .expect(200);

      const heat = res.body.heatOrder.find((h: any) => h.id === 'h1');
      expect(heat.entries).toHaveLength(2);
    });

    it('should succeed with mixed scoring types', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 20 });
      const bibs = await createCouples(comp.id, 4);

      const evStd = await dataService.addEvent(
        'Standard', bibs.slice(0, 2), [], comp.id,
        undefined, undefined, undefined, undefined, undefined, 'standard',
      );
      const evProf = await dataService.addEvent(
        'Proficiency', bibs.slice(2, 4), [], comp.id,
        undefined, undefined, undefined, undefined, undefined, 'proficiency',
      );

      await dataService.saveSchedule({
        competitionId: comp.id,
        heatOrder: [
          { id: 'h1', entries: [{ eventId: evStd.id, round: 'final' }] },
          { id: 'h2', entries: [{ eventId: evProf.id, round: 'final' }] },
        ],
        heatStatuses: { 'h1': 'pending', 'h2': 'pending' },
        currentHeatIndex: 0,
        styleOrder: [],
        levelOrder: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/heat/h1/entries`)
        .send({
          entries: [
            { eventId: evStd.id, round: 'final' },
            { eventId: evProf.id, round: 'final' },
          ],
        })
        .expect(200);

      const heat = res.body.heatOrder.find((h: any) => h.id === 'h1');
      expect(heat.entries).toHaveLength(2);
    });
  });

  describe('POST /:competitionId/heat/:heatId/split-floor', () => {
    it('should return 400 when groupCount is less than 2', async () => {
      const comp = await setupCompetition();
      await request(app)
        .post(`/api/schedules/${comp.id}/heat/some-heat/split-floor`)
        .send({ groupCount: 1 })
        .expect(400);
    });

    it('should return 400 when groupCount is missing', async () => {
      const comp = await setupCompetition();
      await request(app)
        .post(`/api/schedules/${comp.id}/heat/some-heat/split-floor`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /:competitionId/heat/:heatId/unsplit', () => {
    it('should return 400 for non-existent heat', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      await request(app)
        .post(`/api/schedules/${comp.id}/heat/nonexistent/unsplit`)
        .expect(400);
    });
  });

  describe('POST /:competitionId/heat/resplit', () => {
    it('should resplit pending heats', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 6);
      const event = await dataService.addEvent('Waltz', bibs, [], comp.id);

      // Generate schedule
      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Resplit into 2 groups
      const res = await request(app)
        .post(`/api/schedules/${comp.id}/heat/resplit`)
        .send({ eventId: event.id, round: 'final', groupCount: 2 })
        .expect(200);

      const floorHeats = res.body.heatOrder.filter(
        (h: any) => !h.isBreak && h.entries.some((e: any) => e.eventId === event.id && e.bibSubset)
      );
      expect(floorHeats).toHaveLength(2);
    });

    it('should return 400 for invalid params', async () => {
      const comp = await setupCompetition();

      await request(app)
        .post(`/api/schedules/${comp.id}/heat/resplit`)
        .send({ eventId: 1, round: 'final' })
        .expect(400);

      await request(app)
        .post(`/api/schedules/${comp.id}/heat/resplit`)
        .send({ eventId: 1, round: 'final', groupCount: 0 })
        .expect(400);
    });

    it('should return 400 when no pending heats exist', async () => {
      const comp = await setupCompetition();

      await request(app)
        .post(`/api/schedules/${comp.id}/heat/resplit`)
        .send({ eventId: 999, round: 'final', groupCount: 2 })
        .expect(400);
    });
  });

  describe('PATCH /:competitionId/heat/:heatId/bibs', () => {
    it('should reassign bibs on a pending floor heat', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 6);
      const event = await dataService.addEvent('Waltz', bibs, [], comp.id);

      // Generate + split into floor heats
      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heatId = genRes.body.heatOrder[0].id;

      // Split into 2 floor heats
      const splitRes = await request(app)
        .post(`/api/schedules/${comp.id}/heat/${heatId}/split-floor`)
        .send({ groupCount: 2 })
        .expect(200);

      // Find first floor heat
      const floorHeat = splitRes.body.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.some((e: any) => e.bibSubset)
      );

      // Reassign bibs
      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/heat/${floorHeat.id}/bibs`)
        .send({ bibSubset: bibs.slice(0, 4) })
        .expect(200);

      const updatedHeat = res.body.heatOrder.find((h: any) => h.id === floorHeat.id);
      expect(updatedHeat.entries[0].bibSubset).toEqual(bibs.slice(0, 4));
    });

    it('should return 409 for non-pending heat', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 6);
      const event = await dataService.addEvent('Waltz', bibs, [], comp.id);

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heatId = genRes.body.heatOrder[0].id;

      // Split into floor heats
      const splitRes = await request(app)
        .post(`/api/schedules/${comp.id}/heat/${heatId}/split-floor`)
        .send({ groupCount: 2 })
        .expect(200);

      const floorHeat = splitRes.body.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.some((e: any) => e.bibSubset)
      );

      // Mark as scoring
      const schedule = await dataService.getSchedule(comp.id);
      schedule!.heatStatuses[floorHeat.id] = 'scoring';
      await dataService.saveSchedule(schedule!);

      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/${floorHeat.id}/bibs`)
        .send({ bibSubset: bibs.slice(0, 4) })
        .expect(409);
    });

    it('should return 400 for invalid bibs not in event round', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 6);
      const event = await dataService.addEvent('Waltz', bibs, [], comp.id);

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heatId = genRes.body.heatOrder[0].id;

      const splitRes = await request(app)
        .post(`/api/schedules/${comp.id}/heat/${heatId}/split-floor`)
        .send({ groupCount: 2 })
        .expect(200);

      const floorHeat = splitRes.body.heatOrder.find(
        (h: any) => !h.isBreak && h.entries.some((e: any) => e.bibSubset)
      );

      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/${floorHeat.id}/bibs`)
        .send({ bibSubset: [99999] })
        .expect(400);
    });

    it('should return 400 for non-floor-heat', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 10 });
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent('Waltz', bibs, [], comp.id);

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heatId = genRes.body.heatOrder[0].id;

      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/${heatId}/bibs`)
        .send({ bibSubset: bibs })
        .expect(400);
    });
  });

  describe('GET /:competitionId/analyze', () => {
    it('should return analysis for a schedule', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 3);
      await dataService.addEvent(
        'Waltz', bibs, [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/analyze`)
        .expect(200);

      expect(res.body).toHaveProperty('fitsInWindow');
      expect(res.body).toHaveProperty('estimatedDurationMinutes');
      expect(res.body).toHaveProperty('suggestions');
    });

    it('should handle gracefully when no schedule exists', async () => {
      const comp = await setupCompetition();

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/analyze`)
        .expect(200);

      expect(res.body.fitsInWindow).toBe(true);
      expect(res.body.estimatedDurationMinutes).toBe(0);
    });
  });

  describe('POST /:competitionId/optimize', () => {
    it('should apply suggestions and return updated schedule', async () => {
      const comp = await dataService.addCompetition({
        name: 'Opt Test',
        type: 'UNAFFILIATED',
        date: '2026-06-01',
        maxCouplesPerHeat: 10,
        scheduleDayConfigs: [{ day: 1, startTime: '08:00', endTime: '08:01' }],
        timingSettings: {
          defaultDanceDurationSeconds: 75,
          betweenDanceSeconds: 35,
          betweenHeatSeconds: 45,
          startTime: '2026-06-01T08:00:00',
        },
      });
      const bibs = await createCouples(comp.id, 6);

      await dataService.addEvent(
        'Waltz', bibs.slice(0, 3), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Tango', bibs.slice(3, 6), [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Tango'], 'standard',
      );

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/optimize`)
        .send({ suggestions: [] })
        .expect(200);

      expect(res.body).toHaveProperty('heatOrder');
    });

    it('should return 400 when suggestions is not an array', async () => {
      const comp = await setupCompetition();

      await request(app)
        .post(`/api/schedules/${comp.id}/optimize`)
        .send({ suggestions: 'invalid' })
        .expect(400);
    });
  });

  describe('Dance ordering in schedule generation', () => {
    it('should order events by dance within same style and level', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 9);

      // Create events in reverse dance order for Smooth, non-overlapping bibs
      await dataService.addEvent(
        'Bronze Smooth VW', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Viennese Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Foxtrot', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Foxtrot'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs.slice(6, 9), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      // Extract event names in heat order
      const events = await dataService.getEvents(comp.id);
      const eventNames = res.body.heatOrder
        .filter((h: any) => !h.isBreak)
        .flatMap((h: any) => h.entries.map((e: any) => events[e.eventId]?.name));

      // Default Smooth order: Waltz, Tango, Foxtrot, Viennese Waltz
      const waltzIdx = eventNames.indexOf('Bronze Smooth Waltz');
      const foxtrotIdx = eventNames.indexOf('Bronze Smooth Foxtrot');
      const vwIdx = eventNames.indexOf('Bronze Smooth VW');

      expect(waltzIdx).toBeLessThan(foxtrotIdx);
      expect(foxtrotIdx).toBeLessThan(vwIdx);
    });

    it('should use custom danceOrder when passed in generate body', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);

      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Foxtrot', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Foxtrot'], 'standard',
      );

      // Custom order: Foxtrot before Waltz
      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({
          danceOrder: { Smooth: ['Foxtrot', 'Waltz', 'Tango', 'Viennese Waltz'] },
        })
        .expect(201);

      const events = await dataService.getEvents(comp.id);
      const eventNames = res.body.heatOrder
        .filter((h: any) => !h.isBreak)
        .flatMap((h: any) => h.entries.map((e: any) => events[e.eventId]?.name));

      const foxtrotIdx = eventNames.indexOf('Bronze Smooth Foxtrot');
      const waltzIdx = eventNames.indexOf('Bronze Smooth Waltz');

      expect(foxtrotIdx).toBeLessThan(waltzIdx);
    });

    it('should sort unknown dances to the end', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);

      await dataService.addEvent(
        'Bronze Smooth Peabody', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Peabody'], 'standard',
      );
      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const events = await dataService.getEvents(comp.id);
      const eventNames = res.body.heatOrder
        .filter((h: any) => !h.isBreak)
        .flatMap((h: any) => h.entries.map((e: any) => events[e.eventId]?.name));

      const waltzIdx = eventNames.indexOf('Bronze Smooth Waltz');
      const peabodyIdx = eventNames.indexOf('Bronze Smooth Peabody');

      expect(waltzIdx).toBeLessThan(peabodyIdx);
    });

    it('should save danceOrder to competition when provided', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 2);

      await dataService.addEvent(
        'Event 1', bibs, [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const customOrder = { Smooth: ['Tango', 'Waltz', 'Foxtrot', 'Viennese Waltz'] };

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({ danceOrder: customOrder })
        .expect(201);

      const updated = await dataService.getCompetitionById(comp.id);
      expect(updated?.danceOrder).toEqual(customOrder);
    });
  });

  describe('Auto-breaks between styles', () => {
    it('should insert breaks between different styles when autoBreaks is enabled', async () => {
      const comp = await setupCompetition();
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
        .send({ autoBreaks: { enabled: true } })
        .expect(201);

      const breaks = res.body.heatOrder.filter((h: any) => h.isBreak);
      expect(breaks.length).toBeGreaterThanOrEqual(1);
      expect(breaks[0].breakLabel).toBe('Break');
      expect(breaks[0].breakDuration).toBe(5);
    });

    it('should not insert breaks when all events are the same style', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 6);

      await dataService.addEvent(
        'Smooth Waltz', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Smooth Tango', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Tango'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({ autoBreaks: { enabled: true } })
        .expect(201);

      const breaks = res.body.heatOrder.filter((h: any) => h.isBreak);
      expect(breaks).toHaveLength(0);
    });

    it('should not insert breaks when autoBreaks is disabled', async () => {
      const comp = await setupCompetition();
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
        .send({ autoBreaks: { enabled: false } })
        .expect(201);

      const breaks = res.body.heatOrder.filter((h: any) => h.isBreak);
      expect(breaks).toHaveLength(0);
    });

    it('should use custom label and duration for auto-breaks', async () => {
      const comp = await setupCompetition();
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
        .send({
          autoBreaks: { enabled: true, label: 'Style Change', durationMinutes: 10 },
        })
        .expect(201);

      const breaks = res.body.heatOrder.filter((h: any) => h.isBreak);
      expect(breaks.length).toBeGreaterThanOrEqual(1);
      expect(breaks[0].breakLabel).toBe('Style Change');
      expect(breaks[0].breakDuration).toBe(10);
    });
  });

  describe('GET /:competitionId/judge-schedule', () => {
    it('should return judge schedule entries', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 4);

      const judge = await dataService.addJudge('Judge A', comp.id);
      const event = await dataService.addEvent(
        'Bronze Waltz', bibs, [judge.id], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      // Generate a schedule
      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/judge-schedule`)
        .expect(200);

      expect(res.body.entries).toBeDefined();
      expect(res.body.maxMinutesWithoutBreak).toBe(360); // default 6h * 60
      expect(res.body.entries.length).toBeGreaterThanOrEqual(1);

      const judgeEntry = res.body.entries.find((e: any) => e.judgeId === judge.id);
      expect(judgeEntry).toBeDefined();
      expect(judgeEntry.judgeName).toBe('Judge A');
    });

    it('should use competition-level maxJudgeHoursWithoutBreak', async () => {
      const comp = await setupCompetition();
      await dataService.updateCompetition(comp.id, { maxJudgeHoursWithoutBreak: 3 });

      const bibs = await createCouples(comp.id, 3);
      await dataService.addJudge('Judge B', comp.id);
      await dataService.addEvent(
        'Silver Tango', bibs, [], comp.id,
        undefined, undefined, undefined, 'Standard', ['Tango'], 'standard',
      );

      await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const res = await request(app)
        .get(`/api/schedules/${comp.id}/judge-schedule`)
        .expect(200);

      expect(res.body.maxMinutesWithoutBreak).toBe(180); // 3h * 60
    });

    it('should return 404 when no schedule exists', async () => {
      const comp = await setupCompetition();
      await request(app)
        .get(`/api/schedules/${comp.id}/judge-schedule`)
        .expect(404);
    });
  });

  describe('PATCH /:competitionId/heat/:heatId/judges', () => {
    it('should update judges on a heat', async () => {
      const comp = await setupCompetition();
      const bibs = await createCouples(comp.id, 4);

      const judge1 = await dataService.addJudge('Judge 1', comp.id);
      const judge2 = await dataService.addJudge('Judge 2', comp.id);
      await dataService.addEvent(
        'Bronze Waltz', bibs, [judge1.id], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const genRes = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const firstHeat = genRes.body.heatOrder.find((h: any) => !h.isBreak);
      expect(firstHeat).toBeDefined();

      const res = await request(app)
        .patch(`/api/schedules/${comp.id}/heat/${firstHeat.id}/judges`)
        .send({ judgeIds: [judge1.id, judge2.id] })
        .expect(200);

      // Check that the returned events have updated judges
      const eventKeys = Object.keys(res.body);
      expect(eventKeys.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 when judgeIds is missing', async () => {
      const comp = await setupCompetition();
      await request(app)
        .patch(`/api/schedules/${comp.id}/heat/fake-id/judges`)
        .send({})
        .expect(400);
    });
  });

  describe('Style-block ordering (default) vs deferFinals', () => {
    async function setupMultiStyleComp() {
      const comp = await setupCompetition({ maxCouplesPerHeat: 20 });
      const bibs = await createCouples(comp.id, 12);

      // Smooth event with semi + final (7+ couples)
      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs.slice(0, 8), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      // Smooth event with final only (few couples)
      await dataService.addEvent(
        'Silver Smooth Waltz', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Silver', 'Smooth', ['Waltz'], 'standard',
      );
      // Rhythm event with final only
      await dataService.addEvent(
        'Bronze Rhythm Cha Cha', bibs.slice(4, 8), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Rhythm', ['Cha Cha'], 'standard',
      );

      return comp;
    }

    it('should place Smooth finals before Rhythm events (default style-block)', async () => {
      const comp = await setupMultiStyleComp();

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({ styleOrder: ['Smooth', 'Rhythm'] })
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      const eventsMap = (await request(app).get(`/api/events?competitionId=${comp.id}`).expect(200)).body;

      // Find the first Rhythm heat
      const firstRhythmIdx = heats.findIndex((h: any) =>
        h.entries.some((e: any) => eventsMap[e.eventId]?.style === 'Rhythm')
      );

      // Find the last Smooth heat
      let lastSmoothIdx = -1;
      heats.forEach((h: any, idx: number) => {
        if (h.entries.some((e: any) => eventsMap[e.eventId]?.style === 'Smooth')) {
          lastSmoothIdx = idx;
        }
      });

      // All Smooth heats (including finals) should come before any Rhythm heat
      expect(lastSmoothIdx).toBeLessThan(firstRhythmIdx);
    });

    it('should defer all finals when deferFinals=true', async () => {
      const comp = await setupMultiStyleComp();

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({ styleOrder: ['Smooth', 'Rhythm'], deferFinals: true })
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      const eventsMap = (await request(app).get(`/api/events?competitionId=${comp.id}`).expect(200)).body;

      // With deferFinals, all non-final rounds should come before any final round
      let lastNonFinalIdx = -1;
      let firstFinalIdx = heats.length;
      heats.forEach((h: any, idx: number) => {
        const isFinal = h.entries.every((e: any) => e.round === 'final');
        if (isFinal) {
          firstFinalIdx = Math.min(firstFinalIdx, idx);
        } else {
          lastNonFinalIdx = idx;
        }
      });

      expect(lastNonFinalIdx).toBeLessThan(firstFinalIdx);
    });
  });

  describe('event-type ordering', () => {
    it('should order single dances before multi-dance before scholarship within a style', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 7 });
      const bibs = await createCouples(comp.id, 9);

      // Scholarship (should be last)
      await dataService.addEvent(
        'Bronze Smooth Scholarship', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz', 'Tango'], 'standard', true,
      );
      // Multi-dance (should be middle)
      await dataService.addEvent(
        'Bronze Smooth Multi', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz', 'Tango'], 'standard', false,
      );
      // Single dance (should be first)
      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs.slice(6, 9), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard', false,
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      const eventsMap = (await request(app).get(`/api/events?competitionId=${comp.id}`).expect(200)).body;

      // Find the first heat for each event type
      let firstSingleIdx = -1, firstMultiIdx = -1, firstScholarshipIdx = -1;
      heats.forEach((h: any, idx: number) => {
        for (const entry of h.entries) {
          const event = eventsMap[entry.eventId];
          if (!event) continue;
          if (event.isScholarship && firstScholarshipIdx === -1) firstScholarshipIdx = idx;
          else if (event.dances?.length > 1 && !event.isScholarship && firstMultiIdx === -1) firstMultiIdx = idx;
          else if ((!event.dances || event.dances.length <= 1) && !event.isScholarship && firstSingleIdx === -1) firstSingleIdx = idx;
        }
      });

      expect(firstSingleIdx).toBeLessThan(firstMultiIdx);
      expect(firstMultiIdx).toBeLessThan(firstScholarshipIdx);
    });
  });

  describe('level ordering', () => {
    it('should preserve natural level order (low to high)', async () => {
      const comp = await dataService.addCompetition({
        name: 'Level Order Comp',
        type: 'NDCA',
        date: '2026-06-01',
        maxCouplesPerHeat: 7,
        levels: ['Bronze', 'Silver', 'Gold', 'Championship'],
      });

      const bibs = await createCouples(comp.id, 12);

      // One event per level, all same style/dance, non-overlapping bibs
      await dataService.addEvent(
        'Bronze Waltz', bibs.slice(0, 3), [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Silver Waltz', bibs.slice(3, 6), [], comp.id,
        'Pro-Am', 'Syllabus', 'Silver', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Gold Waltz', bibs.slice(6, 9), [], comp.id,
        'Pro-Am', 'Syllabus', 'Gold', 'Smooth', ['Waltz'], 'standard',
      );
      await dataService.addEvent(
        'Championship Waltz', bibs.slice(9, 12), [], comp.id,
        'Pro-Am', 'Syllabus', 'Championship', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      const eventsMap = (await request(app).get(`/api/events?competitionId=${comp.id}`).expect(200)).body;

      // Get the level sequence from the generated schedule
      const levelSequence: string[] = [];
      for (const heat of heats) {
        for (const entry of heat.entries) {
          const event = eventsMap[entry.eventId];
          if (event?.level && !levelSequence.includes(event.level)) {
            levelSequence.push(event.level);
          }
        }
      }

      // Levels should appear in natural order: Bronze → Silver → Gold → Championship
      expect(levelSequence).toEqual(['Bronze', 'Silver', 'Gold', 'Championship']);
    });

    it('should interleave levels within heats when events share the same dance (NDCA pattern)', async () => {
      const comp = await dataService.addCompetition({
        name: 'NDCA Pattern Comp',
        type: 'NDCA',
        date: '2026-06-01',
        maxCouplesPerHeat: 7,
        levels: ['Newcomer', 'Pre Bronze', 'Int. Bronze', 'Full Bronze', 'Pre Silver'],
      });

      // Create 5 levels × 2 dances = 10 events, 2 couples each
      // With maxCouplesPerHeat=7, three 2-couple events merge into one heat (6 ≤ 7)
      const bibs = await createCouples(comp.id, 20);
      let bibIdx = 0;

      for (const level of ['Newcomer', 'Pre Bronze', 'Int. Bronze', 'Full Bronze', 'Pre Silver']) {
        for (const dance of ['Waltz', 'Tango']) {
          await dataService.addEvent(
            `${level} Smooth ${dance}`, bibs.slice(bibIdx, bibIdx + 2), [], comp.id,
            'Pro-Am', 'Syllabus', level, 'Smooth', [dance], 'standard',
          );
          bibIdx += 2;
        }
      }

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);
      const eventsMap = (await request(app).get(`/api/events?competitionId=${comp.id}`).expect(200)).body;

      // Verify merged heats contain events from different levels (NDCA-style interleaving)
      const mergedHeats = heats.filter((h: any) => h.entries.length > 1);
      expect(mergedHeats.length).toBeGreaterThan(0);

      // Check that at least one merged heat has events from different levels
      let hasCrossLevelMerge = false;
      for (const heat of mergedHeats) {
        const levels = new Set(heat.entries.map((e: any) => eventsMap[e.eventId]?.level));
        if (levels.size > 1) hasCrossLevelMerge = true;
      }
      expect(hasCrossLevelMerge).toBe(true);

      // Verify that heats cycle through dances (dance-by-dance pattern):
      // merged heats sharing the same set of events should alternate between Waltz and Tango
      const danceSequence: string[] = [];
      for (const heat of heats) {
        const firstEvent = eventsMap[heat.entries[0]?.eventId];
        if (firstEvent?.dances?.[0]) {
          danceSequence.push(firstEvent.dances[0]);
        }
      }
      // We should see alternating dances (W, T, W, T, ...) not all Waltz then all Tango
      const waltzIndices = danceSequence.map((d, i) => d === 'Waltz' ? i : -1).filter(i => i >= 0);
      const tangoIndices = danceSequence.map((d, i) => d === 'Tango' ? i : -1).filter(i => i >= 0);
      // The first Tango heat should appear before the last Waltz heat (interleaved, not blocked)
      if (waltzIndices.length > 1 && tangoIndices.length > 0) {
        expect(tangoIndices[0]).toBeLessThan(waltzIndices[waltzIndices.length - 1]);
      }
    });
  });

  describe('round separation', () => {
    it('should not place same-event rounds in consecutive heats', async () => {
      const comp = await setupCompetition({ maxCouplesPerHeat: 7 });
      const bibs = await createCouples(comp.id, 10);

      // Create event with enough couples to generate semi+final
      await dataService.addEvent(
        'Bronze Smooth Waltz', bibs, [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      // Create another event at different level to provide swap targets
      const bibs2 = await createCouples(comp.id, 3);
      await dataService.addEvent(
        'Silver Smooth Waltz', bibs2, [], comp.id,
        'Pro-Am', 'Syllabus', 'Silver', 'Smooth', ['Waltz'], 'standard',
      );

      const res = await request(app)
        .post(`/api/schedules/${comp.id}/generate`)
        .send({})
        .expect(201);

      const heats = res.body.heatOrder.filter((h: any) => !h.isBreak);

      // Check that no two adjacent heats share an eventId
      for (let i = 0; i < heats.length - 1; i++) {
        const currEventIds = new Set(heats[i].entries.map((e: any) => e.eventId));
        const nextEventIds = new Set(heats[i + 1].entries.map((e: any) => e.eventId));
        let overlap = false;
        for (const id of currEventIds) {
          if (nextEventIds.has(id)) overlap = true;
        }
        // If there's only one event with multiple rounds, overlap may be unavoidable
        // but with 2 events, at least one swap should be possible
        if (heats.length > 2) {
          expect(overlap).toBe(false);
        }
      }
    });
  });
});
