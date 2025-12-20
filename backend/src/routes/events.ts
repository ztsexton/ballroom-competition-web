import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';

const router = Router();

// Get all events (optionally filtered by competition)
router.get('/', (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const events = dataService.getEvents(competitionId);
  res.json(events);
});

// Get event by ID
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const event = dataService.getEventById(id);
  
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.json(event);
});

// Create a new event
router.post('/', (req: Request, res: Response) => {
  const { name, bibs, judgeIds, competitionId, designation, syllabusType, level, style, dances } = req.body;
  
  if (!name || !bibs || !Array.isArray(bibs) || !competitionId) {
    return res.status(400).json({ error: 'Name, bibs array, and competition ID are required' });
  }
  
  const newEvent = dataService.addEvent(
    name, 
    bibs, 
    judgeIds || [],
    parseInt(competitionId),
    designation, 
    syllabusType, 
    level, 
    style, 
    dances
  );
  res.status(201).json(newEvent);
});

// Update event
router.patch('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updates = req.body;
  
  const updatedEvent = dataService.updateEvent(id, updates);
  
  if (!updatedEvent) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.json(updatedEvent);
});

// Delete event
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = dataService.deleteEvent(id);
  
  if (!deleted) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.status(204).send();
});

// Get results for a specific round
router.get('/:id/results/:round', (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;
  
  const event = dataService.getEventById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  const results = scoringService.calculateResults(eventId, round);
  res.json(results);
});

// Submit scores for a round
router.post('/:id/scores/:round', (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;
  const { scores } = req.body;
  
  if (!scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'Scores array is required' });
  }
  
  const success = scoringService.scoreEvent(eventId, round, scores);
  
  if (!success) {
    return res.status(400).json({ error: 'Failed to score event' });
  }
  
  res.json({ message: 'Scores submitted successfully' });
});

// Clear scores for a round
router.delete('/:id/scores/:round', (req: Request, res: Response) => {
  const eventId = parseInt(req.params.id);
  const round = req.params.round;
  
  dataService.clearScores(eventId, round);
  res.json({ message: 'Scores cleared successfully' });
});

export default router;
