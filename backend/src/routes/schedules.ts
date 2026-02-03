import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scheduleService, ScheduleService } from '../services/schedule';
import { scoringService } from '../services/scoringService';
import { sseService } from '../services/sseService';

const router = Router();

// Get schedule for a competition
router.get('/:competitionId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'No schedule found for this competition' });
    }
    // Transparently migrate old-format schedules
    schedule = ScheduleService.migrateSchedule(schedule);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Generate/regenerate schedule
router.post('/:competitionId/generate', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { styleOrder, levelOrder, judgeSettings, timingSettings } = req.body;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Save judge settings and timing settings to competition if provided
    const updates: Partial<typeof competition> = {};
    if (judgeSettings) updates.judgeSettings = judgeSettings;
    if (timingSettings) updates.timingSettings = timingSettings;
    if (Object.keys(updates).length > 0) {
      await dataService.updateCompetition(competitionId, updates);
    }

    const schedule = await scheduleService.generateSchedule(competitionId, styleOrder, levelOrder);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

// Reorder an event in the schedule
router.patch('/:competitionId/reorder', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { fromIndex, toIndex } = req.body;

    const schedule = await scheduleService.reorderHeat(competitionId, fromIndex, toIndex);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found or invalid indices' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder event' });
  }
});

// Advance the run state
router.post('/:competitionId/advance', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);

    // Before advancing, check if we're transitioning from scoring → completed
    // If so, compile any judge scores into the final format for ALL entries in the heat
    let preSchedule = await dataService.getSchedule(competitionId);
    if (preSchedule) {
      preSchedule = ScheduleService.migrateSchedule(preSchedule);
      const currentHeat = preSchedule.heatOrder[preSchedule.currentHeatIndex];
      if (currentHeat && !currentHeat.isBreak) {
        const heatStatus = preSchedule.heatStatuses[currentHeat.id];
        if (heatStatus === 'scoring') {
          for (const entry of currentHeat.entries) {
            await scoringService.compileJudgeScores(entry.eventId, entry.round);
            // Clear judge scores for all dances
            const event = await dataService.getEventById(entry.eventId);
            const dances: (string | undefined)[] = event?.dances && event.dances.length > 1 ? event.dances : [undefined];
            for (const dance of dances) {
              await dataService.clearJudgeScores(entry.eventId, entry.round, dance);
            }
          }
        }
      }
    }

    const schedule = await scheduleService.advanceHeat(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to advance event' });
  }
});

// Advance to the next dance (multi-dance heats)
router.post('/:competitionId/advance-dance', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = await scheduleService.advanceDance(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to advance dance' });
  }
});

// Go back to the previous dance (multi-dance heats)
router.post('/:competitionId/back-dance', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = await scheduleService.backDance(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to go back dance' });
  }
});

// Go back in the run state
router.post('/:competitionId/back', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = await scheduleService.goBackHeat(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to go back' });
  }
});

// Jump to a specific event
router.post('/:competitionId/jump', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { heatIndex } = req.body;

    const schedule = await scheduleService.jumpToHeat(competitionId, heatIndex);
    if (!schedule) {
      return res.status(400).json({ error: 'Invalid event index or schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to jump to event' });
  }
});

// Reset progress to a specific heat (clears scores from target through current)
router.post('/:competitionId/reset', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { heatIndex } = req.body;

    const schedule = await scheduleService.resetToHeat(competitionId, heatIndex);
    if (!schedule) {
      return res.status(400).json({ error: 'Invalid heat index or schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset to heat' });
  }
});

// Re-run a single heat (clears only that heat's scores)
router.post('/:competitionId/rerun', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { heatIndex } = req.body;

    const schedule = await scheduleService.rerunHeat(competitionId, heatIndex);
    if (!schedule) {
      return res.status(400).json({ error: 'Invalid heat index or schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to re-run heat' });
  }
});

// Suggest position for a new event
router.get('/:competitionId/suggest/:eventId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const eventId = parseInt(req.params.eventId);
    const position = await scheduleService.suggestPosition(competitionId, eventId);
    res.json({ position });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suggest position' });
  }
});

// Insert an event into the schedule at a specific position
router.post('/:competitionId/insert', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { eventId, position } = req.body;

    const schedule = await scheduleService.insertEvent(competitionId, eventId, position);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert event' });
  }
});

// Update entries for a specific heat (merge/split events)
router.patch('/:competitionId/heat/:heatId/entries', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'At least one entry is required' });
    }

    const schedule = await scheduleService.updateHeatEntries(competitionId, heatId, entries);
    if (!schedule) {
      return res.status(400).json({ error: 'Invalid heat, incompatible entries, or exceeds max couples per heat' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update heat entries' });
  }
});

// Split an entry out of a multi-entry heat into its own heat
router.post('/:competitionId/heat/:heatId/split', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;
    const { eventId, round } = req.body;

    if (!eventId || !round) {
      return res.status(400).json({ error: 'eventId and round are required' });
    }

    const schedule = await scheduleService.splitHeatEntry(competitionId, heatId, eventId, round);
    if (!schedule) {
      return res.status(400).json({ error: 'Cannot split: heat not found, entry not found, or heat has only one entry' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to split heat entry' });
  }
});

// Add a break to the schedule
router.post('/:competitionId/break', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { label, duration, position } = req.body;

    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'Break label is required' });
    }

    const schedule = await scheduleService.addBreak(
      competitionId,
      label,
      duration !== undefined ? parseInt(duration) : undefined,
      position !== undefined ? parseInt(position) : undefined,
    );
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(201).json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add break' });
  }
});

// Remove a break from the schedule
router.delete('/:competitionId/break/:heatIndex', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatIndex = parseInt(req.params.heatIndex);

    const schedule = await scheduleService.removeBreak(competitionId, heatIndex);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found or item is not a break' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove break' });
  }
});

// Update timing settings and recalculate schedule times
router.patch('/:competitionId/timing', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { timingSettings } = req.body;

    if (!timingSettings) {
      return res.status(400).json({ error: 'timingSettings is required' });
    }

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    await dataService.updateCompetition(competitionId, { timingSettings });

    // Recalculate schedule times if a schedule exists
    let schedule = await dataService.getSchedule(competitionId);
    if (schedule) {
      schedule = ScheduleService.migrateSchedule(schedule);
      const events = await dataService.getEvents(competitionId);
      const { timingService, DEFAULT_TIMING } = await import('../services/timingService');
      const settings = { ...DEFAULT_TIMING, ...timingSettings };
      timingService.calculateEstimatedTimes(schedule.heatOrder, events, settings);
      schedule = await dataService.saveSchedule(schedule);
      return res.json(schedule);
    }

    res.json({ message: 'Timing settings updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timing settings' });
  }
});

// Delete schedule
router.delete('/:competitionId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const deleted = await dataService.deleteSchedule(competitionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
