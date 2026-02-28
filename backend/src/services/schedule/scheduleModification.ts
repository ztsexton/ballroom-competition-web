import { CompetitionSchedule, ScheduledHeat, HeatEntry } from '../../types';
import { dataService } from '../dataService';
import { heatKey, generateHeatId, recalculateTimingIfConfigured, splitBibsEvenly } from './helpers';
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
  forceOverride?: boolean,
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
  let style: string | undefined;

  for (const entry of newEntries) {
    const event = events[entry.eventId];
    if (!event) return null;
    const eventHeat = event.heats.find(h => h.round === entry.round);
    if (!eventHeat) return null;

    totalCouples += event.heats[0]?.bibs.length ?? 0;

    const eventStyle = event.style || '';
    if (style === undefined) {
      style = eventStyle;
    } else if (style && eventStyle && style !== eventStyle) {
      return null; // Incompatible styles
    }
  }

  if (totalCouples > maxCouples && !forceOverride) return null;
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

export async function splitRoundIntoFloorHeats(
  competitionId: number,
  heatId: string,
  groupCount: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const heatIndex = schedule.heatOrder.findIndex(h => h.id === heatId);
  if (heatIndex === -1) return null;

  const heat = schedule.heatOrder[heatIndex];
  if (heat.isBreak || heat.entries.length !== 1) return null;

  const entry = heat.entries[0];
  // Don't re-split an already-split heat
  if (entry.bibSubset) return null;

  const event = await dataService.getEventById(entry.eventId);
  if (!event) return null;

  const heatData = event.heats.find(h => h.round === entry.round);
  if (!heatData) return null;

  const bibs = heatData.bibs;
  if (groupCount < 2 || groupCount > bibs.length) return null;

  const chunks = splitBibsEvenly(bibs, groupCount);
  const totalFloorHeats = chunks.length;
  const isMultiDance = event.dances && event.dances.length > 1;

  // Build replacement heats
  const newHeats: ScheduledHeat[] = [];
  if (isMultiDance) {
    for (const dance of event.dances!) {
      for (let i = 0; i < chunks.length; i++) {
        const newHeat: ScheduledHeat = {
          id: generateHeatId(),
          entries: [{
            eventId: entry.eventId,
            round: entry.round,
            bibSubset: chunks[i],
            floorHeatIndex: i,
            totalFloorHeats,
            dance,
          }],
        };
        newHeats.push(newHeat);
      }
    }
  } else {
    for (let i = 0; i < chunks.length; i++) {
      const newHeat: ScheduledHeat = {
        id: generateHeatId(),
        entries: [{
          eventId: entry.eventId,
          round: entry.round,
          bibSubset: chunks[i],
          floorHeatIndex: i,
          totalFloorHeats,
        }],
      };
      newHeats.push(newHeat);
    }
  }

  // Replace the original heat with the new floor heats
  const oldStatus = schedule.heatStatuses[heat.id] || 'pending';
  delete schedule.heatStatuses[heat.id];

  schedule.heatOrder.splice(heatIndex, 1, ...newHeats);
  for (const nh of newHeats) {
    schedule.heatStatuses[nh.id] = oldStatus;
  }

  // Adjust currentHeatIndex if needed
  if (heatIndex < schedule.currentHeatIndex) {
    schedule.currentHeatIndex += newHeats.length - 1;
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function unsplitFloorHeats(
  competitionId: number,
  heatId: string,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const heat = schedule.heatOrder.find(h => h.id === heatId);
  if (!heat || heat.isBreak || heat.entries.length !== 1) return null;

  const entry = heat.entries[0];
  if (!entry.bibSubset) return null; // Not a split heat

  // Find all sibling heats for this event/round (all dances × all floor heats)
  const siblingHeats = schedule.heatOrder.filter(h =>
    !h.isBreak && h.entries.some(e => e.eventId === entry.eventId && e.round === entry.round && e.bibSubset));

  if (siblingHeats.length <= 1) return null;

  // Find the earliest position among siblings
  const siblingIndices = siblingHeats.map(h => schedule.heatOrder.indexOf(h)).sort((a, b) => a - b);
  const insertAt = siblingIndices[0];

  // Remove all sibling heats and their statuses
  const siblingIds = new Set(siblingHeats.map(h => h.id));
  for (const id of siblingIds) {
    delete schedule.heatStatuses[id];
  }

  schedule.heatOrder = schedule.heatOrder.filter(h => !siblingIds.has(h.id));

  // Insert a single unsplit heat at the earliest position
  const newHeat: ScheduledHeat = {
    id: generateHeatId(),
    entries: [{ eventId: entry.eventId, round: entry.round }],
  };

  const clampedInsert = Math.min(insertAt, schedule.heatOrder.length);
  schedule.heatOrder.splice(clampedInsert, 0, newHeat);
  schedule.heatStatuses[newHeat.id] = 'pending';

  // Adjust currentHeatIndex: we removed N heats and inserted 1
  // If the current heat was after all siblings, adjust by -(N-1)
  // If it was among the siblings, point to the new unsplit heat
  if (schedule.currentHeatIndex >= insertAt + siblingHeats.length) {
    schedule.currentHeatIndex -= (siblingHeats.length - 1);
  } else if (schedule.currentHeatIndex >= insertAt) {
    schedule.currentHeatIndex = clampedInsert;
  }

  if (schedule.currentHeatIndex >= schedule.heatOrder.length) {
    schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
  await autoAssignJudges(competitionId);
  return await recalculateTimingIfConfigured(competitionId, schedule);
}

export async function resplitPendingHeats(
  competitionId: number,
  eventId: number,
  round: string,
  groupCount: number,
): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const event = await dataService.getEventById(eventId);
  if (!event) return null;
  if (groupCount < 1) return null;

  const heatData = event.heats.find(h => h.round === round);
  if (!heatData) return null;

  const bibs = heatData.bibs;
  if (bibs.length === 0 || groupCount > bibs.length) return null;

  // Find all pending schedule heats for this event/round
  const pendingIndices: number[] = [];
  for (let i = 0; i < schedule.heatOrder.length; i++) {
    const h = schedule.heatOrder[i];
    if (h.isBreak) continue;
    if (schedule.heatStatuses[h.id] !== 'pending') continue;
    if (h.entries.some(e => e.eventId === eventId && e.round === round)) {
      pendingIndices.push(i);
    }
  }

  if (pendingIndices.length === 0) return null;

  // Collect dances from existing entries
  const isMultiDance = event.dances && event.dances.length > 1;

  // Collect which dances are still pending (only these should be recreated)
  const pendingDances = new Set<string>();
  if (isMultiDance) {
    for (const idx of pendingIndices) {
      const h = schedule.heatOrder[idx];
      for (const e of h.entries) {
        if (e.eventId === eventId && e.round === round && e.dance) {
          pendingDances.add(e.dance);
        }
      }
    }
    // Unsplit heat (no dance field) → all dances are pending
    if (pendingDances.size === 0) {
      event.dances!.forEach(d => pendingDances.add(d));
    }
  }

  // Track the earliest pending position
  const earliestPos = pendingIndices[0];

  // Remove all pending heats for this event/round
  const removedIds = new Set<string>();
  for (const idx of pendingIndices) {
    removedIds.add(schedule.heatOrder[idx].id);
  }
  // Remove and clean up statuses
  schedule.heatOrder = schedule.heatOrder.filter(h => !removedIds.has(h.id));
  for (const id of removedIds) {
    delete schedule.heatStatuses[id];
  }

  // Build new heats
  const newHeats: ScheduledHeat[] = [];

  if (groupCount === 1) {
    // Merge: create unsplit heats (no bibSubset/floorHeatIndex/totalFloorHeats)
    if (isMultiDance) {
      for (const dance of pendingDances) {
        newHeats.push({
          id: generateHeatId(),
          entries: [{ eventId, round, dance }],
        });
      }
    } else {
      newHeats.push({
        id: generateHeatId(),
        entries: [{ eventId, round }],
      });
    }
  } else {
    // Split into floor heats
    const chunks = splitBibsEvenly(bibs, groupCount);
    const totalFloorHeats = chunks.length;
    const dancesToCreate = isMultiDance
      ? [...pendingDances]
      : [undefined as string | undefined];

    for (const dance of dancesToCreate) {
      for (let i = 0; i < chunks.length; i++) {
        const entry: HeatEntry = {
          eventId,
          round,
          bibSubset: chunks[i],
          floorHeatIndex: i,
          totalFloorHeats,
        };
        if (dance) entry.dance = dance;
        newHeats.push({
          id: generateHeatId(),
          entries: [entry],
        });
      }
    }
  }

  // Insert at the earliest removed position
  const insertAt = Math.min(earliestPos, schedule.heatOrder.length);
  schedule.heatOrder.splice(insertAt, 0, ...newHeats);
  for (const nh of newHeats) {
    schedule.heatStatuses[nh.id] = 'pending';
  }

  // Adjust currentHeatIndex: we removed N heats and added M new ones
  // All at/after earliestPos
  if (schedule.currentHeatIndex >= earliestPos + pendingIndices.length) {
    // Current heat was after all removed heats
    schedule.currentHeatIndex += newHeats.length - pendingIndices.length;
  } else if (schedule.currentHeatIndex >= earliestPos) {
    // Current heat was among removed heats — point to first new heat
    schedule.currentHeatIndex = insertAt;
  }

  if (schedule.currentHeatIndex >= schedule.heatOrder.length) {
    schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
  }

  schedule.updatedAt = new Date().toISOString();
  await dataService.saveSchedule(schedule);
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
