import { EventResult, Couple } from '../types';
import { dataService } from './dataService';

export class ScoringService {
  calculateResults(eventId: number, round: string): EventResult[] {
    const event = dataService.getEventById(eventId);
    if (!event) return [];

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return [];

    const scoringType = event.scoringType || 'standard';
    const isRecallRound = ['quarter-final', 'semi-final'].includes(round);
    const results: EventResult[] = [];

    for (const bib of heat.bibs) {
      const couple = dataService.getCoupleByBib(bib);
      if (!couple) continue;

      const scores = dataService.getScores(eventId, round, bib);
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

  getTopCouples(eventId: number, round: string, count: number = 6): number[] {
    const results = this.calculateResults(eventId, round);
    return results.slice(0, count).map(r => r.bib);
  }

  scoreEvent(
    eventId: number,
    round: string,
    scores: Array<{ judgeIndex: number; bib: number; score: number }>
  ): boolean {
    const event = dataService.getEventById(eventId);
    if (!event) return false;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return false;

    // Clear existing scores for this round
    dataService.clearScores(eventId, round);

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
      dataService.setScores(eventId, round, Number(bib), bibScores);
    }

    // Check if we need to advance to next round
    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(round);
    if (currentIndex < rounds.length - 1) {
      const topBibs = this.getTopCouples(eventId, round, 6);
      dataService.advanceToNextRound(eventId, round, topBibs);
    }

    return true;
  }
  submitJudgeScores(
    eventId: number,
    round: string,
    judgeId: number,
    scores: Array<{ bib: number; score: number }>,
  ): { success: boolean; allSubmitted: boolean } {
    const event = dataService.getEventById(eventId);
    if (!event) return { success: false, allSubmitted: false };

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return { success: false, allSubmitted: false };
    if (!heat.judges.includes(judgeId)) return { success: false, allSubmitted: false };

    dataService.setJudgeScoresBatch(eventId, round, judgeId, scores);

    const submissionStatus = dataService.getJudgeSubmissionStatus(eventId, round);
    const allSubmitted = heat.judges.every(jId => submissionStatus[jId]);

    if (allSubmitted) {
      this.compileJudgeScores(eventId, round);
    }

    return { success: true, allSubmitted };
  }

  compileJudgeScores(eventId: number, round: string): boolean {
    const event = dataService.getEventById(eventId);
    if (!event) return false;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return false;

    const scoringType = event.scoringType || 'standard';
    const isRecall = ['quarter-final', 'semi-final'].includes(round);
    const defaultScore = scoringType === 'proficiency' ? 0 : isRecall ? 0 : heat.bibs.length;

    for (const bib of heat.bibs) {
      const judgeScores = dataService.getJudgeScores(eventId, round, bib);
      const compiled = heat.judges.map(judgeId =>
        judgeScores[judgeId] !== undefined ? judgeScores[judgeId] : defaultScore,
      );
      dataService.setScores(eventId, round, bib, compiled);
    }

    // Advance to next round if not final
    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(round);
    if (currentIndex < rounds.length - 1) {
      const topBibs = this.getTopCouples(eventId, round, 6);
      dataService.advanceToNextRound(eventId, round, topBibs);
    }

    return true;
  }
}

export const scoringService = new ScoringService();
