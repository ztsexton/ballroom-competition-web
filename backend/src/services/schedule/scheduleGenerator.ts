import { CompetitionSchedule, ScheduledHeat, HeatEntry, Event, EventRunStatus, AutoBreaksConfig } from '../../types';
import { dataService } from '../dataService';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { DEFAULT_STYLE_ORDER, DEFAULT_DANCE_ORDER, getDancesForStyle } from '../../constants/dances';
import { heatKey, generateHeatId, recalculateTimingIfConfigured, splitBibsEvenly } from './helpers';
import { autoAssignJudges } from './judgeAssignment';
const DEFAULT_MAX_COUPLES_PER_HEAT = 6;

export async function generateSchedule(
  competitionId: number,
  styleOrder?: string[],
  levelOrder?: string[],
  danceOrder?: Record<string, string[]>,
  autoBreaks?: AutoBreaksConfig,
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

    const lA = levels.indexOf(a.level || '');
    const lB = levels.indexOf(b.level || '');
    const levelA = lA === -1 ? levels.length : lA;
    const levelB = lB === -1 ? levels.length : lB;
    if (levelA !== levelB) return levelA - levelB;

    // Within the same style and level, sort by first dance position in the dance order
    const styleDances = getDancesForStyle(a.style || '', dances);
    const dA = a.dances?.[0] || '';
    const dB = b.dances?.[0] || '';
    const dIdxA = styleDances.indexOf(dA);
    const dIdxB = styleDances.indexOf(dB);
    const danceA = dIdxA === -1 ? styleDances.length : dIdxA;
    const danceB = dIdxB === -1 ? styleDances.length : dIdxB;
    return danceA - danceB;
  };

  // Build entry lists per round depth, sorted by style+level
  type EntryWithEvent = { entry: HeatEntry; event: Event; coupleCount: number };
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

  // Sort within each bucket by style then level
  for (const bucket of buckets) {
    bucket.sort((a, b) => sortByStyleLevel(a.event, b.event));
  }

  // Merge compatible events within each bucket
  const mergedBuckets: ScheduledHeat[][] = [];
  for (const bucket of buckets) {
    mergedBuckets.push(mergeEntries(bucket, maxCouples));
  }

  const rawHeatOrder = [...mergedBuckets[0], ...mergedBuckets[1], ...mergedBuckets[2]];
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

/**
 * Merge compatible entries into multi-entry heats using first-fit-decreasing.
 * Two entries can share a heat if they have the same style, dances, and scoringType,
 * their combined couple count doesn't exceed maxCouples, and neither event has
 * multiple rounds (events with multiple rounds are never combined).
 */
function mergeEntries(
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
    const key = `${item.event.style || ''}|${danceKey}|${item.event.scoringType || 'standard'}`;
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
