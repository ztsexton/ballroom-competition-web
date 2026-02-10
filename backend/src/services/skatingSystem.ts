/**
 * Skating System implementation (Rules 5-11)
 *
 * Pure functions with zero external dependencies.
 * Implements the standard ballroom dance competition scoring algorithm
 * as defined by the Official Board of Ballroom Dancing.
 */

export interface SkatingResult {
  bib: number;
  placement: number;
  cumulativeCounts: number[];
  cumulativeSums: number[];
}

/**
 * Precompute cumulative count and sum tables for each couple.
 *
 * counts[p] = number of judges who ranked this couple at position p+1 or better
 * sums[p]   = sum of those ranks
 */
function buildCumulativeTable(
  ranks: number[],
  numPositions: number,
): { counts: number[]; sums: number[] } {
  const counts: number[] = [];
  const sums: number[] = [];
  for (let p = 1; p <= numPositions; p++) {
    let count = 0;
    let sum = 0;
    for (const rank of ranks) {
      if (rank <= p) {
        count++;
        sum += rank;
      }
    }
    counts.push(count);
    sums.push(sum);
  }
  return { counts, sums };
}

/**
 * Resolve a group of bibs that all achieved majority at the same column.
 * Applies Rules 6, 7a, 7b, 7c recursively.
 *
 * Returns an array of { bib, placement } for all bibs in the group,
 * with placements starting at startPlace.
 */
function resolveGroup(
  bibs: number[],
  counts: Map<number, number[]>,
  sums: Map<number, number[]>,
  col: number,
  totalCols: number,
  startPlace: number,
): Array<{ bib: number; placement: number }> {
  if (bibs.length <= 1) {
    return bibs.map(bib => ({ bib, placement: startPlace }));
  }

  // Sort by count descending (Rule 6), then sum ascending (Rule 7a)
  const sorted = [...bibs].sort((a, b) => {
    const countDiff = counts.get(b)![col] - counts.get(a)![col];
    if (countDiff !== 0) return countDiff;
    return sums.get(a)![col] - sums.get(b)![col];
  });

  const results: Array<{ bib: number; placement: number }> = [];
  let currentPlace = startPlace;
  let i = 0;

  while (i < sorted.length) {
    // Find tie group starting at i
    let j = i + 1;
    while (
      j < sorted.length &&
      counts.get(sorted[j])![col] === counts.get(sorted[i])![col] &&
      sums.get(sorted[j])![col] === sums.get(sorted[i])![col]
    ) {
      j++;
    }

    const tieGroup = sorted.slice(i, j);

    if (tieGroup.length === 1) {
      results.push({ bib: tieGroup[0], placement: currentPlace });
      currentPlace++;
    } else {
      // Rule 7b: try next columns for the tied subset
      const resolved = breakTieAtNextColumn(
        tieGroup, counts, sums, col + 1, totalCols, currentPlace,
      );
      results.push(...resolved);
      currentPlace += tieGroup.length;
    }

    i = j;
  }

  return results;
}

/**
 * Rule 7b/7c: Try to break a tie by looking at the next column.
 * If all columns exhausted, assign average placement (Rule 7c).
 */
function breakTieAtNextColumn(
  bibs: number[],
  counts: Map<number, number[]>,
  sums: Map<number, number[]>,
  col: number,
  totalCols: number,
  startPlace: number,
): Array<{ bib: number; placement: number }> {
  if (col >= totalCols || bibs.length <= 1) {
    // Rule 7c: assign average placement
    const avgPlace = startPlace + (bibs.length - 1) / 2;
    return bibs.map(bib => ({ bib, placement: avgPlace }));
  }

  // Sort by count descending, then sum ascending at the new column
  const sorted = [...bibs].sort((a, b) => {
    const countDiff = counts.get(b)![col] - counts.get(a)![col];
    if (countDiff !== 0) return countDiff;
    return sums.get(a)![col] - sums.get(b)![col];
  });

  const results: Array<{ bib: number; placement: number }> = [];
  let currentPlace = startPlace;
  let i = 0;

  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      counts.get(sorted[j])![col] === counts.get(sorted[i])![col] &&
      sums.get(sorted[j])![col] === sums.get(sorted[i])![col]
    ) {
      j++;
    }

    const tieGroup = sorted.slice(i, j);

    if (tieGroup.length === 1) {
      results.push({ bib: tieGroup[0], placement: currentPlace });
      currentPlace++;
    } else {
      // Recurse to next column
      const resolved = breakTieAtNextColumn(
        tieGroup, counts, sums, col + 1, totalCols, currentPlace,
      );
      results.push(...resolved);
      currentPlace += tieGroup.length;
    }

    i = j;
  }

  return results;
}

/**
 * Apply Rules 5-8 of the skating system to determine final placements
 * for a single dance.
 *
 * @param judgeRanks - Map from bib to array of judge ordinals (1-based ranks).
 *                     Each judge must assign unique ranks 1..N to N couples.
 * @returns Array of SkatingResult sorted by placement (ascending)
 */
export function skatingPlacement(judgeRanks: Map<number, number[]>): SkatingResult[] {
  const bibs = Array.from(judgeRanks.keys());
  if (bibs.length === 0) return [];

  const numCouples = bibs.length;
  const numJudges = judgeRanks.get(bibs[0])!.length;
  const majority = Math.floor(numJudges / 2) + 1;

  // Precompute cumulative tables
  const counts = new Map<number, number[]>();
  const sums = new Map<number, number[]>();

  for (const [bib, ranks] of judgeRanks) {
    const table = buildCumulativeTable(ranks, numCouples);
    counts.set(bib, table.counts);
    sums.set(bib, table.sums);
  }

  const results: SkatingResult[] = [];
  const placed = new Set<number>();
  let nextPlace = 1;

  for (let col = 0; col < numCouples; col++) {
    if (placed.size === numCouples) break;

    // Find unplaced couples with majority at this column
    const candidates = bibs.filter(
      bib => !placed.has(bib) && counts.get(bib)![col] >= majority,
    );

    if (candidates.length === 0) continue; // Rule 8: no majority, try next column

    if (candidates.length === 1) {
      // Rule 5: clear majority winner
      const bib = candidates[0];
      results.push({
        bib,
        placement: nextPlace,
        cumulativeCounts: counts.get(bib)!,
        cumulativeSums: sums.get(bib)!,
      });
      placed.add(bib);
      nextPlace++;
    } else {
      // Multiple candidates: apply Rules 6/7
      const resolved = resolveGroup(
        candidates, counts, sums, col, numCouples, nextPlace,
      );
      for (const r of resolved) {
        results.push({
          bib: r.bib,
          placement: r.placement,
          cumulativeCounts: counts.get(r.bib)!,
          cumulativeSums: sums.get(r.bib)!,
        });
        placed.add(r.bib);
      }
      nextPlace += resolved.length;
    }
  }

  return results.sort((a, b) => a.placement - b.placement);
}

/**
 * Rules 9-11: Multi-dance final placement.
 *
 * Rule 9:  Sum per-dance placements. Lowest total wins.
 * Rule 10: Break ties by counting dances won (1st places), then 1st-or-2nd, etc.
 *          At each level, if counts are equal, compare sum of placements.
 * Rule 11: If still tied, combine all judge ranks from all dances into one
 *          "super-dance" and apply Rules 5-8.
 *
 * @param perDancePlacements - Map from bib to array of per-dance placements
 * @param perDanceJudgeRanks - Array of Maps (one per dance), each Map<bib, number[]>
 * @returns Array of { bib, placement } sorted by placement
 */
export function multiDancePlacement(
  perDancePlacements: Map<number, number[]>,
  perDanceJudgeRanks: Array<Map<number, number[]>>,
): Array<{ bib: number; placement: number }> {
  const bibs = Array.from(perDancePlacements.keys());
  if (bibs.length === 0) return [];

  // Rule 9: compute totals
  const totals = new Map<number, number>();
  for (const bib of bibs) {
    const placements = perDancePlacements.get(bib)!;
    totals.set(bib, placements.reduce((s, p) => s + p, 0));
  }

  // Sort by total ascending
  const sorted = [...bibs].sort((a, b) => totals.get(a)! - totals.get(b)!);

  const results: Array<{ bib: number; placement: number }> = [];
  let currentPlace = 1;
  let i = 0;

  while (i < sorted.length) {
    // Find tie group
    let j = i + 1;
    while (j < sorted.length && totals.get(sorted[j])! === totals.get(sorted[i])!) {
      j++;
    }

    const tieGroup = sorted.slice(i, j);

    if (tieGroup.length === 1) {
      results.push({ bib: tieGroup[0], placement: currentPlace });
    } else {
      // Rule 10: break tie
      const resolved = breakMultiDanceTie(
        tieGroup, perDancePlacements, perDanceJudgeRanks, currentPlace,
      );
      results.push(...resolved);
    }

    currentPlace += tieGroup.length;
    i = j;
  }

  return results.sort((a, b) => a.placement - b.placement);
}

/**
 * Rule 10/11 tie-breaking for multi-dance events.
 */
function breakMultiDanceTie(
  bibs: number[],
  perDancePlacements: Map<number, number[]>,
  perDanceJudgeRanks: Array<Map<number, number[]>>,
  startPlace: number,
): Array<{ bib: number; placement: number }> {
  if (bibs.length <= 1) {
    return bibs.map(bib => ({ bib, placement: startPlace }));
  }

  const numDances = perDancePlacements.get(bibs[0])!.length;
  const numPositions = bibs.length; // max position to check

  // Rule 10: for each position level p (1, 2, 3, ...)
  for (let p = 1; p <= numPositions; p++) {
    // Count dances where each couple placed at p or better
    const danceCounts = new Map<number, number>();
    const placementSums = new Map<number, number>();

    for (const bib of bibs) {
      const placements = perDancePlacements.get(bib)!;
      let count = 0;
      let sum = 0;
      for (const pl of placements) {
        if (pl <= p) {
          count++;
          sum += pl;
        }
      }
      danceCounts.set(bib, count);
      placementSums.set(bib, sum);
    }

    // Sort: higher count wins, then lower sum
    const sorted = [...bibs].sort((a, b) => {
      const countDiff = danceCounts.get(b)! - danceCounts.get(a)!;
      if (countDiff !== 0) return countDiff;
      return placementSums.get(a)! - placementSums.get(b)!;
    });

    // Check if this breaks the tie (at least partially)
    const allSame = sorted.every(
      bib =>
        danceCounts.get(bib)! === danceCounts.get(sorted[0])! &&
        placementSums.get(bib)! === placementSums.get(sorted[0])!,
    );

    if (!allSame) {
      // This level separates at least some couples - process groups
      const results: Array<{ bib: number; placement: number }> = [];
      let place = startPlace;
      let idx = 0;

      while (idx < sorted.length) {
        let end = idx + 1;
        while (
          end < sorted.length &&
          danceCounts.get(sorted[end])! === danceCounts.get(sorted[idx])! &&
          placementSums.get(sorted[end])! === placementSums.get(sorted[idx])!
        ) {
          end++;
        }

        const subGroup = sorted.slice(idx, end);
        if (subGroup.length === 1) {
          results.push({ bib: subGroup[0], placement: place });
        } else {
          // Still tied within this sub-group; continue Rule 10 at next p or fall through to Rule 11
          const resolved = breakMultiDanceTie(
            subGroup, perDancePlacements, perDanceJudgeRanks, place,
          );
          results.push(...resolved);
        }

        place += subGroup.length;
        idx = end;
      }

      return results;
    }
  }

  // Rule 11: combine all judge ranks across all dances into a super-dance
  const superRanks = new Map<number, number[]>();
  for (const bib of bibs) {
    const combined: number[] = [];
    for (const danceRanks of perDanceJudgeRanks) {
      const ranks = danceRanks.get(bib);
      if (ranks) combined.push(...ranks);
    }
    superRanks.set(bib, combined);
  }

  // If no judge ranks available, assign average placement
  const firstRanks = superRanks.get(bibs[0])!;
  if (firstRanks.length === 0) {
    const avgPlace = startPlace + (bibs.length - 1) / 2;
    return bibs.map(bib => ({ bib, placement: avgPlace }));
  }

  const skatingResults = skatingPlacement(superRanks);

  // Map skating placements to our placement range.
  // skatingPlacement assigns placements starting from 1 for the group,
  // so offset by (startPlace - 1) to shift into the correct range.
  return skatingResults.map(r => ({
    bib: r.bib,
    placement: startPlace + (r.placement - 1),
  }));
}
