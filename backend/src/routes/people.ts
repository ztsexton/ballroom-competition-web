import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';

const router = Router();

// Get all people (optionally filtered by competition)
router.get('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  if (competitionId) {
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;
  } else if (!req.user!.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: competitionId required for non-site-admins' });
  }
  const people = await dataService.getPeople(competitionId);
  res.json(people);
});

// Get person by ID
router.get('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const person = await dataService.getPersonById(id);

  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }

  if (!(await assertCompetitionAccess(req, res, person.competitionId))) return;
  res.json(person);
});

// Add a new person
router.post('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, email, role, status, competitionId, studioId, dateOfBirth } = req.body;

  if (!firstName || !lastName || !role || !competitionId) {
    return res.status(400).json({ error: 'First name, last name, role, and competitionId are required' });
  }

  if (!(await assertCompetitionAccess(req, res, competitionId))) return;

  if (!['leader', 'follower', 'both'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const newPerson = await dataService.addPerson({
    firstName,
    lastName,
    email,
    role,
    status: status || 'student',
    competitionId,
    studioId,
    dateOfBirth: dateOfBirth || undefined,
  });

  res.status(201).json(newPerson);
});

// Update person
router.patch('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const person = await dataService.getPersonById(id);
  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }
  if (!(await assertCompetitionAccess(req, res, person.competitionId))) return;

  const updates = req.body;
  const updatedPerson = await dataService.updatePerson(id, updates);

  if (!updatedPerson) {
    return res.status(404).json({ error: 'Person not found' });
  }

  res.json(updatedPerson);
});

// Delete person
router.delete('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const person = await dataService.getPersonById(id);
  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }
  if (!(await assertCompetitionAccess(req, res, person.competitionId))) return;

  // Check if person is in any couple
  const couples = await dataService.getCouples();
  const inCouple = couples.some(c => c.leaderId === id || c.followerId === id);

  if (inCouple) {
    return res.status(400).json({ error: 'Cannot delete person who is in a couple' });
  }

  const deleted = await dataService.deletePerson(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Person not found' });
  }

  res.status(204).send();
});

export default router;
