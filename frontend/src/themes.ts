export type ThemeKey = 'indigo' | 'blue' | 'rose' | 'teal';

export interface Theme {
  key: ThemeKey;
  label: string;
  description: string;
  swatch: string;
  colors: Record<string, string>;
}

export const themes: Record<ThemeKey, Theme> = {
  indigo: {
    key: 'indigo',
    label: 'Indigo',
    description: 'Classic & refined',
    swatch: '#667eea',
    colors: {
      '--color-primary-50': '#eef2ff',
      '--color-primary-100': '#e0e7ff',
      '--color-primary-200': '#c7d2fe',
      '--color-primary-300': '#a5b4fc',
      '--color-primary-400': '#818cf8',
      '--color-primary-500': '#667eea',
      '--color-primary-600': '#5568d3',
      '--color-primary-700': '#4338ca',
      '--color-primary-800': '#3730a3',
      '--color-primary-900': '#312e81',
      '--color-success-500': '#48bb78',
      '--color-success-600': '#38a169',
      '--color-danger-500': '#f56565',
      '--color-danger-600': '#e53e3e',
    },
  },
  blue: {
    key: 'blue',
    label: 'Blue',
    description: 'Professional & clean',
    swatch: '#3b82f6',
    colors: {
      '--color-primary-50': '#eff6ff',
      '--color-primary-100': '#dbeafe',
      '--color-primary-200': '#bfdbfe',
      '--color-primary-300': '#93c5fd',
      '--color-primary-400': '#60a5fa',
      '--color-primary-500': '#3b82f6',
      '--color-primary-600': '#2563eb',
      '--color-primary-700': '#1d4ed8',
      '--color-primary-800': '#1e40af',
      '--color-primary-900': '#1e3a8a',
      '--color-success-500': '#48bb78',
      '--color-success-600': '#38a169',
      '--color-danger-500': '#f56565',
      '--color-danger-600': '#e53e3e',
    },
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    description: 'Warm & elegant',
    swatch: '#e11d48',
    colors: {
      '--color-primary-50': '#fff1f2',
      '--color-primary-100': '#ffe4e6',
      '--color-primary-200': '#fecdd3',
      '--color-primary-300': '#fda4af',
      '--color-primary-400': '#fb7185',
      '--color-primary-500': '#e11d48',
      '--color-primary-600': '#be123c',
      '--color-primary-700': '#9f1239',
      '--color-primary-800': '#881337',
      '--color-primary-900': '#4c0519',
      '--color-success-500': '#48bb78',
      '--color-success-600': '#38a169',
      '--color-danger-500': '#f56565',
      '--color-danger-600': '#e53e3e',
    },
  },
  teal: {
    key: 'teal',
    label: 'Teal',
    description: 'Fresh & modern',
    swatch: '#14b8a6',
    colors: {
      '--color-primary-50': '#f0fdfa',
      '--color-primary-100': '#ccfbf1',
      '--color-primary-200': '#99f6e4',
      '--color-primary-300': '#5eead4',
      '--color-primary-400': '#2dd4bf',
      '--color-primary-500': '#14b8a6',
      '--color-primary-600': '#0d9488',
      '--color-primary-700': '#0f766e',
      '--color-primary-800': '#115e59',
      '--color-primary-900': '#134e4a',
      '--color-success-500': '#48bb78',
      '--color-success-600': '#38a169',
      '--color-danger-500': '#f56565',
      '--color-danger-600': '#e53e3e',
    },
  },
};

export const themeKeys = Object.keys(themes) as ThemeKey[];
