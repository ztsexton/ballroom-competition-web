import { CompetitionSchedule, ScheduledHeat, HeatEntry } from '../../types';
import { dataService } from '../dataService';
import { heatKey, generateHeatId, recalculateTimingIfConfigured } from './helpers';
import { autoAssignJudges } from './judgeAssignment';

const DEFAULT_MAX_COUPLES_PER_HEAT = 6;

export async function reorderHeat(
  competitionId: number,
  fromIndex: number,
  toIndex: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;
  if (fromIndex < 0 || fromIndex >= schedule.heatOrder.length) return null;
  if (toIndex < 0 || toIndex >= schedule.heatOrder.length) return null;

  const [moved] = schedule.heatOrder.splice(fromIndex, 1);
  schedule.heatOrder.splice(toIndex, 0, moved);
  schedule.updatedAt = new Date().toISOString();

  await dataService.saveSchedule(schedule);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function suggestPosition(competitionId: number, eventId: number): Promise<number> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return 0;

  const event = await dataService.getEventById(eventId);
  if (!event) return schedule.heatOrder.length;

  const styles = schedule.styleOrder;
  const levels = schedule.levelOrder;

  const eventStyleIdx = styles.indexOf(event.style || '');
  const eventLevelIdx = levels.indexOf(event.level || '');
  const sIdx = eventStyleIdx === -1 ? styles.length : eventStyleIdx;
  const lIdx = eventLevelIdx === -1 ? levels.length : eventLevelIdx;

  // Find where the first-round heat should go among other first-round heats
  for (let i = 0; i < schedule.heatOrder.length; i++) {
    const h = schedule.heatOrder[i];
    if (h.isBreak || h.entries.length === 0) continue;
    const firstEntry = h.entries[0];
    const existingEvent = await dataService.getEventById(firstEntry.eventId);
    if (!existingEvent) continue;

    if (existingEvent.heats[0]?.round !== firstEntry.round) continue;

    const esIdx = styles.indexOf(existingEvent.style || '');
    const elIdx = levels.indexOf(existingEvent.level || '');
    const eStyleIdx = esIdx === -1 ? styles.length : esIdx;
    const eLevelIdx = elIdx === -1 ? levels.length : elIdx;

    if (sIdx < eStyleIdx || (sIdx === eStyleIdx && lIdx < eLevelIdx)) {
      return i;
    }
  }

  // If no first-round heat comes after, place before second-round heats start
  for (let i = 0; i < schedule.heatOrder.length; i++) {
    const h = schedule.heatOrder[i];
    if (h.isBreak || h.entries.length === 0) continue;
    const firstEntry = h.entries[0];
    const existingEvent = await dataService.getEventById(firstEntry.eventId);
    if (!existingEvent) continue;
    if (existingEvent.heats.length > 1 && existingEvent.heats[1]?.round === firstEntry.round) {
      return i;
    }
  }

  return schedule.heatOrder.length;
}

export async function insertEvent(
  competitionId: number,
  eventId: number,
  position: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const event = await dataService.getEventById(eventId);
  if (!event) return null;

  // Don't insert if any heat of this event is already scheduled
  if (schedule.heatOrder.some((h: ScheduledHeat) =>
    h.entries.some(e => e.eventId === eventId)
  )) return schedule;

  // Insert first-round heat at specified position
  const firstHeat: ScheduledHeat = {
    id: generateHeatId(),
    entries: [{ eventId, round: event.heats[0].round }],
  };
  const insertAt = Math.max(0, Math.min(position, schedule.heatOrder.length));
  schedule.heatOrder.splice(insertAt, 0, firstHeat);
  schedule.heatStatuses[heatKey(firstHeat)] = 'pending';

  if (insertAt <= schedule.currentHeatIndex) {
    schedule.currentHeatIndex++;
  }

  // Insert subsequent rounds at the end of their round-depth groups
  for (let roundIdx = 1; roundIdx < event.heats.length; roundIdx++) {
    const heat: ScheduledHeat = {
      id: generateHeatId(),
      entries: [{ eventId, round: event.heats[roundIdx].round }],
    };

    let insertPos = schedule.heatOrder.length;
    for (let i = schedule.heatOrder.length - 1; i >= 0; i--) {
      const existing = schedule.heatOrder[i];
      if (existing.isBreak || existing.entries.length === 0) continue;
      const existingEntry = existing.entries[0];
      const existingEvent = await dataService.getEventById(existingEntry.eventId);
      if (!existingEvent) continue;
      const existingRoundIdx = existingEvent.heats.findIndex(h => h.round === existingEntry.round);
      if (existingRoundIdx === roundIdx) {
        insertPos = i + 1;
        break;
      }
    }

    schedule.heatOrder.splice(insertPos, 0, heat);
    schedule.heatStatuses[heatKey(heat)] = 'pending';

    if (insertPos <= schedule.currentHeatIndex) {
      schedule.currentHeatIndex++;
    }
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  await autoAssignJudges(competitionId);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function addBreak(
  competitionId: number,
  label: string,
  duration?: number,
  position?: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const breakHeat: ScheduledHeat = {
    id: generateHeatId(),
    entries: [],
    isBreak: true,
    breakLabel: label,
    breakDuration: duration,
  };

  const insertAt = position !== undefined
    ? Math.max(0, Math.min(position, schedule.heatOrder.length))
    : schedule.heatOrder.length;

  schedule.heatOrder.splice(insertAt, 0, breakHeat);
  schedule.heatStatuses[heatKey(breakHeat)] = 'pending';

  if (insertAt <= schedule.currentHeatIndex) {
    schedule.currentHeatIndex++;
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function removeBreak(
  competitionId: number,
  heatIndex: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;
  if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

  const heat = schedule.heatOrder[heatIndex];
  if (!heat.isBreak) return null;

  const key = heatKey(heat);
  schedule.heatOrder.splice(heatIndex, 1);
  delete schedule.heatStatuses[key];

  if (heatIndex < schedule.currentHeatIndex) {
    schedule.currentHeatIndex--;
  } else if (heatIndex === schedule.currentHeatIndex && schedule.currentHeatIndex >= schedule.heatOrder.length) {
    schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function updateHeatEntries(
  competitionId: number,
  heatId: string,
  newEntries: HeatEntry[],
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const heatIndex = schedule.heatOrder.findIndex(h => h.id === heatId);
  if (heatIndex === -1) return null;

  const heat = schedule.heatOrder[heatIndex];
  if (heat.isBreak) return null;

  // Validate: all entries must exist and have compatible scoring types
  const events = await dataService.getEvents(competitionId);
  const competition = await dataService.getCompetitionById(competitionId);
  const maxCouples = competition?.maxCouplesPerHeat ?? DEFAULT_MAX_COUPLES_PER_HEAT;

  let totalCouples = 0;
  let scoringType: string | undefined;

  for (const entry of newEntries) {
    const event = events[entry.eventId];
    if (!event) return null;
    const eventHeat = event.heats.find(h => h.round === entry.round);
    if (!eventHeat) return null;

    totalCouples += event.heats[0]?.bibs.length ?? 0;
    const st = event.scoringType || 'standard';
    if (scoringType === undefined) {
      scoringType = st;
    } else if (scoringType !== st) {
      return null; // Incompatible scoring types
    }
  }

  if (totalCouples > maxCouples) return null;
  if (newEntries.length === 0) return null;

  // Remove these entries from any other heats they might be in
  for (const entry of newEntries) {
    for (const otherHeat of schedule.heatOrder) {
      if (otherHeat.id === heatId || otherHeat.isBreak) continue;
      otherHeat.entries = otherHeat.entries.filter(
        e => !(e.eventId === entry.eventId && e.round === entry.round)
      );
    }
  }

  // Remove any heats that are now empty (but not breaks)
  const emptyHeatIds: string[] = [];
  schedule.heatOrder = schedule.heatOrder.filter(h => {
    if (h.id === heatId) return true;
    if (h.isBreak) return true;
    if (h.entries.length === 0) {
      emptyHeatIds.push(h.id);
      return false;
    }
    return true;
  });

  // Clean up statuses for removed heats
  for (const id of emptyHeatIds) {
    delete schedule.heatStatuses[id];
  }

  // Clamp currentHeatIndex if heats were removed before it
  if (schedule.currentHeatIndex >= schedule.heatOrder.length) {
    schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
  }

  heat.entries = newEntries;
  schedule.updatedAt = new Date().toISOString();

  await dataService.saveSchedule(schedule);
  await autoAssignJudges(competitionId);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function splitHeatEntry(
  competitionId: number,
  heatId: string,
  eventId: number,
  round: string,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const heatIndex = schedule.heatOrder.findIndex(h => h.id === heatId);
  if (heatIndex === -1) return null;

  const heat = schedule.heatOrder[heatIndex];
  if (heat.isBreak) return null;
  if (heat.entries.length <= 1) return null;

  const entryIndex = heat.entries.findIndex(
    e => e.eventId === eventId && e.round === round
  );
  if (entryIndex === -1) return null;

  // Remove the entry from this heat
  const [removed] = heat.entries.splice(entryIndex, 1);

  // Create a new single-entry heat right after
  const newHeat: ScheduledHeat = {
    id: generateHeatId(),
    entries: [removed],
  };
  schedule.heatOrder.splice(heatIndex + 1, 0, newHeat);
  schedule.heatStatuses[newHeat.id] = schedule.heatStatuses[heatId] || 'pending';

  if (heatIndex < schedule.currentHeatIndex) {
    schedule.currentHeatIndex++;
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  await autoAssignJudges(competitionId);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}
