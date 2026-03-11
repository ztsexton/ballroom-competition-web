import { CompetitionSchedule, HeatEntry, ScheduledHeat, AutoBreaksConfig, LevelCombiningConfig } from '../../types';
import { migrateSchedule, getDancesForHeat } from './helpers';
import { generateSchedule } from './scheduleGenerator';
import { advanceHeat, goBackHeat, advanceDance, backDance } from './heatNavigation';
import { reorderHeat, insertEvent, addBreak, removeBreak, updateHeatEntries, splitHeatEntry, splitRoundIntoFloorHeats, unsplitFloorHeats, suggestPosition, resplitPendingHeats } from './scheduleModification';
import { jumpToHeat, resetToHeat, rerunHeat } from './heatStatus';
import { autoAssignJudges } from './judgeAssignment';
export { buildJudgeSchedule } from './judgeSchedule';
import { detectBackToBack, detectPersonBackToBack, minimizeBackToBack, BackToBackConflict, PersonBackToBackConflict } from './backToBack';
import { analyzeSchedule, applySuggestions, ScheduleAnalysis, ScheduleSuggestion, getConsolidationPreview, simulateCombined, ConsolidationPreview, ConsolidationStrategy, ConsolidationChanges, CombinedSimulationResult } from './scheduleOptimizer';

export class ScheduleService {
  static migrateSchedule = migrateSchedule;

  getDancesForHeat(heat: ScheduledHeat): Promise<string[]> {
    return getDancesForHeat(heat);
  }

  generateSchedule(competitionId: number, styleOrder?: string[], levelOrder?: string[], danceOrder?: Record<string, string[]>, autoBreaks?: AutoBreaksConfig, deferFinals?: boolean, eventTypeOrder?: string[], levelCombining?: LevelCombiningConfig): Promise<CompetitionSchedule> {
    return generateSchedule(competitionId, styleOrder, levelOrder, danceOrder, autoBreaks, deferFinals, eventTypeOrder, levelCombining);
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

  updateHeatEntries(competitionId: number, heatId: string, newEntries: HeatEntry[], forceOverride?: boolean): Promise<CompetitionSchedule | null> {
    return updateHeatEntries(competitionId, heatId, newEntries, forceOverride);
  }

  splitHeatEntry(competitionId: number, heatId: string, eventId: number, round: string): Promise<CompetitionSchedule | null> {
    return splitHeatEntry(competitionId, heatId, eventId, round);
  }

  splitRoundIntoFloorHeats(competitionId: number, heatId: string, groupCount: number): Promise<CompetitionSchedule | null> {
    return splitRoundIntoFloorHeats(competitionId, heatId, groupCount);
  }

  unsplitFloorHeats(competitionId: number, heatId: string): Promise<CompetitionSchedule | null> {
    return unsplitFloorHeats(competitionId, heatId);
  }

  resplitPendingHeats(competitionId: number, eventId: number, round: string, groupCount: number): Promise<CompetitionSchedule | null> {
    return resplitPendingHeats(competitionId, eventId, round, groupCount);
  }

  detectBackToBack(competitionId: number): Promise<BackToBackConflict[]> {
    return (async () => {
      const schedule = await (await import('../dataService')).dataService.getSchedule(competitionId);
      if (!schedule) return [];
      const migrated = migrateSchedule(schedule);
      return detectBackToBack(migrated.heatOrder, competitionId);
    })();
  }

  detectPersonBackToBack(competitionId: number, excludePros: boolean = false): Promise<PersonBackToBackConflict[]> {
    return (async () => {
      const schedule = await (await import('../dataService')).dataService.getSchedule(competitionId);
      if (!schedule) return [];
      const migrated = migrateSchedule(schedule);
      return detectPersonBackToBack(migrated.heatOrder, competitionId, excludePros);
    })();
  }

  analyzeSchedule(competitionId: number): Promise<ScheduleAnalysis> {
    return analyzeSchedule(competitionId);
  }

  applySuggestions(competitionId: number, suggestionIndices: number[]): Promise<CompetitionSchedule | null> {
    return applySuggestions(competitionId, suggestionIndices);
  }

  getConsolidationPreview(competitionId: number): Promise<ConsolidationPreview> {
    return getConsolidationPreview(competitionId);
  }

  simulateCombined(competitionId: number, strategyIds: string[]): Promise<CombinedSimulationResult> {
    return simulateCombined(competitionId, strategyIds);
  }

  async minimizeBackToBack(competitionId: number): Promise<CompetitionSchedule | null> {
    const { dataService } = await import('../dataService');
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    schedule = migrateSchedule(schedule);
    const result = await minimizeBackToBack(schedule.heatOrder, competitionId);
    schedule.heatOrder = result.heatOrder;
    schedule.updatedAt = new Date().toISOString();
    return dataService.saveSchedule(schedule);
  }
}

export const scheduleService = new ScheduleService();
