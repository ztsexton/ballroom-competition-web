import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { sseService } from '../services/sseService';
import { ActiveHeatInfo, ScoringProgress } from '../types';

const router = Router();

// GET /api/judging/competition/:competitionId/active-heat
router.get('/competition/:competitionId/active-heat', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return res.status(404).json({ error: 'No current heat' });

    const heatKey = `${currentHeat.eventId}:${currentHeat.round}`;
    const status = schedule.heatStatuses[heatKey] || 'pending';

    if (currentHeat.isBreak) {
      const info: ActiveHeatInfo = {
        competitionId,
        eventId: 0,
        eventName: currentHeat.breakLabel || 'Break',
        round: currentHeat.round,
        status,
        couples: [],
        judges: [],
        isRecallRound: false,
        isBreak: true,
        breakLabel: currentHeat.breakLabel,
        breakDuration: currentHeat.breakDuration,
      };
      return res.json(info);
    }

    const event = dataService.getEventById(currentHeat.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const heat = event.heats.find(h => h.round === currentHeat.round);
    if (!heat) return res.status(404).json({ error: 'Heat not found' });

    const couples = heat.bibs.map(bib => {
      const couple = dataService.getCoupleByBib(bib);
      return couple
        ? { bib, leaderName: couple.leaderName, followerName: couple.followerName }
        : { bib, leaderName: 'Unknown', followerName: 'Unknown' };
    });

    const judges = heat.judges.map(jId => {
      const judge = dataService.getJudgeById(jId);
      return judge
        ? { id: judge.id, name: judge.name, judgeNumber: judge.judgeNumber }
        : { id: jId, name: 'Unknown', judgeNumber: 0 };
    });

    const info: ActiveHeatInfo = {
      competitionId,
      eventId: currentHeat.eventId,
      eventName: event.name,
      round: currentHeat.round,
      status,
      couples,
      judges,
      isRecallRound: ['quarter-final', 'semi-final'].includes(currentHeat.round),
      scoringType: event.scoringType || 'standard',
      style: event.style,
      level: event.level,
      dances: event.dances,
    };

    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active heat' });
  }
});

// GET /api/judging/competition/:competitionId/scoring-progress
router.get('/competition/:competitionId/scoring-progress', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return res.status(404).json({ error: 'No current heat' });

    if (currentHeat.isBreak) {
      return res.status(400).json({ error: 'Current heat is a break, no scoring progress' });
    }

    const event = dataService.getEventById(currentHeat.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const heat = event.heats.find(h => h.round === currentHeat.round);
    if (!heat) return res.status(404).json({ error: 'Heat not found' });

    const submissionStatus = dataService.getJudgeSubmissionStatus(currentHeat.eventId, currentHeat.round);

    const judgesList = heat.judges.map(jId => {
      const judge = dataService.getJudgeById(jId);
      return {
        judgeId: jId,
        judgeName: judge?.name || 'Unknown',
        judgeNumber: judge?.judgeNumber || 0,
        hasSubmitted: submissionStatus[jId] || false,
      };
    });

    const scoresByBib: Record<number, Record<number, number>> = {};
    for (const bib of heat.bibs) {
      scoresByBib[bib] = dataService.getJudgeScores(currentHeat.eventId, currentHeat.round, bib);
    }

    const progress: ScoringProgress = {
      eventId: currentHeat.eventId,
      round: currentHeat.round,
      judges: judgesList,
      submittedCount: judgesList.filter(j => j.hasSubmitted).length,
      totalJudges: judgesList.length,
      scoresByBib,
    };

    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scoring progress' });
  }
});

// POST /api/judging/competition/:competitionId/submit-scores
router.post('/competition/:competitionId/submit-scores', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { judgeId, eventId, round, scores } = req.body;

    if (!judgeId || !eventId || !round || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'judgeId, eventId, round, and scores array are required' });
    }

    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    const heatKey = `${currentHeat.eventId}:${currentHeat.round}`;
    const status = schedule.heatStatuses[heatKey];

    if (currentHeat.eventId !== eventId || currentHeat.round !== round) {
      return res.status(400).json({ error: 'This is not the currently active heat' });
    }
    if (status !== 'scoring') {
      return res.status(400).json({ error: 'Heat is not in scoring status' });
    }

    const result = scoringService.submitJudgeScores(eventId, round, judgeId, scores);
    if (!result.success) {
      return res.status(400).json({ error: 'Failed to submit scores. Judge may not be assigned to this heat.' });
    }

    sseService.broadcastScoreUpdate(competitionId, eventId, round);

    res.json({
      message: 'Scores submitted successfully',
      allJudgesSubmitted: result.allSubmitted,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit scores' });
  }
});

// GET /api/judging/competition/:competitionId/judges
router.get('/competition/:competitionId/judges', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const judges = dataService.getJudges(competitionId);
    res.json(judges);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get judges' });
  }
});

// GET /api/judging/competition/:competitionId/schedule (read-only, non-admin)
router.get('/competition/:competitionId/schedule', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// GET /api/judging/competition/:competitionId/events (read-only, non-admin)
router.get('/competition/:competitionId/events', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const events = dataService.getEvents(competitionId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// GET /api/judging/competition/:competitionId/couples (read-only, non-admin)
router.get('/competition/:competitionId/couples', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const couples = dataService.getCouples(competitionId);
    res.json(couples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get couples' });
  }
});

// GET /api/judging/competition/:competitionId/competition (read-only, non-admin)
router.get('/competition/:competitionId/competition', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const competition = dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });
    res.json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get competition' });
  }
});

// SSE stream
router.get('/competition/:competitionId/stream', (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  sseService.addClient(competitionId, res);
});

export default router;
