import { JsonDataService } from '../../../services/data/JsonDataService';
import { dataServiceContractTests } from './dataServiceContract';

describe('JsonDataService', () => {
  dataServiceContractTests(() => new JsonDataService());
});
