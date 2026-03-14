import { CompetitionSchedule, ScheduledHeat, EventRunStatus } from '../../types';
import { dataService } from '../dataService';
import { timingService, DEFAULT_TIMING } from '../timingService';

export function heatKey(heat: ScheduledHeat): string {
  return heat.id;
}

export function generateHeatId(): string {
  return `heat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Split bibs into N groups as evenly as possible, sorted by bib number.
 * E.g. 10 bibs into 3 groups → [4, 3, 3], not [4, 4, 2].
 * Bibs are sorted numerically so heat 1 gets the lowest bibs.
 */
export function splitBibsEvenly(bibs: number[], groupCount: number): number[][] {
  const sorted = [...bibs].sort((a, b) => a - b);
  const baseSize = Math.floor(sorted.length / groupCount);
  const remainder = sorted.length % groupCount;
  const chunks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < groupCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    chunks.push(sorted.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

/**
 * Get the ordered union of dances across all entries in a heat.
 * Returns empty array for single-dance or no-dance heats.
 */
export async function getDancesForHeat(heat: ScheduledHeat): Promise<string[]> {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of heat.entries) {
    const event = await dataService.getEventById(entry.eventId);
    if (event?.dances && event.dances.length > 1) {
      for (const d of event.dances) {
        if (!seen.has(d)) {
          seen.add(d);
          result.push(d);
        }
      }
    }
  }
  return result;
}

/**
 * Migrate old-format schedules (eventId/round on ScheduledHeat) to new format (entries array + id).
 */
export function migrateSchedule(schedule: CompetitionSchedule): CompetitionSchedule {
  if (schedule.heatOrder.length === 0) return schedule;

  // Detect old format: first non-break heat has no `id` field
  const firstHeat = schedule.heatOrder[0];
  if (firstHeat.id && firstHeat.entries) return schedule; // Already new format

  const newHeatOrder: ScheduledHeat[] = [];
  const newStatuses: Record<string, EventRunStatus> = {};

  for (const oldHeat of schedule.heatOrder as any[]) {
    const id = `heat-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newHeat: ScheduledHeat = {
      id,
      entries: oldHeat.isBreak ? [] : [{ eventId: oldHeat.eventId, round: oldHeat.round }],
      isBreak: oldHeat.isBreak,
      breakLabel: oldHeat.breakLabel,
      breakDuration: oldHeat.breakDuration,
    };
    newHeatOrder.push(newHeat);

    const oldKey = `${oldHeat.eventId}:${oldHeat.round}`;
    newStatuses[id] = schedule.heatStatuses[oldKey] || 'pending';
  }

  schedule.heatOrder = newHeatOrder;
  schedule.heatStatuses = newStatuses;
  return schedule;
}

/**
 * Derive a full ISO start time from scheduleDayConfigs and competition date.
 * scheduleDayConfigs stores time-only strings like "08:00",
 * so we combine with the competition date to get a proper datetime.
 */
export function deriveStartTime(competition: { date: string; scheduleDayConfigs?: { startTime: string }[] }): string | undefined {
  const dayConfig = competition.scheduleDayConfigs?.[0];
  if (!dayConfig?.startTime) return undefined;
  const [h, m] = dayConfig.startTime.split(':').map(Number);
  const d = new Date(competition.date + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export async function recalculateTimingIfConfigured(
  competitionId: number,
  schedule: CompetitionSchedule,
): Promise<CompetitionSchedule> {
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) return schedule;

  // Prefer scheduleDayConfigs start time (user-configured) over timingSettings.startTime (may be stale)
  const effectiveStartTime = deriveStartTime(competition) || competition.timingSettings?.startTime;
  if (!effectiveStartTime) return schedule;

  const events = await dataService.getEvents(competitionId);
  const settings = { ...DEFAULT_TIMING, ...competition.timingSettings, startTime: effectiveStartTime };
  timingService.calculateEstimatedTimes(schedule.heatOrder, events, settings);
  return await dataService.saveSchedule(schedule);
}
