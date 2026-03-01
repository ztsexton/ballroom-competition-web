import { describe, it, expect } from 'vitest';
import { DEFAULT_DANCE_ORDER, getDancesForStyle } from '../constants/dances';

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
