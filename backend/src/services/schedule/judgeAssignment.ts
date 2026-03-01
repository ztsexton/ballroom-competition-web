import { JudgeSettings } from '../../types';
import { CERTIFICATION_LEVEL_ORDER } from '../../constants/levels';
import { dataService } from '../dataService';
import { isJudgeQualified } from './judgeQualification';

export async function autoAssignJudges(competitionId: number): Promise<void> {
  const schedule = await dataService.getSchedule(competitionId);
  if (!schedule) return;

  const judges = (await dataService.getJudges(competitionId))
    .sort((a, b) => a.judgeNumber - b.judgeNumber);
  if (judges.length === 0) return;

  const events = await dataService.getEvents(competitionId);
  const competition = await dataService.getCompetitionById(competitionId);
  const settings: JudgeSettings = competition?.judgeSettings || { defaultCount: 3, levelOverrides: {} };
  const targetStintMs = (settings.targetStintMinutes || 45) * 60 * 1000;

  // Build certifications map: judgeId -> certifications
  // undefined = no profile linked (unrestricted, can judge anything)
  // {} = has profile but no extra certs (restricted to Silver and below)
  const certsMap = new Map<number, Record<string, string[]> | undefined>();
  const profileIds = judges.filter(j => j.profileId).map(j => j.profileId!);
  if (profileIds.length > 0) {
    const profiles = await dataService.getJudgeProfiles();
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    for (const judge of judges) {
      if (judge.profileId) {
        const profile = profileMap.get(judge.profileId);
        certsMap.set(judge.id, profile?.certifications || {});
      } else {
        certsMap.set(judge.id, undefined); // No profile = unrestricted
      }
    }
  } else {
    for (const judge of judges) {
      certsMap.set(judge.id, undefined); // No profile = unrestricted
    }
  }

  // State
  const workMs = new Map<number, number>();  // continuous work time
  const restMs = new Map<number, number>();  // continuous rest time
  const activePanel = new Set<number>();     // currently active judges

  for (const j of judges) {
    workMs.set(j.id, 0);
    restMs.set(j.id, 0);
  }

  let firstHeat = true;

  for (const scheduledHeat of schedule.heatOrder) {
    if (scheduledHeat.isBreak) {
      // Break resets everyone's work counter
      for (const j of judges) {
        workMs.set(j.id, 0);
      }
      continue;
    }
    if (scheduledHeat.entries.length === 0) continue;

    const heatDurationMs = (scheduledHeat.estimatedDurationSeconds || 120) * 1000;

    // Determine required judge count: max of all entries' level requirements
    const requiredCount = Math.min(
      Math.max(...scheduledHeat.entries.map(entry => {
        const event = events[entry.eventId];
        return settings.levelOverrides[event?.level || ''] ?? settings.defaultCount;
      })),
      judges.length,
    );

    // Determine heat style and level for qualification filtering
    const heatStyles = new Set<string>();
    const heatLevels = new Set<string>();
    for (const entry of scheduledHeat.entries) {
      const event = events[entry.eventId];
      if (event?.style) heatStyles.add(event.style);
      if (event?.level) heatLevels.add(event.level);
    }
    const heatStyle = heatStyles.size === 1 ? [...heatStyles][0] : undefined;
    // Use highest level from entries for qualification
    const heatLevel = heatLevels.size > 0
      ? [...heatLevels].reduce((a, b) =>
          CERTIFICATION_LEVEL_ORDER.indexOf(a) > CERTIFICATION_LEVEL_ORDER.indexOf(b) ? a : b
        )
      : undefined;

    // Filter to qualified judges for this heat
    // Judges without a profile (certsMap = undefined) are unrestricted
    const qualifiedIds = new Set(
      judges
        .filter(j => {
          const certs = certsMap.get(j.id);
          if (certs === undefined) return true; // No profile = unrestricted
          return isJudgeQualified(certs, heatStyle, heatLevel);
        })
        .map(j => j.id)
    );

    // Initialize panel on first heat
    if (firstHeat) {
      const qualifiedJudges = judges.filter(j => qualifiedIds.has(j.id));
      for (let i = 0; i < Math.min(requiredCount, qualifiedJudges.length); i++) {
        activePanel.add(qualifiedJudges[i].id);
      }
      firstHeat = false;
    }

    // Remove any active judge not qualified for this heat
    for (const jId of [...activePanel]) {
      if (!qualifiedIds.has(jId)) {
        activePanel.delete(jId);
        restMs.set(jId, 0);
        workMs.set(jId, 0);
      }
    }

    // Adjust panel size down
    while (activePanel.size > requiredCount) {
      // Remove judge with highest workMs (give them a break)
      let maxWork = -1;
      let toRemove = -1;
      for (const jId of activePanel) {
        const w = workMs.get(jId) || 0;
        if (w > maxWork) { maxWork = w; toRemove = jId; }
      }
      if (toRemove >= 0) {
        activePanel.delete(toRemove);
        restMs.set(toRemove, 0);
        workMs.set(toRemove, 0);
      } else break;
    }

    // Adjust panel size up
    while (activePanel.size < requiredCount) {
      // Add qualified resting judge with highest restMs
      let maxRest = -1;
      let toAdd = -1;
      for (const j of judges) {
        if (activePanel.has(j.id) || !qualifiedIds.has(j.id)) continue;
        const r = restMs.get(j.id) || 0;
        if (r > maxRest) { maxRest = r; toAdd = j.id; }
      }
      if (toAdd >= 0) {
        activePanel.add(toAdd);
        restMs.set(toAdd, 0);
        workMs.set(toAdd, 0);
      } else break; // No more qualified judges available
    }

    // Rotate overworked judges
    const overworked = [...activePanel]
      .filter(jId => (workMs.get(jId) || 0) >= targetStintMs)
      .sort((a, b) => (workMs.get(b) || 0) - (workMs.get(a) || 0));

    for (const owId of overworked) {
      // Find best qualified resting judge
      let maxRest = -1;
      let candidate = -1;
      for (const j of judges) {
        if (activePanel.has(j.id) || !qualifiedIds.has(j.id)) continue;
        const r = restMs.get(j.id) || 0;
        if (r > maxRest) { maxRest = r; candidate = j.id; }
      }
      if (candidate >= 0) {
        activePanel.delete(owId);
        restMs.set(owId, 0);
        workMs.set(owId, 0);
        activePanel.add(candidate);
        restMs.set(candidate, 0);
        workMs.set(candidate, 0);
      }
    }

    // Assign judges to all entries for this heat
    const assigned = Array.from(activePanel);
    for (const entry of scheduledHeat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const heat = event.heats.find(h => h.round === entry.round);
      if (heat) heat.judges = assigned;
    }

    // Update timers
    for (const j of judges) {
      if (activePanel.has(j.id)) {
        workMs.set(j.id, (workMs.get(j.id) || 0) + heatDurationMs);
        // Working judges don't accumulate rest
      } else {
        restMs.set(j.id, (restMs.get(j.id) || 0) + heatDurationMs);
        // Resting judges don't accumulate work
      }
    }
  }

  // Save updated events
  for (const event of Object.values(events)) {
    await dataService.updateEvent(event.id, { heats: event.heats });
  }
}
