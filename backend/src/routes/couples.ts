import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all couples
router.get('/', (_req: Request, res: Response) => {
  const couples = dataService.getCouples();
  res.json(couples);
});

// Get couple by bib
router.get('/:bib', (req: Request, res: Response) => {
  const bib = parseInt(req.params.bib);
  const couple = dataService.getCoupleByBib(bib);
  
  if (!couple) {
    return res.status(404).json({ error: 'Couple not found' });
  }
  
  res.json(couple);
});

// Add a new couple
router.post('/', (req: Request, res: Response) => {
  const { leaderId, followerId } = req.body;
  
  if (!leaderId || !followerId) {
    return res.status(400).json({ error: 'Leader and follower IDs are required' });
  }
  
  const newCouple = dataService.addCouple(
    parseInt(leaderId),
    parseInt(followerId)
  );
  
  if (!newCouple) {
    return res.status(400).json({ error: 'Invalid leader or follower ID' });
  }
  
  res.status(201).json(newCouple);
});

// Delete couple
router.delete('/:bib', (req: Request, res: Response) => {
  const bib = parseInt(req.params.bib);
  
  // Check if couple is in any event
  const events = dataService.getEvents();
  const inEvent = Object.values(events).some(event =>
    event.heats.some(heat => heat.bibs.includes(bib))
  );
  
  if (inEvent) {
    return res.status(400).json({ error: 'Cannot delete couple that is in an event' });
  }
  
  const deleted = dataService.deleteCouple(bib);
  
  if (!deleted) {
    return res.status(404).json({ error: 'Couple not found' });
  }
  
  res.status(204).send();
});

export default router;
