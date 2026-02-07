import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { runMigrations, checkDatabaseHealth } from '../services/migrationService';
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

export default router;
