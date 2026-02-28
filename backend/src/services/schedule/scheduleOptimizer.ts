import { CompetitionSchedule, ScheduledHeat, ScheduleDayConfig } from '../../types';
import { dataService } from '../dataService';
import { timingService, DEFAULT_TIMING } from '../timingService';
import { updateHeatEntries } from './scheduleModification';

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
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return { estimatedDurationMinutes: 0, availableMinutes: null, overflowMinutes: 0, fitsInWindow: true, suggestions: [] };
  }

  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) {
    return { estimatedDurationMinutes: 0, availableMinutes: null, overflowMinutes: 0, fitsInWindow: true, suggestions: [] };
  }

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

  if (!fitsInWindow) {
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
    const totalMergeSavings = suggestions.reduce((sum, s) => sum + s.estimatedTimeSavingMinutes, 0);
    if (totalMergeSavings < overflowMinutes) {
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
    suggestions,
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
