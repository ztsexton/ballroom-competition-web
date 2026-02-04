import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all competitions
router.get('/', async (req: Request, res: Response) => {
  try {
    const competitions = await dataService.getCompetitions();
    res.json(competitions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

// Get a specific competition
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const competition = await dataService.getCompetitionById(id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competition' });
  }
});

// Create a new competition
router.post('/', async (req: Request, res: Response) => {
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
      levels,
      publiclyVisible: publiclyVisible !== undefined ? publiclyVisible : true,
      resultsPublic: resultsPublic !== undefined ? resultsPublic : (type === 'STUDIO' ? false : true),
      websiteUrl,
      organizerEmail,
    });

    res.status(201).json(competition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create competition' });
  }
});

// Update a competition
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
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

// Delete a competition
router.delete('/:id', async (req: Request, res: Response) => {
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

export default router;
