import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import multer from 'multer';
import { runMigrations, checkDatabaseHealth } from '../services/migrationService';
import { authenticate, requireAdmin, AuthRequest, isStagingBypass, setStagingBypass } from '../middleware/auth';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { scheduleService } from '../services/schedule';
import { seedFinishedCompetition } from '../services/seedFinishedCompetition';
import { seedValidationCompetition } from '../services/seedValidationCompetition';
import { exportAllData, importAllData } from '../services/backupService';
import logger from '../utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const upload = multer({ limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB max

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

// POST /api/database/seed-validation — seed a competition with entry validation scenarios (admin only)
router.post('/seed-validation', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    logger.info({ user: req.user?.email }, 'Seeding validation competition data');

    const result = await seedValidationCompetition(dataService);

    logger.info({ competitionId: result.competitionId }, 'Validation competition seeded successfully');
    res.json({
      success: true,
      message: `Validation competition "${result.competitionName}" created with level validation enabled, deliberate violations to fix, and couples at every level range`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed validation competition');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to seed validation competition',
    });
  }
});

// GET /api/database/backup — export all data as gzipped JSON (admin only)
router.get('/backup', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    logger.info({ user: req.user?.email }, 'Starting full data backup');
    const data = await exportAllData();
    const json = JSON.stringify(data);
    const compressed = await gzip(Buffer.from(json, 'utf-8'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    logger.info(
      { user: req.user?.email, uncompressedKB: Math.round(json.length / 1024), compressedKB: Math.round(compressed.length / 1024) },
      'Backup created'
    );

    res.setHeader('Content-Disposition', `attachment; filename="backup-${timestamp}.json.gz"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', compressed.length);
    res.send(compressed);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create backup');
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /api/database/restore — restore from a gzipped JSON backup (admin only)
router.post('/restore', authenticate, requireAdmin, upload.single('backup'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided. Upload as multipart field "backup".' });
    }

    logger.info({ user: req.user?.email, fileSize: req.file.size, filename: req.file.originalname }, 'Starting data restore');

    let json: string;
    try {
      // Try to decompress (gzipped file)
      const decompressed = await gunzip(req.file.buffer);
      json = decompressed.toString('utf-8');
    } catch {
      // Not gzipped — try as plain JSON
      json = req.file.buffer.toString('utf-8');
    }

    const backup = JSON.parse(json);

    if (!backup.version || !backup.competitions) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const result = await importAllData(backup);

    logger.info({ user: req.user?.email, ...result }, 'Data restore complete');
    res.json({
      success: true,
      message: `Restored ${result.competitionsRestored} competition(s) and ${result.usersRestored} user(s) from backup created ${backup.createdAt}`,
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to restore from backup');
    res.status(500).json({
      error: 'Failed to restore from backup',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/database/staging-bypass — check if staging auth bypass is active
router.get('/staging-bypass', (_req: Request, res: Response) => {
  res.json({ enabled: isStagingBypass() });
});

// POST /api/database/staging-bypass — toggle staging auth bypass (no auth required so it can bootstrap itself)
router.post('/staging-bypass', (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  setStagingBypass(enabled);
  logger.info({ enabled }, 'Staging auth bypass toggled');
  res.json({ enabled: isStagingBypass() });
});

export default router;
