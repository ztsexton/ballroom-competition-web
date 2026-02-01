export function determineRounds(numCompetitors: number): string[] {
  if (numCompetitors <= 6) return ['final'];
  if (numCompetitors <= 14) return ['semi-final', 'final'];
  return ['quarter-final', 'semi-final', 'final'];
}

export function getScoreKey(eventId: number, round: string, bib: number): string {
  return `${eventId}:${round}:${bib}`;
}
