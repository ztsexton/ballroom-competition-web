import { dataService } from '../../services/dataService';
import { detectBackToBack, detectPersonBackToBack, minimizeBackToBack } from '../../services/schedule/backToBack';
import { ScheduledHeat } from '../../types';

describe('Back-to-Back Detection', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetition() {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    const p1 = await dataService.addPerson({ firstName: 'A', lastName: 'Leader', role: 'leader', status: 'student', competitionId: comp.id });
    const p2 = await dataService.addPerson({ firstName: 'A', lastName: 'Follower', role: 'follower', status: 'student', competitionId: comp.id });
    const p3 = await dataService.addPerson({ firstName: 'B', lastName: 'Leader', role: 'leader', status: 'student', competitionId: comp.id });
    const p4 = await dataService.addPerson({ firstName: 'B', lastName: 'Follower', role: 'follower', status: 'student', competitionId: comp.id });
    const c1 = await dataService.addCouple(p1.id, p2.id, comp.id);
    const c2 = await dataService.addCouple(p3.id, p4.id, comp.id);
    return { comp, c1: c1!, c2: c2! };
  }

  it('should detect no conflicts when couples are not in consecutive heats', async () => {
    const { comp, c1, c2 } = await setupCompetition();

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c2.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    const conflicts = await detectBackToBack(heatOrder, comp.id);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when a couple is in consecutive heats', async () => {
    const { comp, c1 } = await setupCompetition();

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c1.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    const conflicts = await detectBackToBack(heatOrder, comp.id);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].bib).toBe(c1.bib);
  });

  it('should not flag conflicts separated by a break', async () => {
    const { comp, c1 } = await setupCompetition();

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c1.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'break', entries: [], isBreak: true, breakLabel: 'Break' },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    const conflicts = await detectBackToBack(heatOrder, comp.id);
    // Break separates them, so consecutive non-break heats don't share the couple
    expect(conflicts).toHaveLength(0);
  });
});

describe('Person-Level Back-to-Back Detection', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  it('should detect person-level conflicts across different couples', async () => {
    // Pro follower dances with two different student leaders (different bibs)
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    const studentLeader1 = await dataService.addPerson({ firstName: 'Student', lastName: 'One', role: 'leader', status: 'student', competitionId: comp.id });
    const studentLeader2 = await dataService.addPerson({ firstName: 'Student', lastName: 'Two', role: 'leader', status: 'student', competitionId: comp.id });
    const pro = await dataService.addPerson({ firstName: 'Pro', lastName: 'Follower', role: 'follower', status: 'professional', competitionId: comp.id });

    const c1 = (await dataService.addCouple(studentLeader1.id, pro.id, comp.id))!;
    const c2 = (await dataService.addCouple(studentLeader2.id, pro.id, comp.id))!;

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c2.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    // Couple-level detection should NOT detect this (different bibs since different leaders)
    const coupleConflicts = await detectBackToBack(heatOrder, comp.id);
    expect(coupleConflicts).toHaveLength(0);

    // Person-level detection SHOULD detect the pro in consecutive heats
    const personConflicts = await detectPersonBackToBack(heatOrder, comp.id);
    expect(personConflicts.length).toBeGreaterThanOrEqual(1);
    expect(personConflicts.some(c => c.personId === pro.id)).toBe(true);
  });

  it('should exclude pros when excludePros is true', async () => {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    const studentLeader1 = await dataService.addPerson({ firstName: 'Student', lastName: 'One', role: 'leader', status: 'student', competitionId: comp.id });
    const studentLeader2 = await dataService.addPerson({ firstName: 'Student', lastName: 'Two', role: 'leader', status: 'student', competitionId: comp.id });
    const pro = await dataService.addPerson({ firstName: 'Pro', lastName: 'Follower', role: 'follower', status: 'professional', competitionId: comp.id });

    const c1 = (await dataService.addCouple(studentLeader1.id, pro.id, comp.id))!;
    const c2 = (await dataService.addCouple(studentLeader2.id, pro.id, comp.id))!;

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c2.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    // Without excludePros — should detect the pro
    const withPros = await detectPersonBackToBack(heatOrder, comp.id, false);
    expect(withPros.length).toBeGreaterThanOrEqual(1);

    // With excludePros — should NOT detect the pro (only non-pro conflicts matter)
    const withoutPros = await detectPersonBackToBack(heatOrder, comp.id, true);
    expect(withoutPros).toHaveLength(0);
  });

  it('should still detect student conflicts when excludePros is true', async () => {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    const leader1 = await dataService.addPerson({ firstName: 'Leader', lastName: 'One', role: 'leader', status: 'student', competitionId: comp.id });
    const follower1 = await dataService.addPerson({ firstName: 'Follower', lastName: 'One', role: 'follower', status: 'student', competitionId: comp.id });

    const c1 = (await dataService.addCouple(leader1.id, follower1.id, comp.id))!;

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c1.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    // Even with excludePros, student conflicts should be detected
    const conflicts = await detectPersonBackToBack(heatOrder, comp.id, true);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    // Both the leader and follower should be detected (both are students)
    const personIds = new Set(conflicts.map(c => c.personId));
    expect(personIds.has(leader1.id)).toBe(true);
    expect(personIds.has(follower1.id)).toBe(true);
  });

  it('should not flag conflicts separated by a break', async () => {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    const studentLeader1 = await dataService.addPerson({ firstName: 'Student', lastName: 'One', role: 'leader', status: 'student', competitionId: comp.id });
    const studentLeader2 = await dataService.addPerson({ firstName: 'Student', lastName: 'Two', role: 'leader', status: 'student', competitionId: comp.id });
    const pro = await dataService.addPerson({ firstName: 'Pro', lastName: 'Follower', role: 'follower', status: 'professional', competitionId: comp.id });

    const c1 = (await dataService.addCouple(studentLeader1.id, pro.id, comp.id))!;
    const c2 = (await dataService.addCouple(studentLeader2.id, pro.id, comp.id))!;

    const e1 = await dataService.addEvent('Event 1', [c1.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c2.bib], [], comp.id);

    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'break', entries: [], isBreak: true, breakLabel: 'Break' },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
    ];

    const conflicts = await detectPersonBackToBack(heatOrder, comp.id);
    expect(conflicts).toHaveLength(0);
  });
});

describe('Back-to-Back Minimization', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  it('should reduce conflicts by reordering heats', async () => {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'NDCA', date: '2026-06-01',
    });
    // Create 3 couples
    const people = [];
    for (let i = 0; i < 6; i++) {
      people.push(await dataService.addPerson({
        firstName: `Person${i}`, lastName: 'Test',
        role: i % 2 === 0 ? 'leader' : 'follower',
        status: 'student', competitionId: comp.id,
      }));
    }
    const c1 = (await dataService.addCouple(people[0].id, people[1].id, comp.id))!;
    const c2 = (await dataService.addCouple(people[2].id, people[3].id, comp.id))!;
    const c3 = (await dataService.addCouple(people[4].id, people[5].id, comp.id))!;

    // Create events: c1 is in events 1 and 2 (back-to-back)
    const e1 = await dataService.addEvent('Event 1', [c1.bib, c2.bib], [], comp.id);
    const e2 = await dataService.addEvent('Event 2', [c1.bib, c3.bib], [], comp.id);
    const e3 = await dataService.addEvent('Event 3', [c3.bib], [], comp.id);

    // Arrange so c1 is back-to-back: e1, e2, e3
    const heatOrder: ScheduledHeat[] = [
      { id: 'h1', entries: [{ eventId: e1.id, round: 'final' }] },
      { id: 'h2', entries: [{ eventId: e2.id, round: 'final' }] },
      { id: 'h3', entries: [{ eventId: e3.id, round: 'final' }] },
    ];

    const initialConflicts = await detectBackToBack(heatOrder, comp.id);

    const result = await minimizeBackToBack(heatOrder, comp.id);
    expect(result.conflictsRemaining).toBeLessThanOrEqual(initialConflicts.length);
  });
});
