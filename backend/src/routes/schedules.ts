import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scheduleService } from '../services/scheduleService';

const router = Router();

// Get schedule for a competition
router.get('/:competitionId', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'No schedule found for this competition' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Generate/regenerate schedule
router.post('/:competitionId/generate', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { styleOrder, levelOrder, judgeSettings } = req.body;

    const competition = dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Save judge settings to competition if provided
    if (judgeSettings) {
      dataService.updateCompetition(competitionId, { judgeSettings });
    }

    const schedule = scheduleService.generateSchedule(competitionId, styleOrder, levelOrder);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

// Reorder an event in the schedule
router.patch('/:competitionId/reorder', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { fromIndex, toIndex } = req.body;

    const schedule = scheduleService.reorderHeat(competitionId, fromIndex, toIndex);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found or invalid indices' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder event' });
  }
});

// Advance the run state
router.post('/:competitionId/advance', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = scheduleService.advanceHeat(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to advance event' });
  }
});

// Go back in the run state
router.post('/:competitionId/back', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = scheduleService.goBackHeat(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to go back' });
  }
});

// Jump to a specific event
router.post('/:competitionId/jump', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { heatIndex } = req.body;

    const schedule = scheduleService.jumpToHeat(competitionId, heatIndex);
    if (!schedule) {
      return res.status(400).json({ error: 'Invalid event index or schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to jump to event' });
  }
});

// Suggest position for a new event
router.get('/:competitionId/suggest/:eventId', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const eventId = parseInt(req.params.eventId);
    const position = scheduleService.suggestPosition(competitionId, eventId);
    res.json({ position });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suggest position' });
  }
});

// Insert an event into the schedule at a specific position
router.post('/:competitionId/insert', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { eventId, position } = req.body;

    const schedule = scheduleService.insertEvent(competitionId, eventId, position);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert event' });
  }
});

// Delete schedule
router.delete('/:competitionId', (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const deleted = dataService.deleteSchedule(competitionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;
