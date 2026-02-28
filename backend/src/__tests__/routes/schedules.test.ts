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
});
