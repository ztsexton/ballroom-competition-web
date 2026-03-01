import { Router, Response } from 'express';
import { dataService } from '../services/dataService';
import { AuthRequest, requireAdmin, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';
import { DEFAULT_LEVELS_BY_TYPE } from '../constants/levels';
import { CompetitionType } from '../types';

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
    if (!(await assertCompetitionAccess(req, res, id))) return;

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
    if (!(await assertCompetitionAccess(req, res, id))) return;

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
    if (!(await assertCompetitionAccess(req, res, id))) return;

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

// ─── Competition Admin CRUD ───

// List admins for a competition (enriched with user info)
router.get('/:id/admins', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await assertCompetitionAccess(req, res, id))) return;

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
    if (!(await assertCompetitionAccess(req, res, id))) return;

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Look up user by email
    const users = await dataService.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'No registered user found with that email' });
    }

    const admin = await dataService.addCompetitionAdmin(id, user.uid);
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
    if (!(await assertCompetitionAccess(req, res, id))) return;

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

export default router;
