import { dataService } from './dataService';
import { Event, Couple } from '../types';

export interface EventCombination {
  designation?: string;
  syllabusType?: string;
  level?: string;
  style?: string;
  dances?: string[];
  scoringType?: string;
  ageCategory?: string;
}

function eventMatchesCombination(event: Event, combination: EventCombination, reqDances: string[], reqScoringType: string): boolean {
  const evtDances = Array.isArray(event.dances) && event.dances.length > 0
    ? [...event.dances].sort()
    : [];
  const evtScoringType = event.scoringType || 'standard';

  return (
    (event.designation || undefined) === (combination.designation || undefined) &&
    (event.syllabusType || undefined) === (combination.syllabusType || undefined) &&
    (event.level || undefined) === (combination.level || undefined) &&
    (event.style || undefined) === (combination.style || undefined) &&
    (event.ageCategory || undefined) === (combination.ageCategory || undefined) &&
    JSON.stringify(evtDances) === JSON.stringify(reqDances) &&
    evtScoringType === reqScoringType
  );
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
    if (eventMatchesCombination(event, combination, reqDances, reqScoringType)) {
      return event;
    }
  }

  return null;
}

export async function findAllMatchingEvents(
  competitionId: number,
  combination: EventCombination
): Promise<Event[]> {
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];
  const reqScoringType = combination.scoringType || 'standard';

  const allEvents = await dataService.getEvents(competitionId);
  const matches: Event[] = [];

  for (const event of Object.values(allEvents)) {
    if (eventMatchesCombination(event, combination, reqDances, reqScoringType)) {
      matches.push(event);
    }
  }

  return matches;
}

export async function checkPersonConflict(
  bib: number,
  eventBibs: number[],
  competitionId: number
): Promise<boolean> {
  const couple = await dataService.getCoupleByBib(bib);
  if (!couple) return false;

  const existingCouples = await dataService.getCouplesByBibs(eventBibs);

  for (const [, existingCouple] of existingCouples) {
    if (existingCouple.leaderId === couple.leaderId ||
        existingCouple.leaderId === couple.followerId ||
        existingCouple.followerId === couple.leaderId ||
        existingCouple.followerId === couple.followerId) {
      return true;
    }
  }

  return false;
}

function buildEventName(combination: EventCombination, reqDances: string[]): string {
  const parts = [combination.designation, combination.ageCategory, combination.syllabusType, combination.level, combination.style].filter(Boolean);
  if (reqDances.length > 0) parts.push(reqDances.join('/'));
  return parts.length > 0 ? parts.join(' ') : 'Untitled Event';
}

export async function createSectionEvent(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  existingEvents: Event[]
): Promise<Event> {
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];

  const judges = await dataService.getJudges(competitionId);
  const judgeIds = judges.map(j => j.id);

  // Determine sectionGroupId and next letter
  const existingWithGroup = existingEvents.filter(e => e.sectionGroupId);
  let sectionGroupId: string;
  let nextLetter: string;

  if (existingWithGroup.length > 0) {
    // Reuse existing group ID
    sectionGroupId = existingWithGroup[0].sectionGroupId!;
    const usedLetters = existingWithGroup.map(e => e.sectionLetter || 'A');
    const maxCode = Math.max(...usedLetters.map(l => l.charCodeAt(0)));
    nextLetter = String.fromCharCode(maxCode + 1);
  } else {
    // First split — create new group, label existing event as A
    sectionGroupId = `sg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    nextLetter = 'B';

    // Update the existing event to be section A
    const existingEvent = existingEvents[0];
    const baseName = existingEvent.name;
    await dataService.updateEvent(existingEvent.id, {
      name: baseName + ' - A',
      sectionGroupId,
      sectionLetter: 'A',
    });
  }

  // Create new section event
  const baseName = buildEventName(combination, reqDances);
  const name = baseName + ' - ' + nextLetter;

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

  // Set section fields via update
  await dataService.updateEvent(newEvent.id, {
    sectionGroupId,
    sectionLetter: nextLetter,
  });

  return (await dataService.getEventById(newEvent.id))!;
}

export interface RegisterResult {
  event: Event | null;
  created: boolean;
  redirectedToSection?: boolean;
  error?: string;
  status?: number;
}

export async function registerCoupleForEvent(
  competitionId: number,
  bib: number,
  combination: EventCombination
): Promise<RegisterResult> {
  const competition = await dataService.getCompetitionById(competitionId);
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];

  if (competition?.allowDuplicateEntries) {
    return registerWithDuplicateEntries(competitionId, bib, combination, reqDances);
  }

  return registerStandard(competitionId, bib, combination, reqDances);
}

async function registerStandard(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  reqDances: string[]
): Promise<RegisterResult> {
  const matchedEvent = await findMatchingEvent(competitionId, combination);

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
  const name = buildEventName(combination, reqDances);

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

async function registerWithDuplicateEntries(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  reqDances: string[]
): Promise<RegisterResult> {
  const matchingEvents = await findAllMatchingEvents(competitionId, combination);

  // Check if couple is already in any matching event
  for (const event of matchingEvents) {
    const existingBibs = event.heats[0]?.bibs || [];
    if (existingBibs.includes(bib)) {
      return { event: null, created: false, error: 'Couple is already entered in this event', status: 409 };
    }
  }

  if (matchingEvents.length === 0) {
    // No matching events at all — create first event (no sections yet)
    const name = buildEventName(combination, reqDances);
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

  // Try to find a section without person conflict
  for (const event of matchingEvents) {
    const existingBibs = event.heats[0]?.bibs || [];
    const hasConflict = await checkPersonConflict(bib, existingBibs, competitionId);

    if (!hasConflict) {
      // No person conflict — add couple to this section
      let hasScores = false;
      for (const heat of event.heats) {
        for (const b of heat.bibs) {
          const scores = await dataService.getScores(event.id, heat.round, b);
          if (scores.length > 0) { hasScores = true; break; }
        }
        if (hasScores) break;
      }
      if (hasScores) {
        continue; // Skip sections with scores, try next
      }

      const newBibs = [...existingBibs, bib];
      const judgeIds = event.heats[0]?.judges || [];
      const st = event.scoringType || 'standard';
      const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
      const updated = await dataService.updateEvent(event.id, { heats: newHeats });
      return { event: updated, created: false };
    }
  }

  // All sections have person conflicts — create new section
  const sectionEvent = await createSectionEvent(competitionId, bib, combination, matchingEvents);
  return { event: sectionEvent, created: true, redirectedToSection: true };
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
