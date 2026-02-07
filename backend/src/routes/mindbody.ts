import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import * as mindbodyService from '../services/mindbodyService';
import logger from '../utils/logger';

const router = Router();

// POST /api/mindbody/studios/:studioId/connect — authenticate & link MindBody
router.post('/studios/:studioId/connect', async (req: Request, res: Response) => {
  if (!mindbodyService.isConfigured()) {
    return res.status(503).json({ error: 'MindBody not configured. Set MINDBODY_API_KEY environment variable.' });
  }

  const studioId = parseInt(req.params.studioId);
  const { siteId, username, password } = req.body;

  const studio = await dataService.getStudioById(studioId);
  if (!studio) {
    return res.status(404).json({ error: 'Studio not found' });
  }

  if (!siteId || !username || !password) {
    return res.status(400).json({ error: 'siteId, username, and password are required' });
  }

  try {
    const token = await mindbodyService.authenticateStaff(siteId, username, password);
    await dataService.updateStudio(studioId, { mindbodySiteId: siteId, mindbodyToken: token });
    res.json({ connected: true, siteId });
  } catch (err: any) {
    logger.error({ err }, 'MindBody connect error');
    res.status(502).json({ error: err.message || 'Failed to authenticate with MindBody' });
  }
});

// DELETE /api/mindbody/studios/:studioId/disconnect — remove MindBody connection
router.delete('/studios/:studioId/disconnect', async (req: Request, res: Response) => {
  const studioId = parseInt(req.params.studioId);
  const studio = await dataService.getStudioById(studioId);
  if (!studio) {
    return res.status(404).json({ error: 'Studio not found' });
  }

  await dataService.updateStudio(studioId, { mindbodySiteId: undefined, mindbodyToken: undefined });
  res.json({ disconnected: true });
});

// GET /api/mindbody/studios/:studioId/clients — preview MindBody clients
router.get('/studios/:studioId/clients', async (req: Request, res: Response) => {
  if (!mindbodyService.isConfigured()) {
    return res.status(503).json({ error: 'MindBody not configured. Set MINDBODY_API_KEY environment variable.' });
  }

  const studioId = parseInt(req.params.studioId);
  const studio = await dataService.getStudioById(studioId);
  if (!studio) {
    return res.status(404).json({ error: 'Studio not found' });
  }

  if (!studio.mindbodySiteId || !studio.mindbodyToken) {
    return res.status(400).json({ error: 'Studio is not connected to MindBody' });
  }

  const searchText = req.query.searchText as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

  try {
    const result = await mindbodyService.getClients(
      studio.mindbodySiteId,
      studio.mindbodyToken,
      { searchText, limit, offset }
    );
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, 'MindBody getClients error');
    res.status(502).json({ error: err.message || 'Failed to fetch clients from MindBody' });
  }
});

// POST /api/mindbody/studios/:studioId/import — import selected clients as people
router.post('/studios/:studioId/import', async (req: Request, res: Response) => {
  const studioId = parseInt(req.params.studioId);
  const { competitionId, clients } = req.body;

  const studio = await dataService.getStudioById(studioId);
  if (!studio) {
    return res.status(404).json({ error: 'Studio not found' });
  }

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'clients array is required' });
  }

  const imported = [];
  for (const client of clients) {
    const person = await dataService.addPerson({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email || undefined,
      role: client.role || 'both',
      status: client.status || 'student',
      competitionId,
      studioId,
    });
    imported.push(person);
  }

  res.json({ imported: imported.length, people: imported });
});

export default router;
