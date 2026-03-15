import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresDataService } from '../../../services/data/PostgresDataService';
import fs from 'fs';
import path from 'path';

/**
 * Migration tests: set up data in the OLD format (JSONB), run the full schema
 * (which includes migration blocks), and verify the data is accessible through
 * the new normalized tables.
 *
 * This simulates the real upgrade path: an existing database with data in the
 * old format runs the schema migrations and everything continues to work.
 */

const describeIfDocker = process.env.SKIP_DOCKER_TESTS ? describe.skip : describe;

describeIfDocker('Database Migration — JSONB to normalized tables', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('migration_test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    pool = new Pool({ connectionString: container.getConnectionUri() });
  }, 60000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  /**
   * Returns a "pre-migration" schema: the original competitions table WITH
   * entry_payments JSONB, plus the events table, but WITHOUT the new
   * event_entries / entry_payments / pending_entries tables.
   *
   * We read schema.sql and extract only the initial CREATE TABLE statements
   * (before the Phase 1/2/3 migration blocks).
   */
  function getPreMigrationSchema(): string {
    const schemaPath = path.join(__dirname, '../../../services/data/schema.sql');
    const full = fs.readFileSync(schemaPath, 'utf-8');
    // Find where Phase 1 starts and take everything before it
    const phase1Marker = '-- ─── Phase 1: event_entries junction table';
    const idx = full.indexOf(phase1Marker);
    if (idx === -1) throw new Error('Could not find Phase 1 marker in schema.sql');
    return full.substring(0, idx);
  }

  function getFullSchema(): string {
    const schemaPath = path.join(__dirname, '../../../services/data/schema.sql');
    return fs.readFileSync(schemaPath, 'utf-8');
  }

  describe('Phase 1: event_entries migration', () => {
    it('should migrate bibs from heats JSONB into event_entries table', async () => {
      // 1. Set up pre-migration schema
      await pool.query(getPreMigrationSchema());

      // 2. Insert data in old format: competition, events with bibs in heats JSONB
      await pool.query(`
        INSERT INTO competitions (id, name, type, date, created_at)
        VALUES (1, 'Migration Test', 'STUDIO', '2026-01-01', '2026-01-01T00:00:00Z')
        ON CONFLICT (id) DO NOTHING
      `);

      // Event with bibs [10, 20, 30] in heats[0].bibs
      await pool.query(`
        INSERT INTO events (id, name, competition_id, heats, scratched_bibs)
        VALUES (
          1, 'Waltz', 1,
          '[{"round": "final", "bibs": [10, 20, 30], "judges": [], "scores": {}}]'::jsonb,
          '[20]'::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `);

      // Event with bibs [10, 40] — bib 10 is in both events
      await pool.query(`
        INSERT INTO events (id, name, competition_id, heats)
        VALUES (
          2, 'Tango', 1,
          '[{"round": "final", "bibs": [10, 40], "judges": [], "scores": {}}]'::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `);

      // 3. Run full schema (includes migration blocks)
      await pool.query(getFullSchema());

      // 4. Verify event_entries were populated
      const ds = new PostgresDataService(pool);

      const e1Entries = await ds.getEventEntries(1);
      expect(e1Entries).toHaveLength(3);
      const e1Bibs = e1Entries.map(e => e.bib).sort();
      expect(e1Bibs).toEqual([10, 20, 30]);

      // Bib 20 was in scratched_bibs — should be marked scratched
      const scratched = e1Entries.find(e => e.bib === 20);
      expect(scratched?.scratched).toBe(true);

      // Non-scratched bibs should not be scratched
      const notScratched = e1Entries.find(e => e.bib === 10);
      expect(notScratched?.scratched).toBe(false);

      // Bib 10 should appear in both events
      const bib10Entries = await ds.getEntriesForBib(1, 10);
      expect(bib10Entries).toHaveLength(2);
      const bib10EventIds = bib10Entries.map(e => e.eventId).sort();
      expect(bib10EventIds).toEqual([1, 2]);

      // Event 2 entries
      const e2Entries = await ds.getEventEntries(2);
      expect(e2Entries).toHaveLength(2);
    });
  });

  describe('Phase 2: entry_payments migration', () => {
    it('should migrate entry_payments from JSONB column to new table', async () => {
      // The previous test already ran migrations. Clean and re-setup.
      // Drop all tables and start fresh
      await pool.query(`
        DROP TABLE IF EXISTS pending_entries CASCADE;
        DROP TABLE IF EXISTS entry_payments CASCADE;
        DROP TABLE IF EXISTS event_entries CASCADE;
        DROP TABLE IF EXISTS competition_admins CASCADE;
        DROP TABLE IF EXISTS judge_scores CASCADE;
        DROP TABLE IF EXISTS scores CASCADE;
        DROP TABLE IF EXISTS schedules CASCADE;
        DROP TABLE IF EXISTS events CASCADE;
        DROP TABLE IF EXISTS judges CASCADE;
        DROP TABLE IF EXISTS couples CASCADE;
        DROP TABLE IF EXISTS people CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS competitions CASCADE;
        DROP TABLE IF EXISTS studios CASCADE;
        DROP TABLE IF EXISTS organizations CASCADE;
        DROP TABLE IF EXISTS site_settings CASCADE;
        DROP TABLE IF EXISTS judge_profiles CASCADE;
      `);

      // 1. Set up pre-migration schema (has entry_payments JSONB column)
      await pool.query(getPreMigrationSchema());

      // 2. Insert competition with entry_payments JSONB data
      await pool.query(`
        INSERT INTO competitions (id, name, type, date, created_at, entry_payments)
        VALUES (
          1, 'Payment Test', 'STUDIO', '2026-01-01', '2026-01-01T00:00:00Z',
          '{"1:10": {"paid": true, "paidBy": 5, "paidAt": "2026-01-01T10:00:00Z", "notes": "Cash"}, "2:20": {"paid": false}}'::jsonb
        )
      `);

      // Also need an event for context
      await pool.query(`
        INSERT INTO events (id, name, competition_id, heats)
        VALUES (
          1, 'Waltz', 1,
          '[{"round": "final", "bibs": [10], "judges": [], "scores": {}}]'::jsonb
        ),
        (
          2, 'Tango', 1,
          '[{"round": "final", "bibs": [20], "judges": [], "scores": {}}]'::jsonb
        )
      `);

      // 3. Run full schema (migration moves JSONB to table, drops column)
      await pool.query(getFullSchema());

      // 4. Verify entry_payments table has the data
      const ds = new PostgresDataService(pool);
      const payments = await ds.getEntryPayments(1);

      expect(payments['1:10']).toBeDefined();
      expect(payments['1:10'].paid).toBe(true);
      expect(payments['1:10'].paidBy).toBe(5);
      expect(payments['1:10'].notes).toBe('Cash');

      expect(payments['2:20']).toBeDefined();
      expect(payments['2:20'].paid).toBe(false);

      // 5. Verify the JSONB column was dropped from competitions
      const { rows } = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'competitions' AND column_name = 'entry_payments'
      `);
      expect(rows).toHaveLength(0);
    });
  });

  describe('Phase 3: pending_entries table', () => {
    it('should support pending entries after migration', async () => {
      // Using the db from previous test (already migrated)
      const ds = new PostgresDataService(pool);

      // Should start empty
      const empty = await ds.getPendingEntries(1);
      expect(empty).toEqual([]);

      // Add a pending entry
      const pe = await ds.addPendingEntry({
        id: 'migration-pe-1',
        bib: 10,
        competitionId: 1,
        combination: { level: 'Gold', style: 'Smooth', designation: 'Pro-Am' },
        reason: 'Level too high for couple',
        requestedAt: new Date().toISOString(),
      });
      expect(pe.id).toBe('migration-pe-1');

      // Retrieve and verify
      const all = await ds.getPendingEntries(1);
      expect(all).toHaveLength(1);
      expect(all[0].bib).toBe(10);
      expect(all[0].combination.level).toBe('Gold');

      // Remove
      const removed = await ds.removePendingEntry('migration-pe-1');
      expect(removed).toBe(true);
      expect(await ds.getPendingEntries(1)).toEqual([]);
    });
  });

  describe('Post-migration: dual-write operations work correctly', () => {
    it('should dual-write new entries to both heats JSONB and event_entries table', async () => {
      const ds = new PostgresDataService(pool);

      // Create a fresh event with a couple
      const leader = await ds.addPerson({
        firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId: 1,
      });
      const follower = await ds.addPerson({
        firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId: 1,
      });
      const couple = await ds.addCouple(leader.id, follower.id, 1);
      const bib = couple!.bib;

      const event = await ds.addEvent('New Event', [bib], [], 1);

      // Verify event_entries has the entry
      const entries = await ds.getEventEntries(event.id);
      expect(entries).toHaveLength(1);
      expect(entries[0].bib).toBe(bib);

      // Verify heats JSONB also has it
      const fetched = await ds.getEventById(event.id);
      expect(fetched?.heats[0].bibs).toContain(bib);

      // Add another entry via addEventEntry
      const leader2 = await ds.addPerson({
        firstName: 'L2', lastName: 'C', role: 'leader', status: 'student', competitionId: 1,
      });
      const follower2 = await ds.addPerson({
        firstName: 'F2', lastName: 'D', role: 'follower', status: 'student', competitionId: 1,
      });
      const couple2 = await ds.addCouple(leader2.id, follower2.id, 1);
      await ds.addEventEntry(event.id, couple2!.bib, 1);

      const entriesAfter = await ds.getEventEntries(event.id);
      expect(entriesAfter).toHaveLength(2);
    });

    it('should update entry_payments via new table after migration', async () => {
      const ds = new PostgresDataService(pool);

      // Mark a payment
      const result = await ds.updateEntryPayments(
        1,
        [{ eventId: 100, bib: 50 }],
        { paid: true, paidBy: 7, notes: 'Card' }
      );

      expect(result).not.toBeNull();
      expect(result!['100:50'].paid).toBe(true);
      expect(result!['100:50'].paidBy).toBe(7);

      // Read it back
      const payments = await ds.getEntryPayments(1);
      expect(payments['100:50'].paid).toBe(true);
      expect(payments['100:50'].notes).toBe('Card');

      // Mark unpaid
      await ds.updateEntryPayments(
        1,
        [{ eventId: 100, bib: 50 }],
        { paid: false }
      );
      const updated = await ds.getEntryPayments(1);
      expect(updated['100:50'].paid).toBe(false);
      expect(updated['100:50'].paidAt).toBeUndefined();
    });
  });
});
