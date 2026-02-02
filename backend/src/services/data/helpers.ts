export function determineRounds(numCompetitors: number): string[] {
  if (numCompetitors <= 6) return ['final'];
  if (numCompetitors <= 14) return ['semi-final', 'final'];
  return ['quarter-final', 'semi-final', 'final'];
}

export function getScoreKey(eventId: number, round: string, bib: number, dance?: string): string {
  if (dance) return `${eventId}:${round}:${dance}:${bib}`;
  return `${eventId}:${round}:${bib}`;
}
