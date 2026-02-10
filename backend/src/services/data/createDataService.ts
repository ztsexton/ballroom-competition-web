import { IDataService } from './IDataService';
import { JsonDataService } from './JsonDataService';
import { CachingDataService } from './CachingDataService';

export function createDataService(): IDataService {
  const store = process.env.DATA_STORE || 'json';
  let inner: IDataService;

  switch (store) {
    case 'json':
      inner = new JsonDataService();
      break;
    case 'postgres': {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PostgresDataService } = require('./PostgresDataService');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      inner = new PostgresDataService(pool);
      break;
    }
    default:
      throw new Error(`Unknown DATA_STORE: ${store}. Expected 'json' or 'postgres'.`);
  }

  if (process.env.DISABLE_CACHE === 'true') return inner;
  return new CachingDataService(inner);
}
