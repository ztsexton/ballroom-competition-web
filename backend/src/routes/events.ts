import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { Event } from '../types';

const router = Router();

// Get all events (optionally filtered by competition)
router.get('/', async (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const events = await dataService.getEvents(competitionId);
  res.json(events);
});

// Get event by ID
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const event = await dataService.getEventById(id);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json(event);
});

// Create a new event
router.post('/', async (req: Request, res: Response) => {
  const { name, bibs, judgeIds, competitionId, designation, syllabusType, level, style, dances, scoringType, isScholarship } = req.body;

  if (!name || !bibs || !Array.isArray(bibs) || !competitionId) {
    return res.status(400).json({ error: 'Name, bibs array, and competition ID are required' });
  }

  const newEvent = await dataService.addEvent(
    name,
    bibs,
    judgeIds || [],
    parseInt(competitionId),
    designation,
    syllabusType,
    level,
    style,
    dances,
    scoringType,
    isScholarship
  );
  res.status(201).json(newEvent);
});

// Update event
router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const existing = await dataService.getEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

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
  let hasExistingScores = false;
  for (const heat of existing.heats) {
    for (const bib of heat.bibs) {
      const scores = await dataService.getScores(id, heat.round, bib);
      if (scores.length > 0) {
        hasExistingScores = true;
        break;
      }
    }
    if (hasExistingScores) break;
  }

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
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = await dataService.deleteEvent(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.status(204).send();
});

// Get results for a specific round
router.get('/:id/results/:round', async (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;

  const event = await dataService.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const results = await scoringService.calculateResults(eventId, round);
  res.json(results);
});

// Submit scores for a round
router.post('/:id/scores/:round', async (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;
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
router.delete('/:id/scores/:round', async (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;

  await dataService.clearScores(eventId, round);
  res.json({ message: 'Scores cleared successfully' });
});

export default router;
