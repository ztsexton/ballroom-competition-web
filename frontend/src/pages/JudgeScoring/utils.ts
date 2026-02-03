export const formatRound = (round: string) =>
  round.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
