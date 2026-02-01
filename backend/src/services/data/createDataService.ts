import { IDataService } from './IDataService';
import { JsonDataService } from './JsonDataService';

export function createDataService(): IDataService {
  const store = process.env.DATA_STORE || 'json';

  switch (store) {
    case 'json':
      return new JsonDataService();
    case 'postgres': {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PostgresDataService } = require('./PostgresDataService');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return new PostgresDataService(pool);
    }
    default:
      throw new Error(`Unknown DATA_STORE: ${store}. Expected 'json' or 'postgres'.`);
  }
}
