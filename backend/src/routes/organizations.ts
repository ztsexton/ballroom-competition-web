import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { AgeCategory } from '../types';

const router = Router();

const VALID_PRESETS = ['ndca', 'usadance', 'custom'];

const NDCA_AGE_CATEGORIES: AgeCategory[] = [
  { name: 'Junior 1', maxAge: 11 },
  { name: 'Junior 2', minAge: 12, maxAge: 15 },
  { name: 'Youth', minAge: 16, maxAge: 18 },
  { name: 'Adult', minAge: 19, maxAge: 34 },
  { name: 'Senior 1', minAge: 35, maxAge: 44 },
  { name: 'Senior 2', minAge: 45, maxAge: 54 },
  { name: 'Senior 3', minAge: 55, maxAge: 64 },
  { name: 'Senior 4', minAge: 65 },
];

const USA_DANCE_AGE_CATEGORIES: AgeCategory[] = [
  { name: 'Pre-Teen', maxAge: 11 },
  { name: 'Junior', minAge: 12, maxAge: 15 },
  { name: 'Youth', minAge: 16, maxAge: 18 },
  { name: 'Under 21', minAge: 16, maxAge: 20 },
  { name: 'Adult', minAge: 19 },
  { name: 'Senior 1', minAge: 35 },
  { name: 'Senior 2', minAge: 50 },
  { name: 'Senior 3', minAge: 60 },
  { name: 'Senior 4', minAge: 70 },
];

const PRESET_DEFAULTS: Record<string, { defaultLevels: string[]; defaultScoringType: 'standard' | 'proficiency'; defaultMaxCouplesPerHeat: number; ageCategories: AgeCategory[] }> = {
  ndca: {
    defaultLevels: ['Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Champ', 'Championship'],
    defaultScoringType: 'standard',
    defaultMaxCouplesPerHeat: 7,
    ageCategories: NDCA_AGE_CATEGORIES,
  },
  usadance: {
    defaultLevels: ['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'],
    defaultScoringType: 'standard',
    defaultMaxCouplesPerHeat: 6,
    ageCategories: USA_DANCE_AGE_CATEGORIES,
  },
};

// Get all organizations
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizations = await dataService.getOrganizations();
    res.json(organizations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get a specific organization
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const organization = await dataService.getOrganizationById(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Create a new organization
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, rulePresetKey, settings } = req.body;

    if (!name || !rulePresetKey) {
      return res.status(400).json({ error: 'Name and rulePresetKey are required' });
    }

    if (!VALID_PRESETS.includes(rulePresetKey)) {
      return res.status(400).json({ error: 'Invalid rulePresetKey. Must be one of: ndca, usadance, custom' });
    }

    // Apply preset defaults, allowing user-provided settings to override
    const presetDefaults = PRESET_DEFAULTS[rulePresetKey] || {};
    const finalSettings = { ...presetDefaults, ...settings };

    const organization = await dataService.addOrganization({
      name,
      rulePresetKey,
      settings: finalSettings,
    });

    res.status(201).json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Update an organization
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    if (updates.rulePresetKey && !VALID_PRESETS.includes(updates.rulePresetKey)) {
      return res.status(400).json({ error: 'Invalid rulePresetKey. Must be one of: ndca, usadance, custom' });
    }

    const organization = await dataService.updateOrganization(id, updates);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Delete an organization
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await dataService.deleteOrganization(id);
    if (!success) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

export default router;
