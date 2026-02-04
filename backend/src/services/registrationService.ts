import { dataService } from './dataService';
import { Event } from '../types';

export interface EventCombination {
  designation?: string;
  syllabusType?: string;
  level?: string;
  style?: string;
  dances?: string[];
  scoringType?: string;
  ageCategory?: string;
}

export async function findMatchingEvent(
  competitionId: number,
  combination: EventCombination
): Promise<Event | null> {
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];
  const reqScoringType = combination.scoringType || 'standard';

  const allEvents = await dataService.getEvents(competitionId);

  for (const event of Object.values(allEvents)) {
    const evtDances = Array.isArray(event.dances) && event.dances.length > 0
      ? [...event.dances].sort()
      : [];
    const evtScoringType = event.scoringType || 'standard';

    if (
      (event.designation || undefined) === (combination.designation || undefined) &&
      (event.syllabusType || undefined) === (combination.syllabusType || undefined) &&
      (event.level || undefined) === (combination.level || undefined) &&
      (event.style || undefined) === (combination.style || undefined) &&
      (event.ageCategory || undefined) === (combination.ageCategory || undefined) &&
      JSON.stringify(evtDances) === JSON.stringify(reqDances) &&
      evtScoringType === reqScoringType
    ) {
      return event;
    }
  }

  return null;
}

export interface RegisterResult {
  event: Event | null;
  created: boolean;
  error?: string;
  status?: number;
}

export async function registerCoupleForEvent(
  competitionId: number,
  bib: number,
  combination: EventCombination
): Promise<RegisterResult> {
  const matchedEvent = await findMatchingEvent(competitionId, combination);
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];

  if (matchedEvent) {
    const existingBibs = matchedEvent.heats[0]?.bibs || [];
    if (existingBibs.includes(bib)) {
      return { event: null, created: false, error: 'Couple is already entered in this event', status: 409 };
    }

    let hasScores = false;
    for (const heat of matchedEvent.heats) {
      for (const b of heat.bibs) {
        const scores = await dataService.getScores(matchedEvent.id, heat.round, b);
        if (scores.length > 0) { hasScores = true; break; }
      }
      if (hasScores) break;
    }
    if (hasScores) {
      return { event: null, created: false, error: 'Cannot add couple: event has existing scores', status: 409 };
    }

    const newBibs = [...existingBibs, bib];
    const judgeIds = matchedEvent.heats[0]?.judges || [];
    const st = matchedEvent.scoringType || 'standard';
    const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
    const updated = await dataService.updateEvent(matchedEvent.id, { heats: newHeats });
    return { event: updated, created: false };
  }

  // No match — auto-create event
  const parts = [combination.designation, combination.ageCategory, combination.syllabusType, combination.level, combination.style].filter(Boolean);
  if (reqDances.length > 0) parts.push(reqDances.join('/'));
  const name = parts.length > 0 ? parts.join(' ') : 'Untitled Event';

  const judges = await dataService.getJudges(competitionId);
  const judgeIds = judges.map(j => j.id);

  const newEvent = await dataService.addEvent(
    name,
    [bib],
    judgeIds,
    competitionId,
    combination.designation,
    combination.syllabusType,
    combination.level,
    combination.style,
    reqDances.length > 0 ? reqDances : undefined,
    (combination.scoringType as 'standard' | 'proficiency') || 'standard',
    undefined,
    combination.ageCategory,
  );

  return { event: newEvent, created: true };
}

export async function removeEntryFromEvent(
  eventId: number,
  bib: number
): Promise<{ event: Event | null; error?: string; status?: number }> {
  const event = await dataService.getEventById(eventId);
  if (!event) {
    return { event: null, error: 'Event not found', status: 404 };
  }

  const existingBibs = event.heats[0]?.bibs || [];
  if (!existingBibs.includes(bib)) {
    return { event: null, error: 'Couple is not in this event', status: 404 };
  }

  let hasScores = false;
  for (const heat of event.heats) {
    for (const b of heat.bibs) {
      const scores = await dataService.getScores(eventId, heat.round, b);
      if (scores.length > 0) { hasScores = true; break; }
    }
    if (hasScores) break;
  }
  if (hasScores) {
    return { event: null, error: 'Cannot remove couple: event has existing scores', status: 409 };
  }

  const newBibs = existingBibs.filter((b: number) => b !== bib);
  const judgeIds = event.heats[0]?.judges || [];
  const st = event.scoringType || 'standard';
  const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
  const updated = await dataService.updateEvent(eventId, { heats: newHeats });
  return { event: updated };
}
