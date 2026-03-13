import { Router, Request, Response, NextFunction } from 'express';
import { dataService } from '../services/dataService';
import { scheduleService, ScheduleService, buildJudgeSchedule } from '../services/schedule';
import { scoringService, computeAdvancementBibs } from '../services/scoringService';
import { sseService } from '../services/sseService';
import { getRecallCount } from '../constants/rounds';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';
import { generateHeatSheetPDF, generateCombinedHeatSheetPDF, generateResultsPDF, generateCombinedResultsPDF } from '../services/pdfService';
import { sendHeatSheetEmail, sendResultsEmail, isEmailConfigured } from '../services/emailService';
import { PersonHeatEntry, PersonPartnerHeats, PersonHeatListResponse, PersonEventResult, PersonResultsResponse } from '../types';
import logger from '../utils/logger';

const router = Router();

// All schedule routes require at least competition-admin access
router.use(requireAnyAdmin);

// Check competition access for all routes with :competitionId
router.use('/:competitionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const competitionId = parseInt(req.params.competitionId);
  if (isNaN(competitionId)) return next();
  if (!(await assertCompetitionAccess(req, res, competitionId))) return;
  next();
});

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
    const { styleOrder, levelOrder, danceOrder, judgeSettings, timingSettings, autoBreaks, deferFinals, eventTypeOrder, levelCombining } = req.body;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Save judge settings, timing settings, and dance order to competition if provided
    const updates: Partial<typeof competition> = {};
    if (judgeSettings) updates.judgeSettings = judgeSettings;
    if (timingSettings) updates.timingSettings = timingSettings;
    if (danceOrder) updates.danceOrder = danceOrder;
    if (Object.keys(updates).length > 0) {
      await dataService.updateCompetition(competitionId, updates);
    }

    const schedule = await scheduleService.generateSchedule(competitionId, styleOrder, levelOrder, danceOrder, autoBreaks, deferFinals, eventTypeOrder, levelCombining);
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
            await scoringService.compileJudgeScores(entry.eventId, entry.round, entry.bibSubset, entry.dance);
            // Clear judge scores for the relevant dance(s)
            if (entry.dance) {
              await dataService.clearJudgeScores(entry.eventId, entry.round, entry.dance);
            } else {
              const event = await dataService.getEventById(entry.eventId);
              const dances: (string | undefined)[] = event?.dances && event.dances.length > 1 ? event.dances : [undefined];
              for (const dance of dances) {
                await dataService.clearJudgeScores(entry.eventId, entry.round, dance);
              }
            }

            // Floor heat deferred advancement: only advance when ALL sibling floor heats complete
            if (entry.totalFloorHeats && entry.totalFloorHeats > 1) {
              // Find all sibling heats for this event/round
              const siblingHeats = preSchedule.heatOrder.filter(h =>
                h.entries.some(e => e.eventId === entry.eventId && e.round === entry.round));

              // The current heat is about to be marked completed by advanceHeat,
              // so treat it as completed for this check
              const allDone = siblingHeats.every(h =>
                h.id === currentHeat.id || preSchedule!.heatStatuses[h.id] === 'completed');

              if (allDone) {
                // All floor heats done — collect top bibs from each subset and advance
                const subsetsByIndex = new Map<number, number[]>();
                for (const h of siblingHeats) {
                  const e = h.entries.find(e => e.eventId === entry.eventId && e.round === entry.round)!;
                  if (e.bibSubset && e.floorHeatIndex !== undefined) {
                    subsetsByIndex.set(e.floorHeatIndex, e.bibSubset);
                  }
                }

                const event = await dataService.getEventById(entry.eventId);
                const competition = event ? await dataService.getCompetitionById(event.competitionId) : undefined;
                const rules = competition?.recallRules;
                const nextRoundName = event
                  ? event.heats[event.heats.findIndex(h => h.round === entry.round) + 1]?.round
                  : undefined;
                const isFinalNext = nextRoundName === 'final';
                const includeTies = rules?.includeTies ?? true;

                const allRecalled: number[] = [];
                for (const [idx, bibSubset] of subsetsByIndex) {
                  const results = await scoringService.calculateResults(entry.eventId, entry.round, bibSubset);
                  const perHeatRecall = event
                    ? getRecallCount(event.heats, entry.round, entry.totalFloorHeats, idx) ?? 6
                    : 6;
                  // For floor heats advancing to final, apply hardMax per-subset
                  const perHeatHardMax = isFinalNext
                    ? Math.ceil((rules?.finalMaxSize ?? 8) / (entry.totalFloorHeats || 1))
                    : undefined;
                  const topBibs = computeAdvancementBibs(results, perHeatRecall, {
                    hardMax: perHeatHardMax,
                    includeTies,
                  });
                  allRecalled.push(...topBibs);
                }
                await dataService.advanceToNextRound(entry.eventId, entry.round, allRecalled);
              }
              // else: not all sibling heats done yet, skip advancement
            }
          }
        }
      }
    }

    // Guard: prevent starting scoring on a new heat while another is already scoring
    if (preSchedule) {
      const currentHeat = preSchedule.heatOrder[preSchedule.currentHeatIndex];
      const currentStatus = currentHeat ? (preSchedule.heatStatuses[currentHeat.id] || 'pending') : 'pending';
      if (currentStatus === 'pending' && currentHeat && !currentHeat.isBreak) {
        const scoringHeat = preSchedule.heatOrder.find((h, idx) =>
          idx !== preSchedule!.currentHeatIndex && preSchedule!.heatStatuses[h.id] === 'scoring',
        );
        if (scoringHeat) {
          return res.status(409).json({
            error: 'Another heat is currently being scored. Complete or reset it before starting a new one.',
          });
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
    const { entries, forceOverride } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'At least one entry is required' });
    }

    const schedule = await scheduleService.updateHeatEntries(competitionId, heatId, entries, forceOverride);
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

// Split a round into floor heats (manual split)
router.post('/:competitionId/heat/:heatId/split-floor', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;
    const { groupCount } = req.body;

    if (!groupCount || groupCount < 2) {
      return res.status(400).json({ error: 'groupCount must be at least 2' });
    }

    const schedule = await scheduleService.splitRoundIntoFloorHeats(competitionId, heatId, groupCount);
    if (!schedule) {
      return res.status(400).json({ error: 'Cannot split: heat not found, already split, or invalid group count' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to split into floor heats' });
  }
});

// Resplit pending heats for a partially-scored event
router.post('/:competitionId/heat/resplit', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { eventId, round, groupCount } = req.body;

    if (!eventId || !round || !groupCount || groupCount < 1) {
      return res.status(400).json({ error: 'eventId, round, and groupCount (>=1) are required' });
    }

    const schedule = await scheduleService.resplitPendingHeats(competitionId, eventId, round, groupCount);
    if (!schedule) {
      return res.status(400).json({ error: 'Cannot resplit: no pending heats found, invalid parameters, or event not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resplit heats' });
  }
});

// Reassign bibs in a pending floor heat
router.patch('/:competitionId/heat/:heatId/bibs', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;
    const { bibSubset } = req.body;

    if (!Array.isArray(bibSubset) || bibSubset.length === 0) {
      return res.status(400).json({ error: 'bibSubset array is required' });
    }

    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    schedule = ScheduleService.migrateSchedule(schedule);

    const heat = schedule.heatOrder.find(h => h.id === heatId);
    if (!heat) return res.status(404).json({ error: 'Heat not found' });
    if (heat.isBreak) return res.status(400).json({ error: 'Cannot reassign bibs on a break' });

    const status = schedule.heatStatuses[heatId] || 'pending';
    if (status !== 'pending') {
      return res.status(409).json({ error: 'Can only reassign bibs on pending heats' });
    }

    // Must be a floor heat
    const entry = heat.entries[0];
    if (!entry || !entry.bibSubset) {
      return res.status(400).json({ error: 'Heat is not a floor heat (no bibSubset)' });
    }

    // Validate all bibs are in the event's round
    const event = await dataService.getEventById(entry.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const roundHeat = event.heats.find(h => h.round === entry.round);
    if (!roundHeat) return res.status(404).json({ error: 'Round not found in event' });

    const validBibs = new Set(roundHeat.bibs);
    const invalidBibs = bibSubset.filter((b: number) => !validBibs.has(b));
    if (invalidBibs.length > 0) {
      return res.status(400).json({ error: `Invalid bibs not in event round: ${invalidBibs.join(', ')}` });
    }

    entry.bibSubset = bibSubset;
    schedule.updatedAt = new Date().toISOString();
    await dataService.saveSchedule(schedule);

    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reassign bibs' });
  }
});

// Unsplit floor heats back into a single heat
router.post('/:competitionId/heat/:heatId/unsplit', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;

    const schedule = await scheduleService.unsplitFloorHeats(competitionId, heatId);
    if (!schedule) {
      return res.status(400).json({ error: 'Cannot unsplit: heat not found, not a split heat, or only one floor heat' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsplit floor heats' });
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

// Detect back-to-back scheduling conflicts
// Query params: ?level=person (default: couple), ?excludePros=true
router.get('/:competitionId/back-to-back', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const level = req.query.level as string | undefined;
    const excludePros = req.query.excludePros === 'true';

    if (level === 'person') {
      const conflicts = await scheduleService.detectPersonBackToBack(competitionId, excludePros);
      // Collect unique heat IDs involved in conflicts for easy frontend highlighting
      const conflictHeatIds = new Set<string>();
      for (const c of conflicts) {
        conflictHeatIds.add(c.heatId1);
        conflictHeatIds.add(c.heatId2);
      }
      res.json({ conflicts, count: conflicts.length, conflictHeatIds: [...conflictHeatIds] });
    } else {
      const conflicts = await scheduleService.detectBackToBack(competitionId);
      const conflictHeatIds = new Set<string>();
      for (const c of conflicts) {
        conflictHeatIds.add(c.heatId1);
        conflictHeatIds.add(c.heatId2);
      }
      res.json({ conflicts, count: conflicts.length, conflictHeatIds: [...conflictHeatIds] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect back-to-back conflicts' });
  }
});

// Minimize back-to-back scheduling conflicts
router.post('/:competitionId/minimize-back-to-back', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const schedule = await scheduleService.minimizeBackToBack(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    // Return the new schedule along with remaining conflicts
    const conflicts = await scheduleService.detectBackToBack(competitionId);
    res.json({ schedule, conflicts, conflictsRemaining: conflicts.length });
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to minimize back-to-back conflicts' });
  }
});

// Analyze schedule for optimization opportunities
router.get('/:competitionId/analyze', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const analysis = await scheduleService.analyzeSchedule(competitionId);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze schedule' });
  }
});

// Apply optimization suggestions
router.post('/:competitionId/optimize', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { suggestions } = req.body;

    if (!Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'suggestions array is required' });
    }

    const schedule = await scheduleService.applySuggestions(competitionId, suggestions);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply optimizations' });
  }
});

// Get consolidation preview — simulates schedule with different configs
router.get('/:competitionId/consolidation-preview', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const preview = await scheduleService.getConsolidationPreview(competitionId);
    res.json(preview);
  } catch (error) {
    console.error('Consolidation preview error:', error);
    res.status(500).json({ error: 'Failed to generate consolidation preview' });
  }
});

// Simulate combined consolidation strategies
router.post('/:competitionId/consolidation-simulate', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { strategyIds } = req.body;
    if (!Array.isArray(strategyIds)) {
      return res.status(400).json({ error: 'strategyIds must be an array' });
    }
    const result = await scheduleService.simulateCombined(competitionId, strategyIds);
    res.json(result);
  } catch (error) {
    console.error('Consolidation simulate error:', error);
    res.status(500).json({ error: 'Failed to simulate consolidation' });
  }
});

// In-memory variant store with TTL
import { ScheduleVariant } from '../types';
const variantStore = new Map<number, { variants: ScheduleVariant[]; expiresAt: number }>();

// Generate schedule variants for main/fill-in mode
router.post('/:competitionId/generate-variants', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { judgeSettings, timingSettings, danceOrder } = req.body;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Save settings if provided
    const updates: Partial<typeof competition> = {};
    if (judgeSettings) updates.judgeSettings = judgeSettings;
    if (timingSettings) updates.timingSettings = timingSettings;
    if (danceOrder) updates.danceOrder = danceOrder;
    if (Object.keys(updates).length > 0) {
      await dataService.updateCompetition(competitionId, updates);
    }

    const variants = await scheduleService.generateVariants(competitionId);
    if (variants.length === 0) {
      return res.status(400).json({ error: 'Could not generate variants. Ensure you have main and fill-in judges configured.' });
    }

    // Store with 30-min TTL
    variantStore.set(competitionId, {
      variants,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    res.json({ variants });
  } catch (error) {
    console.error('Generate variants error:', error);
    res.status(500).json({ error: 'Failed to generate schedule variants' });
  }
});

// Apply a selected variant
router.post('/:competitionId/apply-variant', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const { variantId } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId is required' });
    }

    const stored = variantStore.get(competitionId);
    if (!stored || stored.expiresAt < Date.now()) {
      variantStore.delete(competitionId);
      return res.status(404).json({ error: 'Variants expired. Please regenerate.' });
    }

    const variant = stored.variants.find(v => v.id === variantId);
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Apply the variant's heat order to the schedule
    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found. Generate a base schedule first.' });
    }
    schedule = ScheduleService.migrateSchedule(schedule);

    schedule.heatOrder = variant.heatOrder;
    schedule.updatedAt = new Date().toISOString();

    // Recalculate timing
    const events = await dataService.getEvents(competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
    if (competition?.timingSettings) {
      const { timingService, DEFAULT_TIMING } = await import('../services/timingService');
      const settings = { ...DEFAULT_TIMING, ...competition.timingSettings };
      timingService.calculateEstimatedTimes(schedule.heatOrder, events, settings);
    }

    // Save updated events (judge assignments were written to events by the variant generator)
    for (const event of Object.values(events)) {
      await dataService.updateEvent(event.id, { heats: event.heats });
    }

    const saved = await dataService.saveSchedule(schedule);
    variantStore.delete(competitionId);

    res.json(saved);
    sseService.broadcastScheduleUpdate(competitionId);
  } catch (error) {
    console.error('Apply variant error:', error);
    res.status(500).json({ error: 'Failed to apply schedule variant' });
  }
});

// Get judge schedule for a competition
router.get('/:competitionId/judge-schedule', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);

    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) {
      return res.status(404).json({ error: 'No schedule found' });
    }
    schedule = ScheduleService.migrateSchedule(schedule);

    const [events, judges, competition, siteSettings] = await Promise.all([
      dataService.getEvents(competitionId),
      dataService.getJudges(competitionId),
      dataService.getCompetitionById(competitionId),
      dataService.getSiteSettings(),
    ]);

    const maxHours = competition?.maxJudgeHoursWithoutBreak
      ?? siteSettings.maxJudgeHoursWithoutBreak
      ?? 6;
    const maxMinutesWithoutBreak = maxHours * 60;

    const entries = buildJudgeSchedule(schedule.heatOrder, events, judges, maxMinutesWithoutBreak);
    res.json({ entries, maxMinutesWithoutBreak });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build judge schedule' });
  }
});

// Update judges assigned to a specific heat
router.patch('/:competitionId/heat/:heatId/judges', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const heatId = req.params.heatId;
    const { judgeIds } = req.body;

    if (!Array.isArray(judgeIds)) {
      return res.status(400).json({ error: 'judgeIds array is required' });
    }

    let schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    schedule = ScheduleService.migrateSchedule(schedule);

    const heat = schedule.heatOrder.find(h => h.id === heatId);
    if (!heat) return res.status(404).json({ error: 'Heat not found' });
    if (heat.isBreak) return res.status(400).json({ error: 'Cannot assign judges to a break' });

    const events = await dataService.getEvents(competitionId);

    // Update judges on each entry's event heat
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (eventHeat) {
        eventHeat.judges = judgeIds;
      }
      await dataService.updateEvent(event.id, { heats: event.heats });
    }

    const updatedEvents = await dataService.getEvents(competitionId);
    res.json(updatedEvents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update heat judges' });
  }
});

// ─── Helper: build per-person heat list data ───
async function buildPersonHeatList(competitionId: number, personId: number): Promise<PersonHeatListResponse | null> {
  const people = await dataService.getPeople(competitionId);
  const person = people.find(p => p.id === personId);
  if (!person || person.competitionId !== competitionId) return null;

  const couples = await dataService.getCouples(competitionId);
  const personCouples = couples.filter(c => c.leaderId === personId || c.followerId === personId);
  const bibToPartner = new Map<number, string>();
  for (const c of personCouples) {
    bibToPartner.set(c.bib, c.leaderId === personId ? c.followerName : c.leaderName);
  }
  const personBibs = new Set(personCouples.map(c => c.bib));

  const schedule = await dataService.getSchedule(competitionId);
  const eventsMap = await dataService.getEvents(competitionId);
  const partnershipHeatsMap = new Map<number, PersonHeatEntry[]>();

  if (schedule) {
    let heatNumber = 0;
    for (const scheduledHeat of schedule.heatOrder) {
      heatNumber++;
      if (scheduledHeat.isBreak) continue;

      for (const entry of scheduledHeat.entries) {
        const event = eventsMap[entry.eventId];
        if (!event) continue;

        const heat = event.heats.find(h => h.round === entry.round);
        if (!heat) continue;

        const scratched = new Set(event.scratchedBibs || []);
        const relevantBibs = entry.bibSubset || heat.bibs.filter(b => !scratched.has(b));

        for (const bib of relevantBibs) {
          if (!personBibs.has(bib)) continue;
          let heats = partnershipHeatsMap.get(bib);
          if (!heats) { heats = []; partnershipHeatsMap.set(bib, heats); }
          heats.push({
            heatNumber,
            estimatedTime: scheduledHeat.estimatedStartTime,
            eventName: event.name,
            round: entry.round,
            dance: entry.dance,
            style: event.style,
          });
        }
      }
    }
  }

  const partnerships: PersonPartnerHeats[] = [];
  for (const [bib, heats] of partnershipHeatsMap) {
    partnerships.push({ bib, partnerName: bibToPartner.get(bib) || '', heats });
  }

  return { personId: person.id, firstName: person.firstName, lastName: person.lastName, partnerships };
}

// ─── Helper: build per-person results data ───
async function buildPersonResults(competitionId: number, personId: number): Promise<PersonResultsResponse | null> {
  const people = await dataService.getPeople(competitionId);
  const person = people.find(p => p.id === personId);
  if (!person || person.competitionId !== competitionId) return null;

  const couples = await dataService.getCouples(competitionId);
  const personCouples = couples.filter(c => c.leaderId === personId || c.followerId === personId);
  const personBibs = new Set(personCouples.map(c => c.bib));

  const eventsMap = await dataService.getEvents(competitionId);
  const events: PersonEventResult[] = [];

  for (const event of Object.values(eventsMap)) {
    const eventBibs = new Set(event.heats.flatMap(h => h.bibs));
    const matchingBib = [...personBibs].find(b => eventBibs.has(b));
    if (!matchingBib) continue;

    const couple = personCouples.find(c => c.bib === matchingBib)!;
    const partnerName = couple.leaderId === personId ? couple.followerName : couple.leaderName;

    const rounds: PersonEventResult['rounds'] = [];
    for (const heat of event.heats) {
      if (!heat.bibs.includes(matchingBib)) continue;

      try {
        const results = await scoringService.calculateResults(event.id, heat.round);
        await scoringService.enrichRecallStatus(results, event.id, heat.round);

        const judgeIds = heat.judges || [];
        const judgesMap = await dataService.getJudgesByIds(judgeIds);
        const judges = judgeIds.map(id => {
          const j = judgesMap.get(id);
          return { id, judgeNumber: j?.judgeNumber ?? 0, name: j?.name ?? '' };
        });

        const personResult = results.find(r => r.bib === matchingBib);
        if (!personResult) continue;

        rounds.push({
          round: heat.round,
          detailed: {
            judges,
            eventName: event.name,
            round: heat.round,
            dances: event.dances,
            style: event.style,
            level: event.level,
            results,
          },
          personResult,
        });
      } catch {
        // Skip if scoring fails (no scores submitted)
      }
    }

    if (rounds.length > 0) {
      events.push({
        eventId: event.id,
        eventName: event.name,
        style: event.style,
        level: event.level,
        dances: event.dances,
        bib: matchingBib,
        partnerName,
        rounds,
      });
    }
  }

  return { personId: person.id, firstName: person.firstName, lastName: person.lastName, events };
}

// ─── Heat Sheet PDF Routes ───

// Download heat sheet PDF for a single person
router.get('/:competitionId/heatsheet/pdf/:personId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const personId = parseInt(req.params.personId);

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const data = await buildPersonHeatList(competitionId, personId);
    if (!data) return res.status(404).json({ error: 'Person not found in this competition' });

    const pdfBuffer = await generateHeatSheetPDF(data, competition);
    const safeName = `${data.firstName}-${data.lastName}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="heatsheet-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, 'Heat sheet PDF generation error');
    res.status(500).json({ error: 'Failed to generate heat sheet PDF' });
  }
});

// Download combined heat sheet PDF for all people
router.get('/:competitionId/heatsheet/pdf', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const people = await dataService.getPeople(competitionId);
    const allData: PersonHeatListResponse[] = [];

    for (const person of people) {
      const data = await buildPersonHeatList(competitionId, person.id);
      if (data && data.partnerships.length > 0) allData.push(data);
    }

    if (allData.length === 0) {
      return res.status(404).json({ error: 'No heat sheets to generate' });
    }

    // Sort by last name, then first name
    allData.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const pdfBuffer = await generateCombinedHeatSheetPDF(allData, competition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="heatsheets-all.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, 'Combined heat sheet PDF generation error');
    res.status(500).json({ error: 'Failed to generate combined heat sheet PDF' });
  }
});

// Email heat sheet PDF to a person
router.post('/:competitionId/heatsheet/email/:personId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const personId = parseInt(req.params.personId);

    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.' });
    }

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const person = await dataService.getPersonById(personId);
    if (!person || person.competitionId !== competitionId) {
      return res.status(404).json({ error: 'Person not found in this competition' });
    }
    if (!person.email) {
      return res.status(400).json({ error: 'Person has no email address on file' });
    }

    const data = await buildPersonHeatList(competitionId, personId);
    if (!data) return res.status(404).json({ error: 'No heat sheet data found' });

    const pdfBuffer = await generateHeatSheetPDF(data, competition);
    const personName = `${person.firstName} ${person.lastName}`;
    await sendHeatSheetEmail(person.email, personName, competition.name, pdfBuffer);
    res.json({ success: true, sentTo: person.email });
  } catch (err) {
    logger.error({ err }, 'Heat sheet email error');
    res.status(500).json({ error: 'Failed to send heat sheet email' });
  }
});

// ─── Results PDF Routes ───

// Download results PDF for a single person
router.get('/:competitionId/results/pdf/:personId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const personId = parseInt(req.params.personId);

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const data = await buildPersonResults(competitionId, personId);
    if (!data) return res.status(404).json({ error: 'Person not found in this competition' });

    const pdfBuffer = await generateResultsPDF(data, competition);
    const safeName = `${data.firstName}-${data.lastName}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="results-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, 'Results PDF generation error');
    res.status(500).json({ error: 'Failed to generate results PDF' });
  }
});

// Download combined results PDF for all people
router.get('/:competitionId/results/pdf', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const people = await dataService.getPeople(competitionId);
    const allData: PersonResultsResponse[] = [];

    for (const person of people) {
      const data = await buildPersonResults(competitionId, person.id);
      if (data && data.events.length > 0) allData.push(data);
    }

    if (allData.length === 0) {
      return res.status(404).json({ error: 'No results to generate' });
    }

    allData.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const pdfBuffer = await generateCombinedResultsPDF(allData, competition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="results-all.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, 'Combined results PDF generation error');
    res.status(500).json({ error: 'Failed to generate combined results PDF' });
  }
});

// Email results PDF to a person
router.post('/:competitionId/results/email/:personId', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.competitionId);
    const personId = parseInt(req.params.personId);

    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.' });
    }

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    const person = await dataService.getPersonById(personId);
    if (!person || person.competitionId !== competitionId) {
      return res.status(404).json({ error: 'Person not found in this competition' });
    }
    if (!person.email) {
      return res.status(400).json({ error: 'Person has no email address on file' });
    }

    const data = await buildPersonResults(competitionId, personId);
    if (!data) return res.status(404).json({ error: 'No results data found' });

    const pdfBuffer = await generateResultsPDF(data, competition);
    const personName = `${person.firstName} ${person.lastName}`;
    await sendResultsEmail(person.email, personName, competition.name, pdfBuffer);
    res.json({ success: true, sentTo: person.email });
  } catch (err) {
    logger.error({ err }, 'Results email error');
    res.status(500).json({ error: 'Failed to send results email' });
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
