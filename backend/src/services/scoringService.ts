import { EventResult, Couple, RecallRules, SkatingDetail, DanceDetail } from '../types';
import { dataService } from './dataService';
import { ROUND_CAPACITY, RECALL_ROUNDS } from '../constants/rounds';
import { skatingPlacement, multiDancePlacement } from './skatingSystem';

/**
 * Extract the sorting metric from an EventResult for tie comparison.
 * Results are already sorted, so we just need the value to detect ties.
 */
function getResultMetric(result: EventResult): number {
  if (result.totalMarks !== undefined) return result.totalMarks;
  if (result.totalRank !== undefined) return result.totalRank;
  if (result.totalScore !== undefined) return result.totalScore;
  return 0;
}

/**
 * Compute which bibs should advance, respecting ties at the cut line.
 *
 * Rules (from doc/spec/scoring.md):
 *   R1: Include all entries whose score equals the cut-line value (tie group).
 *   R2: Never break ties or truncate the tie group.
 *   R3/R4: For finals, hard max of 8 (configurable). If tie group would exceed
 *          the hard max, exclude the entire tie group (advance only those
 *          strictly better than the cut line).
 *
 * @param sortedResults - Results already sorted by their metric (best first)
 * @param targetCount   - How many entries to aim for
 * @param options.hardMax      - If set, cap advancement at this number (for finals)
 * @param options.includeTies  - If false, just slice to targetCount (no tie expansion)
 */
export function computeAdvancementBibs(
  sortedResults: EventResult[],
  targetCount: number,
  options?: { hardMax?: number; includeTies?: boolean },
): number[] {
  if (sortedResults.length === 0) return [];
  if (sortedResults.length <= targetCount) {
    return sortedResults.map(r => r.bib);
  }

  const includeTies = options?.includeTies ?? true;
  if (!includeTies) {
    return sortedResults.slice(0, targetCount).map(r => r.bib);
  }

  // Find the metric at the cut line (targetCount - 1, 0-indexed)
  const cutLineMetric = getResultMetric(sortedResults[targetCount - 1]);

  // Extend to include all entries tied at the cut line
  let advanceCount = targetCount;
  while (
    advanceCount < sortedResults.length &&
    getResultMetric(sortedResults[advanceCount]) === cutLineMetric
  ) {
    advanceCount++;
  }

  // If hardMax is set and we exceed it, exclude the entire tie group at cut line
  if (options?.hardMax !== undefined && advanceCount > options.hardMax) {
    // Find where the tie group starts (entries strictly better than cut line)
    let strictCount = 0;
    while (
      strictCount < sortedResults.length &&
      getResultMetric(sortedResults[strictCount]) !== cutLineMetric
    ) {
      strictCount++;
    }
    advanceCount = strictCount;
  }

  return sortedResults.slice(0, advanceCount).map(r => r.bib);
}

export class ScoringService {
  /**
   * Get the list of dances for scoring purposes.
   * Returns [undefined] for single-dance or no-dance events (backward compatible).
   * Returns the actual dance names for multi-dance events.
   */
  private async getDancesForScoring(eventId: number): Promise<(string | undefined)[]> {
    const event = await dataService.getEventById(eventId);
    if (!event?.dances || event.dances.length <= 1) return [undefined];
    return event.dances;
  }

  async calculateResults(eventId: number, round: string, bibSubset?: number[]): Promise<EventResult[]> {
    const event = await dataService.getEventById(eventId);
    if (!event) return [];

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];

    const scratched = new Set(event.scratchedBibs || []);
    const bibs = (bibSubset || heat.bibs).filter(b => !scratched.has(b));
    const scoringType = event.scoringType || 'standard';
    const isRecallRound = RECALL_ROUNDS.includes(round);
    const dances = await this.getDancesForScoring(eventId);
    const isMultiDance = dances.length > 1 && dances[0] !== undefined;

    if (isMultiDance && !isRecallRound) {
      // Multi-dance final: calculate per-dance placements, then combine
      return this.calculateMultiDanceResults(eventId, round, bibs, dances as string[], scoringType);
    }

    if (isMultiDance && isRecallRound) {
      // Multi-dance recall: sum marks across all dances
      return this.calculateMultiDanceRecallResults(eventId, round, bibs, dances as string[]);
    }

    // Single-dance or no-dance: original logic
    return this.calculateSingleDanceResults(eventId, round, bibs, scoringType, isRecallRound);
  }

  private async calculateSingleDanceResults(
    eventId: number,
    round: string,
    bibs: number[],
    scoringType: string,
    isRecallRound: boolean,
    dance?: string,
  ): Promise<EventResult[]> {
    const results: EventResult[] = [];
    const couplesMap = await dataService.getCouplesByBibs(bibs);
    const allScores = await dataService.getScoresForRound(eventId, round, bibs, dance);

    for (const bib of bibs) {
      const couple = couplesMap.get(bib);
      if (!couple) continue;

      const scores = allScores[bib] || [];
      if (scores.length === 0) continue;

      if (scoringType === 'proficiency') {
        const average = scores.length > 0
          ? parseFloat((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1))
          : 0;
        results.push({
          bib,
          leaderName: couple.leaderName,
          followerName: couple.followerName,
          totalScore: average,
          scores,
          isRecall: false,
        });
      } else if (isRecallRound) {
        results.push({
          bib,
          leaderName: couple.leaderName,
          followerName: couple.followerName,
          totalMarks: scores.reduce((sum, score) => sum + score, 0),
          scores,
          isRecall: true,
        });
      } else {
        results.push({
          bib,
          leaderName: couple.leaderName,
          followerName: couple.followerName,
          totalRank: scores.reduce((sum, score) => sum + score, 0),
          scores,
          isRecall: false,
        });
      }
    }

    // Apply skating system for standard finals (Rules 5-8)
    if (!isRecallRound && scoringType !== 'proficiency' && results.length > 0) {
      const judgeRanks = new Map<number, number[]>();
      for (const r of results) {
        judgeRanks.set(r.bib, r.scores);
      }
      const skatingResults = skatingPlacement(judgeRanks);
      for (const sr of skatingResults) {
        const result = results.find(r => r.bib === sr.bib);
        if (result) {
          result.place = sr.placement;
          result.totalRank = sr.placement;
          result.skatingDetail = {
            cumulativeCounts: sr.cumulativeCounts,
            cumulativeSums: sr.cumulativeSums,
          };
        }
      }
    }

    // Sort results
    if (scoringType === 'proficiency') {
      results.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    } else if (isRecallRound) {
      results.sort((a, b) => (b.totalMarks || 0) - (a.totalMarks || 0));
    } else {
      results.sort((a, b) => (a.totalRank || 0) - (b.totalRank || 0));
    }

    return results;
  }

  /**
   * Multi-dance final: for each dance, calculate placements using the skating system
   * (Rules 5-8). Then determine overall ranking using Rules 9-11.
   */
  private async calculateMultiDanceResults(
    eventId: number,
    round: string,
    bibs: number[],
    dances: string[],
    scoringType: string,
  ): Promise<EventResult[]> {
    const event = await dataService.getEventById(eventId);
    const eventDances = event?.dances || [];

    if (scoringType !== 'proficiency') {
      // Standard scoring: apply skating system (Rules 5-11)
      const perDancePlacements = new Map<number, number[]>();
      const perDanceJudgeRanks: Array<Map<number, number[]>> = [];
      const perDanceSkatingDetails: Array<Map<number, SkatingDetail>> = [];

      for (const bib of bibs) {
        perDancePlacements.set(bib, []);
      }

      for (const dance of dances) {
        const activeBibs = eventDances.includes(dance) ? bibs : [];
        const judgeRanks = new Map<number, number[]>();
        const danceScores = await dataService.getScoresForRound(eventId, round, activeBibs, dance);

        for (const bib of activeBibs) {
          const scores = danceScores[bib] || [];
          if (scores.length > 0) {
            judgeRanks.set(bib, scores);
          }
        }

        perDanceJudgeRanks.push(judgeRanks);
        const danceSkatingDetails = new Map<number, SkatingDetail>();

        if (judgeRanks.size > 0) {
          const skatingResults = skatingPlacement(judgeRanks);
          for (const sr of skatingResults) {
            perDancePlacements.get(sr.bib)?.push(sr.placement);
            danceSkatingDetails.set(sr.bib, {
              cumulativeCounts: sr.cumulativeCounts,
              cumulativeSums: sr.cumulativeSums,
            });
          }
        }
        perDanceSkatingDetails.push(danceSkatingDetails);
      }

      // Apply Rules 9-11 for overall ranking
      const overallResults = multiDancePlacement(perDancePlacements, perDanceJudgeRanks);

      const results: EventResult[] = [];
      const couplesMap = await dataService.getCouplesByBibs(overallResults.map(r => r.bib));
      for (const r of overallResults) {
        const couple = couplesMap.get(r.bib);
        if (!couple) continue;

        const placements = perDancePlacements.get(r.bib) || [];
        results.push({
          bib: r.bib,
          leaderName: couple.leaderName,
          followerName: couple.followerName,
          place: r.placement,
          totalRank: r.placement,
          scores: placements,
          danceScores: dances.map((dance, i) => ({
            dance,
            placement: placements[i] || 0,
          })),
          danceDetails: dances.map((dance, i) => ({
            dance,
            scores: perDanceJudgeRanks[i]?.get(r.bib) || [],
            placement: placements[i] || 0,
            skatingDetail: perDanceSkatingDetails[i]?.get(r.bib),
          })),
          isRecall: false,
        });
      }

      return results.sort((a, b) => (a.totalRank || 0) - (b.totalRank || 0));
    }

    // Proficiency scoring: use index-based placement
    const dancePlacements: Record<number, number[]> = {};
    for (const bib of bibs) {
      dancePlacements[bib] = [];
    }

    for (const dance of dances) {
      const activeBibs = eventDances.includes(dance) ? bibs : [];
      const danceResults = await this.calculateSingleDanceResults(
        eventId, round, activeBibs, scoringType, false, dance,
      );
      for (let i = 0; i < danceResults.length; i++) {
        dancePlacements[danceResults[i].bib].push(i + 1);
      }
    }

    const results: EventResult[] = [];
    const profCouplesMap = await dataService.getCouplesByBibs(bibs);
    for (const bib of bibs) {
      const couple = profCouplesMap.get(bib);
      if (!couple) continue;

      const placements = dancePlacements[bib];
      if (placements.length === 0) continue;

      const totalRank = placements.reduce((sum, p) => sum + p, 0);
      results.push({
        bib,
        leaderName: couple.leaderName,
        followerName: couple.followerName,
        totalRank,
        scores: placements,
        danceScores: dances.map((dance, i) => ({
          dance,
          placement: placements[i],
        })),
        isRecall: false,
      });
    }

    results.sort((a, b) => (a.totalRank || 0) - (b.totalRank || 0));
    return results;
  }

  /**
   * Multi-dance recall: sum marks across all dances and all judges.
   * Each dance has separate recall marks per judge.
   */
  private async calculateMultiDanceRecallResults(
    eventId: number,
    round: string,
    bibs: number[],
    dances: string[],
  ): Promise<EventResult[]> {
    const results: EventResult[] = [];
    const couplesMap = await dataService.getCouplesByBibs(bibs);

    // Prefetch all dance scores in batch
    const danceScoresMap: Record<string, Record<number, number[]>> = {};
    for (const dance of dances) {
      danceScoresMap[dance] = await dataService.getScoresForRound(eventId, round, bibs, dance);
    }

    for (const bib of bibs) {
      const couple = couplesMap.get(bib);
      if (!couple) continue;

      let totalMarks = 0;
      const allScores: number[] = [];
      const danceDetails: DanceDetail[] = [];

      for (const dance of dances) {
        const scores = danceScoresMap[dance][bib] || [];
        const danceMarks = scores.reduce((sum, s) => sum + s, 0);
        totalMarks += danceMarks;
        allScores.push(...scores);
        danceDetails.push({ dance, scores, totalMarks: danceMarks });
      }

      if (allScores.length === 0) continue;

      results.push({
        bib,
        leaderName: couple.leaderName,
        followerName: couple.followerName,
        totalMarks,
        scores: allScores,
        danceDetails,
        isRecall: true,
      });
    }

    results.sort((a, b) => (b.totalMarks || 0) - (a.totalMarks || 0));
    return results;
  }

  async enrichRecallStatus(results: EventResult[], eventId: number, round: string): Promise<void> {
    const event = await dataService.getEventById(eventId);
    if (!event) return;
    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(round);
    if (currentIndex < 0 || currentIndex >= rounds.length - 1) return;
    const nextHeat = event.heats[currentIndex + 1];
    const advancedBibs = new Set(nextHeat.bibs);
    for (const r of results) {
      r.recalled = advancedBibs.has(r.bib);
    }
  }

  async getTopCouples(
    eventId: number,
    round: string,
    count: number = 6,
    options?: { hardMax?: number; includeTies?: boolean },
  ): Promise<number[]> {
    const results = await this.calculateResults(eventId, round);
    return computeAdvancementBibs(results, count, options);
  }

  async scoreEvent(
    eventId: number,
    round: string,
    scores: Array<{ judgeIndex: number; bib: number; score: number }>
  ): Promise<boolean> {
    const event = await dataService.getEventById(eventId);
    if (!event) return false;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return false;

    // Clear existing scores for this round
    await dataService.clearScores(eventId, round);

    // Group scores by bib, excluding scratched
    const scratched = new Set(event.scratchedBibs || []);
    const activeBibs = heat.bibs.filter(b => !scratched.has(b));
    const scoresByBib: Record<number, number[]> = {};
    for (const bib of activeBibs) {
      scoresByBib[bib] = [];
    }

    // Organize scores by bib and judge order
    scores.forEach(({ bib, score }) => {
      if (scoresByBib[bib]) {
        scoresByBib[bib].push(score);
      }
    });

    // Save scores
    for (const [bib, bibScores] of Object.entries(scoresByBib)) {
      await dataService.setScores(eventId, round, Number(bib), bibScores);
    }

    // Check if we need to advance to next round
    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(round);
    if (currentIndex < rounds.length - 1) {
      const nextRound = rounds[currentIndex + 1];
      const targetCount = ROUND_CAPACITY[nextRound] || 6;
      const competition = await dataService.getCompetitionById(event.competitionId);
      const rules = competition?.recallRules;
      const isFinalNext = nextRound === 'final';
      const hardMax = isFinalNext ? (rules?.finalMaxSize ?? 8) : undefined;
      const includeTies = rules?.includeTies ?? true;
      const topBibs = await this.getTopCouples(eventId, round, targetCount, { hardMax, includeTies });
      await dataService.advanceToNextRound(eventId, round, topBibs);
    }

    return true;
  }

  async submitJudgeScores(
    eventId: number,
    round: string,
    judgeId: number,
    scores: Array<{ bib: number; score: number }>,
    dance?: string,
  ): Promise<{ success: boolean; allSubmitted: boolean }> {
    const event = await dataService.getEventById(eventId);
    if (!event) return { success: false, allSubmitted: false };

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return { success: false, allSubmitted: false };
    if (!heat.judges.includes(judgeId)) return { success: false, allSubmitted: false };

    await dataService.setJudgeScoresBatch(eventId, round, judgeId, scores, dance);

    // Check all dances in one batch call instead of per-dance loop
    const scratched = new Set(event.scratchedBibs || []);
    const activeBibs = heat.bibs.filter(b => !scratched.has(b));
    const dances = await this.getDancesForScoring(eventId);
    const batchEntries = dances.map(d => ({
      eventId,
      round,
      dance: d,
      bibs: activeBibs,
    }));
    const batchStatus = await dataService.getJudgeSubmissionStatusBatch(batchEntries, heat.judges);
    const allSubmitted = heat.judges.every(jId => batchStatus[jId]);

    return { success: true, allSubmitted };
  }

  async compileJudgeScores(eventId: number, round: string, bibSubset?: number[], danceFilter?: string): Promise<boolean> {
    const event = await dataService.getEventById(eventId);
    if (!event) return false;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return false;

    const scratched = new Set(event.scratchedBibs || []);
    const bibs = (bibSubset || heat.bibs).filter(b => !scratched.has(b));
    const scoringType = event.scoringType || 'standard';
    const isRecall = RECALL_ROUNDS.includes(round);
    const defaultScore = scoringType === 'proficiency' ? 0 : isRecall ? 0 : bibs.length;

    const dances = danceFilter ? [danceFilter] : await this.getDancesForScoring(eventId);

    for (const dance of dances) {
      const allJudgeScores = await dataService.getJudgeScoresForRound(eventId, round, bibs, dance);
      const scoreEntries: Array<{ bib: number; scores: number[] }> = [];
      for (const bib of bibs) {
        const judgeScores = allJudgeScores[bib] || {};
        const compiled = heat.judges.map(judgeId =>
          judgeScores[judgeId] !== undefined ? judgeScores[judgeId] : defaultScore,
        );
        scoreEntries.push({ bib, scores: compiled });
      }
      await dataService.setScoresBatch(eventId, round, scoreEntries, dance);
    }

    // Skip auto-advancement when bibSubset is provided (caller handles it)
    if (!bibSubset) {
      const rounds = event.heats.map(h => h.round);
      const currentIndex = rounds.indexOf(round);
      if (currentIndex < rounds.length - 1) {
        const nextRound = rounds[currentIndex + 1];
        const targetCount = ROUND_CAPACITY[nextRound] || 6;
        const competition = await dataService.getCompetitionById(event.competitionId);
        const rules = competition?.recallRules;
        const isFinalNext = nextRound === 'final';
        const hardMax = isFinalNext ? (rules?.finalMaxSize ?? 8) : undefined;
        const includeTies = rules?.includeTies ?? true;
        const topBibs = await this.getTopCouples(eventId, round, targetCount, { hardMax, includeTies });
        await dataService.advanceToNextRound(eventId, round, topBibs);
      }
    }

    return true;
  }
}

export const scoringService = new ScoringService();
