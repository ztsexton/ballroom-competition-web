export const DEFAULT_LEVELS = [
  'Newcomer', 'Bronze', 'Silver', 'Gold',
  'Novice', 'Pre-Championship', 'Championship',
];

export const CERTIFICATION_LEVEL_ORDER = [
  'Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship',
];
export const DEFAULT_MAX_LEVEL = 'Silver';  // Index 2 — judges can judge 0-2 by default

export const LEVEL_TEMPLATES: Record<string, { label: string; levels: string[]; levelMode?: 'combined' | 'integrated' }> = {
  standard: {
    label: 'Standard',
    levels: DEFAULT_LEVELS,
  },
  detailed: {
    label: 'Detailed Sub-levels',
    levels: [
      'Newcomer', 'Bronze 1', 'Bronze 2', 'Bronze 3', 'Bronze 4',
      'Silver 1', 'Silver 2', 'Silver 3', 'Gold',
      'Novice', 'Pre-Championship', 'Championship',
    ],
  },
  simplified: {
    label: 'Simplified',
    levels: ['Bronze', 'Silver', 'Gold'],
  },
  open: {
    label: 'Open / Social',
    levels: ['Open'],
  },
  integratedOpen: {
    label: 'Integrated Open',
    levels: [
      'Bronze 1', 'Bronze 2', 'Bronze 3', 'Open Bronze',
      'Silver 1', 'Silver 2', 'Silver 3', 'Open Silver',
      'Gold', 'Open Gold',
    ],
    levelMode: 'integrated',
  },
};

import { CompetitionType } from '../types';

export const DEFAULT_LEVELS_BY_TYPE: Record<CompetitionType, string[]> = {
  NDCA: LEVEL_TEMPLATES.standard.levels,
  USA_DANCE: LEVEL_TEMPLATES.standard.levels,
  WDC: LEVEL_TEMPLATES.standard.levels,
  WDSF: LEVEL_TEMPLATES.standard.levels,
  UNAFFILIATED: LEVEL_TEMPLATES.standard.levels,
  STUDIO: LEVEL_TEMPLATES.simplified.levels,
};
