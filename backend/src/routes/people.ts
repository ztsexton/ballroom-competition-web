import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all people (optionally filtered by competition)
router.get('/', (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const people = dataService.getPeople(competitionId);
  res.json(people);
});

// Get person by ID
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const person = dataService.getPersonById(id);
  
  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }
  
  res.json(person);
});

// Add a new person
router.post('/', (req: Request, res: Response) => {
  const { firstName, lastName, email, role, status, competitionId, studioId } = req.body;

  if (!firstName || !lastName || !role || !competitionId) {
    return res.status(400).json({ error: 'First name, last name, role, and competitionId are required' });
  }

  if (!['leader', 'follower', 'both'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const newPerson = dataService.addPerson({
    firstName,
    lastName,
    email,
    role,
    status: status || 'student',
    competitionId,
    studioId,
  });

  res.status(201).json(newPerson);
});

// Update person
router.patch('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updates = req.body;
  
  const updatedPerson = dataService.updatePerson(id, updates);
  
  if (!updatedPerson) {
    return res.status(404).json({ error: 'Person not found' });
  }
  
  res.json(updatedPerson);
});

// Delete person
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  
  // Check if person is in any couple
  const couples = dataService.getCouples();
  const inCouple = couples.some(c => c.leaderId === id || c.followerId === id);
  
  if (inCouple) {
    return res.status(400).json({ error: 'Cannot delete person who is in a couple' });
  }
  
  const deleted = dataService.deletePerson(id);
  
  if (!deleted) {
    return res.status(404).json({ error: 'Person not found' });
  }
  
  res.status(204).send();
});

export default router;
