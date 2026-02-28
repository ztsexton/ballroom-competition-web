import { CompetitionType, RulePresetKey } from '../../../../types';

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'ZAR', label: 'ZAR - South African Rand (R)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

export const PRESET_TO_TYPE: Record<string, CompetitionType> = {
  ndca: 'NDCA',
  usadance: 'USA_DANCE',
  wdc: 'WDC',
  wdsf: 'WDSF',
  custom: 'UNAFFILIATED',
};

export const PRESET_COLORS: Record<string, string> = {
  ndca: '#dc2626',
  usadance: '#2563eb',
  wdc: '#059669',
  wdsf: '#d97706',
  custom: '#6b7280',
};

export const KNOWN_PRESETS: { key: RulePresetKey; label: string; color: string }[] = [
  { key: 'ndca', label: 'NDCA', color: '#dc2626' },
  { key: 'usadance', label: 'USA Dance', color: '#2563eb' },
  { key: 'wdc', label: 'WDC', color: '#059669' },
  { key: 'wdsf', label: 'WDSF', color: '#d97706' },
];
