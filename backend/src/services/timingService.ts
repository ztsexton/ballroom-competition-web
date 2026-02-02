import { TimingSettings, ScheduledHeat, Event } from '../types';

export const DEFAULT_TIMING: TimingSettings = {
  defaultDanceDurationSeconds: 75,
  scholarshipDurationSeconds: 90,
  betweenDanceSeconds: 35,
  betweenHeatSeconds: 45,
};

export class TimingService {
  /**
   * Calculate the duration in seconds for a single heat.
   */
  calculateHeatDuration(
    heat: ScheduledHeat,
    events: Record<number, Event>,
    settings: TimingSettings,
  ): number {
    if (heat.isBreak) {
      return (heat.breakDuration || 0) * 60;
    }

    const allDances: string[] = [];
    const seen = new Set<string>();
    let isScholarship = false;
    let heatLevel: string | undefined;

    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      if (event.isScholarship) isScholarship = true;
      if (event.level && !heatLevel) heatLevel = event.level;
      if (event.dances && event.dances.length > 1) {
        for (const d of event.dances) {
          if (!seen.has(d)) { seen.add(d); allDances.push(d); }
        }
      }
    }

    const danceCount = Math.max(allDances.length, 1);

    let danceDuration = settings.defaultDanceDurationSeconds;
    if (isScholarship && settings.scholarshipDurationSeconds) {
      danceDuration = settings.scholarshipDurationSeconds;
    } else if (heatLevel && settings.levelDurationOverrides?.[heatLevel]) {
      danceDuration = settings.levelDurationOverrides[heatLevel];
    }

    const totalDanceTime = danceCount * danceDuration;
    const betweenDanceTime = danceCount > 1
      ? (danceCount - 1) * settings.betweenDanceSeconds
      : 0;

    return totalDanceTime + betweenDanceTime;
  }

  /**
   * Calculate estimated start times for all heats from a start time.
   * Mutates heatOrder in place, setting estimatedStartTime and estimatedDurationSeconds.
   */
  calculateEstimatedTimes(
    heatOrder: ScheduledHeat[],
    events: Record<number, Event>,
    settings: TimingSettings,
  ): number {
    if (!settings.startTime) return 0;

    let currentTime = new Date(settings.startTime).getTime();
    let totalDuration = 0;

    for (let i = 0; i < heatOrder.length; i++) {
      const heat = heatOrder[i];
      heat.estimatedStartTime = new Date(currentTime).toISOString();

      const duration = this.calculateHeatDuration(heat, events, settings);
      heat.estimatedDurationSeconds = duration;

      currentTime += duration * 1000;

      if (i < heatOrder.length - 1 && !heat.isBreak) {
        currentTime += settings.betweenHeatSeconds * 1000;
      }

      totalDuration += duration;
      if (i < heatOrder.length - 1 && !heat.isBreak) {
        totalDuration += settings.betweenHeatSeconds;
      }
    }

    return totalDuration;
  }

  /**
   * Recalculate future heat times from a given index forward,
   * using an anchor time (or Date.now()).
   */
  recalculateFromIndex(
    heatOrder: ScheduledHeat[],
    fromIndex: number,
    events: Record<number, Event>,
    settings: TimingSettings,
    anchorTime?: string,
  ): void {
    let currentTime: number;

    if (anchorTime) {
      currentTime = new Date(anchorTime).getTime();
    } else if (heatOrder[fromIndex]?.actualStartTime) {
      currentTime = new Date(heatOrder[fromIndex].actualStartTime!).getTime();
    } else {
      currentTime = Date.now();
    }

    for (let i = fromIndex; i < heatOrder.length; i++) {
      const heat = heatOrder[i];

      if (i === fromIndex && heat.actualStartTime) {
        const duration = this.calculateHeatDuration(heat, events, settings);
        heat.estimatedDurationSeconds = duration;
        currentTime = new Date(heat.actualStartTime).getTime() + duration * 1000;
        if (i < heatOrder.length - 1 && !heat.isBreak) {
          currentTime += settings.betweenHeatSeconds * 1000;
        }
        continue;
      }

      heat.estimatedStartTime = new Date(currentTime).toISOString();
      const duration = this.calculateHeatDuration(heat, events, settings);
      heat.estimatedDurationSeconds = duration;

      currentTime += duration * 1000;
      if (i < heatOrder.length - 1 && !heat.isBreak) {
        currentTime += settings.betweenHeatSeconds * 1000;
      }
    }
  }
}

export const timingService = new TimingService();
