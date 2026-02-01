import { Pool } from 'pg';
import { PostgresDataService } from '../../../services/data/PostgresDataService';
import { dataServiceContractTests } from './dataServiceContract';
import fs from 'fs';
import path from 'path';

const describeIfPg = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfPg('PostgresDataService', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schemaPath = path.join(__dirname, '../../../services/data/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
  });

  afterAll(async () => {
    await pool.end();
  });

  dataServiceContractTests(
    () => new PostgresDataService(pool),
    async () => { /* pool.end() handled by afterAll */ }
  );
});
