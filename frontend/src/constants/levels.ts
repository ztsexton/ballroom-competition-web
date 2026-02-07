export const DEFAULT_LEVELS = [
  'Newcomer', 'Bronze', 'Silver', 'Gold',
  'Novice', 'Pre-Championship', 'Championship',
];

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
