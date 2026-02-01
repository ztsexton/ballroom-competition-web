import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all judges (optionally filtered by competition)
router.get('/', async (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const judges = await dataService.getJudges(competitionId);
  res.json(judges);
});

// Get judge by ID
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const judge = await dataService.getJudgeById(id);

  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  res.json(judge);
});

// Add a new judge
router.post('/', async (req: Request, res: Response) => {
  const { name, competitionId } = req.body;

  if (!name || !competitionId) {
    return res.status(400).json({ error: 'Name and competition ID are required' });
  }

  const newJudge = await dataService.addJudge(name, parseInt(competitionId));
  res.status(201).json(newJudge);
});

// Delete judge
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = await dataService.deleteJudge(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  res.status(204).send();
});

export default router;
