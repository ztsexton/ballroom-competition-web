import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { registerCoupleForEvent } from '../services/registrationService';
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

  const newEvent = await dataService.addEvent(
    name,
    eventBibs,
    judgeIds || [],
    parseInt(competitionId),
    designation,
    syllabusType,
    level,
    style,
    dances,
    scoringType,
    isScholarship,
    ageCategory
  );
  res.status(201).json(newEvent);
});

// Register a couple for a combination (find-or-create event)
router.post('/register', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { competitionId, bib, designation, syllabusType, level, style, dances, scoringType, ageCategory } = req.body;

    if (!competitionId || bib === undefined) {
      return res.status(400).json({ error: 'competitionId and bib are required' });
    }

    if (!(await assertCompetitionAccess(req, res, competitionId))) return;

    const couple = await dataService.getCoupleByBib(bib);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    const result = await registerCoupleForEvent(competitionId, bib, {
      designation, syllabusType, level, style, dances, scoringType, ageCategory,
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

export default router;
