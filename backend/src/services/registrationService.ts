import { dataService } from './dataService';
import { Event, Couple } from '../types';
import { getDancesForStyle } from '../constants/dances';

export interface EventCombination {
  designation?: string;
  syllabusType?: string;
  level?: string;
  style?: string;
  dances?: string[];
  scoringType?: string;
  isScholarship?: boolean;
  ageCategory?: string;
}

/** Sort dances by the configured dance order for a style. Unknown dances go at the end in their original order. */
function sortDancesByConfiguredOrder(dances: string[], style?: string, danceOrder?: Record<string, string[]>): string[] {
  if (!style || dances.length <= 1) return [...dances];
  const ordered = getDancesForStyle(style, danceOrder);
  return [...dances].sort((a, b) => {
    const ai = ordered.indexOf(a);
    const bi = ordered.indexOf(b);
    // Unknown dances get a high index so they sort to the end
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function eventMatchesCombination(event: Event, combination: EventCombination, reqDances: string[], reqScoringType: string, levelMode?: string): boolean {
  const evtDances = Array.isArray(event.dances) && event.dances.length > 0
    ? [...event.dances].sort()
    : [];
  const evtScoringType = event.scoringType || 'standard';

  // In integrated mode, syllabusType is not used — ignore it for matching
  const syllabusMatch = levelMode === 'integrated'
    ? true
    : (event.syllabusType || undefined) === (combination.syllabusType || undefined);

  return (
    (event.designation || undefined) === (combination.designation || undefined) &&
    syllabusMatch &&
    (event.level || undefined) === (combination.level || undefined) &&
    (event.style || undefined) === (combination.style || undefined) &&
    (event.ageCategory || undefined) === (combination.ageCategory || undefined) &&
    (!!event.isScholarship) === (!!combination.isScholarship) &&
    JSON.stringify(evtDances) === JSON.stringify(reqDances) &&
    evtScoringType === reqScoringType
  );
}

export async function findMatchingEvent(
  competitionId: number,
  combination: EventCombination,
  levelMode?: string
): Promise<Event | null> {
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];
  const reqScoringType = combination.scoringType || 'standard';

  const allEvents = await dataService.getEvents(competitionId);

  for (const event of Object.values(allEvents)) {
    if (eventMatchesCombination(event, combination, reqDances, reqScoringType, levelMode)) {
      return event;
    }
  }

  return null;
}

export async function findAllMatchingEvents(
  competitionId: number,
  combination: EventCombination,
  levelMode?: string
): Promise<Event[]> {
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];
  const reqScoringType = combination.scoringType || 'standard';

  const allEvents = await dataService.getEvents(competitionId);
  const matches: Event[] = [];

  for (const event of Object.values(allEvents)) {
    if (eventMatchesCombination(event, combination, reqDances, reqScoringType, levelMode)) {
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
  if (combination.isScholarship) parts.push('Scholarship');
  return parts.length > 0 ? parts.join(' ') : 'Untitled Event';
}

export async function createSectionEvent(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  existingEvents: Event[]
): Promise<Event> {
  const competition = await dataService.getCompetitionById(competitionId);
  const displayDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? sortDancesByConfiguredOrder(combination.dances, combination.style, competition?.danceOrder)
    : [];

  // Apply section scoring type override if configured
  const sectionScoringType = competition?.scoringTypeDefaults?.section;
  const scoringType = (sectionScoringType || combination.scoringType as 'standard' | 'proficiency') || 'standard';

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

    // Update the existing event to be section A, and update scoring type if section default is set
    const existingEvent = existingEvents[0];
    const baseName = existingEvent.name;
    const sectionAUpdates: Record<string, unknown> = {
      name: baseName + ' - A',
      sectionGroupId,
      sectionLetter: 'A',
    };
    if (sectionScoringType && existingEvent.scoringType !== sectionScoringType) {
      sectionAUpdates.scoringType = sectionScoringType;
      // Rebuild heats with new scoring type
      const existingBibs = existingEvent.heats[0]?.bibs || [];
      const existingJudges = existingEvent.heats[0]?.judges || [];
      sectionAUpdates.heats = dataService.rebuildHeats(existingBibs, existingJudges, sectionScoringType);
    }
    await dataService.updateEvent(existingEvent.id, sectionAUpdates);
  }

  // Create new section event
  const baseName = buildEventName(combination, displayDances);
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
    displayDances.length > 0 ? displayDances : undefined,
    scoringType,
    combination.isScholarship,
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

/** Determine the event category for scoring type defaults */
function getEventCategory(combination: EventCombination): 'scholarship' | 'single' | 'multi' {
  if (combination.isScholarship) return 'scholarship';
  const danceCount = Array.isArray(combination.dances) ? combination.dances.length : 0;
  if (danceCount > 1) return 'multi';
  return 'single';
}

export async function registerCoupleForEvent(
  competitionId: number,
  bib: number,
  combination: EventCombination
): Promise<RegisterResult> {
  const competition = await dataService.getCompetitionById(competitionId);

  // Apply scoring type defaults if configured
  const defaults = competition?.scoringTypeDefaults;
  if (defaults) {
    const category = getEventCategory(combination);
    const defaultType = defaults[category];
    if (defaultType) {
      combination = { ...combination, scoringType: defaultType };
    }
  }

  // Alphabetical sort for matching/comparison
  const reqDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? [...combination.dances].sort()
    : [];
  // Configured dance order for storage and display
  const displayDances = Array.isArray(combination.dances) && combination.dances.length > 0
    ? sortDancesByConfiguredOrder(combination.dances, combination.style, competition?.danceOrder)
    : [];

  const levelMode = competition?.levelMode;

  if (competition?.allowDuplicateEntries) {
    return registerWithDuplicateEntries(competitionId, bib, combination, reqDances, displayDances, levelMode);
  }

  return registerStandard(competitionId, bib, combination, reqDances, displayDances, levelMode);
}

async function registerStandard(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  reqDances: string[],
  displayDances: string[],
  levelMode?: string
): Promise<RegisterResult> {
  const matchedEvent = await findMatchingEvent(competitionId, combination, levelMode);

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
  const name = buildEventName(combination, displayDances);

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
    displayDances.length > 0 ? displayDances : undefined,
    (combination.scoringType as 'standard' | 'proficiency') || 'standard',
    combination.isScholarship,
    combination.ageCategory,
  );

  return { event: newEvent, created: true };
}

async function registerWithDuplicateEntries(
  competitionId: number,
  bib: number,
  combination: EventCombination,
  reqDances: string[],
  displayDances: string[],
  levelMode?: string
): Promise<RegisterResult> {
  const matchingEvents = await findAllMatchingEvents(competitionId, combination, levelMode);

  // Check if couple is already in any matching event
  for (const event of matchingEvents) {
    const existingBibs = event.heats[0]?.bibs || [];
    if (existingBibs.includes(bib)) {
      return { event: null, created: false, error: 'Couple is already entered in this event', status: 409 };
    }
  }

  if (matchingEvents.length === 0) {
    // No matching events at all — create first event (no sections yet)
    const name = buildEventName(combination, displayDances);
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
      displayDances.length > 0 ? displayDances : undefined,
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
