/**
 * Maximum number of couples allowed in each round type.
 * The recall count for a round = the capacity of the NEXT round.
 *
 * E.g. quarter-final → semi-final: recall ROUND_CAPACITY['semi-final'] = 12
 */
export const ROUND_CAPACITY: Record<string, number> = {
  'final': 6,
  'semi-final': 12,
  'quarter-final': 24,
  '1/8-final': 48,
  '1/16-final': 96,
  '1/32-final': 192,
};

/**
 * All recall round names (every round except final).
 */
export const RECALL_ROUNDS = ['semi-final', 'quarter-final', '1/8-final', '1/16-final', '1/32-final'];

/**
 * Calculate how many couples to recall from a given round.
 * Returns undefined for final rounds (no recall needed).
 */
export function getRecallCount(
  heats: Array<{ round: string }>,
  currentRound: string,
  totalFloorHeats?: number,
  floorHeatIndex?: number,
): number | undefined {
  const roundIdx = heats.findIndex(h => h.round === currentRound);
  if (roundIdx === -1 || roundIdx >= heats.length - 1) return undefined;

  const nextRound = heats[roundIdx + 1].round;
  const totalRecall = ROUND_CAPACITY[nextRound];
  if (!totalRecall) return undefined;

  if (!totalFloorHeats || totalFloorHeats <= 1) return totalRecall;

  // Distribute evenly: base + 1 for the first `remainder` heats
  const base = Math.floor(totalRecall / totalFloorHeats);
  const remainder = totalRecall % totalFloorHeats;

  if (floorHeatIndex !== undefined) {
    return base + (floorHeatIndex < remainder ? 1 : 0);
  }

  // Default: use ceiling (for judge-facing display)
  return Math.ceil(totalRecall / totalFloorHeats);
}
