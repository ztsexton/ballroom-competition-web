import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all couples (optionally filtered by competition)
router.get('/', async (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const couples = await dataService.getCouples(competitionId);
  res.json(couples);
});

// Get couple by bib
router.get('/:bib', async (req: Request, res: Response) => {
  const bib = parseInt(req.params.bib);
  const couple = await dataService.getCoupleByBib(bib);

  if (!couple) {
    return res.status(404).json({ error: 'Couple not found' });
  }

  res.json(couple);
});

// Add a new couple
router.post('/', async (req: Request, res: Response) => {
  const { leaderId, followerId, competitionId } = req.body;

  if (!leaderId || !followerId || !competitionId) {
    return res.status(400).json({ error: 'Leader ID, follower ID, and competition ID are required' });
  }

  const newCouple = await dataService.addCouple(
    parseInt(leaderId),
    parseInt(followerId),
    parseInt(competitionId)
  );

  if (!newCouple) {
    return res.status(400).json({ error: 'Invalid leader or follower ID, or people not in same competition' });
  }

  res.status(201).json(newCouple);
});

// Get all events a couple is entered in
router.get('/:bib/events', async (req: Request, res: Response) => {
  try {
    const bib = parseInt(req.params.bib);
    const couple = await dataService.getCoupleByBib(bib);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    const allEvents = await dataService.getEvents(couple.competitionId);
    const coupleEvents = Object.values(allEvents).filter(event =>
      event.heats[0]?.bibs.includes(bib)
    );
    res.json(coupleEvents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get couple events' });
  }
});

// Delete couple
router.delete('/:bib', async (req: Request, res: Response) => {
  const bib = parseInt(req.params.bib);

  // Check if couple is in any event
  const events = await dataService.getEvents();
  const inEvent = Object.values(events).some(event =>
    event.heats.some(heat => heat.bibs.includes(bib))
  );

  if (inEvent) {
    return res.status(400).json({ error: 'Cannot delete couple that is in an event' });
  }

  const deleted = await dataService.deleteCouple(bib);

  if (!deleted) {
    return res.status(404).json({ error: 'Couple not found' });
  }

  res.status(204).send();
});

export default router;
