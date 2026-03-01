import { dataService } from '../../services/dataService';
import { autoAssignJudges } from '../../services/schedule/judgeAssignment';
import { CompetitionSchedule, ScheduledHeat, Event } from '../../types';

describe('autoAssignJudges', () => {
  let competitionId: number;

  beforeEach(async () => {
    await dataService.resetAllData();
    const comp = await dataService.addCompetition({
      name: 'Test Comp',
      type: 'NDCA',
      date: '2026-03-01',
      judgeSettings: { defaultCount: 3, levelOverrides: {} },
    });
    competitionId = comp.id;
  });

  async function addJudges(count: number, profileIds?: number[]): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const judge = await dataService.addJudge(`Judge ${i + 1}`, competitionId);
      if (profileIds && profileIds[i]) {
        await dataService.updateJudge(judge.id, { profileId: profileIds[i] });
      }
      ids.push(judge.id);
    }
    return ids;
  }

  async function createEvent(level?: string, style?: string): Promise<Event> {
    return dataService.addEvent(`Event-${level || 'default'}`, [1], [], competitionId, undefined, undefined, level, style);
  }

  async function createSchedule(heats: ScheduledHeat[]): Promise<CompetitionSchedule> {
    return dataService.saveSchedule({
      competitionId,
      heatOrder: heats,
      styleOrder: [],
      levelOrder: [],
      currentHeatIndex: 0,
      heatStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function makeHeat(eventId: number, round: string, opts?: { isBreak?: boolean; durationSec?: number }): ScheduledHeat {
    return {
      id: `heat-${eventId}-${round}-${Math.random().toString(36).slice(2)}`,
      entries: opts?.isBreak ? [] : [{ eventId, round }],
      isBreak: opts?.isBreak,
      estimatedDurationSeconds: opts?.durationSec || 120,
    };
  }

  it('should assign all judges when count equals required', async () => {
    const judgeIds = await addJudges(3);
    const event = await createEvent('Bronze', 'Smooth');
    await createSchedule([makeHeat(event.id, 'final')]);

    await autoAssignJudges(competitionId);

    const updated = await dataService.getEventById(event.id);
    expect(updated!.heats[0].judges).toHaveLength(3);
    expect(updated!.heats[0].judges.sort()).toEqual(judgeIds.sort());
  });

  it('should use defaultCount judges when fewer than total available', async () => {
    await addJudges(7);
    const event = await createEvent('Bronze', 'Smooth');
    await createSchedule([makeHeat(event.id, 'final')]);

    await autoAssignJudges(competitionId);

    const updated = await dataService.getEventById(event.id);
    expect(updated!.heats[0].judges).toHaveLength(3); // defaultCount = 3
  });

  it('should use levelOverrides when specified', async () => {
    await dataService.updateCompetition(competitionId, {
      judgeSettings: { defaultCount: 3, levelOverrides: { Championship: 5 } },
    });
    await addJudges(7);
    const event = await createEvent('Championship', 'Smooth');
    await createSchedule([makeHeat(event.id, 'final')]);

    await autoAssignJudges(competitionId);

    const updated = await dataService.getEventById(event.id);
    expect(updated!.heats[0].judges).toHaveLength(5);
  });

  it('should rotate judges after target stint expires', async () => {
    await dataService.updateCompetition(competitionId, {
      judgeSettings: { defaultCount: 3, levelOverrides: {}, targetStintMinutes: 5 },
    });
    await addJudges(5);

    // Create separate events so each heat has its own judges array
    const events: Event[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(await createEvent('Bronze', 'Smooth'));
    }

    const heats: ScheduledHeat[] = events.map(ev =>
      makeHeat(ev.id, 'final', { durationSec: 120 })
    );
    await createSchedule(heats);

    await autoAssignJudges(competitionId);

    // Collect all unique judges across all events
    const allAssigned = new Set<number>();
    for (const ev of events) {
      const updated = await dataService.getEventById(ev.id);
      if (updated) {
        updated.heats[0].judges.forEach(j => allAssigned.add(j));
      }
    }
    // With 5 judges available and 3 per heat, rotation after 5-min stint means
    // more than 3 unique judges should be used across 6 heats (720 sec > 300 sec stint)
    expect(allAssigned.size).toBeGreaterThan(3);
  });

  it('should reset work timers on breaks', async () => {
    await dataService.updateCompetition(competitionId, {
      judgeSettings: { defaultCount: 3, levelOverrides: {}, targetStintMinutes: 4 },
    });
    await addJudges(5);

    // Create separate events for each heat
    const ev1 = await createEvent('Bronze', 'Smooth');
    const ev2 = await createEvent('Bronze', 'Smooth');
    const ev3 = await createEvent('Bronze', 'Smooth');
    const ev4 = await createEvent('Bronze', 'Smooth');

    const heats: ScheduledHeat[] = [
      makeHeat(ev1.id, 'final', { durationSec: 120 }),
      makeHeat(ev2.id, 'final', { durationSec: 120 }),
      { id: 'break-1', entries: [], isBreak: true, breakLabel: 'Break' },
      makeHeat(ev3.id, 'final', { durationSec: 120 }),
      makeHeat(ev4.id, 'final', { durationSec: 120 }),
    ];
    await createSchedule(heats);

    await autoAssignJudges(competitionId);

    // Each event should have 3 judges assigned
    for (const ev of [ev1, ev2, ev3, ev4]) {
      const updated = await dataService.getEventById(ev.id);
      expect(updated!.heats[0].judges).toHaveLength(3);
    }
  });

  it('should handle empty schedule', async () => {
    await addJudges(3);
    await createSchedule([]);
    // Should not throw
    await autoAssignJudges(competitionId);
  });

  it('should handle no judges', async () => {
    const event = await createEvent('Bronze', 'Smooth');
    await createSchedule([makeHeat(event.id, 'final')]);
    // Should not throw
    await autoAssignJudges(competitionId);
  });

  it('should handle no schedule', async () => {
    await addJudges(3);
    // No schedule saved
    await autoAssignJudges(competitionId);
    // Should not throw
  });

  describe('qualification filtering', () => {
    it('should only assign qualified judges to high-level heats', async () => {
      // Create 2 profiles: one certified for Championship Smooth, one not
      const profile1 = await dataService.addJudgeProfile({
        firstName: 'A', lastName: 'Judge',
        certifications: { Smooth: ['Gold', 'Novice', 'Pre-Championship', 'Championship'] },
      });
      const profile2 = await dataService.addJudgeProfile({
        firstName: 'B', lastName: 'Judge',
        certifications: {},
      });
      const profile3 = await dataService.addJudgeProfile({
        firstName: 'C', lastName: 'Judge',
        certifications: { Smooth: ['Gold', 'Championship'] },
      });

      await dataService.updateCompetition(competitionId, {
        judgeSettings: { defaultCount: 2, levelOverrides: {} },
      });

      // Create judges linked to profiles
      const j1 = await dataService.addJudge('A Judge', competitionId);
      await dataService.updateJudge(j1.id, { profileId: profile1.id });
      const j2 = await dataService.addJudge('B Judge', competitionId);
      await dataService.updateJudge(j2.id, { profileId: profile2.id });
      const j3 = await dataService.addJudge('C Judge', competitionId);
      await dataService.updateJudge(j3.id, { profileId: profile3.id });

      const event = await createEvent('Championship', 'Smooth');
      await createSchedule([makeHeat(event.id, 'final')]);

      await autoAssignJudges(competitionId);

      const updated = await dataService.getEventById(event.id);
      const assignedJudges = updated!.heats[0].judges;

      // Judge B (no certs) should NOT be assigned to Championship heat
      expect(assignedJudges).not.toContain(j2.id);
      // Judges A and C are qualified
      expect(assignedJudges).toHaveLength(2);
      expect(assignedJudges).toContain(j1.id);
      expect(assignedJudges).toContain(j3.id);
    });

    it('should allow all judges for Silver-level heats', async () => {
      const profile1 = await dataService.addJudgeProfile({
        firstName: 'A', lastName: 'Judge', certifications: {},
      });

      await dataService.updateCompetition(competitionId, {
        judgeSettings: { defaultCount: 2, levelOverrides: {} },
      });

      const j1 = await dataService.addJudge('A Judge', competitionId);
      await dataService.updateJudge(j1.id, { profileId: profile1.id });
      const j2 = await dataService.addJudge('B Judge', competitionId);

      const event = await createEvent('Silver', 'Smooth');
      await createSchedule([makeHeat(event.id, 'final')]);

      await autoAssignJudges(competitionId);

      const updated = await dataService.getEventById(event.id);
      expect(updated!.heats[0].judges).toHaveLength(2);
    });
  });
});
