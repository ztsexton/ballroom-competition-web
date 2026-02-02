import { EventResult, Couple } from '../types';
import { dataService } from './dataService';

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

  async calculateResults(eventId: number, round: string): Promise<EventResult[]> {
    const event = await dataService.getEventById(eventId);
    if (!event) return [];

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];

    const scoringType = event.scoringType || 'standard';
    const isRecallRound = ['quarter-final', 'semi-final'].includes(round);
    const dances = await this.getDancesForScoring(eventId);
    const isMultiDance = dances.length > 1 && dances[0] !== undefined;

    if (isMultiDance && !isRecallRound) {
      // Multi-dance final: calculate per-dance placements, then combine
      return this.calculateMultiDanceResults(eventId, round, heat.bibs, dances as string[], scoringType);
    }

    if (isMultiDance && isRecallRound) {
      // Multi-dance recall: sum marks across all dances
      return this.calculateMultiDanceRecallResults(eventId, round, heat.bibs, dances as string[]);
    }

    // Single-dance or no-dance: original logic
    return this.calculateSingleDanceResults(eventId, round, heat.bibs, scoringType, isRecallRound);
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

    for (const bib of bibs) {
      const couple = await dataService.getCoupleByBib(bib);
      if (!couple) continue;

      const scores = await dataService.getScores(eventId, round, bib, dance);
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
   * Multi-dance final: for each dance, calculate placements using the skating method
   * (sum of judge ranks per dance → placement). Then sum placements across all dances
   * for the overall ranking (Rule 10). Lower total is better.
   */
  private async calculateMultiDanceResults(
    eventId: number,
    round: string,
    bibs: number[],
    dances: string[],
    scoringType: string,
  ): Promise<EventResult[]> {
    // Per-dance placements: bib → placement per dance
    const dancePlacements: Record<number, number[]> = {};
    for (const bib of bibs) {
      dancePlacements[bib] = [];
    }

    for (const dance of dances) {
      // Get the bibs that participate in this dance
      const event = await dataService.getEventById(eventId);
      const eventDances = event?.dances || [];
      // All bibs from this event participate in dances included in the event's dance list
      const activeBibs = eventDances.includes(dance) ? bibs : [];

      if (scoringType === 'proficiency') {
        const danceResults = await this.calculateSingleDanceResults(
          eventId, round, activeBibs, scoringType, false, dance,
        );
        // Assign placements based on sort order
        for (let i = 0; i < danceResults.length; i++) {
          dancePlacements[danceResults[i].bib].push(i + 1);
        }
        // Bibs not in this dance get no placement (skip)
      } else {
        const danceResults = await this.calculateSingleDanceResults(
          eventId, round, activeBibs, scoringType, false, dance,
        );
        for (let i = 0; i < danceResults.length; i++) {
          dancePlacements[danceResults[i].bib].push(i + 1);
        }
      }
    }

    // Combine: sum of placements across dances
    const results: EventResult[] = [];
    for (const bib of bibs) {
      const couple = await dataService.getCoupleByBib(bib);
      if (!couple) continue;

      const placements = dancePlacements[bib];
      if (placements.length === 0) continue;

      const totalRank = placements.reduce((sum, p) => sum + p, 0);
      results.push({
        bib,
        leaderName: couple.leaderName,
        followerName: couple.followerName,
        totalRank,
        scores: placements, // Store per-dance placements as the scores array
        danceScores: dances.map((dance, i) => ({
          dance,
          placement: placements[i],
        })),
        isRecall: false,
      });
    }

    // Sort by total placement (lower is better)
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

    for (const bib of bibs) {
      const couple = await dataService.getCoupleByBib(bib);
      if (!couple) continue;

      let totalMarks = 0;
      const allScores: number[] = [];

      for (const dance of dances) {
        const scores = await dataService.getScores(eventId, round, bib, dance);
        const danceMarks = scores.reduce((sum, s) => sum + s, 0);
        totalMarks += danceMarks;
        allScores.push(...scores);
      }

      if (allScores.length === 0) continue;

      results.push({
        bib,
        leaderName: couple.leaderName,
        followerName: couple.followerName,
        totalMarks,
        scores: allScores,
        isRecall: true,
      });
    }

    results.sort((a, b) => (b.totalMarks || 0) - (a.totalMarks || 0));
    return results;
  }

  async getTopCouples(eventId: number, round: string, count: number = 6): Promise<number[]> {
    const results = await this.calculateResults(eventId, round);
    return results.slice(0, count).map(r => r.bib);
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

    // Group scores by bib
    const scoresByBib: Record<number, number[]> = {};
    for (const bib of heat.bibs) {
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
      const topBibs = await this.getTopCouples(eventId, round, 6);
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

    // For multi-dance events, check all dances; for single-dance, check the one
    const dances = await this.getDancesForScoring(eventId);
    let allSubmitted = true;
    for (const d of dances) {
      const submissionStatus = await dataService.getJudgeSubmissionStatus(eventId, round, d);
      if (!heat.judges.every(jId => submissionStatus[jId])) {
        allSubmitted = false;
        break;
      }
    }

    return { success: true, allSubmitted };
  }

  async compileJudgeScores(eventId: number, round: string): Promise<boolean> {
    const event = await dataService.getEventById(eventId);
    if (!event) return false;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return false;

    const scoringType = event.scoringType || 'standard';
    const isRecall = ['quarter-final', 'semi-final'].includes(round);
    const defaultScore = scoringType === 'proficiency' ? 0 : isRecall ? 0 : heat.bibs.length;

    const dances = await this.getDancesForScoring(eventId);

    for (const dance of dances) {
      for (const bib of heat.bibs) {
        const judgeScores = await dataService.getJudgeScores(eventId, round, bib, dance);
        const compiled = heat.judges.map(judgeId =>
          judgeScores[judgeId] !== undefined ? judgeScores[judgeId] : defaultScore,
        );
        await dataService.setScores(eventId, round, bib, compiled, dance);
      }
    }

    // Advance to next round if not final
    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(round);
    if (currentIndex < rounds.length - 1) {
      const topBibs = await this.getTopCouples(eventId, round, 6);
      await dataService.advanceToNextRound(eventId, round, topBibs);
    }

    return true;
  }
}

export const scoringService = new ScoringService();
