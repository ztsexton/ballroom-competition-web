import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { registerCoupleForEvent, checkPersonConflict, createSectionEvent, findAllMatchingEvents } from '../services/registrationService';
import { Event, DetailedResultsResponse } from '../types';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';

const router = Router();

// Get all events (optionally filtered by competition)
router.get('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  if (competitionId) {
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;
  } else if (!req.user!.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: competitionId required for non-site-admins' });
  }
  const events = await dataService.getEvents(competitionId);
  res.json(events);
});

// Get event by ID
router.get('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const event = await dataService.getEventById(id);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;
  res.json(event);
});

// Create a new event
router.post('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const { name, bibs, judgeIds, competitionId, designation, syllabusType, level, style, dances, scoringType, isScholarship, ageCategory } = req.body;

  if (!name || !competitionId) {
    return res.status(400).json({ error: 'Name and competition ID are required' });
  }

  if (!(await assertCompetitionAccess(req, res, parseInt(competitionId)))) return;

  const eventBibs = Array.isArray(bibs) ? bibs : [];

  // Sort dances by configured order if a style is specified
  let orderedDances = dances;
  if (Array.isArray(dances) && dances.length > 0 && style) {
    const competition = await dataService.getCompetitionById(parseInt(competitionId));
    const { getDancesForStyle } = await import('../constants/dances');
    const styleOrder = getDancesForStyle(style, competition?.danceOrder);
    orderedDances = [...dances].sort((a: string, b: string) => {
      const ai = styleOrder.indexOf(a);
      const bi = styleOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  const newEvent = await dataService.addEvent(
    name,
    eventBibs,
    judgeIds || [],
    parseInt(competitionId),
    designation,
    syllabusType,
    level,
    style,
    orderedDances,
    scoringType,
    isScholarship,
    ageCategory
  );
  res.status(201).json(newEvent);
});

// Register a couple for a combination (find-or-create event)
router.post('/register', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { competitionId, bib, designation, syllabusType, level, style, dances, scoringType, isScholarship, ageCategory } = req.body;

    if (!competitionId || bib === undefined) {
      return res.status(400).json({ error: 'competitionId and bib are required' });
    }

    if (!(await assertCompetitionAccess(req, res, competitionId))) return;

    const couple = await dataService.getCoupleByBib(bib);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    const result = await registerCoupleForEvent(competitionId, bib, {
      designation, syllabusType, level, style, dances, scoringType, isScholarship, ageCategory,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    if (result.created) {
      return res.status(201).json({ event: result.event, created: true });
    }
    return res.json({ event: result.event, created: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register entry' });
  }
});

// Get entries (couples) for an event
router.get('/:id/entries', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    const bibs = event.heats[0]?.bibs || [];
    const couples = await dataService.getCouples(event.competitionId);
    const entryCouples = couples.filter(c => bibs.includes(c.bib));
    res.json(entryCouples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get entries' });
  }
});

// Add a couple to an event
router.post('/:id/entries', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { bib } = req.body;

    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    const existingBibs = event.heats[0]?.bibs || [];
    if (existingBibs.includes(bib)) {
      return res.status(409).json({ error: 'Couple is already entered in this event' });
    }

    const hasScores = await dataService.hasAnyScores(id);
    if (hasScores) {
      return res.status(409).json({ error: 'Cannot add couple: event has existing scores' });
    }

    // Check for person conflict when duplicate entries are enabled
    const competition = await dataService.getCompetitionById(event.competitionId);
    if (competition?.allowDuplicateEntries && existingBibs.length > 0) {
      const hasConflict = await checkPersonConflict(bib, existingBibs, event.competitionId);
      if (hasConflict) {
        // Find all matching events and create/redirect to appropriate section
        const combination = {
          designation: event.designation,
          syllabusType: event.syllabusType,
          level: event.level,
          style: event.style,
          dances: event.dances,
          scoringType: event.scoringType,
          ageCategory: event.ageCategory,
        };
        const matchingEvents = await findAllMatchingEvents(event.competitionId, combination);
        const sectionEvent = await createSectionEvent(event.competitionId, bib, combination, matchingEvents);
        return res.status(201).json({ ...sectionEvent, redirectedToSection: true });
      }
    }

    const newBibs = [...existingBibs, bib];
    const judgeIds = event.heats[0]?.judges || [];
    const st = event.scoringType || 'standard';
    const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
    const updated = await dataService.updateEvent(id, { heats: newHeats });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

// Remove a couple from an event
router.delete('/:id/entries/:bib', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const bib = parseInt(req.params.bib);

    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    const existingBibs = event.heats[0]?.bibs || [];
    if (!existingBibs.includes(bib)) {
      return res.status(404).json({ error: 'Couple is not in this event' });
    }

    const hasScores = await dataService.hasAnyScores(id);
    if (hasScores) {
      return res.status(409).json({ error: 'Cannot remove couple: event has existing scores' });
    }

    const newBibs = existingBibs.filter((b: number) => b !== bib);
    const judgeIds = event.heats[0]?.judges || [];
    const st = event.scoringType || 'standard';
    const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
    const updated = await dataService.updateEvent(id, { heats: newHeats });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove entry' });
  }
});

// Scratch (withdraw) a couple from an event
router.post('/:id/scratch', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { bib } = req.body;

    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    // Check bib is in the event
    const allBibs = event.heats.flatMap(h => h.bibs);
    if (!allBibs.includes(bib)) {
      return res.status(404).json({ error: 'Bib not found in this event' });
    }

    const scratchedBibs = event.scratchedBibs || [];
    if (scratchedBibs.includes(bib)) {
      return res.status(409).json({ error: 'Couple is already scratched from this event' });
    }

    const updated = await dataService.updateEvent(id, {
      scratchedBibs: [...scratchedBibs, bib],
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to scratch couple' });
  }
});

// Unscratch (reinstate) a couple in an event
router.delete('/:id/scratch/:bib', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const bib = parseInt(req.params.bib);

    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    const scratchedBibs = event.scratchedBibs || [];
    if (!scratchedBibs.includes(bib)) {
      return res.status(404).json({ error: 'Couple is not scratched from this event' });
    }

    const updated = await dataService.updateEvent(id, {
      scratchedBibs: scratchedBibs.filter(b => b !== bib),
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to unscratch couple' });
  }
});

// Late entry — add a couple to an event that already has scores
router.post('/:id/late-entry', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { bib } = req.body;

    const event = await dataService.getEventById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

    // Check bib belongs to the competition
    const couple = await dataService.getCoupleByBib(bib);
    if (!couple || couple.competitionId !== event.competitionId) {
      return res.status(404).json({ error: 'Couple not found in this competition' });
    }

    // Check not already in event
    const existingBibs = event.heats[0]?.bibs || [];
    if (existingBibs.includes(bib)) {
      return res.status(409).json({ error: 'Couple is already entered in this event' });
    }

    // Add bib to first round always
    const updatedHeats = event.heats.map((heat, index) => {
      if (index === 0) {
        // Always add to first round
        return { ...heat, bibs: [...heat.bibs, bib] };
      }
      // For subsequent rounds: add only if round has no scores AND has populated bibs
      // (populated bibs means advancement has happened for the prior round)
      if (heat.bibs.length > 0) {
        // Check if this round has any scores
        // We can't easily async here, so we'll check after
        return heat;
      }
      return heat;
    });

    // Batch-fetch scores for subsequent rounds that have bibs, then add bib to unscored ones
    const roundsToCheck = updatedHeats
      .slice(1)
      .filter(heat => heat.bibs.length > 0);

    const scoreResults = await Promise.all(
      roundsToCheck.map(heat => dataService.getScoresForRound(id, heat.round, heat.bibs))
    );

    const scoredRounds = new Set<string>();
    roundsToCheck.forEach((heat, idx) => {
      const hasAnyScores = Object.values(scoreResults[idx]).some(s => s.length > 0);
      if (hasAnyScores) scoredRounds.add(heat.round);
    });

    for (let i = 1; i < updatedHeats.length; i++) {
      const heat = updatedHeats[i];
      if (heat.bibs.length > 0 && !scoredRounds.has(heat.round)) {
        updatedHeats[i] = { ...heat, bibs: [...heat.bibs, bib] };
      }
    }

    await dataService.updateEvent(id, { heats: updatedHeats });

    // Update schedule floor heats if they exist
    const schedule = await dataService.getSchedule(event.competitionId);
    if (schedule) {
      let scheduleChanged = false;
      for (const scheduledHeat of schedule.heatOrder) {
        if (scheduledHeat.isBreak) continue;
        for (const entry of scheduledHeat.entries) {
          if (entry.eventId !== id) continue;
          if (!entry.bibSubset) continue;
          // Only add to pending floor heats — find the smallest one
          const status = schedule.heatStatuses[scheduledHeat.id];
          if (status !== 'pending') continue;
          // Find all pending floor heats for this event/round
          const siblingHeats = schedule.heatOrder.filter(h =>
            !h.isBreak &&
            schedule.heatStatuses[h.id] === 'pending' &&
            h.entries.some(e => e.eventId === id && e.round === entry.round && e.bibSubset)
          );
          if (siblingHeats.length > 0) {
            // Add to the smallest pending floor heat
            let smallest = siblingHeats[0];
            for (const sh of siblingHeats) {
              const shEntry = sh.entries.find(e => e.eventId === id && e.round === entry.round)!;
              const smEntry = smallest.entries.find(e => e.eventId === id && e.round === entry.round)!;
              if ((shEntry.bibSubset?.length || 0) < (smEntry.bibSubset?.length || 0)) {
                smallest = sh;
              }
            }
            const smEntry = smallest.entries.find(e => e.eventId === id && e.round === entry.round)!;
            smEntry.bibSubset = [...(smEntry.bibSubset || []), bib];
            scheduleChanged = true;
          }
          break; // Only process once per event
        }
        if (scheduleChanged) break;
      }
      if (scheduleChanged) {
        schedule.updatedAt = new Date().toISOString();
        await dataService.saveSchedule(schedule);
      }
    }

    const updatedEvent = await dataService.getEventById(id);
    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add late entry' });
  }
});

// Update event
router.patch('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const existing = await dataService.getEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!(await assertCompetitionAccess(req, res, existing.competitionId))) return;

  const {
    bibs,
    judgeIds,
    scoringType,
    clearScores: confirmClear,
    ...otherUpdates
  } = req.body;

  // Detect structural changes
  const existingBibs = existing.heats[0]?.bibs || [];
  const existingJudges = existing.heats[0]?.judges || [];
  const existingScoringType = existing.scoringType || 'standard';

  const bibsChanged = bibs !== undefined &&
    JSON.stringify([...bibs].sort()) !== JSON.stringify([...existingBibs].sort());
  const judgesChanged = judgeIds !== undefined &&
    JSON.stringify([...judgeIds].sort()) !== JSON.stringify([...existingJudges].sort());
  const scoringTypeChanged = scoringType !== undefined &&
    scoringType !== existingScoringType;

  const structuralChange = bibsChanged || judgesChanged || scoringTypeChanged;

  // Check if scores exist
  const hasExistingScores = await dataService.hasAnyScores(id);

  // If structural change + existing scores + no confirmation, return warning
  if (structuralChange && hasExistingScores && !confirmClear) {
    return res.status(409).json({
      warning: true,
      message: 'This change will clear all existing scores for this event.',
      changes: { bibs: bibsChanged, judges: judgesChanged, scoringType: scoringTypeChanged },
    });
  }

  // Build update payload
  const updates: Partial<Omit<Event, 'id'>> = { ...otherUpdates };

  if (structuralChange) {
    if (hasExistingScores) {
      await dataService.clearAllEventScores(id);
    }
    const newBibs = bibs ?? existingBibs;
    const newJudgeIds = judgeIds ?? existingJudges;
    const newScoringType = scoringType ?? existingScoringType;

    updates.heats = dataService.rebuildHeats(newBibs, newJudgeIds, newScoringType);
    if (scoringType !== undefined) {
      updates.scoringType = scoringType;
    }
  }

  const updatedEvent = await dataService.updateEvent(id, updates);
  if (!updatedEvent) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json(updatedEvent);
});

// Delete event
router.delete('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const event = await dataService.getEventById(id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

  const deleted = await dataService.deleteEvent(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.status(204).send();
});

// Get results for a specific round
router.get('/:id/results/:round', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;
  const detail = req.query.detail === 'true';

  const event = await dataService.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

  const results = await scoringService.calculateResults(eventId, round);

  if (!detail) {
    return res.json(results);
  }

  await scoringService.enrichRecallStatus(results, eventId, round);

  const heat = event.heats.find(h => h.round === round);
  const judgeIds = heat?.judges || [];
  const judgesMap = await dataService.getJudgesByIds(judgeIds);
  const judges = judgeIds.map(id => {
    const j = judgesMap.get(id);
    return { id, judgeNumber: j?.judgeNumber ?? 0, name: j?.name ?? '' };
  });

  const response: DetailedResultsResponse = {
    judges,
    eventName: event.name,
    round,
    dances: event.dances,
    style: event.style,
    level: event.level,
    results,
  };
  res.json(response);
});

// Submit scores for a round
router.post('/:id/scores/:round', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;

  const event = await dataService.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

  const { scores } = req.body;

  if (!scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'Scores array is required' });
  }

  const success = await scoringService.scoreEvent(eventId, round, scores);

  if (!success) {
    return res.status(400).json({ error: 'Failed to score event' });
  }

  res.json({ message: 'Scores submitted successfully' });
});

// Clear scores for a round
router.delete('/:id/scores/:round', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;

  const event = await dataService.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;

  await dataService.clearScores(eventId, round);
  res.json({ message: 'Scores cleared successfully' });
});

// Bulk update scoring type by event type (single/multi/scholarship)
router.post('/bulk-scoring-type/:competitionId', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  if (!(await assertCompetitionAccess(req, res, competitionId))) return;

  try {
    const { rules, clearScores: confirmClear } = req.body;
    // rules: { single?: 'standard' | 'proficiency', multi?: 'standard' | 'proficiency', scholarship?: 'standard' | 'proficiency' }
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ error: 'rules object required (e.g. { single: "proficiency", multi: "standard" })' });
    }

    const validTypes = ['standard', 'proficiency'];
    for (const [key, val] of Object.entries(rules)) {
      if (!['single', 'multi', 'scholarship'].includes(key)) {
        return res.status(400).json({ error: `Invalid event type key: ${key}` });
      }
      if (!validTypes.includes(val as string)) {
        return res.status(400).json({ error: `Invalid scoring type: ${val}` });
      }
    }

    const allEvents = await dataService.getEvents(competitionId);
    const eventsToUpdate: Array<{ event: Event; newScoringType: 'standard' | 'proficiency' }> = [];
    let wouldClearScores = false;

    for (const event of Object.values(allEvents)) {
      // Determine event type tag
      let tag: string;
      if (event.isScholarship) tag = 'scholarship';
      else if (event.dances && event.dances.length > 1) tag = 'multi';
      else tag = 'single';

      const newScoringType = rules[tag] as 'standard' | 'proficiency' | undefined;
      if (!newScoringType) continue;

      const currentScoringType = event.scoringType || 'standard';
      if (currentScoringType === newScoringType) continue;

      // Check if this event has scores
      if (await dataService.hasAnyScores(event.id)) {
        wouldClearScores = true;
      }

      eventsToUpdate.push({ event, newScoringType });
    }

    if (eventsToUpdate.length === 0) {
      return res.json({ updated: 0, message: 'No events needed updating' });
    }

    // If scores would be cleared and not confirmed, return warning
    if (wouldClearScores && !confirmClear) {
      return res.status(409).json({
        warning: true,
        message: `This will update ${eventsToUpdate.length} event(s) and clear scores on some events with existing scores.`,
        count: eventsToUpdate.length,
      });
    }

    let updatedCount = 0;
    for (const { event, newScoringType } of eventsToUpdate) {
      const hasScores = await dataService.hasAnyScores(event.id);
      if (hasScores) {
        await dataService.clearAllEventScores(event.id);
      }

      const existingBibs = event.heats[0]?.bibs || [];
      const existingJudges = event.heats[0]?.judges || [];
      const newHeats = dataService.rebuildHeats(existingBibs, existingJudges, newScoringType);

      await dataService.updateEvent(event.id, { scoringType: newScoringType, heats: newHeats });
      updatedCount++;
    }

    res.json({ updated: updatedCount });
  } catch (error) {
    console.error('Bulk scoring type error:', error);
    res.status(500).json({ error: 'Failed to bulk update scoring types' });
  }
});

// Get combined results for a section group (aggregates proficiency scores across sections)
router.get('/section-results/:competitionId/:sectionGroupId', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const sectionGroupId = req.params.sectionGroupId;
  if (!(await assertCompetitionAccess(req, res, competitionId))) return;

  try {
    const allEvents = await dataService.getEvents(competitionId);
    const sectionEvents = Object.values(allEvents).filter(e => e.sectionGroupId === sectionGroupId);

    if (sectionEvents.length === 0) {
      return res.status(404).json({ error: 'No events found for this section group' });
    }

    // Gather results from all sections
    const allResults: Array<{
      bib: number;
      leaderName: string;
      followerName: string;
      sectionLetter: string;
      eventId: number;
      scores: number[];
      averageScore: number;
    }> = [];

    for (const event of sectionEvents) {
      const round = 'final';
      const heat = event.heats.find(h => h.round === round);
      if (!heat) continue;

      const results = await scoringService.calculateResults(event.id, round);
      for (const result of results) {
        allResults.push({
          bib: result.bib,
          leaderName: result.leaderName,
          followerName: result.followerName,
          sectionLetter: event.sectionLetter || '?',
          eventId: event.id,
          scores: result.scores,
          averageScore: result.totalScore ?? 0,
        });
      }
    }

    // Sort by average score descending, then assign combined rank
    allResults.sort((a, b) => b.averageScore - a.averageScore);
    const ranked = allResults.map((r, i) => ({
      ...r,
      combinedRank: i + 1,
    }));

    res.json({
      sectionGroupId,
      eventName: sectionEvents[0].name.replace(/ - [A-Z]$/, ''),
      sectionCount: sectionEvents.length,
      results: ranked,
    });
  } catch (error) {
    console.error('Section results error:', error);
    res.status(500).json({ error: 'Failed to compute section results' });
  }
});

// Reorder dances in all events for a competition to match configured dance order
router.post('/reorder-dances/:competitionId', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  if (!(await assertCompetitionAccess(req, res, competitionId))) return;

  try {
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const { getDancesForStyle } = await import('../constants/dances');
    const allEvents = await dataService.getEvents(competitionId);
    let updatedCount = 0;

    for (const event of Object.values(allEvents)) {
      if (!event.dances || event.dances.length <= 1 || !event.style) continue;

      const styleOrder = getDancesForStyle(event.style, competition.danceOrder);
      const reordered = [...event.dances].sort((a, b) => {
        const ai = styleOrder.indexOf(a);
        const bi = styleOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      // Check if order actually changed
      if (JSON.stringify(reordered) === JSON.stringify(event.dances)) continue;

      // Rebuild the event name with reordered dances
      const oldDanceStr = event.dances.join('/');
      const newDanceStr = reordered.join('/');
      const newName = event.name.includes(oldDanceStr)
        ? event.name.replace(oldDanceStr, newDanceStr)
        : event.name;

      await dataService.updateEvent(event.id, { dances: reordered, name: newName });
      updatedCount++;
    }

    res.json({ updated: updatedCount });
  } catch (error) {
    console.error('Reorder dances error:', error);
    res.status(500).json({ error: 'Failed to reorder dances' });
  }
});

export default router;
