import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';

const router = Router();

// Get all judges (optionally filtered by competition)
router.get('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  if (competitionId) {
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;
  } else if (!req.user!.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: competitionId required for non-site-admins' });
  }
  const judges = await dataService.getJudges(competitionId);
  res.json(judges);
});

// Get judge by ID
router.get('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const judge = await dataService.getJudgeById(id);

  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  if (!(await assertCompetitionAccess(req, res, judge.competitionId))) return;
  res.json(judge);
});

// Add a new judge
router.post('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const { name, competitionId } = req.body;

  if (!name || !competitionId) {
    return res.status(400).json({ error: 'Name and competition ID are required' });
  }

  if (!(await assertCompetitionAccess(req, res, parseInt(competitionId)))) return;

  const newJudge = await dataService.addJudge(name, parseInt(competitionId));
  res.status(201).json(newJudge);
});

// Update judge
router.patch('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const judge = await dataService.getJudgeById(id);
  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }
  if (!(await assertCompetitionAccess(req, res, judge.competitionId))) return;

  const updated = await dataService.updateJudge(id, req.body);

  if (!updated) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  res.json(updated);
});

// Delete judge
router.delete('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const judge = await dataService.getJudgeById(id);
  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }
  if (!(await assertCompetitionAccess(req, res, judge.competitionId))) return;

  const deleted = await dataService.deleteJudge(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  res.status(204).send();
});

export default router;
