import { ScheduledHeat, Event } from '../../types';
import { dataService } from '../dataService';

export interface BackToBackConflict {
  bib: number;
  leaderName: string;
  followerName: string;
  heatIndex1: number;
  heatIndex2: number;
  heatId1: string;
  heatId2: string;
  eventName1: string;
  eventName2: string;
}

export interface PersonBackToBackConflict {
  personId: number;
  personName: string;
  heatIndex1: number;
  heatIndex2: number;
  heatId1: string;
  heatId2: string;
  eventName1: string;
  eventName2: string;
}

/**
 * Detect couples scheduled in consecutive heats.
 */
export async function detectBackToBack(
  heatOrder: ScheduledHeat[],
  competitionId: number,
): Promise<BackToBackConflict[]> {
  const events = await dataService.getEvents(competitionId);
  const couples = await dataService.getCouples(competitionId);
  const coupleMap = new Map(couples.map(c => [c.bib, c]));

  const conflicts: BackToBackConflict[] = [];

  // Build bib sets per heat and check adjacent non-break heats for shared bibs.
  // Breaks act as separators — heats on opposite sides of a break are NOT back-to-back.
  function getBibs(heat: ScheduledHeat): Set<number> {
    const bibs = new Set<number>();
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const roundHeat = event.heats.find(h => h.round === entry.round);
      if (roundHeat) {
        for (const bib of roundHeat.bibs) {
          bibs.add(bib);
        }
      }
    }
    return bibs;
  }

  for (let i = 0; i < heatOrder.length - 1; i++) {
    const curr = heatOrder[i];
    const next = heatOrder[i + 1];

    // Skip if either heat is a break
    if (curr.isBreak || next.isBreak) continue;

    const currBibs = getBibs(curr);
    const nextBibs = getBibs(next);

    for (const bib of currBibs) {
      if (nextBibs.has(bib)) {
        const couple = coupleMap.get(bib);
        if (!couple) continue;

        const eventName1 = curr.entries
          .map(e => events[e.eventId]?.name || `Event ${e.eventId}`)
          .join(', ');
        const eventName2 = next.entries
          .map(e => events[e.eventId]?.name || `Event ${e.eventId}`)
          .join(', ');

        conflicts.push({
          bib,
          leaderName: couple.leaderName,
          followerName: couple.followerName,
          heatIndex1: i,
          heatIndex2: i + 1,
          heatId1: curr.id,
          heatId2: next.id,
          eventName1,
          eventName2,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect persons scheduled in consecutive heats.
 * Unlike couple-level detection, this catches cases where the same person
 * appears in multiple couples (e.g., a pro dancing with several students).
 */
export async function detectPersonBackToBack(
  heatOrder: ScheduledHeat[],
  competitionId: number,
  excludePros: boolean = false,
): Promise<PersonBackToBackConflict[]> {
  const events = await dataService.getEvents(competitionId);
  const couples = await dataService.getCouples(competitionId);
  const people = await dataService.getPeople(competitionId);

  // Build personId → name map
  const personNameMap = new Map<number, string>();
  for (const p of people) {
    personNameMap.set(p.id, `${p.firstName} ${p.lastName}`);
  }

  // Build set of professional person IDs
  const proPersonIds = new Set<number>();
  if (excludePros) {
    for (const p of people) {
      if (p.status === 'professional') proPersonIds.add(p.id);
    }
  }

  // Build bib → person IDs mapping
  const bibToPersonIds = new Map<number, number[]>();
  for (const couple of couples) {
    const ids: number[] = [];
    if (couple.leaderId) ids.push(couple.leaderId);
    if (couple.followerId) ids.push(couple.followerId);
    bibToPersonIds.set(couple.bib, ids);
  }

  // Get person IDs for a heat (excluding pros if requested)
  function getPersonIds(heat: ScheduledHeat): Set<number> {
    const personIds = new Set<number>();
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const roundHeat = event.heats.find(h => h.round === entry.round);
      if (!roundHeat) continue;
      for (const bib of roundHeat.bibs) {
        const ids = bibToPersonIds.get(bib);
        if (ids) {
          for (const id of ids) {
            if (!excludePros || !proPersonIds.has(id)) {
              personIds.add(id);
            }
          }
        }
      }
    }
    return personIds;
  }

  const conflicts: PersonBackToBackConflict[] = [];

  for (let i = 0; i < heatOrder.length - 1; i++) {
    const curr = heatOrder[i];
    const next = heatOrder[i + 1];
    if (curr.isBreak || next.isBreak) continue;

    const currPersons = getPersonIds(curr);
    const nextPersons = getPersonIds(next);

    for (const personId of currPersons) {
      if (nextPersons.has(personId)) {
        const eventName1 = curr.entries
          .map(e => events[e.eventId]?.name || `Event ${e.eventId}`)
          .join(', ');
        const eventName2 = next.entries
          .map(e => events[e.eventId]?.name || `Event ${e.eventId}`)
          .join(', ');

        conflicts.push({
          personId,
          personName: personNameMap.get(personId) || `Person ${personId}`,
          heatIndex1: i,
          heatIndex2: i + 1,
          heatId1: curr.id,
          heatId2: next.id,
          eventName1,
          eventName2,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Minimize back-to-back occurrences by reordering heats within the same
 * round-bucket (same round depth). Does not move heats across round
 * boundaries (e.g., won't move a quarter-final heat after a semi-final).
 *
 * Uses a greedy approach: for each bucket, try swapping adjacent heats
 * to reduce the total number of B2B conflicts.
 */
export async function minimizeBackToBack(
  heatOrder: ScheduledHeat[],
  competitionId: number,
): Promise<{ heatOrder: ScheduledHeat[]; conflictsRemaining: number }> {
  const events = await dataService.getEvents(competitionId);
  const couples = await dataService.getCouples(competitionId);

  // Build bib sets for each heat
  function getBibsForHeat(heat: ScheduledHeat): Set<number> {
    const bibs = new Set<number>();
    if (heat.isBreak) return bibs;
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const roundHeat = event.heats.find(h => h.round === entry.round);
      if (roundHeat) {
        for (const bib of roundHeat.bibs) bibs.add(bib);
      }
    }
    return bibs;
  }

  function countConflicts(order: ScheduledHeat[]): number {
    let count = 0;
    const nonBreaks = order.filter(h => !h.isBreak);
    for (let i = 0; i < nonBreaks.length - 1; i++) {
      const currBibs = getBibsForHeat(nonBreaks[i]);
      const nextBibs = getBibsForHeat(nonBreaks[i + 1]);
      for (const bib of currBibs) {
        if (nextBibs.has(bib)) count++;
      }
    }
    return count;
  }

  // Identify contiguous non-break segments to reorder within
  const result = [...heatOrder];
  let improved = true;
  let maxIterations = 100;

  while (improved && maxIterations > 0) {
    improved = false;
    maxIterations--;

    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].isBreak || result[i + 1].isBreak) continue;

      // Try swapping adjacent heats
      const before = countConflicts(result);

      // Swap
      [result[i], result[i + 1]] = [result[i + 1], result[i]];

      const after = countConflicts(result);

      if (after < before) {
        improved = true;
      } else {
        // Swap back
        [result[i], result[i + 1]] = [result[i + 1], result[i]];
      }
    }
  }

  return {
    heatOrder: result,
    conflictsRemaining: countConflicts(result),
  };
}
