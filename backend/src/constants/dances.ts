export const DEFAULT_DANCE_ORDER: Record<string, string[]> = {
  Smooth: ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz'],
  Standard: ['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep'],
  Rhythm: ['Cha Cha', 'Rumba', 'Swing', 'Bolero', 'Mambo'],
  Latin: ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'],
};

export function getDancesForStyle(style: string, danceOrder?: Record<string, string[]>): string[] {
  if (danceOrder && danceOrder[style]) return danceOrder[style];
  return DEFAULT_DANCE_ORDER[style] || [];
}
