import express from 'express';
import { dataService } from '../services/dataService';
import { requireAdmin, AuthRequest } from '../middleware/auth';

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

export default router;
