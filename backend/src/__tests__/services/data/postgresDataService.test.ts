import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresDataService } from '../../../services/data/PostgresDataService';
import { dataServiceContractTests } from './dataServiceContract';
import fs from 'fs';
import path from 'path';

// Skip if Docker is not available (CI environments without Docker)
const describeIfDocker = process.env.SKIP_DOCKER_TESTS ? describe.skip : describe;

describeIfDocker('PostgresDataService', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    // Start PostgreSQL container - this may take a few seconds on first run
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    // Create connection pool using container's connection string
    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    // Run schema migrations
    const schemaPath = path.join(__dirname, '../../../services/data/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    // Clean up: close pool and stop container
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  dataServiceContractTests(
    () => new PostgresDataService(pool),
    async () => { /* pool.end() handled by afterAll */ }
  );
});
