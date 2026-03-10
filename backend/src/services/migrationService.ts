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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'zsexton2011@gmail.com';

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

    // Ensure the default admin user exists and is always marked as admin.
    // This runs every startup so the admin can never be locked out.
    await ensureAdminUser(pool);

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
 * Ensure the default admin user exists in the database with is_admin = true.
 * If the user already exists, force is_admin to true in case it was accidentally revoked.
 * If the user doesn't exist yet, insert a placeholder row so they're admin on first login.
 */
async function ensureAdminUser(pool: Pool): Promise<void> {
  try {
    const { rows } = await pool.query('SELECT uid FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (rows.length > 0) {
      // User exists — make sure they're admin
      await pool.query('UPDATE users SET is_admin = TRUE WHERE email = $1', [ADMIN_EMAIL]);
      logger.info({ email: ADMIN_EMAIL }, 'Admin user verified');
    } else {
      // User doesn't exist yet — create a placeholder so they're admin on first login
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO users (uid, email, display_name, is_admin, sign_in_methods, created_at, last_login_at)
         VALUES ($1, $2, $3, TRUE, '[]'::jsonb, $4, $4)
         ON CONFLICT (uid) DO NOTHING`,
        [`pending-${ADMIN_EMAIL}`, ADMIN_EMAIL, 'Admin', now]
      );
      logger.info({ email: ADMIN_EMAIL }, 'Admin user placeholder created');
    }
  } catch (err) {
    // Non-fatal — log and continue so migrations still succeed
    logger.warn({ err, email: ADMIN_EMAIL }, 'Could not ensure admin user (table may not exist yet)');
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
