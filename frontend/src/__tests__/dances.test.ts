import { describe, it, expect } from 'vitest';
import { DEFAULT_DANCE_ORDER, DEFAULT_STYLE_ORDER, getDancesForStyle, getAvailableStyles } from '../constants/dances';

describe('DEFAULT_DANCE_ORDER', () => {
  it('should have 4 standard styles', () => {
    expect(Object.keys(DEFAULT_DANCE_ORDER)).toEqual(['Smooth', 'Standard', 'Rhythm', 'Latin']);
  });

  it('should have Rhythm dances with Swing (not East Coast Swing)', () => {
    expect(DEFAULT_DANCE_ORDER.Rhythm).toContain('Swing');
    expect(DEFAULT_DANCE_ORDER.Rhythm).not.toContain('East Coast Swing');
  });
});

describe('getDancesForStyle', () => {
  it('should return defaults when no custom order', () => {
    expect(getDancesForStyle('Smooth')).toEqual(['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz']);
  });

  it('should return custom override when provided', () => {
    const custom = { Smooth: ['Tango', 'Waltz'] };
    expect(getDancesForStyle('Smooth', custom)).toEqual(['Tango', 'Waltz']);
  });

  it('should fall back to defaults for styles not in custom order', () => {
    const custom = { Latin: ['Rumba'] };
    expect(getDancesForStyle('Standard', custom)).toEqual(['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep']);
  });

  it('should return empty array for unknown style', () => {
    expect(getDancesForStyle('Unknown')).toEqual([]);
  });
});

describe('DEFAULT_STYLE_ORDER', () => {
  it('should contain the four standard styles', () => {
    expect(DEFAULT_STYLE_ORDER).toEqual(['Smooth', 'Rhythm', 'Standard', 'Latin']);
  });
});

describe('getAvailableStyles', () => {
  it('should return defaults when no danceOrder provided', () => {
    expect(getAvailableStyles()).toEqual(['Smooth', 'Rhythm', 'Standard', 'Latin']);
  });

  it('should return defaults when danceOrder has only default styles', () => {
    const order = { Smooth: ['Waltz'], Latin: ['Cha Cha'] };
    expect(getAvailableStyles(order)).toEqual(['Smooth', 'Rhythm', 'Standard', 'Latin']);
  });

  it('should include custom styles after defaults', () => {
    const order = {
      Smooth: ['Waltz'],
      'Theater Arts': ['Broadway'],
      'Country Western': ['Two Step'],
    };
    const result = getAvailableStyles(order);
    expect(result).toEqual(['Smooth', 'Rhythm', 'Standard', 'Latin', 'Theater Arts', 'Country Western']);
  });

  it('should not duplicate default styles', () => {
    const order = { Smooth: ['Waltz'], 'Theater Arts': [] };
    const result = getAvailableStyles(order);
    expect(result.filter(s => s === 'Smooth')).toHaveLength(1);
    expect(result).toContain('Theater Arts');
  });
});
