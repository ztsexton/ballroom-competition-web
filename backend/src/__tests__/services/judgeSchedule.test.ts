import { buildJudgeSchedule } from '../../services/schedule/judgeSchedule';
import { ScheduledHeat, Event, Judge } from '../../types';

describe('buildJudgeSchedule', () => {
  const judges: Judge[] = [
    { id: 1, name: 'Alice', judgeNumber: 1, competitionId: 1 },
    { id: 2, name: 'Bob', judgeNumber: 2, competitionId: 1 },
    { id: 3, name: 'Carol', judgeNumber: 3, competitionId: 1, isChairman: true },
  ];

  const events: Record<number, Event> = {
    10: {
      id: 10, name: 'Bronze Waltz', competitionId: 1,
      heats: [
        { round: 'final', bibs: [1, 2, 3], judges: [1, 2] },
      ],
    },
    20: {
      id: 20, name: 'Silver Tango', competitionId: 1,
      heats: [
        { round: 'final', bibs: [4, 5], judges: [2, 3] },
      ],
    },
  };

  function makeHeat(id: string, eventId: number, round: string, opts?: { isBreak?: boolean; durationSeconds?: number }): ScheduledHeat {
    return {
      id,
      entries: opts?.isBreak ? [] : [{ eventId, round }],
      isBreak: opts?.isBreak,
      estimatedDurationSeconds: opts?.durationSeconds ?? 120,
    };
  }

  it('should assign heats to correct judges based on event heat judges', () => {
    const heatOrder: ScheduledHeat[] = [
      makeHeat('h1', 10, 'final'),
      makeHeat('h2', 20, 'final'),
    ];

    const result = buildJudgeSchedule(heatOrder, events, judges, 360);

    expect(result).toHaveLength(3);

    // Judge 1 (Alice) — only event 10
    const j1 = result.find(e => e.judgeId === 1)!;
    expect(j1.totalHeatCount).toBe(1);
    expect(j1.heats).toHaveLength(1);
    expect(j1.heats[0].eventNames).toEqual(['Bronze Waltz']);

    // Judge 2 (Bob) — both events
    const j2 = result.find(e => e.judgeId === 2)!;
    expect(j2.totalHeatCount).toBe(2);

    // Judge 3 (Carol) — only event 20
    const j3 = result.find(e => e.judgeId === 3)!;
    expect(j3.totalHeatCount).toBe(1);
    expect(j3.isChairman).toBe(true);
  });

  it('should split segments at breaks', () => {
    const heatOrder: ScheduledHeat[] = [
      makeHeat('h1', 10, 'final', { durationSeconds: 300 }),
      { id: 'brk', entries: [], isBreak: true, breakLabel: 'Lunch' },
      makeHeat('h2', 10, 'final', { durationSeconds: 300 }),
    ];

    // Use events where all judges are on event 10
    const eventsLocal: Record<number, Event> = {
      10: {
        id: 10, name: 'Test', competitionId: 1,
        heats: [{ round: 'final', bibs: [1], judges: [1, 2] }],
      },
    };

    const result = buildJudgeSchedule(heatOrder, eventsLocal, judges.slice(0, 2), 360);

    const j1 = result.find(e => e.judgeId === 1)!;
    expect(j1.segments).toHaveLength(2);
    expect(j1.segments[0].startHeatIndex).toBe(0);
    expect(j1.segments[0].endHeatIndex).toBe(0);
    expect(j1.segments[1].startHeatIndex).toBe(2);
    expect(j1.segments[1].endHeatIndex).toBe(2);
  });

  it('should flag segments that exceed the limit', () => {
    // 4 heats, each 200 seconds = 800 seconds total = ~13.3 minutes
    const heatOrder: ScheduledHeat[] = [
      makeHeat('h1', 10, 'final', { durationSeconds: 200 }),
      makeHeat('h2', 10, 'final', { durationSeconds: 200 }),
      makeHeat('h3', 10, 'final', { durationSeconds: 200 }),
      makeHeat('h4', 10, 'final', { durationSeconds: 200 }),
    ];

    const eventsLocal: Record<number, Event> = {
      10: {
        id: 10, name: 'Test', competitionId: 1,
        heats: [{ round: 'final', bibs: [1], judges: [1] }],
      },
    };

    // Set limit to 10 minutes — 13.3 minutes should exceed
    const result = buildJudgeSchedule(heatOrder, eventsLocal, [judges[0]], 10);

    const j1 = result[0];
    expect(j1.segments).toHaveLength(1);
    expect(j1.segments[0].exceedsLimit).toBe(true);
    expect(j1.segments[0].durationMinutes).toBeCloseTo(13.33, 1);
  });

  it('should not flag segments within the limit', () => {
    const heatOrder: ScheduledHeat[] = [
      makeHeat('h1', 10, 'final', { durationSeconds: 120 }),
    ];

    const eventsLocal: Record<number, Event> = {
      10: {
        id: 10, name: 'Test', competitionId: 1,
        heats: [{ round: 'final', bibs: [1], judges: [1] }],
      },
    };

    const result = buildJudgeSchedule(heatOrder, eventsLocal, [judges[0]], 360);
    expect(result[0].segments[0].exceedsLimit).toBe(false);
  });

  it('should handle empty heat order', () => {
    const result = buildJudgeSchedule([], events, judges, 360);
    expect(result).toHaveLength(3);
    result.forEach(entry => {
      expect(entry.totalHeatCount).toBe(0);
      expect(entry.segments).toHaveLength(0);
    });
  });

  it('should sort results by judge number', () => {
    const shuffledJudges = [judges[2], judges[0], judges[1]];
    const result = buildJudgeSchedule([], events, shuffledJudges, 360);
    expect(result[0].judgeNumber).toBe(1);
    expect(result[1].judgeNumber).toBe(2);
    expect(result[2].judgeNumber).toBe(3);
  });
});
