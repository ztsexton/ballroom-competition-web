import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { runMigrations, checkDatabaseHealth } from '../services/migrationService';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
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
    // In production: __dirname is /app/dist/routes, seed.sql is at /app/sample/seed.sql
    const seedPath = path.join(__dirname, '../../sample/seed.sql');

    if (!fs.existsSync(seedPath)) {
      return res.status(404).json({ success: false, message: 'Seed file not found' });
    }

    const seedSql = fs.readFileSync(seedPath, 'utf-8');

    logger.info({ user: req.user?.email }, 'Seeding test competition data');

    await pool.query(seedSql);

    logger.info('Test competition data seeded successfully');
    res.json({ success: true, message: 'Test competition "Galaxy Ballroom Classic 2026" created successfully' });
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

export default router;
