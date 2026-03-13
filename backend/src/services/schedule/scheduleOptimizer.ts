import { CompetitionSchedule, ScheduledHeat, ScheduleDayConfig, LevelCombiningConfig, Event, TimingSettings, AutoBreaksConfig } from '../../types';
import { dataService } from '../dataService';
import { timingService, DEFAULT_TIMING } from '../timingService';
import { updateHeatEntries } from './scheduleModification';
import { mergeEntries, getEventTypePriority, DEFAULT_EVENT_TYPE_ORDER, separateEventRounds } from './scheduleGenerator';
import { getDancesForStyle } from '../../constants/dances';
import { DEFAULT_STYLE_ORDER } from '../../constants/dances';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { generateHeatId } from './helpers';

export interface ScheduleSuggestion {
  type: 'merge' | 'increase-max-couples';
  description: string;
  details: {
    sourceIndex?: number;
    targetIndex?: number;
    newMaxCouples?: number;
  };
  estimatedTimeSavingMinutes: number;
}

export interface ScheduleAnalysis {
  estimatedDurationMinutes: number;
  availableMinutes: number | null;
  overflowMinutes: number;
  fitsInWindow: boolean;
  hardStopTime?: string;
  estimatedEndTime?: string;
  exceedsHardStop: boolean;
  hardStopOverflowMinutes: number;
  suggestions: ScheduleSuggestion[];
}

function calculateAvailableMinutes(dayConfigs: ScheduleDayConfig[]): number {
  let total = 0;
  for (const dc of dayConfigs) {
    const [sh, sm] = dc.startTime.split(':').map(Number);
    const [eh, em] = dc.endTime.split(':').map(Number);
    total += (eh * 60 + em) - (sh * 60 + sm);
  }
  return total;
}

function calculateEstimatedDuration(
  schedule: CompetitionSchedule,
  events: Record<number, import('../../types').Event>,
  timingSettings: import('../../types').TimingSettings,
): number {
  const settings = { ...DEFAULT_TIMING, ...timingSettings };
  const totalSeconds = timingService.calculateEstimatedTimes(
    schedule.heatOrder, events, settings
  );
  return Math.ceil(totalSeconds / 60);
}

function areMergeable(
  sourceHeat: ScheduledHeat,
  targetHeat: ScheduledHeat,
  events: Record<number, import('../../types').Event>,
  maxCouples: number,
  heatStatuses: Record<string, string>,
): boolean {
  if (sourceHeat.isBreak || targetHeat.isBreak) return false;
  if (sourceHeat.entries.length === 0 || targetHeat.entries.length === 0) return false;

  // Status check
  const srcStatus = heatStatuses[sourceHeat.id] || 'pending';
  const tgtStatus = heatStatuses[targetHeat.id] || 'pending';
  if (srcStatus !== 'pending' || tgtStatus !== 'pending') return false;

  // Round mismatch
  const srcRound = sourceHeat.entries[0].round;
  const tgtRound = targetHeat.entries[0].round;
  if (srcRound !== tgtRound) return false;

  // Style check
  let srcStyle: string | undefined;
  let tgtStyle: string | undefined;
  let totalCouples = 0;

  for (const entry of sourceHeat.entries) {
    const event = events[entry.eventId];
    if (!event) return false;
    if (event.heats.length > 1) return false; // Multi-round event
    srcStyle = event.style || '';
    totalCouples += event.heats[0]?.bibs.length ?? 0;
  }

  for (const entry of targetHeat.entries) {
    const event = events[entry.eventId];
    if (!event) return false;
    if (event.heats.length > 1) return false;
    tgtStyle = event.style || '';
    totalCouples += event.heats[0]?.bibs.length ?? 0;
  }

  if (srcStyle && tgtStyle && srcStyle !== tgtStyle) return false;
  if (totalCouples > maxCouples) return false;

  // Overlapping bibs
  const srcBibs = new Set<number>();
  for (const entry of sourceHeat.entries) {
    const event = events[entry.eventId];
    if (event) event.heats.forEach(h => h.bibs.forEach(b => srcBibs.add(b)));
  }
  for (const entry of targetHeat.entries) {
    const event = events[entry.eventId];
    if (event) {
      for (const h of event.heats) {
        for (const b of h.bibs) {
          if (srcBibs.has(b)) return false;
        }
      }
    }
  }

  return true;
}

export async function analyzeSchedule(competitionId: number): Promise<ScheduleAnalysis> {
  const emptyResult: ScheduleAnalysis = {
    estimatedDurationMinutes: 0, availableMinutes: null, overflowMinutes: 0,
    fitsInWindow: true, exceedsHardStop: false, hardStopOverflowMinutes: 0, suggestions: [],
  };

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) return emptyResult;

  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return emptyResult;

  const events = await dataService.getEvents(competitionId);
  const timingSettings = competition.timingSettings || DEFAULT_TIMING;
  const maxCouples = competition.maxCouplesPerHeat ?? 6;

  const estimatedDurationMinutes = calculateEstimatedDuration(schedule, events, timingSettings);

  let availableMinutes: number | null = null;
  if (competition.scheduleDayConfigs && competition.scheduleDayConfigs.length > 0) {
    availableMinutes = calculateAvailableMinutes(competition.scheduleDayConfigs);
  }

  const overflowMinutes = availableMinutes !== null
    ? Math.max(0, estimatedDurationMinutes - availableMinutes)
    : 0;
  const fitsInWindow = availableMinutes === null || estimatedDurationMinutes <= availableMinutes;

  const suggestions: ScheduleSuggestion[] = [];

  // Hard stop calculation
  let exceedsHardStop = false;
  let hardStopOverflowMinutes = 0;
  let estimatedEndTime: string | undefined;

  if (competition.hardStopTime && timingSettings.startTime) {
    const startMs = new Date(timingSettings.startTime).getTime();
    const endMs = startMs + estimatedDurationMinutes * 60000;
    const endDate = new Date(endMs);
    estimatedEndTime = endDate.toISOString();

    // Parse hard stop as HH:MM on the same date as start
    const [hh, mm] = competition.hardStopTime.split(':').map(Number);
    const hardStopDate = new Date(timingSettings.startTime);
    hardStopDate.setHours(hh, mm, 0, 0);
    const hardStopMs = hardStopDate.getTime();

    if (endMs > hardStopMs) {
      exceedsHardStop = true;
      hardStopOverflowMinutes = Math.ceil((endMs - hardStopMs) / 60000);
    }
  }

  const needsSuggestions = !fitsInWindow || exceedsHardStop;

  if (needsSuggestions) {
    // Suggest merging compatible adjacent heats
    const betweenHeatMinutes = (timingSettings.betweenHeatSeconds ?? DEFAULT_TIMING.betweenHeatSeconds) / 60;

    for (let i = 0; i < schedule.heatOrder.length - 1; i++) {
      const source = schedule.heatOrder[i];
      const target = schedule.heatOrder[i + 1];

      if (areMergeable(source, target, events, maxCouples, schedule.heatStatuses)) {
        const sourceLabel = source.entries.map(e => events[e.eventId]?.name || `Event #${e.eventId}`).join(' + ');
        const targetLabel = target.entries.map(e => events[e.eventId]?.name || `Event #${e.eventId}`).join(' + ');

        suggestions.push({
          type: 'merge',
          description: `Merge "${sourceLabel}" with "${targetLabel}"`,
          details: { sourceIndex: i, targetIndex: i + 1 },
          estimatedTimeSavingMinutes: Math.round(betweenHeatMinutes * 10) / 10,
        });
      }
    }

    // If merges alone aren't enough, suggest increasing maxCouplesPerHeat
    const targetOverflow = Math.max(overflowMinutes, hardStopOverflowMinutes);
    const totalMergeSavings = suggestions.reduce((sum, s) => sum + s.estimatedTimeSavingMinutes, 0);
    if (totalMergeSavings < targetOverflow) {
      const suggestedMax = maxCouples + 2;
      suggestions.push({
        type: 'increase-max-couples',
        description: `Increase max couples per heat from ${maxCouples} to ${suggestedMax}`,
        details: { newMaxCouples: suggestedMax },
        estimatedTimeSavingMinutes: 0, // Varies — requires re-generation
      });
    }
  }

  return {
    estimatedDurationMinutes,
    availableMinutes,
    overflowMinutes,
    fitsInWindow,
    hardStopTime: competition.hardStopTime,
    estimatedEndTime,
    exceedsHardStop,
    hardStopOverflowMinutes,
    suggestions,
  };
}

// ---- Consolidation Preview ----

export interface ConsolidationChanges {
  maxCouplesPerHeat?: number;
  levelCombining?: LevelCombiningConfig;
  defaultDanceDurationSeconds?: number;
  scholarshipDurationSeconds?: number;
  betweenHeatSeconds?: number;
  betweenDanceSeconds?: number;
}

export interface ConsolidationStrategy {
  id: string;
  name: string;
  description: string;
  category: 'couples' | 'levels' | 'timing' | 'combined';
  changes: ConsolidationChanges;
  totalHeats: number;
  estimatedDurationMinutes: number;
  timeSavedMinutes: number;
  fitsInWindow: boolean;
}

export interface ConsolidationPreview {
  currentHeats: number;
  currentDurationMinutes: number;
  availableMinutes: number | null;
  overflowMinutes: number;
  strategies: ConsolidationStrategy[];
}

/**
 * Simulate schedule generation with given params and return heat count + estimated duration.
 * Does NOT save anything — purely read-only.
 */
function simulateSchedule(
  eventList: Event[],
  events: Record<number, Event>,
  maxCouples: number,
  levelCombining: LevelCombiningConfig | undefined,
  timingSettings: TimingSettings,
  styleOrder: string[],
  levelOrder: string[],
  danceOrder: Record<string, string[]>,
  autoBreaks?: AutoBreaksConfig,
): { totalHeats: number; durationMinutes: number } {
  const styles = styleOrder;
  const levels = levelOrder;
  const dances = danceOrder;
  const typeOrder = DEFAULT_EVENT_TYPE_ORDER;

  const sortByStyleLevel = (a: Event, b: Event) => {
    const sA = styles.indexOf(a.style || '');
    const sB = styles.indexOf(b.style || '');
    const styleA = sA === -1 ? styles.length : sA;
    const styleB = sB === -1 ? styles.length : sB;
    if (styleA !== styleB) return styleA - styleB;
    const typeA = getEventTypePriority(a, typeOrder);
    const typeB = getEventTypePriority(b, typeOrder);
    if (typeA !== typeB) return typeA - typeB;
    const lA = levels.indexOf(a.level || '');
    const lB = levels.indexOf(b.level || '');
    const levelA = lA === -1 ? levels.length : lA;
    const levelB = lB === -1 ? levels.length : lB;
    if (levelA !== levelB) return levelA - levelB;
    const styleDances = getDancesForStyle(a.style || '', dances);
    const dA = a.dances?.[0] || '';
    const dB = b.dances?.[0] || '';
    const dIdxA = styleDances.indexOf(dA);
    const dIdxB = styleDances.indexOf(dB);
    const danceA = dIdxA === -1 ? styleDances.length : dIdxA;
    const danceB = dIdxB === -1 ? styleDances.length : dIdxB;
    return danceA - danceB;
  };

  // Build entries (style-block mode, no deferred finals for simulation)
  const ROUND_ORDER = ['quarter-final', 'semi-final'];
  const eventsByStyle = new Map<string, Event[]>();
  for (const event of eventList) {
    const style = event.style || '';
    if (!eventsByStyle.has(style)) eventsByStyle.set(style, []);
    eventsByStyle.get(style)!.push(event);
  }

  type EntryWithEvent = { entry: { eventId: number; round: string }; event: Event; coupleCount: number };
  const allItems: EntryWithEvent[] = [];
  const processedStyles = new Set<string>();

  for (const style of styles) {
    processedStyles.add(style);
    const styleEvents = (eventsByStyle.get(style) || []).sort(sortByStyleLevel);
    const typeGroups = new Map<number, Event[]>();
    for (const event of styleEvents) {
      const priority = getEventTypePriority(event, typeOrder);
      if (!typeGroups.has(priority)) typeGroups.set(priority, []);
      typeGroups.get(priority)!.push(event);
    }
    for (const typePriority of [0, 1, 2]) {
      const groupEvents = typeGroups.get(typePriority);
      if (!groupEvents || groupEvents.length === 0) continue;
      const entries: EntryWithEvent[] = [];
      for (const event of groupEvents) {
        const totalCouples = event.heats[0]?.bibs.length ?? 0;
        for (const heat of event.heats) {
          entries.push({ entry: { eventId: event.id, round: heat.round }, event, coupleCount: totalCouples });
        }
      }
      entries.sort((a, b) => {
        const eventCmp = sortByStyleLevel(a.event, b.event);
        if (eventCmp !== 0) return eventCmp;
        const rA = ROUND_ORDER.indexOf(a.entry.round);
        const rB = ROUND_ORDER.indexOf(b.entry.round);
        return (rA === -1 ? ROUND_ORDER.length : rA) - (rB === -1 ? ROUND_ORDER.length : rB);
      });
      allItems.push(...entries);
    }
  }
  for (const [style, evts] of eventsByStyle) {
    if (processedStyles.has(style)) continue;
    evts.sort(sortByStyleLevel);
    for (const event of evts) {
      const totalCouples = event.heats[0]?.bibs.length ?? 0;
      for (const heat of event.heats) {
        allItems.push({ entry: { eventId: event.id, round: heat.round }, event, coupleCount: totalCouples });
      }
    }
  }

  let heatOrder = mergeEntries(allItems, maxCouples, levelCombining);

  // Add auto breaks if configured
  if (autoBreaks?.enabled) {
    const breakLabel = autoBreaks.label || 'Break';
    const breakDuration = autoBreaks.durationMinutes ?? 5;
    const withBreaks: typeof heatOrder = [];
    let lastStyle: string | null = null;
    for (const heat of heatOrder) {
      const firstEntry = heat.entries[0];
      const event = firstEntry ? eventList.find(e => e.id === firstEntry.eventId) : undefined;
      const style = event?.style || null;
      if (style && lastStyle && style !== lastStyle) {
        withBreaks.push({ id: generateHeatId(), entries: [], isBreak: true, breakLabel, breakDuration });
      }
      withBreaks.push(heat);
      if (style) lastStyle = style;
    }
    heatOrder = withBreaks;
  }

  heatOrder = separateEventRounds(heatOrder);

  // Estimate duration
  const settings = { ...DEFAULT_TIMING, ...timingSettings };
  if (!settings.startTime) {
    settings.startTime = new Date().toISOString();
  }
  const totalSeconds = timingService.calculateEstimatedTimes(heatOrder, events, settings);
  const nonBreakHeats = heatOrder.filter(h => !h.isBreak).length;

  return {
    totalHeats: nonBreakHeats,
    durationMinutes: Math.ceil(totalSeconds / 60),
  };
}

export async function getConsolidationPreview(competitionId: number): Promise<ConsolidationPreview> {
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return { currentHeats: 0, currentDurationMinutes: 0, availableMinutes: null, overflowMinutes: 0, strategies: [] };
  }

  const schedule = await dataService.getSchedule(competitionId);
  const events = await dataService.getEvents(competitionId);
  const eventList = Object.values(events);
  const timingSettings = competition.timingSettings || DEFAULT_TIMING;
  const currentMax = competition.maxCouplesPerHeat ?? 6;
  const styleOrder = schedule?.styleOrder || DEFAULT_STYLE_ORDER;
  const levelOrder = schedule?.levelOrder || competition.levels || DEFAULT_LEVELS;
  const danceOrder = competition.danceOrder || {};
  const autoBreaks = schedule ? undefined : undefined; // Don't add breaks to simulations for cleaner comparison

  let availableMinutes: number | null = null;
  if (competition.scheduleDayConfigs && competition.scheduleDayConfigs.length > 0) {
    availableMinutes = calculateAvailableMinutes(competition.scheduleDayConfigs);
  }

  // Current schedule stats
  let currentHeats = 0;
  let currentDurationMinutes = 0;
  if (schedule) {
    currentHeats = schedule.heatOrder.filter(h => !h.isBreak).length;
    currentDurationMinutes = calculateEstimatedDuration(schedule, events, timingSettings);
  } else {
    // No schedule yet — simulate with current settings
    const sim = simulateSchedule(eventList, events, currentMax, undefined, timingSettings, styleOrder, levelOrder, danceOrder);
    currentHeats = sim.totalHeats;
    currentDurationMinutes = sim.durationMinutes;
  }

  const overflowMinutes = availableMinutes !== null
    ? Math.max(0, currentDurationMinutes - availableMinutes)
    : 0;

  const strategies: ConsolidationStrategy[] = [];
  const currentDanceDuration = timingSettings.defaultDanceDurationSeconds ?? DEFAULT_TIMING.defaultDanceDurationSeconds;
  const currentScholarshipDuration = timingSettings.scholarshipDurationSeconds ?? DEFAULT_TIMING.scholarshipDurationSeconds;
  const currentBetweenHeat = timingSettings.betweenHeatSeconds ?? DEFAULT_TIMING.betweenHeatSeconds;
  const currentBetweenDance = timingSettings.betweenDanceSeconds ?? DEFAULT_TIMING.betweenDanceSeconds;

  // --- Category: couples ---
  for (const bump of [2, 4, 6, 8]) {
    const newMax = currentMax + bump;
    const sim = simulateSchedule(eventList, events, newMax, undefined, timingSettings, styleOrder, levelOrder, danceOrder);
    const saved = currentDurationMinutes - sim.durationMinutes;
    if (saved <= 0) continue;

    strategies.push({
      id: `max-couples-${newMax}`,
      name: `${newMax} couples per heat`,
      description: `Increase max couples per heat from ${currentMax} to ${newMax}`,
      category: 'couples',
      changes: { maxCouplesPerHeat: newMax },
      totalHeats: sim.totalHeats,
      estimatedDurationMinutes: sim.durationMinutes,
      timeSavedMinutes: saved,
      fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
    });
  }

  // --- Category: levels ---
  const levelModes: Array<{ mode: LevelCombiningConfig; label: string; desc: string }> = [
    { mode: { mode: 'prefer-same' }, label: 'Prefer same level', desc: 'Combine same levels first, then merge under-filled heats cross-level' },
    { mode: { mode: 'any' }, label: 'Combine all levels', desc: 'Freely combine any levels into shared heats' },
  ];

  const customGroups: string[][] = [];
  let currentGroup: string[] = [];
  let currentBase = '';
  for (const level of levelOrder) {
    const base = level.replace(/\s*\d+$/, '');
    if (base !== currentBase && currentGroup.length > 0) {
      customGroups.push(currentGroup);
      currentGroup = [];
    }
    currentBase = base;
    currentGroup.push(level);
  }
  if (currentGroup.length > 0) customGroups.push(currentGroup);
  if (customGroups.some(g => g.length > 1)) {
    const groupDesc = customGroups.map(g => g.join('+')).join(', ');
    levelModes.push({
      mode: { mode: 'custom', customGroups },
      label: 'Custom level groups',
      desc: `Group similar levels: ${groupDesc}`,
    });
  }

  for (const lm of levelModes) {
    const sim = simulateSchedule(eventList, events, currentMax, lm.mode, timingSettings, styleOrder, levelOrder, danceOrder);
    const saved = currentDurationMinutes - sim.durationMinutes;
    if (saved <= 0) continue;

    strategies.push({
      id: `level-${lm.mode.mode}`,
      name: lm.label,
      description: lm.desc,
      category: 'levels',
      changes: { levelCombining: lm.mode },
      totalHeats: sim.totalHeats,
      estimatedDurationMinutes: sim.durationMinutes,
      timeSavedMinutes: saved,
      fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
    });
  }

  // --- Category: timing ---
  // Dance duration reductions
  for (const newDuration of [70, 65, 60, 55]) {
    if (newDuration >= currentDanceDuration) continue;
    const modifiedTiming = { ...timingSettings, defaultDanceDurationSeconds: newDuration };
    const sim = simulateSchedule(eventList, events, currentMax, undefined, modifiedTiming, styleOrder, levelOrder, danceOrder);
    const saved = currentDurationMinutes - sim.durationMinutes;
    if (saved <= 0) continue;

    strategies.push({
      id: `timing-dance-${newDuration}`,
      name: `Dance duration ${newDuration}s`,
      description: `Reduce default dance duration from ${currentDanceDuration}s to ${newDuration}s`,
      category: 'timing',
      changes: { defaultDanceDurationSeconds: newDuration },
      totalHeats: sim.totalHeats,
      estimatedDurationMinutes: sim.durationMinutes,
      timeSavedMinutes: saved,
      fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
    });
  }

  // Scholarship duration reductions
  if (currentScholarshipDuration) {
    for (const newDuration of [80, 75, 70, 60]) {
      if (newDuration >= currentScholarshipDuration) continue;
      const modifiedTiming = { ...timingSettings, scholarshipDurationSeconds: newDuration };
      const sim = simulateSchedule(eventList, events, currentMax, undefined, modifiedTiming, styleOrder, levelOrder, danceOrder);
      const saved = currentDurationMinutes - sim.durationMinutes;
      if (saved <= 0) continue;

      strategies.push({
        id: `timing-scholarship-${newDuration}`,
        name: `Scholarship duration ${newDuration}s`,
        description: `Reduce scholarship dance duration from ${currentScholarshipDuration}s to ${newDuration}s`,
        category: 'timing',
        changes: { scholarshipDurationSeconds: newDuration },
        totalHeats: sim.totalHeats,
        estimatedDurationMinutes: sim.durationMinutes,
        timeSavedMinutes: saved,
        fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
      });
    }
  }

  // Between-heat gap reductions
  for (const newGap of [35, 30, 25, 20]) {
    if (newGap >= currentBetweenHeat) continue;
    const modifiedTiming = { ...timingSettings, betweenHeatSeconds: newGap };
    const sim = simulateSchedule(eventList, events, currentMax, undefined, modifiedTiming, styleOrder, levelOrder, danceOrder);
    const saved = currentDurationMinutes - sim.durationMinutes;
    if (saved <= 0) continue;

    strategies.push({
      id: `timing-between-heat-${newGap}`,
      name: `Heat gap ${newGap}s`,
      description: `Reduce between-heat gap from ${currentBetweenHeat}s to ${newGap}s`,
      category: 'timing',
      changes: { betweenHeatSeconds: newGap },
      totalHeats: sim.totalHeats,
      estimatedDurationMinutes: sim.durationMinutes,
      timeSavedMinutes: saved,
      fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
    });
  }

  // Between-dance gap reductions
  for (const newGap of [25, 20, 15]) {
    if (newGap >= currentBetweenDance) continue;
    const modifiedTiming = { ...timingSettings, betweenDanceSeconds: newGap };
    const sim = simulateSchedule(eventList, events, currentMax, undefined, modifiedTiming, styleOrder, levelOrder, danceOrder);
    const saved = currentDurationMinutes - sim.durationMinutes;
    if (saved <= 0) continue;

    strategies.push({
      id: `timing-between-dance-${newGap}`,
      name: `Dance gap ${newGap}s`,
      description: `Reduce between-dance gap from ${currentBetweenDance}s to ${newGap}s`,
      category: 'timing',
      changes: { betweenDanceSeconds: newGap },
      totalHeats: sim.totalHeats,
      estimatedDurationMinutes: sim.durationMinutes,
      timeSavedMinutes: saved,
      fitsInWindow: availableMinutes === null || sim.durationMinutes <= availableMinutes,
    });
  }

  // Sort within each category: by time saved descending
  strategies.sort((a, b) => {
    const catOrder = { couples: 0, levels: 1, timing: 2, combined: 3 };
    if (a.category !== b.category) return catOrder[a.category] - catOrder[b.category];
    return b.timeSavedMinutes - a.timeSavedMinutes;
  });

  return {
    currentHeats,
    currentDurationMinutes,
    availableMinutes,
    overflowMinutes,
    strategies,
  };
}

export function mergeConsolidationChanges(strategies: ConsolidationStrategy[]): ConsolidationChanges {
  const merged: ConsolidationChanges = {};
  for (const s of strategies) {
    if (s.changes.maxCouplesPerHeat !== undefined) {
      merged.maxCouplesPerHeat = Math.max(merged.maxCouplesPerHeat ?? 0, s.changes.maxCouplesPerHeat);
    }
    if (s.changes.levelCombining) {
      // Last one wins; strategies are sorted so more aggressive modes come later
      merged.levelCombining = s.changes.levelCombining;
    }
    if (s.changes.defaultDanceDurationSeconds !== undefined) {
      merged.defaultDanceDurationSeconds = Math.min(
        merged.defaultDanceDurationSeconds ?? Infinity,
        s.changes.defaultDanceDurationSeconds,
      );
    }
    if (s.changes.scholarshipDurationSeconds !== undefined) {
      merged.scholarshipDurationSeconds = Math.min(
        merged.scholarshipDurationSeconds ?? Infinity,
        s.changes.scholarshipDurationSeconds,
      );
    }
    if (s.changes.betweenHeatSeconds !== undefined) {
      merged.betweenHeatSeconds = Math.min(
        merged.betweenHeatSeconds ?? Infinity,
        s.changes.betweenHeatSeconds,
      );
    }
    if (s.changes.betweenDanceSeconds !== undefined) {
      merged.betweenDanceSeconds = Math.min(
        merged.betweenDanceSeconds ?? Infinity,
        s.changes.betweenDanceSeconds,
      );
    }
  }
  return merged;
}

export interface CombinedSimulationResult {
  totalHeats: number;
  estimatedDurationMinutes: number;
  timeSavedMinutes: number;
  fitsInWindow: boolean;
  mergedChanges: ConsolidationChanges;
}

export async function simulateCombined(
  competitionId: number,
  strategyIds: string[],
): Promise<CombinedSimulationResult> {
  const preview = await getConsolidationPreview(competitionId);
  const selected = preview.strategies.filter(s => strategyIds.includes(s.id));

  if (selected.length === 0) {
    return {
      totalHeats: preview.currentHeats,
      estimatedDurationMinutes: preview.currentDurationMinutes,
      timeSavedMinutes: 0,
      fitsInWindow: preview.availableMinutes === null || preview.currentDurationMinutes <= preview.availableMinutes,
      mergedChanges: {},
    };
  }

  const mergedChanges = mergeConsolidationChanges(selected);

  // Load data for simulation
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return { totalHeats: 0, estimatedDurationMinutes: 0, timeSavedMinutes: 0, fitsInWindow: true, mergedChanges };
  }

  const events = await dataService.getEvents(competitionId);
  const eventList = Object.values(events);
  const schedule = await dataService.getSchedule(competitionId);
  const baseTimingSettings = competition.timingSettings || DEFAULT_TIMING;
  const currentMax = competition.maxCouplesPerHeat ?? 6;
  const styleOrder = schedule?.styleOrder || DEFAULT_STYLE_ORDER;
  const levelOrder = schedule?.levelOrder || competition.levels || DEFAULT_LEVELS;
  const danceOrder = competition.danceOrder || {};

  // Apply merged changes
  const simMax = mergedChanges.maxCouplesPerHeat ?? currentMax;
  const simLevelCombining = mergedChanges.levelCombining;
  const simTiming: TimingSettings = {
    ...baseTimingSettings,
    ...(mergedChanges.defaultDanceDurationSeconds !== undefined && { defaultDanceDurationSeconds: mergedChanges.defaultDanceDurationSeconds }),
    ...(mergedChanges.scholarshipDurationSeconds !== undefined && { scholarshipDurationSeconds: mergedChanges.scholarshipDurationSeconds }),
    ...(mergedChanges.betweenHeatSeconds !== undefined && { betweenHeatSeconds: mergedChanges.betweenHeatSeconds }),
    ...(mergedChanges.betweenDanceSeconds !== undefined && { betweenDanceSeconds: mergedChanges.betweenDanceSeconds }),
  };

  const sim = simulateSchedule(eventList, events, simMax, simLevelCombining, simTiming, styleOrder, levelOrder, danceOrder);

  return {
    totalHeats: sim.totalHeats,
    estimatedDurationMinutes: sim.durationMinutes,
    timeSavedMinutes: preview.currentDurationMinutes - sim.durationMinutes,
    fitsInWindow: preview.availableMinutes === null || sim.durationMinutes <= preview.availableMinutes,
    mergedChanges,
  };
}

export async function applySuggestions(
  competitionId: number,
  suggestionIndices: number[],
): Promise<CompetitionSchedule | null> {
  if (suggestionIndices.length === 0) {
    return (await dataService.getSchedule(competitionId)) ?? null;
  }

  const analysis = await analyzeSchedule(competitionId);

  // Sort descending so indices don't shift as we apply merges
  const sorted = [...suggestionIndices].sort((a, b) => b - a);

  for (const idx of sorted) {
    const suggestion = analysis.suggestions[idx];
    if (!suggestion || suggestion.type !== 'merge') continue;

    const { sourceIndex, targetIndex } = suggestion.details;
    if (sourceIndex === undefined || targetIndex === undefined) continue;

    // Re-fetch schedule each iteration since indices shift
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    // Validate indices are still in range
    if (sourceIndex >= schedule.heatOrder.length || targetIndex >= schedule.heatOrder.length) continue;

    const sourceHeat = schedule.heatOrder[sourceIndex];
    const targetHeat = schedule.heatOrder[targetIndex];
    if (!sourceHeat || !targetHeat) continue;

    const allEntries = [...sourceHeat.entries, ...targetHeat.entries];
    await updateHeatEntries(competitionId, sourceHeat.id, allEntries);
  }

  return (await dataService.getSchedule(competitionId)) ?? null;
}
