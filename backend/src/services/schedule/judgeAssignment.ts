import { JudgeSettings } from '../../types';
import { dataService } from '../dataService';

export async function autoAssignJudges(competitionId: number): Promise<void> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return;

  const judges = (await dataService.getJudges(competitionId))
    .sort((a, b) => a.judgeNumber - b.judgeNumber);
  if (judges.length === 0) return;

  const events = await dataService.getEvents(competitionId);
  const competition = await dataService.getCompetitionById(competitionId);
  const settings: JudgeSettings = competition?.judgeSettings || { defaultCount: 3, levelOverrides: {} };

  let judgeIndex = 0;

  for (const scheduledHeat of schedule.heatOrder) {
    if (scheduledHeat.isBreak || scheduledHeat.entries.length === 0) continue;

    // Determine required judge count: max of all entries' level requirements
    const requiredCount = Math.min(
      Math.max(...scheduledHeat.entries.map(entry => {
        const event = events[entry.eventId];
        return settings.levelOverrides[event?.level || ''] ?? settings.defaultCount;
      })),
      judges.length,
    );

    const assigned: number[] = [];
    for (let i = 0; i < requiredCount; i++) {
      assigned.push(judges[judgeIndex % judges.length].id);
      judgeIndex++;
    }

    // Propagate same judges to all entries' event heat objects
    for (const entry of scheduledHeat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const heat = event.heats.find(h => h.round === entry.round);
      if (heat) heat.judges = assigned;
    }
  }

  // Save updated events
  for (const event of Object.values(events)) {
    await dataService.updateEvent(event.id, { heats: event.heats });
  }
}
