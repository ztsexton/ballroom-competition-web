import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { sseService } from '../services/sseService';
import { scheduleService, ScheduleService } from '../services/schedule';
import { ActiveHeatInfo, ActiveHeatEntry, ScoringProgress, ScoringProgressEntry, Event, Heat } from '../types';
import { RECALL_ROUNDS, getRecallCount } from '../constants/rounds';

const router = Router();

// GET /api/judging/competition/:competitionId/active-heat
router.get('/competition/:competitionId/active-heat', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });
    schedule = ScheduleService.migrateSchedule(schedule);

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return res.status(404).json({ error: 'No current heat' });

    const status = schedule.heatStatuses[currentHeat.id] || 'pending';

    if (currentHeat.isBreak) {
      const info: ActiveHeatInfo = {
        competitionId,
        heatId: currentHeat.id,
        entries: [],
        status,
        judges: [],
        isBreak: true,
        breakLabel: currentHeat.breakLabel,
        breakDuration: currentHeat.breakDuration,
        heatNumber: schedule.currentHeatIndex + 1,
        totalHeats: schedule.heatOrder.length,
      };
      return res.json(info);
    }

    // Batch-prefetch all events for this heat
    const eventIds = currentHeat.entries.map(e => e.eventId);
    const eventsMap = await dataService.getEventsByIds(eventIds);

    // Collect all bibs and judge IDs in one pass
    const allBibs: number[] = [];
    const allJudgeIds = new Set<number>();
    const entryMeta: Array<{ entry: typeof currentHeat.entries[0]; event: Event; heat: Heat; bibs: number[] }> = [];

    for (const entry of currentHeat.entries) {
      const event = eventsMap.get(entry.eventId);
      if (!event) continue;

      const heat = event.heats.find(h => h.round === entry.round);
      if (!heat) continue;

      heat.judges.forEach(j => allJudgeIds.add(j));
      const bibs = entry.bibSubset || heat.bibs;
      allBibs.push(...bibs);
      entryMeta.push({ entry, event, heat, bibs });
    }

    // Batch-prefetch all couples and judges (3 queries total instead of 35+)
    const couplesMap = await dataService.getCouplesByBibs(allBibs);
    const judgesMap = await dataService.getJudgesByIds(Array.from(allJudgeIds));

    // Build entries array using prefetched data
    const entries: ActiveHeatEntry[] = [];
    for (const { entry, event, heat, bibs } of entryMeta) {
      const couples = bibs.map(bib => {
        const couple = couplesMap.get(bib);
        return couple
          ? { bib, leaderName: couple.leaderName, followerName: couple.followerName }
          : { bib, leaderName: 'Unknown', followerName: 'Unknown' };
      });

      const recallCount = getRecallCount(
        event.heats,
        entry.round,
        entry.totalFloorHeats,
        entry.floorHeatIndex,
      );

      entries.push({
        eventId: entry.eventId,
        eventName: event.name,
        round: entry.round,
        couples,
        isRecallRound: RECALL_ROUNDS.includes(entry.round),
        scoringType: event.scoringType || 'standard',
        designation: event.designation,
        style: event.style,
        level: event.level,
        dances: entry.dance ? [entry.dance] : event.dances,
        floorHeatIndex: entry.floorHeatIndex,
        totalFloorHeats: entry.totalFloorHeats,
        recallCount,
      });
    }

    // Resolve judge details from prefetched data
    const judges = Array.from(allJudgeIds).map(jId => {
      const judge = judgesMap.get(jId);
      return judge
        ? { id: judge.id, name: judge.name, judgeNumber: judge.judgeNumber, isChairman: judge.isChairman }
        : { id: jId, name: 'Unknown', judgeNumber: 0 };
    });
    judges.sort((a, b) => a.judgeNumber - b.judgeNumber);

    // Get dance info — floor-split heats have a specific dance per heat entry
    const floorDance = currentHeat.entries[0]?.dance;
    const allDances = floorDance ? [floorDance] : await scheduleService.getDancesForHeat(currentHeat);

    const info: ActiveHeatInfo = {
      competitionId,
      heatId: currentHeat.id,
      entries,
      status,
      judges,
      heatNumber: schedule.currentHeatIndex + 1,
      totalHeats: schedule.heatOrder.length,
      currentDance: floorDance || (allDances.length > 0 ? schedule.currentDance : undefined),
      allDances: allDances.length > 0 ? allDances : undefined,
    };

    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active heat' });
  }
});

// GET /api/judging/competition/:competitionId/scoring-progress
router.get('/competition/:competitionId/scoring-progress', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });
    schedule = ScheduleService.migrateSchedule(schedule);

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return res.status(404).json({ error: 'No current heat' });

    if (currentHeat.isBreak) {
      return res.status(400).json({ error: 'Current heat is a break, no scoring progress' });
    }

    // Batch-prefetch events for this heat
    const progressEventIds = currentHeat.entries.map(e => e.eventId);
    const progressEventsMap = await dataService.getEventsByIds(progressEventIds);

    // Collect all judge IDs in one pass
    const allJudgeIds = new Set<number>();
    const progressEntries: ScoringProgressEntry[] = [];

    for (const entry of currentHeat.entries) {
      const event = progressEventsMap.get(entry.eventId);
      if (!event) continue;

      const heat = event.heats.find(h => h.round === entry.round);
      if (!heat) continue;

      heat.judges.forEach(j => allJudgeIds.add(j));

      const bibs = entry.bibSubset || heat.bibs;
      const eventDances = entry.dance ? [entry.dance] : (event.dances && event.dances.length > 1 ? event.dances : [undefined]);
      const scoresByBib: Record<number, Record<number, number>> = {};
      const danceProgress: Record<string, Record<number, Record<number, number>>> = {};

      for (const dance of eventDances) {
        const roundScores = await dataService.getJudgeScoresForRound(entry.eventId, entry.round, bibs, dance);
        if (dance) {
          danceProgress[dance] = {};
          for (const bib of bibs) {
            danceProgress[dance][bib] = roundScores[bib] || {};
          }
        } else {
          for (const bib of bibs) {
            scoresByBib[bib] = roundScores[bib] || {};
          }
        }
      }

      progressEntries.push({
        eventId: entry.eventId,
        round: entry.round,
        scoresByBib: Object.keys(danceProgress).length > 0 ? {} : scoresByBib,
        dances: eventDances.filter((d): d is string => d !== undefined),
        danceScoresByBib: Object.keys(danceProgress).length > 0 ? danceProgress : undefined,
      });
    }

    // Batch-prefetch judges
    const progressJudgesMap = await dataService.getJudgesByIds(Array.from(allJudgeIds));

    // A judge hasSubmitted only when they've submitted for ALL entries
    const batchEntries = currentHeat.entries.map(e => {
      const event = progressEventsMap.get(e.eventId);
      const heat = event?.heats.find(h => h.round === e.round);
      return {
        eventId: e.eventId,
        round: e.round,
        dance: e.dance,
        bibs: e.bibSubset || heat?.bibs || [],
      };
    });
    const judgeIdArray = Array.from(allJudgeIds);
    const batchStatus = await dataService.getJudgeSubmissionStatusBatch(batchEntries, judgeIdArray);

    const judgesList = judgeIdArray.map(jId => {
      const judge = progressJudgesMap.get(jId);
      return {
        judgeId: jId,
        judgeName: judge?.name || 'Unknown',
        judgeNumber: judge?.judgeNumber || 0,
        hasSubmitted: batchStatus[jId] ?? false,
        isChairman: judge?.isChairman,
      };
    });
    judgesList.sort((a, b) => a.judgeNumber - b.judgeNumber);

    const progress: ScoringProgress = {
      heatId: currentHeat.id,
      entries: progressEntries,
      judges: judgesList,
      submittedCount: judgesList.filter(j => j.hasSubmitted).length,
      totalJudges: judgesList.length,
    };

    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scoring progress' });
  }
});

// POST /api/judging/competition/:competitionId/submit-scores
router.post('/competition/:competitionId/submit-scores', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { judgeId, eventId, round, scores, dance } = req.body;

    if (!judgeId || !eventId || !round || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'judgeId, eventId, round, and scores array are required' });
    }

    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });
    schedule = ScheduleService.migrateSchedule(schedule);

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    const status = schedule.heatStatuses[currentHeat.id];

    // Validate this event/round is in the current heat
    const matchingEntry = currentHeat.entries.find(
      e => e.eventId === eventId && e.round === round
    );
    if (!matchingEntry) {
      return res.status(400).json({ error: 'This event/round is not in the currently active heat' });
    }
    if (status !== 'scoring') {
      return res.status(400).json({ error: 'Heat is not in scoring status' });
    }

    const result = await scoringService.submitJudgeScores(eventId, round, judgeId, scores, dance || undefined);
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
router.get('/competition/:competitionId/judges', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const judges = await dataService.getJudges(competitionId);
    res.json(judges);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get judges' });
  }
});

// GET /api/judging/competition/:competitionId/schedule (read-only, non-admin)
router.get('/competition/:competitionId/schedule', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'No schedule found' });
    schedule = ScheduleService.migrateSchedule(schedule);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// GET /api/judging/competition/:competitionId/events (read-only, non-admin)
router.get('/competition/:competitionId/events', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const events = await dataService.getEvents(competitionId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// GET /api/judging/competition/:competitionId/couples (read-only, non-admin)
router.get('/competition/:competitionId/couples', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const couples = await dataService.getCouples(competitionId);
    res.json(couples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get couples' });
  }
});

// GET /api/judging/competition/:competitionId/competition (read-only, non-admin)
router.get('/competition/:competitionId/competition', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
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
