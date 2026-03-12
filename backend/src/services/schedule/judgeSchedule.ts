import { ScheduledHeat, Event, Judge, JudgeScheduleEntry, JudgeScheduleHeat, JudgeWorkSegment } from '../../types';

export function buildJudgeSchedule(
  heatOrder: ScheduledHeat[],
  events: Record<number, Event>,
  judges: Judge[],
  maxMinutesWithoutBreak: number,
): JudgeScheduleEntry[] {
  // Init per-judge entry
  const entryMap = new Map<number, JudgeScheduleEntry>();
  for (const judge of judges) {
    entryMap.set(judge.id, {
      judgeId: judge.id,
      judgeName: judge.name,
      judgeNumber: judge.judgeNumber,
      isChairman: judge.isChairman,
      judgeRole: judge.judgeRole,
      heats: [],
      totalHeatCount: 0,
      estimatedWorkingMinutes: 0,
      segments: [],
    });
  }

  // Track per-judge segment state
  const segmentState = new Map<number, { startIndex: number; minutes: number }>();

  function finalizeSegment(judgeId: number) {
    const state = segmentState.get(judgeId);
    if (!state) return;
    const entry = entryMap.get(judgeId);
    if (!entry) return;
    const lastHeat = entry.heats[entry.heats.length - 1];
    entry.segments.push({
      startHeatIndex: state.startIndex,
      endHeatIndex: lastHeat ? lastHeat.heatIndex : state.startIndex,
      durationMinutes: state.minutes,
      exceedsLimit: state.minutes > maxMinutesWithoutBreak,
    });
    segmentState.delete(judgeId);
  }

  for (let idx = 0; idx < heatOrder.length; idx++) {
    const heat = heatOrder[idx];

    if (heat.isBreak) {
      // Finalize open segments for all judges
      for (const judgeId of segmentState.keys()) {
        finalizeSegment(judgeId);
      }
      continue;
    }

    // Collect judge IDs assigned to this heat across all entries
    const heatJudgeIds = new Set<number>();
    const eventNames: string[] = [];
    let round = '';
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      if (!round) round = entry.round;
      eventNames.push(event.name);
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (eventHeat) {
        for (const jId of eventHeat.judges) {
          heatJudgeIds.add(jId);
        }
      }
    }

    const durationMinutes = (heat.estimatedDurationSeconds || 0) / 60;

    for (const judgeId of heatJudgeIds) {
      const entry = entryMap.get(judgeId);
      if (!entry) continue;

      const schedHeat: JudgeScheduleHeat = {
        heatIndex: idx,
        heatId: heat.id,
        eventNames,
        round,
        estimatedStartTime: heat.estimatedStartTime,
        estimatedDurationSeconds: heat.estimatedDurationSeconds,
      };
      entry.heats.push(schedHeat);
      entry.totalHeatCount++;
      entry.estimatedWorkingMinutes += durationMinutes;

      // Track segment
      const state = segmentState.get(judgeId);
      if (state) {
        state.minutes += durationMinutes;
      } else {
        segmentState.set(judgeId, { startIndex: idx, minutes: durationMinutes });
      }
    }
  }

  // Finalize remaining open segments
  for (const judgeId of segmentState.keys()) {
    finalizeSegment(judgeId);
  }

  // Round working minutes
  for (const entry of entryMap.values()) {
    entry.estimatedWorkingMinutes = Math.round(entry.estimatedWorkingMinutes);
  }

  // Sort: main judges first, then fill-in, each sub-sorted by judge number
  return [...entryMap.values()].sort((a, b) => {
    const aFillIn = a.judgeRole === 'fill-in' ? 1 : 0;
    const bFillIn = b.judgeRole === 'fill-in' ? 1 : 0;
    if (aFillIn !== bFillIn) return aFillIn - bFillIn;
    return a.judgeNumber - b.judgeNumber;
  });
}
