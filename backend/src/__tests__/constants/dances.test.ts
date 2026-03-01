import { DEFAULT_DANCE_ORDER, DEFAULT_STYLE_ORDER, getDancesForStyle, getAvailableStyles } from '../../constants/dances';

describe('DEFAULT_DANCE_ORDER', () => {
  it('should have Smooth dances in correct order', () => {
    expect(DEFAULT_DANCE_ORDER.Smooth).toEqual(['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz']);
  });

  it('should have Standard dances in correct order', () => {
    expect(DEFAULT_DANCE_ORDER.Standard).toEqual(['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep']);
  });

  it('should have Rhythm dances with Swing', () => {
    expect(DEFAULT_DANCE_ORDER.Rhythm).toEqual(['Cha Cha', 'Rumba', 'Swing', 'Bolero', 'Mambo']);
  });

  it('should have Latin dances in correct order', () => {
    expect(DEFAULT_DANCE_ORDER.Latin).toEqual(['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive']);
  });
});

describe('getDancesForStyle', () => {
  it('should return default dances when no custom order provided', () => {
    expect(getDancesForStyle('Smooth')).toEqual(['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz']);
  });

  it('should return default dances when custom order has no entry for the style', () => {
    const custom = { Latin: ['Rumba', 'Cha Cha'] };
    expect(getDancesForStyle('Smooth', custom)).toEqual(['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz']);
  });

  it('should return custom order when provided for the style', () => {
    const custom = { Smooth: ['Foxtrot', 'Waltz', 'Tango', 'Viennese Waltz'] };
    expect(getDancesForStyle('Smooth', custom)).toEqual(['Foxtrot', 'Waltz', 'Tango', 'Viennese Waltz']);
  });

  it('should return empty array for unknown style with no custom order', () => {
    expect(getDancesForStyle('Theater Arts')).toEqual([]);
  });

  it('should return empty array for unknown style even with custom order for other styles', () => {
    const custom = { Smooth: ['Waltz'] };
    expect(getDancesForStyle('Theater Arts', custom)).toEqual([]);
  });

  it('should preserve custom dances beyond the standard set', () => {
    const custom = { Smooth: ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz', 'Peabody'] };
    expect(getDancesForStyle('Smooth', custom)).toEqual(['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz', 'Peabody']);
  });

  it('should return custom dances for a custom style', () => {
    const custom = { 'Theater Arts': ['Broadway', 'Jazz'] };
    expect(getDancesForStyle('Theater Arts', custom)).toEqual(['Broadway', 'Jazz']);
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

  it('should include custom styles from danceOrder keys after defaults', () => {
    const order = {
      Smooth: ['Waltz'],
      'Theater Arts': ['Broadway'],
      'Country Western': ['Two Step'],
    };
    const result = getAvailableStyles(order);
    expect(result).toEqual(['Smooth', 'Rhythm', 'Standard', 'Latin', 'Theater Arts', 'Country Western']);
  });

  it('should not duplicate default styles that also appear in danceOrder', () => {
    const order = { Smooth: ['Waltz'], Standard: ['Waltz'], 'Theater Arts': [] };
    const result = getAvailableStyles(order);
    expect(result.filter(s => s === 'Smooth')).toHaveLength(1);
    expect(result.filter(s => s === 'Standard')).toHaveLength(1);
    expect(result).toContain('Theater Arts');
  });

  it('should return a new array each time (not a reference)', () => {
    const a = getAvailableStyles();
    const b = getAvailableStyles();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
