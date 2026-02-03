import { CompetitionSchedule, HeatEntry, ScheduledHeat } from '../../types';
import { migrateSchedule, getDancesForHeat } from './helpers';
import { generateSchedule } from './scheduleGenerator';
import { advanceHeat, goBackHeat, advanceDance, backDance } from './heatNavigation';
import { reorderHeat, insertEvent, addBreak, removeBreak, updateHeatEntries, splitHeatEntry, suggestPosition } from './scheduleModification';
import { jumpToHeat, resetToHeat, rerunHeat } from './heatStatus';
import { autoAssignJudges } from './judgeAssignment';

export class ScheduleService {
  static migrateSchedule = migrateSchedule;

  getDancesForHeat(heat: ScheduledHeat): Promise<string[]> {
    return getDancesForHeat(heat);
  }

  generateSchedule(competitionId: number, styleOrder?: string[], levelOrder?: string[]): Promise<CompetitionSchedule> {
    return generateSchedule(competitionId, styleOrder, levelOrder);
  }

  autoAssignJudges(competitionId: number): Promise<void> {
    return autoAssignJudges(competitionId);
  }

  advanceHeat(competitionId: number): Promise<CompetitionSchedule | null> {
    return advanceHeat(competitionId);
  }

  goBackHeat(competitionId: number): Promise<CompetitionSchedule | null> {
    return goBackHeat(competitionId);
  }

  advanceDance(competitionId: number): Promise<CompetitionSchedule | null> {
    return advanceDance(competitionId);
  }

  backDance(competitionId: number): Promise<CompetitionSchedule | null> {
    return backDance(competitionId);
  }

  reorderHeat(competitionId: number, fromIndex: number, toIndex: number): Promise<CompetitionSchedule | null> {
    return reorderHeat(competitionId, fromIndex, toIndex);
  }

  suggestPosition(competitionId: number, eventId: number): Promise<number> {
    return suggestPosition(competitionId, eventId);
  }

  insertEvent(competitionId: number, eventId: number, position: number): Promise<CompetitionSchedule | null> {
    return insertEvent(competitionId, eventId, position);
  }

  addBreak(competitionId: number, label: string, duration?: number, position?: number): Promise<CompetitionSchedule | null> {
    return addBreak(competitionId, label, duration, position);
  }

  removeBreak(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    return removeBreak(competitionId, heatIndex);
  }

  jumpToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    return jumpToHeat(competitionId, heatIndex);
  }

  resetToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    return resetToHeat(competitionId, heatIndex);
  }

  rerunHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    return rerunHeat(competitionId, heatIndex);
  }

  updateHeatEntries(competitionId: number, heatId: string, newEntries: HeatEntry[]): Promise<CompetitionSchedule | null> {
    return updateHeatEntries(competitionId, heatId, newEntries);
  }

  splitHeatEntry(competitionId: number, heatId: string, eventId: number, round: string): Promise<CompetitionSchedule | null> {
    return splitHeatEntry(competitionId, heatId, eventId, round);
  }
}

export const scheduleService = new ScheduleService();
