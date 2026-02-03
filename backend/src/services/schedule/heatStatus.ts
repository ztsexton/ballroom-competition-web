import { CompetitionSchedule } from '../../types';
import { dataService } from '../dataService';
import { heatKey } from './helpers';

export async function jumpToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;
  if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

  schedule.currentHeatIndex = heatIndex;
  schedule.updatedAt = new Date().toISOString();

  return await dataService.saveSchedule(schedule);
}

export async function resetToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;
  if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

  // Only clear from target heat through the current position (inclusive)
  const endIndex = Math.max(heatIndex, schedule.currentHeatIndex);
  for (let i = heatIndex; i <= endIndex; i++) {
    const heat = schedule.heatOrder[i];
    const key = heatKey(heat);
    const status = schedule.heatStatuses[key];

    if (status && status !== 'pending') {
      schedule.heatStatuses[key] = 'pending';
      if (!heat.isBreak) {
        for (const entry of heat.entries) {
          await dataService.clearScores(entry.eventId, entry.round);
          await dataService.clearJudgeScores(entry.eventId, entry.round);
        }
      }
    }
  }

  schedule.currentHeatIndex = heatIndex;
  schedule.currentDance = undefined;
  schedule.updatedAt = new Date().toISOString();

  return await dataService.saveSchedule(schedule);
}

export async function rerunHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return null;
  if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

  const heat = schedule.heatOrder[heatIndex];
  const key = heatKey(heat);
  const status = schedule.heatStatuses[key];

  if (status && status !== 'pending') {
    schedule.heatStatuses[key] = 'pending';
    if (!heat.isBreak) {
      for (const entry of heat.entries) {
        await dataService.clearScores(entry.eventId, entry.round);
        await dataService.clearJudgeScores(entry.eventId, entry.round);
      }
    }
  }

  schedule.currentHeatIndex = heatIndex;
  schedule.currentDance = undefined;
  schedule.updatedAt = new Date().toISOString();

  return await dataService.saveSchedule(schedule);
}
