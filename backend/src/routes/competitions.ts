import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { AuthRequest, requireAdmin, requireAnyAdmin, assertCompetitionRole } from '../middleware/auth';
import { DEFAULT_LEVELS_BY_TYPE } from '../constants/levels';
import { CompetitionType } from '../types';
import { getAllowedLevelsForCouple, getMainLevel, groupLevelsByMain } from '../services/validationService';
import { registerCoupleForEvent } from '../services/registrationService';
import logger from '../utils/logger';

const router = Router();

// Get all competitions (site admin sees all, competition admin sees only theirs)
router.get('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitions = await dataService.getCompetitions();

    if (req.user!.isAdmin) {
      res.json(competitions);
      return;
    }

    // Competition admin: filter to only their competitions
    const adminCompIds = await dataService.getCompetitionsByAdmin(req.user!.uid);
    const filtered = competitions.filter(c => adminCompIds.includes(c.id));
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

// Get a specific competition
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin', 'billing', 'entries']))) return;

    const competition = await dataService.getCompetitionById(id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competition' });
  }
});

// Get competition summary with counts
router.get('/:id/summary', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin', 'billing', 'entries']))) return;

    const competition = await dataService.getCompetitionById(id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const [people, couples, judges, events, schedule] = await Promise.all([
      dataService.getPeople(id),
      dataService.getCouples(id),
      dataService.getJudges(id),
      dataService.getEvents(id),
      dataService.getSchedule(id).catch(() => null),
    ]);

    const totalEntries = Object.values(events).reduce(
      (sum, event) => sum + (event.heats[0]?.bibs.length || 0),
      0
    );

    const completedCount = schedule
      ? Object.values(schedule.heatStatuses).filter(s => s === 'completed').length
      : 0;

    res.json({
      competition,
      counts: {
        people: people.length,
        couples: couples.length,
        judges: judges.length,
        events: Object.keys(events).length,
        totalEntries,
      },
      schedule: schedule ? {
        scheduleHeats: schedule.heatOrder.length,
        currentHeatIndex: schedule.currentHeatIndex,
        completedCount,
        scheduleExists: true,
      } : {
        scheduleHeats: 0,
        currentHeatIndex: 0,
        completedCount: 0,
        scheduleExists: false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competition summary' });
  }
});

// Create a new competition (site admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, date, location, studioId, organizationId, description, defaultScoringType, levels, publiclyVisible, resultsPublic, websiteUrl, organizerEmail } = req.body;

    if (!name || !type || !date) {
      return res.status(400).json({ error: 'Name, type, and date are required' });
    }

    // Validate competition type
    const validTypes = ['NDCA', 'USA_DANCE', 'WDC', 'WDSF', 'UNAFFILIATED', 'STUDIO'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid competition type' });
    }

    // For studio competitions, studioId is required
    if (type === 'STUDIO' && !studioId) {
      return res.status(400).json({ error: 'Studio ID is required for studio competitions' });
    }

    const competition = await dataService.addCompetition({
      name,
      type,
      date,
      location,
      studioId,
      organizationId,
      description,
      defaultScoringType,
      levels: levels || DEFAULT_LEVELS_BY_TYPE[type as CompetitionType] || [],
      publiclyVisible: publiclyVisible !== undefined ? publiclyVisible : true,
      resultsPublic: resultsPublic !== undefined ? resultsPublic : (type === 'STUDIO' ? false : true),
      websiteUrl,
      organizerEmail,
      createdBy: req.user!.uid,
    });

    res.status(201).json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create competition' });
  }
});

// Update a competition
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin', 'billing']))) return;

    const updates = req.body;
    const competition = await dataService.updateCompetition(id, updates);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    res.json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update competition' });
  }
});

// Delete a competition (site admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await dataService.deleteCompetition(id);
    if (!success) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete competition' });
  }
});

// Bulk reassign all bibs according to current bibSettings
router.post('/:id/reassign-bibs', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin', 'billing']))) return;

    const competition = await dataService.getCompetitionById(id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    await dataService.bulkReassignBibs(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reassign bibs' });
  }
});

// ─── Competition Admin CRUD ───

// List admins for a competition (enriched with user info)
router.get('/:id/admins', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin']))) return;

    const enriched = await dataService.getEnrichedCompetitionAdmins(id);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competition admins' });
  }
});

// Add admin by email
router.post('/:id/admins', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin']))) return;

    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const validRoles = ['admin', 'billing', 'entries'];
    const adminRole = validRoles.includes(role) ? role : 'admin';

    // Look up user by email
    const users = await dataService.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'No registered user found with that email' });
    }

    const admin = await dataService.addCompetitionAdmin(id, user.uid, adminRole);
    res.status(201).json({
      ...admin,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add competition admin' });
  }
});

// Remove admin
router.delete('/:id/admins/:uid', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, id, ['admin']))) return;

    const { uid } = req.params;
    const success = await dataService.removeCompetitionAdmin(id, uid);
    if (!success) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove competition admin' });
  }
});

// GET /competitions/:id/validation-issues — check all event entries for level validation issues (per-style + cross-style)
router.get('/:id/validation-issues', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin']))) return;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    // If validation is disabled, no issues
    if (!competition.entryValidation?.enabled || !competition.levels?.length) {
      return res.json({ issues: [], count: 0 });
    }

    const eventsMap = await dataService.getEvents(competitionId);
    const events = Object.values(eventsMap);
    const issues: Array<{
      eventId: number;
      eventName: string;
      eventLevel: string;
      eventStyle: string | undefined;
      bib: number;
      leaderName: string;
      followerName: string;
      coupleLevel: string | null;
      allowedLevels: string[];
      reason: string;
      issueType: 'per-style' | 'cross-style';
    }> = [];

    // Track already-flagged (bib, eventId) to avoid duplicates
    const flagged = new Set<string>();

    for (const event of events) {
      if (!event.level) continue;

      for (const bib of event.heats[0]?.bibs || []) {
        const couple = await dataService.getCoupleByBib(bib);
        if (!couple) continue;

        // Per-style check: only compare against entries in the same style
        const { levels: allowedLevels, coupleLevel } = await getAllowedLevelsForCouple(
          competitionId,
          bib,
          event.style,  // per-style
        );

        if (allowedLevels.length > 0 && !allowedLevels.includes(event.level)) {
          const key = `${bib}-${event.id}`;
          if (!flagged.has(key)) {
            flagged.add(key);
            const [leader, follower] = await Promise.all([
              dataService.getPersonById(couple.leaderId),
              dataService.getPersonById(couple.followerId),
            ]);
            const styleLabel = event.style ? ` in ${event.style}` : '';
            issues.push({
              eventId: event.id,
              eventName: event.name,
              eventLevel: event.level,
              eventStyle: event.style,
              bib,
              leaderName: leader ? `${leader.firstName} ${leader.lastName}` : 'Unknown',
              followerName: follower ? `${follower.firstName} ${follower.lastName}` : 'Unknown',
              coupleLevel,
              allowedLevels,
              reason: `Couple's entries${styleLabel} are at ${coupleLevel} level — ${event.level} is outside their allowed range (${allowedLevels.join(', ')})`,
              issueType: 'per-style',
            });
          }
        }

        // Cross-style check
        if (competition.entryValidation.crossStyleValidation) {
          const crossLevelsAbove = competition.entryValidation.crossStyleLevelsAboveAllowed ?? competition.entryValidation.levelsAboveAllowed;
          const { levels: crossAllowed, coupleLevel: crossLevel } = await getAllowedLevelsForCouple(
            competitionId,
            bib,
            undefined,  // all styles
            crossLevelsAbove,
          );

          if (crossAllowed.length > 0 && !crossAllowed.includes(event.level)) {
            const key = `${bib}-${event.id}`;
            if (!flagged.has(key)) {
              flagged.add(key);
              const [leader, follower] = await Promise.all([
                dataService.getPersonById(couple.leaderId),
                dataService.getPersonById(couple.followerId),
              ]);
              issues.push({
                eventId: event.id,
                eventName: event.name,
                eventLevel: event.level,
                eventStyle: event.style,
                bib,
                leaderName: leader ? `${leader.firstName} ${leader.lastName}` : 'Unknown',
                followerName: follower ? `${follower.firstName} ${follower.lastName}` : 'Unknown',
                coupleLevel: crossLevel,
                allowedLevels: crossAllowed,
                reason: `Couple's entries across all styles span from ${crossLevel} — ${event.level} is outside the cross-style allowed range (${crossAllowed.join(', ')})`,
                issueType: 'cross-style',
              });
            }
          }
        }
      }
    }

    res.json({ issues, count: issues.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check validation issues' });
  }
});

// GET /competitions/:id/validation-resolutions — compute detailed conflict groups with suggested resolutions (per-style + cross-style)
router.get('/:id/validation-resolutions', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin']))) return;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) return res.status(404).json({ error: 'Competition not found' });

    if (!competition.entryValidation?.enabled || !competition.levels?.length) {
      return res.json({ conflicts: [], count: 0 });
    }

    const eventsMap = await dataService.getEvents(competitionId);
    const events = Object.values(eventsMap);
    const mode = competition.entryValidation.levelRestrictionMode || 'sublevel';

    interface EntryInfo {
      eventId: number;
      eventName: string;
      level: string;
      levelIndex: number;
      style: string | undefined;
    }

    // Collect all entries per couple
    const coupleEntries = new Map<number, EntryInfo[]>();
    for (const event of events) {
      if (!event.level) continue;
      const levelIdx = competition.levels.indexOf(event.level);
      if (levelIdx === -1) continue;
      for (const bib of event.heats[0]?.bibs || []) {
        if (!coupleEntries.has(bib)) coupleEntries.set(bib, []);
        coupleEntries.get(bib)!.push({
          eventId: event.id,
          eventName: event.name,
          level: event.level,
          levelIndex: levelIdx,
          style: event.style,
        });
      }
    }

    // Helper to compute allowed range for a given base level index with a specific levelsAbove
    function computeAllowedRange(baseLevelIdx: number, levelsAbove: number): { minIdx: number; maxIdx: number; levels: string[] } {
      if (mode === 'mainlevel') {
        const groups = groupLevelsByMain(competition!.levels!);
        const baseMain = getMainLevel(competition!.levels![baseLevelIdx]);
        const baseGroupIdx = groups.findIndex(g => g.mainLevel === baseMain);
        if (baseGroupIdx === -1) return { minIdx: baseLevelIdx, maxIdx: baseLevelIdx, levels: [competition!.levels![baseLevelIdx]] };
        const maxGroupIdx = Math.min(baseGroupIdx + levelsAbove, groups.length - 1);
        const allowed: string[] = [];
        for (let i = baseGroupIdx; i <= maxGroupIdx; i++) {
          allowed.push(...groups[i].subLevels);
        }
        const minIdx = competition!.levels!.indexOf(allowed[0]);
        const maxIdx = competition!.levels!.indexOf(allowed[allowed.length - 1]);
        return { minIdx, maxIdx, levels: allowed };
      }
      const maxIdx = Math.min(baseLevelIdx + levelsAbove, competition!.levels!.length - 1);
      return { minIdx: baseLevelIdx, maxIdx, levels: competition!.levels!.slice(baseLevelIdx, maxIdx + 1) };
    }

    function allFitInRange(levelIndices: number[], levelsAbove: number): boolean {
      if (levelIndices.length === 0) return true;
      const lowest = Math.min(...levelIndices);
      const { levels: allowed } = computeAllowedRange(lowest, levelsAbove);
      return levelIndices.every(idx => allowed.includes(competition!.levels![idx]));
    }

    function computeValidTargets(entryIdx: number, allEntryIndices: number[], levelsAbove: number): string[] {
      const otherIndices = allEntryIndices.filter((_, i) => i !== entryIdx);
      const validTargets: string[] = [];
      for (let candidateIdx = 0; candidateIdx < competition!.levels!.length; candidateIdx++) {
        if (candidateIdx === allEntryIndices[entryIdx]) continue;
        const hypothetical = [...otherIndices, candidateIdx];
        if (allFitInRange(hypothetical, levelsAbove)) {
          validTargets.push(competition!.levels![candidateIdx]);
        }
      }
      return validTargets;
    }

    interface EntryAction {
      eventId: number;
      eventName: string;
      currentLevel: string;
      style: string | undefined;
      validTargetLevels: string[];
      defaultTargetLevel: string;
    }

    interface CoupleConflict {
      bib: number;
      leaderName: string;
      followerName: string;
      style: string | undefined;  // style this conflict is about (undefined for cross-style)
      conflictType: 'per-style' | 'cross-style';
      entries: Array<{ eventId: number; eventName: string; level: string; style: string | undefined; inRange: boolean }>;
      currentRange: string;
      allowedRange: string[];
      entryActions: EntryAction[];
    }

    const conflicts: CoupleConflict[] = [];

    const perStyleLevelsAbove = competition.entryValidation.levelsAboveAllowed ?? 1;
    const crossStyleEnabled = !!competition.entryValidation.crossStyleValidation;
    const crossStyleLevelsAbove = competition.entryValidation.crossStyleLevelsAboveAllowed ?? perStyleLevelsAbove;

    for (const [bib, entries] of coupleEntries) {
      // Group entries by style for per-style checks
      const byStyle = new Map<string, EntryInfo[]>();
      for (const e of entries) {
        const styleKey = e.style || '__none__';
        if (!byStyle.has(styleKey)) byStyle.set(styleKey, []);
        byStyle.get(styleKey)!.push(e);
      }

      let couple: Awaited<ReturnType<typeof dataService.getCoupleByBib>> | null = null;
      let leaderName = 'Unknown';
      let followerName = 'Unknown';

      const loadCouple = async () => {
        if (couple !== null) return;
        couple = await dataService.getCoupleByBib(bib);
        if (couple) {
          const [leader, follower] = await Promise.all([
            dataService.getPersonById(couple.leaderId),
            dataService.getPersonById(couple.followerId),
          ]);
          leaderName = leader ? `${leader.firstName} ${leader.lastName}` : 'Unknown';
          followerName = follower ? `${follower.firstName} ${follower.lastName}` : 'Unknown';
        }
      };

      // Per-style conflicts
      for (const [styleKey, styleEntries] of byStyle) {
        if (styleEntries.length < 2) continue; // need at least 2 entries to have a conflict
        const allIndices = styleEntries.map(e => e.levelIndex);
        if (allFitInRange(allIndices, perStyleLevelsAbove)) continue;

        await loadCouple();
        if (!couple) continue;

        const entryActions: EntryAction[] = [];
        for (let i = 0; i < styleEntries.length; i++) {
          const entry = styleEntries[i];
          const validTargets = computeValidTargets(i, allIndices, perStyleLevelsAbove);
          if (validTargets.length === 0) continue;

          const otherIndices = allIndices.filter((_, j) => j !== i);
          const otherMean = otherIndices.length > 0 ? otherIndices.reduce((a, b) => a + b, 0) / otherIndices.length : 0;
          let defaultTarget = validTargets[0];
          let bestDist = Infinity;
          for (const t of validTargets) {
            const tIdx = competition.levels!.indexOf(t);
            const dist = Math.abs(tIdx - otherMean);
            if (dist < bestDist) { bestDist = dist; defaultTarget = t; }
          }

          entryActions.push({
            eventId: entry.eventId,
            eventName: entry.eventName,
            currentLevel: entry.level,
            style: entry.style,
            validTargetLevels: validTargets,
            defaultTargetLevel: defaultTarget,
          });
        }

        if (entryActions.length === 0) continue;

        const lowestIdx = Math.min(...allIndices);
        const { levels: allowedFromLowest } = computeAllowedRange(lowestIdx, perStyleLevelsAbove);
        const displayStyle = styleKey === '__none__' ? undefined : styleKey;

        conflicts.push({
          bib,
          leaderName,
          followerName,
          style: displayStyle,
          conflictType: 'per-style',
          entries: styleEntries.map(e => ({
            eventId: e.eventId,
            eventName: e.eventName,
            level: e.level,
            style: e.style,
            inRange: allowedFromLowest.includes(e.level),
          })),
          currentRange: `${competition.levels![lowestIdx]} — ${competition.levels![Math.max(...allIndices)]}`,
          allowedRange: allowedFromLowest,
          entryActions,
        });
      }

      // Cross-style conflict: check ALL entries for this couple together
      if (crossStyleEnabled && entries.length >= 2) {
        const allIndices = entries.map(e => e.levelIndex);
        if (!allFitInRange(allIndices, crossStyleLevelsAbove)) {
          await loadCouple();
          if (!couple) continue;

          const entryActions: EntryAction[] = [];
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const validTargets = computeValidTargets(i, allIndices, crossStyleLevelsAbove);
            if (validTargets.length === 0) continue;

            const otherIndices = allIndices.filter((_, j) => j !== i);
            const otherMean = otherIndices.length > 0 ? otherIndices.reduce((a, b) => a + b, 0) / otherIndices.length : 0;
            let defaultTarget = validTargets[0];
            let bestDist = Infinity;
            for (const t of validTargets) {
              const tIdx = competition.levels!.indexOf(t);
              const dist = Math.abs(tIdx - otherMean);
              if (dist < bestDist) { bestDist = dist; defaultTarget = t; }
            }

            entryActions.push({
              eventId: entry.eventId,
              eventName: entry.eventName,
              currentLevel: entry.level,
              style: entry.style,
              validTargetLevels: validTargets,
              defaultTargetLevel: defaultTarget,
            });
          }

          if (entryActions.length > 0) {
            const lowestIdx = Math.min(...allIndices);
            const { levels: allowedFromLowest } = computeAllowedRange(lowestIdx, crossStyleLevelsAbove);

            conflicts.push({
              bib,
              leaderName,
              followerName,
              style: undefined,
              conflictType: 'cross-style',
              entries: entries.map(e => ({
                eventId: e.eventId,
                eventName: e.eventName,
                level: e.level,
                style: e.style,
                inRange: allowedFromLowest.includes(e.level),
              })),
              currentRange: `${competition.levels![lowestIdx]} — ${competition.levels![Math.max(...allIndices)]}`,
              allowedRange: allowedFromLowest,
              entryActions,
            });
          }
        }
      }
    }

    res.json({ conflicts, count: conflicts.length });
  } catch (error) {
    logger.error({ error }, 'Failed to compute validation resolutions');
    res.status(500).json({ error: 'Failed to compute validation resolutions' });
  }
});

// POST /competitions/:id/apply-resolution — apply a resolution (remove or move entries)
router.post('/:id/apply-resolution', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin']))) return;

    const { actions } = req.body as {
      actions: Array<{
        eventId: number;
        action: 'remove' | 'move';
        bib: number;
        targetLevel?: string;
      }>;
    };

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'No actions provided' });
    }

    const results: Array<{ eventId: number; action: string; success: boolean; error?: string }> = [];

    for (const act of actions) {
      const event = await dataService.getEventById(act.eventId);
      if (!event) {
        results.push({ eventId: act.eventId, action: act.action, success: false, error: 'Event not found' });
        continue;
      }

      if (event.competitionId !== competitionId) {
        results.push({ eventId: act.eventId, action: act.action, success: false, error: 'Event does not belong to this competition' });
        continue;
      }

      const hasScores = await dataService.hasAnyScores(act.eventId);
      if (hasScores) {
        results.push({ eventId: act.eventId, action: act.action, success: false, error: 'Cannot modify: event has scores' });
        continue;
      }

      if (act.action === 'remove') {
        const existingBibs = event.heats[0]?.bibs || [];
        if (!existingBibs.includes(act.bib)) {
          results.push({ eventId: act.eventId, action: 'remove', success: false, error: 'Couple not in event' });
          continue;
        }
        const newBibs = existingBibs.filter((b: number) => b !== act.bib);
        const judgeIds = event.heats[0]?.judges || [];
        const st = event.scoringType || 'standard';
        const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
        await dataService.updateEvent(act.eventId, { heats: newHeats });
        results.push({ eventId: act.eventId, action: 'remove', success: true });
      } else if (act.action === 'move') {
        if (!act.targetLevel) {
          results.push({ eventId: act.eventId, action: 'move', success: false, error: 'No target level specified' });
          continue;
        }

        // Remove from current event
        const existingBibs = event.heats[0]?.bibs || [];
        if (!existingBibs.includes(act.bib)) {
          results.push({ eventId: act.eventId, action: 'move', success: false, error: 'Couple not in event' });
          continue;
        }
        const newBibs = existingBibs.filter((b: number) => b !== act.bib);
        const judgeIds = event.heats[0]?.judges || [];
        const st = event.scoringType || 'standard';
        const newHeats = dataService.rebuildHeats(newBibs, judgeIds, st);
        await dataService.updateEvent(act.eventId, { heats: newHeats });

        // Register into target level event (find or create)
        const combination = {
          designation: event.designation,
          syllabusType: event.syllabusType,
          level: act.targetLevel,
          style: event.style,
          dances: event.dances,
          scoringType: event.scoringType,
          ageCategory: event.ageCategory,
        };
        const regResult = await registerCoupleForEvent(competitionId, act.bib, combination);
        if (regResult.error) {
          results.push({ eventId: act.eventId, action: 'move', success: false, error: regResult.error });
        } else {
          results.push({ eventId: act.eventId, action: 'move', success: true });
        }
      }
    }

    const allSuccess = results.every(r => r.success);
    logger.info({ competitionId, actionsCount: actions.length, allSuccess }, 'Applied validation resolution');
    res.json({ results, allSuccess });
  } catch (error) {
    logger.error({ error }, 'Failed to apply resolution');
    res.status(500).json({ error: 'Failed to apply resolution' });
  }
});

// GET /competitions/:id/pending-entries — list pending entries awaiting admin approval
router.get('/:id/pending-entries', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin', 'entries']))) return;

    const pending = await dataService.getPendingEntries(competitionId);

    // Enrich with couple names
    const enriched = await Promise.all(pending.map(async (entry) => {
      const couple = await dataService.getCoupleByBib(entry.bib);
      let leaderName = 'Unknown';
      let followerName = 'Unknown';
      if (couple) {
        const [leader, follower] = await Promise.all([
          dataService.getPersonById(couple.leaderId),
          dataService.getPersonById(couple.followerId),
        ]);
        if (leader) leaderName = `${leader.firstName} ${leader.lastName}`;
        if (follower) followerName = `${follower.firstName} ${follower.lastName}`;
      }
      return { ...entry, leaderName, followerName };
    }));

    res.json({ pendingEntries: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pending entries' });
  }
});

// POST /competitions/:id/pending-entries/:entryId/approve — approve a pending entry
router.post('/:id/pending-entries/:entryId/approve', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const entryId = req.params.entryId;
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin', 'entries']))) return;

    const pending = await dataService.getPendingEntries(competitionId);
    const entry = pending.find(p => p.id === entryId);
    if (!entry) return res.status(404).json({ error: 'Pending entry not found' });

    // Register the entry (skip validation since admin is approving)
    const result = await registerCoupleForEvent(competitionId, entry.bib, entry.combination);
    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    // Remove from pending
    await dataService.removePendingEntry(entryId);

    logger.info({ competitionId, entryId, bib: entry.bib }, 'Approved pending entry');
    res.json({ event: result.event, created: result.created });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve pending entry' });
  }
});

// DELETE /competitions/:id/pending-entries/:entryId — reject a pending entry
router.delete('/:id/pending-entries/:entryId', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const entryId = req.params.entryId;
    if (!(await assertCompetitionRole(req, res, competitionId, ['admin', 'entries']))) return;

    const pending = await dataService.getPendingEntries(competitionId);
    if (!pending.some(p => p.id === entryId)) {
      return res.status(404).json({ error: 'Pending entry not found' });
    }

    await dataService.removePendingEntry(entryId);

    logger.info({ competitionId, entryId }, 'Rejected pending entry');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject pending entry' });
  }
});

export default router;
