import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import logger from '../utils/logger';

const SCHEMA_PATH = path.join(__dirname, './data/schema.sql');

export interface MigrationResult {
  success: boolean;
  message: string;
}

/**
 * Run database migrations (schema.sql).
 * Safe to run multiple times - uses IF NOT EXISTS and IF NOT EXISTS for columns.
 */
export async function runMigrations(pool: Pool): Promise<MigrationResult> {
  try {
    // Check if schema file exists
    if (!fs.existsSync(SCHEMA_PATH)) {
      logger.error({ path: SCHEMA_PATH }, 'Schema file not found');
      return {
        success: false,
        message: 'Migration failed',
      };
    }

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

    // Test connection first
    try {
      await pool.query('SELECT 1');
    } catch (connErr) {
      logger.error({ err: connErr }, 'Database connection failed');
      return {
        success: false,
        message: 'Migration failed',
      };
    }

    // Run the schema
    await pool.query(schema);

    logger.info('Database migration completed');

    return {
      success: true,
      message: 'Migration completed successfully',
    };
  } catch (err) {
    logger.error({ err }, 'Database migration failed');
    return {
      success: false,
      message: 'Migration failed',
    };
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(pool: Pool): Promise<{
  connected: boolean;
}> {
  try {
    await pool.query('SELECT 1');
    return { connected: true };
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return { connected: false };
  }
}
