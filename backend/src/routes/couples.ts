import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { getCoupleEligibleCategories, calculateAge } from '../services/validationService';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';

const router = Router();

// Get all couples (optionally filtered by competition)
router.get('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;
  if (competitionId) {
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;
  } else if (!req.user!.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: competitionId required for non-site-admins' });
  }
  const couples = await dataService.getCouples(competitionId);
  res.json(couples);
});

// Get couple by id
router.get('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const couple = await dataService.getCoupleById(id);

  if (!couple) {
    return res.status(404).json({ error: 'Couple not found' });
  }

  if (!(await assertCompetitionAccess(req, res, couple.competitionId))) return;
  res.json(couple);
});

// Add a new couple
router.post('/', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const { leaderId, followerId, competitionId } = req.body;

  if (!leaderId || !followerId || !competitionId) {
    return res.status(400).json({ error: 'Leader ID, follower ID, and competition ID are required' });
  }

  if (!(await assertCompetitionAccess(req, res, parseInt(competitionId)))) return;

  const newCouple = await dataService.addCouple(
    parseInt(leaderId),
    parseInt(followerId),
    parseInt(competitionId)
  );

  if (!newCouple) {
    return res.status(400).json({ error: 'Invalid leader or follower ID, or people not in same competition' });
  }

  res.status(201).json(newCouple);
});

// Get eligible age categories for a couple
router.get('/:id/eligible-categories', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const competitionId = req.query.competitionId ? parseInt(req.query.competitionId as string) : undefined;

    if (!competitionId) {
      return res.status(400).json({ error: 'competitionId query parameter is required' });
    }

    if (!(await assertCompetitionAccess(req, res, competitionId))) return;

    const couple = await dataService.getCoupleById(id);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    const categories = await getCoupleEligibleCategories(couple.leaderId, couple.followerId, competitionId);

    const [leader, follower] = await Promise.all([
      dataService.getPersonById(couple.leaderId),
      dataService.getPersonById(couple.followerId),
    ]);

    const competition = await dataService.getCompetitionById(competitionId);
    const leaderAge = leader?.dateOfBirth && competition ? calculateAge(leader.dateOfBirth, competition.date) : undefined;
    const followerAge = follower?.dateOfBirth && competition ? calculateAge(follower.dateOfBirth, competition.date) : undefined;

    res.json({ categories, leaderAge, followerAge });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get eligible categories' });
  }
});

// Get all events a couple is entered in
router.get('/:id/events', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const couple = await dataService.getCoupleById(id);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    if (!(await assertCompetitionAccess(req, res, couple.competitionId))) return;

    const entries = await dataService.getEntriesForBib(couple.competitionId, couple.bib);
    const eventIds = entries.map(e => e.eventId);
    if (eventIds.length === 0) {
      return res.json([]);
    }
    const eventsMap = await dataService.getEventsByIds(eventIds);
    const coupleEvents = eventIds.map(id => eventsMap.get(id)).filter(Boolean);
    res.json(coupleEvents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get couple events' });
  }
});

// Update couple
router.patch('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const couple = await dataService.getCoupleById(id);
  if (!couple) {
    return res.status(404).json({ error: 'Couple not found' });
  }
  if (!(await assertCompetitionAccess(req, res, couple.competitionId))) return;

  const { billTo } = req.body;
  if (billTo !== undefined && !['split', 'leader', 'follower', null].includes(billTo)) {
    return res.status(400).json({ error: 'Invalid billTo value. Must be split, leader, or follower.' });
  }

  const updated = await dataService.updateCoupleById(id, { billTo: billTo || undefined });
  res.json(updated);
});

// Delete couple
router.delete('/:id', requireAnyAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  const couple = await dataService.getCoupleById(id);
  if (!couple) {
    return res.status(404).json({ error: 'Couple not found' });
  }

  if (!(await assertCompetitionAccess(req, res, couple.competitionId))) return;

  // Check if couple is in any event within its competition
  const events = await dataService.getEvents(couple.competitionId);
  const inEvent = Object.values(events).some(event =>
    event.heats.some(heat => heat.bibs.includes(couple.bib))
  );

  if (inEvent) {
    return res.status(400).json({ error: 'Cannot delete couple that is in an event' });
  }

  const deleted = await dataService.deleteCoupleById(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Couple not found' });
  }

  res.status(204).send();
});

export default router;
