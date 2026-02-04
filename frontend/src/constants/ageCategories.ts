import { AgeCategory } from '../types';

export const NDCA_AGE_CATEGORIES: AgeCategory[] = [
  { name: 'Junior 1', maxAge: 11 },
  { name: 'Junior 2', minAge: 12, maxAge: 15 },
  { name: 'Youth', minAge: 16, maxAge: 18 },
  { name: 'Adult', minAge: 19, maxAge: 34 },
  { name: 'Senior 1', minAge: 35, maxAge: 44 },
  { name: 'Senior 2', minAge: 45, maxAge: 54 },
  { name: 'Senior 3', minAge: 55, maxAge: 64 },
  { name: 'Senior 4', minAge: 65 },
];

export const USA_DANCE_AGE_CATEGORIES: AgeCategory[] = [
  { name: 'Pre-Teen', maxAge: 11 },
  { name: 'Junior', minAge: 12, maxAge: 15 },
  { name: 'Youth', minAge: 16, maxAge: 18 },
  { name: 'Under 21', minAge: 16, maxAge: 20 },
  { name: 'Adult', minAge: 19 },
  { name: 'Senior 1', minAge: 35 },
  { name: 'Senior 2', minAge: 50 },
  { name: 'Senior 3', minAge: 60 },
  { name: 'Senior 4', minAge: 70 },
];

export const AGE_CATEGORY_PRESETS: Record<string, AgeCategory[]> = {
  ndca: NDCA_AGE_CATEGORIES,
  usadance: USA_DANCE_AGE_CATEGORIES,
  wdc: [],
  wdsf: [],
};
