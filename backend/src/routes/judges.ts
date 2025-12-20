import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all judges (optionally filtered by competition)
router.get('/', (req: Request, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  const judges = dataService.getJudges(competitionId);
  res.json(judges);
});

// Get judge by ID
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const judge = dataService.getJudgeById(id);
  
  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }
  
  res.json(judge);
});

// Add a new judge
router.post('/', (req: Request, res: Response) => {
  const { name, competitionId } = req.body;
  
  if (!name || !competitionId) {
    return res.status(400).json({ error: 'Name and competition ID are required' });
  }
  
  const newJudge = dataService.addJudge(name, parseInt(competitionId));
  res.status(201).json(newJudge);
});

// Delete judge
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = dataService.deleteJudge(id);
  
  if (!deleted) {
    return res.status(404).json({ error: 'Judge not found' });
  }
  
  res.status(204).send();
});

export default router;
