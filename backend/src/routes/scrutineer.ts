import { Router, Request, Response, NextFunction } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { RECALL_ROUNDS } from '../constants/rounds';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';

const router = Router();

// All scrutineer routes require at least competition-admin access
router.use(requireAnyAdmin);

// Check competition access for all routes with :eventId (look up event to find competitionId)
router.use('/events/:eventId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const eventId = parseInt(req.params.eventId);
  if (isNaN(eventId)) return next();
  const event = await dataService.getEventById(eventId);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (!(await assertCompetitionAccess(req, res, event.competitionId))) return;
  next();
});

// Get all judge scores for an event/round (bulk)
router.get('/events/:eventId/rounds/:round/judge-scores', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const round = req.params.round;

    const event = await dataService.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const heat = event.heats.find(h => h.round === round);
    if (!heat) {
      return res.status(404).json({ error: 'Round not found for this event' });
    }

    // Resolve judge details
    const allJudges = await dataService.getJudges(event.competitionId);
    const judgeMap = new Map(allJudges.map(j => [j.id, j]));
    const judges = heat.judges
      .map(jId => judgeMap.get(jId))
      .filter(j => j != null)
      .map(j => ({ id: j!.id, name: j!.name, judgeNumber: j!.judgeNumber, isChairman: j!.isChairman }));

    const isRecallRound = RECALL_ROUNDS.includes(round);
    const scoringType = event.scoringType || 'standard';
    const dances = event.dances && event.dances.length > 1 ? event.dances : [];

    if (dances.length > 0) {
      // Multi-dance: fetch scores per dance
      const danceScoresByBib: Record<string, Record<number, Record<number, number>>> = {};
      for (const dance of dances) {
        danceScoresByBib[dance] = {};
        for (const bib of heat.bibs) {
          const judgeScores = await dataService.getJudgeScores(eventId, round, bib, dance);
          if (Object.keys(judgeScores).length > 0) {
            danceScoresByBib[dance][bib] = judgeScores;
          }
        }
      }
      res.json({
        eventId, round, bibs: heat.bibs, judges,
        isRecallRound, scoringType, dances,
        scoresByBib: {},
        danceScoresByBib,
      });
    } else {
      // Single-dance
      const scoresByBib: Record<number, Record<number, number>> = {};
      for (const bib of heat.bibs) {
        const judgeScores = await dataService.getJudgeScores(eventId, round, bib);
        if (Object.keys(judgeScores).length > 0) {
          scoresByBib[bib] = judgeScores;
        }
      }
      res.json({
        eventId, round, bibs: heat.bibs, judges,
        isRecallRound, scoringType, dances: [],
        scoresByBib,
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch judge scores' });
  }
});

// Submit scores for one judge (bypasses schedule checks)
router.post('/events/:eventId/rounds/:round/submit-scores', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const round = req.params.round;
    const { judgeId, scores, dance } = req.body;

    if (!judgeId || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'judgeId and scores array are required' });
    }

    const result = await scoringService.submitJudgeScores(eventId, round, judgeId, scores, dance);
    if (!result.success) {
      return res.status(400).json({ error: 'Failed to submit scores. Ensure the judge is assigned to this event/round.' });
    }

    res.json({ success: true, allSubmitted: result.allSubmitted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit scores' });
  }
});

// Compile judge scores and calculate results
router.post('/events/:eventId/rounds/:round/compile', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const round = req.params.round;

    const compiled = await scoringService.compileJudgeScores(eventId, round);
    if (!compiled) {
      return res.status(400).json({ error: 'Failed to compile scores' });
    }

    const results = await scoringService.calculateResults(eventId, round);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compile scores' });
  }
});

export default router;
