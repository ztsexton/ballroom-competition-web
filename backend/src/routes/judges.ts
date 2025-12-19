import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all judges
router.get('/', (_req: Request, res: Response) => {
  const judges = dataService.getJudges();
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
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const newJudge = dataService.addJudge(name);
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
