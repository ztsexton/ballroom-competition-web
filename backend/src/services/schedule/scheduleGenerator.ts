import { CompetitionSchedule, ScheduledHeat, HeatEntry, Event, EventRunStatus, AutoBreaksConfig } from '../../types';
import { dataService } from '../dataService';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { DEFAULT_STYLE_ORDER, DEFAULT_DANCE_ORDER, getDancesForStyle } from '../../constants/dances';
import { heatKey, generateHeatId, recalculateTimingIfConfigured, splitBibsEvenly } from './helpers';
import { autoAssignJudges } from './judgeAssignment';
const DEFAULT_MAX_COUPLES_PER_HEAT = 6;

/**
 * Returns event type priority for schedule ordering:
 * 0 = single dance, 1 = multi-dance, 2 = scholarship
 */
export function getEventTypePriority(event: Event): number {
  if (event.isScholarship) return 2;
  if (event.dances && event.dances.length > 1) return 1;
  return 0;
}

/**
 * Reorders levels by picking every stride-th element to separate consecutive levels.
 * Example: [B1,B2,B3,B4] stride 2 → [B1,B3,B2,B4]
 * Example: [B1,B2,B3,B4,B5,B6] stride 3 → [B1,B4,B2,B5,B3,B6]
 */
export function interleaveLevels(levels: string[], stride: number): string[] {
  if (stride < 2 || levels.length <= stride) return [...levels];
  const result: string[] = [];
  const used = new Set<number>();
  for (let start = 0; start < stride; start++) {
    for (let i = start; i < levels.length; i += stride) {
      if (!used.has(i)) {
        used.add(i);
        result.push(levels[i]);
      }
    }
  }
  return result;
}

/**
 * Post-processing pass: separate heats that share the same eventId.
 * For each adjacent pair sharing an eventId, search ahead 2–5 positions
 * for a swap candidate that doesn't create new event-round adjacency.
 */
export function separateEventRounds(heatOrder: ScheduledHeat[]): ScheduledHeat[] {
  const result = [...heatOrder];

  function getEventIds(heat: ScheduledHeat): Set<number> {
    const ids = new Set<number>();
    if (heat.isBreak) return ids;
    for (const entry of heat.entries) ids.add(entry.eventId);
    return ids;
  }

  function hasOverlap(a: Set<number>, b: Set<number>): boolean {
    for (const id of a) {
      if (b.has(id)) return true;
    }
    return false;
  }

  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].isBreak || result[i + 1].isBreak) continue;

    const currIds = getEventIds(result[i]);
    const nextIds = getEventIds(result[i + 1]);

    if (!hasOverlap(currIds, nextIds)) continue;

    // Search ahead for a swap candidate
    for (let j = i + 2; j < Math.min(i + 6, result.length); j++) {
      if (result[j].isBreak) continue;

      const candidateIds = getEventIds(result[j]);

      // Check: swapping result[i+1] with result[j] won't create new adjacency
      const wouldConflictBefore = hasOverlap(currIds, candidateIds);
      const wouldConflictAfter = j + 1 < result.length && !result[j + 1].isBreak &&
        hasOverlap(getEventIds(result[i + 1]), getEventIds(result[j + 1]));
      // Also check that candidate doesn't conflict with what's before j
      const wouldConflictBeforeJ = j - 1 > i + 1 && !result[j - 1].isBreak &&
        hasOverlap(getEventIds(result[i + 1]), getEventIds(result[j - 1]));

      if (!wouldConflictBefore && !wouldConflictAfter && !wouldConflictBeforeJ) {
        [result[i + 1], result[j]] = [result[j], result[i + 1]];
        break;
      }
    }
  }

  return result;
}

/**
 * Post-processing: minimize person-level back-to-back conflicts.
 * Excludes professionals (pro-am pros dance in many heats, can't avoid).
 * Uses greedy adjacent swaps, never creating event-round adjacency.
 */
export async function minimizePersonBackToBack(
  heatOrder: ScheduledHeat[],
  competitionId: number,
): Promise<ScheduledHeat[]> {
  const events = await dataService.getEvents(competitionId);
  const couples = await dataService.getCouples(competitionId);
  const people = await dataService.getPeople(competitionId);
  const competition = await dataService.getCompetitionById(competitionId);

  // Build personId → Set<bib> map, excluding professionals
  // When allowDuplicateEntries is on, include pros so section events get spaced apart
  const excludePros = !competition?.allowDuplicateEntries;
  const proPersonIds = new Set(
    excludePros ? people.filter(p => p.status === 'professional').map(p => p.id) : []
  );

  const personToBibs = new Map<number, Set<number>>();
  for (const couple of couples) {
    if (!proPersonIds.has(couple.leaderId)) {
      if (!personToBibs.has(couple.leaderId)) personToBibs.set(couple.leaderId, new Set());
      personToBibs.get(couple.leaderId)!.add(couple.bib);
    }
    if (!proPersonIds.has(couple.followerId)) {
      if (!personToBibs.has(couple.followerId)) personToBibs.set(couple.followerId, new Set());
      personToBibs.get(couple.followerId)!.add(couple.bib);
    }
  }

  // Build bib → personIds map (inverse)
  const bibToPersons = new Map<number, number[]>();
  for (const [personId, bibs] of personToBibs) {
    for (const bib of bibs) {
      if (!bibToPersons.has(bib)) bibToPersons.set(bib, []);
      bibToPersons.get(bib)!.push(personId);
    }
  }

  function getBibs(heat: ScheduledHeat): Set<number> {
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

  function getPersons(bibs: Set<number>): Set<number> {
    const persons = new Set<number>();
    for (const bib of bibs) {
      const ps = bibToPersons.get(bib);
      if (ps) for (const p of ps) persons.add(p);
    }
    return persons;
  }

  function getEventIds(heat: ScheduledHeat): Set<number> {
    const ids = new Set<number>();
    if (heat.isBreak) return ids;
    for (const entry of heat.entries) ids.add(entry.eventId);
    return ids;
  }

  function hasOverlap<T>(a: Set<T>, b: Set<T>): boolean {
    for (const v of a) {
      if (b.has(v)) return true;
    }
    return false;
  }

  function countSetOverlap<T>(a: Set<T>, b: Set<T>): number {
    let count = 0;
    for (const v of a) {
      if (b.has(v)) count++;
    }
    return count;
  }

  const result = [...heatOrder];

  // Pre-cache
  const bibCache = result.map(h => getBibs(h));
  const personCache = bibCache.map(b => getPersons(b));
  const eventIdCache = result.map(h => getEventIds(h));

  function countPersonConflicts(): number {
    let count = 0;
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].isBreak || result[i + 1].isBreak) continue;
      count += countSetOverlap(personCache[i], personCache[i + 1]);
    }
    return count;
  }

  let iterations = 50;
  let improved = true;

  while (improved && iterations > 0) {
    improved = false;
    iterations--;

    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].isBreak || result[i + 1].isBreak) continue;

      // Would swap improve person conflicts without creating event adjacency?
      const beforeConflicts = countPersonConflicts();

      // Swap
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
      [bibCache[i], bibCache[i + 1]] = [bibCache[i + 1], bibCache[i]];
      [personCache[i], personCache[i + 1]] = [personCache[i + 1], personCache[i]];
      [eventIdCache[i], eventIdCache[i + 1]] = [eventIdCache[i + 1], eventIdCache[i]];

      // Check event adjacency constraint
      let createsEventAdjacency = false;
      // Check i-1 vs i
      if (i > 0 && !result[i - 1].isBreak && hasOverlap(eventIdCache[i - 1], eventIdCache[i])) {
        createsEventAdjacency = true;
      }
      // Check i vs i+1
      if (!createsEventAdjacency && hasOverlap(eventIdCache[i], eventIdCache[i + 1])) {
        createsEventAdjacency = true;
      }
      // Check i+1 vs i+2
      if (!createsEventAdjacency && i + 2 < result.length && !result[i + 2].isBreak &&
          hasOverlap(eventIdCache[i + 1], eventIdCache[i + 2])) {
        createsEventAdjacency = true;
      }

      const afterConflicts = countPersonConflicts();

      if (!createsEventAdjacency && afterConflicts < beforeConflicts) {
        improved = true;
      } else {
        // Swap back
        [result[i], result[i + 1]] = [result[i + 1], result[i]];
        [bibCache[i], bibCache[i + 1]] = [bibCache[i + 1], bibCache[i]];
        [personCache[i], personCache[i + 1]] = [personCache[i + 1], personCache[i]];
        [eventIdCache[i], eventIdCache[i + 1]] = [eventIdCache[i + 1], eventIdCache[i]];
      }
    }
  }

  return result;
}

export async function generateSchedule(
  competitionId: number,
  styleOrder?: string[],
  levelOrder?: string[],
  danceOrder?: Record<string, string[]>,
  autoBreaks?: AutoBreaksConfig,
  deferFinals?: boolean,
): Promise<CompetitionSchedule> {
  const competition = await dataService.getCompetitionById(competitionId);
  const events = await dataService.getEvents(competitionId);
  const eventList = Object.values(events);

  const styles = styleOrder || DEFAULT_STYLE_ORDER;
  const levels = levelOrder || competition?.levels || DEFAULT_LEVELS;
  const maxCouples = competition?.maxCouplesPerHeat ?? DEFAULT_MAX_COUPLES_PER_HEAT;
  const dances = danceOrder || competition?.danceOrder || DEFAULT_DANCE_ORDER;

  const sortByStyleLevel = (a: Event, b: Event) => {
    const sA = styles.indexOf(a.style || '');
    const sB = styles.indexOf(b.style || '');
    const styleA = sA === -1 ? styles.length : sA;
    const styleB = sB === -1 ? styles.length : sB;
    if (styleA !== styleB) return styleA - styleB;

    // Event type: single < multi-dance < scholarship
    const typeA = getEventTypePriority(a);
    const typeB = getEventTypePriority(b);
    if (typeA !== typeB) return typeA - typeB;

    // Natural level order (low → high); person spacing handles cross-level conflicts
    const lA = levels.indexOf(a.level || '');
    const lB = levels.indexOf(b.level || '');
    const levelA = lA === -1 ? levels.length : lA;
    const levelB = lB === -1 ? levels.length : lB;
    if (levelA !== levelB) return levelA - levelB;

    // Within the same style, type, and level, sort by first dance position
    const styleDances = getDancesForStyle(a.style || '', dances);
    const dA = a.dances?.[0] || '';
    const dB = b.dances?.[0] || '';
    const dIdxA = styleDances.indexOf(dA);
    const dIdxB = styleDances.indexOf(dB);
    const danceA = dIdxA === -1 ? styleDances.length : dIdxA;
    const danceB = dIdxB === -1 ? styleDances.length : dIdxB;
    return danceA - danceB;
  };

  let allItems: EntryWithEvent[];
  if (deferFinals) {
    allItems = buildRoundDepthEntries(eventList, sortByStyleLevel);
  } else {
    allItems = buildStyleBlockEntries(eventList, styles, sortByStyleLevel);
  }

  const rawHeatOrder = mergeEntries(allItems, maxCouples);
  let heatOrder = await applyFloorHeatSplitting(rawHeatOrder, competitionId);

  if (autoBreaks?.enabled) {
    const breakLabel = autoBreaks.label || 'Break';
    const breakDuration = autoBreaks.durationMinutes ?? 5;
    const withBreaks: ScheduledHeat[] = [];
    let lastStyle: string | null = null;

    for (const heat of heatOrder) {
      const firstEntry = heat.entries[0];
      const event = firstEntry ? eventList.find(e => e.id === firstEntry.eventId) : undefined;
      const style = event?.style || null;
      if (style && lastStyle && style !== lastStyle) {
        withBreaks.push({
          id: generateHeatId(),
          entries: [],
          isBreak: true,
          breakLabel,
          breakDuration,
        });
      }
      withBreaks.push(heat);
      if (style) lastStyle = style;
    }
    heatOrder = withBreaks;
  }

  heatOrder = separateEventRounds(heatOrder);
  heatOrder = await minimizePersonBackToBack(heatOrder, competitionId);

  const heatStatuses: Record<string, EventRunStatus> = {};
  heatOrder.forEach(h => { heatStatuses[heatKey(h)] = 'pending'; });

  const now = new Date().toISOString();

  const schedule: CompetitionSchedule = {
    competitionId,
    heatOrder,
    styleOrder: styles,
    levelOrder: levels,
    currentHeatIndex: 0,
    heatStatuses,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await dataService.saveSchedule(schedule);
  await autoAssignJudges(competitionId);
  return await recalculateTimingIfConfigured(competitionId, saved);
}

type EntryWithEvent = { entry: HeatEntry; event: Event; coupleCount: number };

/**
 * Old behavior (deferFinals=true): bucket by round depth, sort within each bucket.
 * All first-round heats, then all second-round heats, then all third-round heats.
 */
function buildRoundDepthEntries(
  eventList: Event[],
  sortFn: (a: Event, b: Event) => number,
): EntryWithEvent[] {
  const buckets: EntryWithEvent[][] = [[], [], []];
  for (const event of eventList) {
    const totalCouples = event.heats[0]?.bibs.length ?? 0;
    event.heats.forEach((heat, index) => {
      if (index < 3) {
        buckets[index].push({
          entry: { eventId: event.id, round: heat.round },
          event,
          coupleCount: totalCouples,
        });
      }
    });
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => sortFn(a.event, b.event));
  }
  return [...buckets[0], ...buckets[1], ...buckets[2]];
}

/**
 * Default behavior: group by style, then by event type (single/multi/scholarship).
 * Within each type group: prelims first (quarter before semi), then finals.
 */
function buildStyleBlockEntries(
  eventList: Event[],
  styles: string[],
  sortFn: (a: Event, b: Event) => number,
): EntryWithEvent[] {
  const ROUND_ORDER = ['quarter-final', 'semi-final'];
  const eventsByStyle = new Map<string, Event[]>();
  for (const event of eventList) {
    const style = event.style || '';
    if (!eventsByStyle.has(style)) eventsByStyle.set(style, []);
    eventsByStyle.get(style)!.push(event);
  }

  const allEntries: EntryWithEvent[] = [];
  const processedStyles = new Set<string>();

  for (const style of styles) {
    processedStyles.add(style);
    const styleEvents = (eventsByStyle.get(style) || []).sort(sortFn);

    // Group events by type priority (0=single, 1=multi, 2=scholarship)
    const typeGroups = new Map<number, Event[]>();
    for (const event of styleEvents) {
      const priority = getEventTypePriority(event);
      if (!typeGroups.has(priority)) typeGroups.set(priority, []);
      typeGroups.get(priority)!.push(event);
    }

    // Process each type group in order (0, 1, 2)
    for (const typePriority of [0, 1, 2]) {
      const groupEvents = typeGroups.get(typePriority);
      if (!groupEvents || groupEvents.length === 0) continue;

      // Emit entries sorted by level (via sortFn), then by round depth within each event.
      // This keeps the natural level progression (Bronze → Silver → Gold → Open)
      // while putting earlier rounds first. separateEventRounds handles spacing.
      const entries: EntryWithEvent[] = [];
      for (const event of groupEvents) {
        const totalCouples = event.heats[0]?.bibs.length ?? 0;
        for (const heat of event.heats) {
          entries.push({ entry: { eventId: event.id, round: heat.round }, event, coupleCount: totalCouples });
        }
      }

      entries.sort((a, b) => {
        // Primary: event ordering (style → eventType → level → dance)
        const eventCmp = sortFn(a.event, b.event);
        if (eventCmp !== 0) return eventCmp;
        // Secondary: round depth within the same event (QF < SF < Final)
        const rA = ROUND_ORDER.indexOf(a.entry.round);
        const rB = ROUND_ORDER.indexOf(b.entry.round);
        const roundA = rA === -1 ? ROUND_ORDER.length : rA;
        const roundB = rB === -1 ? ROUND_ORDER.length : rB;
        return roundA - roundB;
      });

      allEntries.push(...entries);
    }
  }

  // Handle events with unrecognized styles
  for (const [style, events] of eventsByStyle) {
    if (processedStyles.has(style)) continue;
    events.sort(sortFn);
    for (const event of events) {
      const totalCouples = event.heats[0]?.bibs.length ?? 0;
      for (const heat of event.heats) {
        allEntries.push({ entry: { eventId: event.id, round: heat.round }, event, coupleCount: totalCouples });
      }
    }
  }

  return allEntries;
}

/**
 * Merge compatible entries into multi-entry heats using first-fit-decreasing.
 * Two entries can share a heat if they have the same style, dances, and scoringType,
 * their combined couple count doesn't exceed maxCouples, and neither event has
 * multiple rounds (events with multiple rounds are never combined).
 */
export function mergeEntries(
  items: Array<{ entry: HeatEntry; event: Event; coupleCount: number }>,
  maxCouples: number,
): ScheduledHeat[] {
  // Events with multiple rounds are never combined — give each its own heat
  const mergeable: typeof items = [];
  const result: ScheduledHeat[] = [];

  for (const item of items) {
    if (item.event.heats.length > 1) {
      result.push({
        id: generateHeatId(),
        entries: [item.entry],
      });
    } else {
      mergeable.push(item);
    }
  }

  // Group mergeable entries by key: (style, dances sorted, scoringType)
  const groups = new Map<string, typeof items>();
  for (const item of mergeable) {
    const danceKey = (item.event.dances || []).slice().sort().join(',');
    const key = `${item.event.style || ''}|${danceKey}|${item.event.scoringType || 'standard'}|${item.event.isScholarship ? 'sch' : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const [, group] of groups) {
    // Sort by couple count descending for first-fit-decreasing packing
    const sorted = [...group].sort((a, b) => b.coupleCount - a.coupleCount);

    const heats: { entries: HeatEntry[]; totalCouples: number }[] = [];

    for (const item of sorted) {
      let placed = false;
      for (const heat of heats) {
        if (heat.totalCouples + item.coupleCount <= maxCouples) {
          // Section events with the same sectionGroupId must never share a heat
          if (item.event.sectionGroupId) {
            const hasGroupConflict = heat.entries.some(existingEntry => {
              const existingItem = sorted.find(s => s.entry.eventId === existingEntry.eventId);
              return existingItem?.event.sectionGroupId === item.event.sectionGroupId;
            });
            if (hasGroupConflict) continue;
          }
          heat.entries.push(item.entry);
          heat.totalCouples += item.coupleCount;
          placed = true;
          break;
        }
      }
      if (!placed) {
        heats.push({ entries: [item.entry], totalCouples: item.coupleCount });
      }
    }

    for (const heat of heats) {
      result.push({
        id: generateHeatId(),
        entries: heat.entries,
      });
    }
  }

  // Sort result heats by style/level of their first entry to maintain ordering
  result.sort((a, b) => {
    const aFirst = items.find(i => i.entry.eventId === a.entries[0]?.eventId);
    const bFirst = items.find(i => i.entry.eventId === b.entries[0]?.eventId);
    if (!aFirst || !bFirst) return 0;
    const aIdx = items.indexOf(aFirst);
    const bIdx = items.indexOf(bFirst);
    return aIdx - bIdx;
  });

  return result;
}

/**
 * Post-process the heat order to split rounds that exceed the floor capacity.
 * Only applies to single-entry heats (not merged heats or breaks).
 * For multi-dance events, creates N × D heats ordered by dance then floor heat.
 */
async function applyFloorHeatSplitting(
  heatOrder: ScheduledHeat[],
  competitionId: number,
): Promise<ScheduledHeat[]> {
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition?.maxCouplesOnFloor && !competition?.maxCouplesOnFloorByLevel) {
    return heatOrder;
  }

  const result: ScheduledHeat[] = [];

  for (const heat of heatOrder) {
    if (heat.isBreak || heat.entries.length !== 1) {
      result.push(heat);
      continue;
    }

    const entry = heat.entries[0];
    const event = await dataService.getEventById(entry.eventId);
    if (!event) {
      result.push(heat);
      continue;
    }

    const heatData = event.heats.find(h => h.round === entry.round);
    if (!heatData) {
      result.push(heat);
      continue;
    }

    const levelMax = competition.maxCouplesOnFloorByLevel?.[event.level || ''];
    const floorMax = levelMax ?? competition.maxCouplesOnFloor;

    if (!floorMax || heatData.bibs.length <= floorMax) {
      result.push(heat);
      continue;
    }

    const groupCount = Math.ceil(heatData.bibs.length / floorMax);
    const chunks = splitBibsEvenly(heatData.bibs, groupCount);
    const totalFloorHeats = chunks.length;
    const isMultiDance = event.dances && event.dances.length > 1;

    if (isMultiDance) {
      for (const dance of event.dances!) {
        for (let i = 0; i < chunks.length; i++) {
          result.push({
            id: generateHeatId(),
            entries: [{
              eventId: entry.eventId,
              round: entry.round,
              bibSubset: chunks[i],
              floorHeatIndex: i,
              totalFloorHeats,
              dance,
            }],
          });
        }
      }
    } else {
      for (let i = 0; i < chunks.length; i++) {
        result.push({
          id: generateHeatId(),
          entries: [{
            eventId: entry.eventId,
            round: entry.round,
            bibSubset: chunks[i],
            floorHeatIndex: i,
            totalFloorHeats,
          }],
        });
      }
    }
  }

  return result;
}
