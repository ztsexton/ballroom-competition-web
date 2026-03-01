import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// GET /api/settings — return site settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await dataService.getSiteSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// PATCH /api/settings — update site settings
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { maxJudgeHoursWithoutBreak } = req.body;

    if (maxJudgeHoursWithoutBreak !== undefined && maxJudgeHoursWithoutBreak !== null) {
      const val = Number(maxJudgeHoursWithoutBreak);
      if (isNaN(val) || val < 0.5 || val > 24) {
        return res.status(400).json({ error: 'maxJudgeHoursWithoutBreak must be between 0.5 and 24' });
      }
    }

    const updates: Record<string, unknown> = {};
    if (maxJudgeHoursWithoutBreak !== undefined) {
      updates.maxJudgeHoursWithoutBreak = maxJudgeHoursWithoutBreak === null ? undefined : Number(maxJudgeHoursWithoutBreak);
    }

    const settings = await dataService.updateSiteSettings(updates);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update site settings' });
  }
});

export default router;
