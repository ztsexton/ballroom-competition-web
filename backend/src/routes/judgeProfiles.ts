import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET / — List all judge profiles
router.get('/', async (_req: AuthRequest, res: Response) => {
  const profiles = await dataService.getJudgeProfiles();
  res.json(profiles);
});

// GET /:id — Get single profile
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const profile = await dataService.getJudgeProfileById(id);
  if (!profile) {
    return res.status(404).json({ error: 'Judge profile not found' });
  }
  res.json(profile);
});

// POST / — Create profile
router.post('/', async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, email, userUid, certifications } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const profile = await dataService.addJudgeProfile({
    firstName,
    lastName,
    email: email || undefined,
    userUid: userUid || undefined,
    certifications: certifications || {},
  });
  res.status(201).json(profile);
});

// PATCH /:id — Update profile
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const updated = await dataService.updateJudgeProfile(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Judge profile not found' });
  }
  res.json(updated);
});

// DELETE /:id — Delete profile
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = await dataService.deleteJudgeProfile(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Judge profile not found' });
  }
  res.status(204).send();
});

export default router;
