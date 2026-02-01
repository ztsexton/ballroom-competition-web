export type { IDataService } from './IDataService';
export { createDataService } from './createDataService';
export { determineRounds, getScoreKey } from './helpers';

import { createDataService } from './createDataService';
export const dataService = createDataService();
