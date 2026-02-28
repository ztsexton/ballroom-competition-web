import express from 'express';
import { dataService } from '../services/dataService';
import { requireAdmin, AuthRequest, clearUserCache } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();

// Get all users (admin only)
router.get('/', requireAdmin, async (_req, res) => {
  const users = await dataService.getUsers();
  res.json(users);
});

// Update user admin status (admin only)
router.patch('/:uid/admin', requireAdmin, async (req: AuthRequest, res) => {
  const { uid } = req.params;
  const { isAdmin } = req.body;

  if (typeof isAdmin !== 'boolean') {
    res.status(400).json({ error: 'isAdmin must be a boolean' });
    return;
  }

  const user = await dataService.updateUserAdmin(uid, isAdmin);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Invalidate auth middleware cache so the change takes effect immediately
  clearUserCache(uid);

  res.json(user);
});

// Get current user info
router.get('/me', async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await dataService.getUserByUid(req.user.uid);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// Update current user's profile
router.patch('/me', async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { firstName, lastName, phone, city, stateRegion, country, studioTeamName } = req.body;

  const updates: Record<string, any> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;
  if (city !== undefined) updates.city = city;
  if (stateRegion !== undefined) updates.stateRegion = stateRegion;
  if (country !== undefined) updates.country = country;
  if (studioTeamName !== undefined) updates.studioTeamName = studioTeamName;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No profile fields to update' });
    return;
  }

  const user = await dataService.updateUserProfile(req.user.uid, updates);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// Get current user's competition admin status
router.get('/me/admin-competitions', async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const competitionIds = await dataService.getCompetitionsByAdmin(req.user.uid);
    res.json({
      competitionIds,
      isCompetitionAdmin: competitionIds.length > 0,
    });
  } catch (err) {
    // Table may not exist if migration hasn't run yet
    logger.error(err, 'Failed to fetch admin-competitions');
    res.json({
      competitionIds: [],
      isCompetitionAdmin: false,
    });
  }
});

export default router;
