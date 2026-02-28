import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { runMigrations, checkDatabaseHealth } from '../services/migrationService';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { scheduleService } from '../services/schedule';
import { seedFinishedCompetition } from '../services/seedFinishedCompetition';
import logger from '../utils/logger';

const router = Router();

// Lazy-load pool only when postgres is configured
function getPool(): Pool | null {
  if (process.env.DATA_STORE !== 'postgres') {
    return null;
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

// GET /api/database/health — check database connection
router.get('/health', async (_req: Request, res: Response) => {
  const pool = getPool();

  if (!pool) {
    return res.json({ connected: true });
  }

  try {
    const health = await checkDatabaseHealth(pool);
    res.json(health);
  } finally {
    await pool.end();
  }
});

// POST /api/database/migrate — run schema migrations
router.post('/migrate', async (_req: Request, res: Response) => {
  const pool = getPool();

  if (!pool) {
    return res.json({ success: true, message: 'No migration needed' });
  }

  try {
    logger.info('Running database migration via API');
    const result = await runMigrations(pool);
    res.status(result.success ? 200 : 500).json(result);
  } finally {
    await pool.end();
  }
});

// POST /api/database/seed — seed test competition data (admin only)
router.post('/seed', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const pool = getPool();

  if (!pool) {
    return res.status(400).json({ success: false, message: 'Postgres not configured' });
  }

  try {
    // Read the seed.sql file
    // Production (dist/routes): ../../sample/seed.sql -> /app/sample/seed.sql
    // Local dev (src/routes):    ../../../sample/seed.sql -> project-root/sample/seed.sql
    const possiblePaths = [
      path.join(__dirname, '../../sample/seed.sql'),
      path.join(__dirname, '../../../sample/seed.sql'),
    ];
    const seedPath = possiblePaths.find(p => fs.existsSync(p));

    if (!seedPath) {
      return res.status(404).json({ success: false, message: 'Seed file not found' });
    }

    const seedSql = fs.readFileSync(seedPath, 'utf-8');

    logger.info({ user: req.user?.email }, 'Seeding test competition data');

    await pool.query(seedSql);

    // Raw SQL bypasses the data service — clear cached data so new records are visible
    dataService.clearCache();

    // Verify the competition was actually inserted
    const { rows } = await pool.query('SELECT id, name FROM competitions WHERE id = 1');
    if (rows.length === 0) {
      logger.error('Seed SQL ran but competition id=1 was not found in database');
      return res.status(500).json({ success: false, message: 'Seed completed but competition was not created. The INSERT may have been skipped.' });
    }

    logger.info({ competitionName: rows[0].name }, 'Test competition data seeded successfully');
    res.json({ success: true, message: `Test competition "${rows[0].name}" created successfully` });
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed test data');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to seed test data'
    });
  } finally {
    await pool.end();
  }
});

// POST /api/database/seed-finished — seed a fully scored/completed competition (admin only)
router.post('/seed-finished', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    logger.info({ user: req.user?.email }, 'Seeding finished competition data');

    const result = await seedFinishedCompetition(dataService, scoringService, scheduleService);

    logger.info({ competitionId: result.competitionId }, 'Finished competition seeded successfully');
    res.json({
      success: true,
      message: `Finished competition "${result.competitionName}" created successfully with all events scored and results calculated`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed finished competition');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to seed finished competition',
    });
  }
});

export default router;
