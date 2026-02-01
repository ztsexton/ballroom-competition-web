import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';

const router = Router();

// Get all studios
router.get('/', async (req: Request, res: Response) => {
  try {
    const studios = await dataService.getStudios();
    res.json(studios);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch studios' });
  }
});

// Get a specific studio
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const studio = await dataService.getStudioById(id);
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }
    res.json(studio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch studio' });
  }
});

// Create a new studio
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, location, contactInfo } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const studio = await dataService.addStudio({
      name,
      location,
      contactInfo,
    });

    res.status(201).json(studio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create studio' });
  }
});

// Update a studio
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const studio = await dataService.updateStudio(id, updates);
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    res.json(studio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update studio' });
  }
});

// Delete a studio
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await dataService.deleteStudio(id);
    if (!success) {
      return res.status(404).json({ error: 'Studio not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete studio' });
  }
});

export default router;
