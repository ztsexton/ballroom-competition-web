import { CompetitionSchedule } from '../../types';
import { dataService } from '../dataService';
import { timingService, DEFAULT_TIMING } from '../timingService';
import { heatKey, getDancesForHeat } from './helpers';

export async function advanceHeat(competitionId: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  if (!currentHeat) return schedule;

  const key = heatKey(currentHeat);
  const currentStatus = schedule.heatStatuses[key] || 'pending';

  if (currentHeat.isBreak) {
    if (currentStatus === 'pending') {
      schedule.heatStatuses[key] = 'completed';
      if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
        schedule.currentHeatIndex++;
      }
    } else if (currentStatus === 'completed') {
      if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
        schedule.currentHeatIndex++;
      }
    }
    schedule.updatedAt = new Date().toISOString();
    return await dataService.saveSchedule(schedule);
  }

  switch (currentStatus) {
    case 'pending': {
      schedule.heatStatuses[key] = 'scoring';
      currentHeat.actualStartTime = new Date().toISOString();
      // Auto-set currentDance for multi-dance heats
      const dances = await getDancesForHeat(currentHeat);
      schedule.currentDance = dances.length > 0 ? dances[0] : undefined;
      break;
    }
    case 'scoring':
      schedule.heatStatuses[key] = 'completed';
      schedule.currentDance = undefined;
      if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
        schedule.currentHeatIndex++;
      }
      break;
    case 'completed':
      schedule.currentDance = undefined;
      if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
        schedule.currentHeatIndex++;
      }
      break;
  }

  schedule.updatedAt = new Date().toISOString();
  const saved = await dataService.saveSchedule(schedule);

  // Recalculate future estimated times when a heat starts or completes
  if (currentStatus === 'pending' || currentStatus === 'scoring') {
    const competition = await dataService.getCompetitionById(competitionId);
    if (competition?.timingSettings?.startTime) {
      const events = await dataService.getEvents(competitionId);
      const settings = { ...DEFAULT_TIMING, ...competition.timingSettings };
      timingService.recalculateFromIndex(
        saved.heatOrder,
        saved.currentHeatIndex,
        events,
        settings,
        new Date().toISOString(),
      );
      return await dataService.saveSchedule(saved);
    }
  }
  return saved;
}

export async function goBackHeat(competitionId: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  if (!currentHeat) return schedule;

  const key = heatKey(currentHeat);
  const currentStatus = schedule.heatStatuses[key] || 'pending';

  if (currentHeat.isBreak) {
    if (currentStatus === 'completed') {
      schedule.heatStatuses[key] = 'pending';
    } else if (currentStatus === 'pending') {
      if (schedule.currentHeatIndex > 0) {
        schedule.currentHeatIndex--;
      }
    }
    schedule.updatedAt = new Date().toISOString();
    return await dataService.saveSchedule(schedule);
  }

  switch (currentStatus) {
    case 'scoring':
      schedule.heatStatuses[key] = 'pending';
      schedule.currentDance = undefined;
      break;
    case 'pending':
      if (schedule.currentHeatIndex > 0) {
        schedule.currentHeatIndex--;
      }
      break;
  }

  schedule.updatedAt = new Date().toISOString();
  return await dataService.saveSchedule(schedule);
}

export async function advanceDance(competitionId: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  if (!currentHeat || currentHeat.isBreak) return schedule;

  const dances = await getDancesForHeat(currentHeat);
  if (dances.length === 0) return schedule;

  const currentIdx = schedule.currentDance ? dances.indexOf(schedule.currentDance) : -1;
  const nextIdx = currentIdx + 1;
  if (nextIdx < dances.length) {
    schedule.currentDance = dances[nextIdx];
    schedule.updatedAt = new Date().toISOString();
    return await dataService.saveSchedule(schedule);
  }

  return schedule;
}

export async function backDance(competitionId: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;

  const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
  if (!currentHeat || currentHeat.isBreak) return schedule;

  const dances = await getDancesForHeat(currentHeat);
  if (dances.length === 0) return schedule;

  const currentIdx = schedule.currentDance ? dances.indexOf(schedule.currentDance) : -1;
  if (currentIdx > 0) {
    schedule.currentDance = dances[currentIdx - 1];
    schedule.updatedAt = new Date().toISOString();
    return await dataService.saveSchedule(schedule);
  }

  return schedule;
}
