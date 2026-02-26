import { dataService } from '../../services/dataService';
import { scoringService } from '../../services/scoringService';

describe('Scratch/Withdraw — scoring filtering', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupEvent(coupleCount: number = 4) {
    const comp = await dataService.addCompetition({
      name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01',
    });
    const bibs: number[] = [];
    for (let i = 0; i < coupleCount; i++) {
      const leader = await dataService.addPerson({
        firstName: `L${i}`, lastName: 'X', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: `F${i}`, lastName: 'X', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
      bibs.push(couple!.bib);
    }
    const judge = await dataService.addJudge('Judge A', comp.id);
    return { comp, bibs, judge };
  }

  it('calculateResults excludes scratched bibs', async () => {
    const { comp, bibs, judge } = await setupEvent(3);
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);

    // Score all bibs
    for (let i = 0; i < bibs.length; i++) {
      await dataService.setScores(event.id, 'final', bibs[i], [i + 1]);
    }

    // Scratch bib 0
    await dataService.updateEvent(event.id, { scratchedBibs: [bibs[0]] });

    const results = await scoringService.calculateResults(event.id, 'final');
    const resultBibs = results.map(r => r.bib);

    expect(resultBibs).not.toContain(bibs[0]);
    expect(resultBibs).toContain(bibs[1]);
    expect(resultBibs).toContain(bibs[2]);
  });

  it('calculateResults includes non-scratched bibs normally', async () => {
    const { comp, bibs, judge } = await setupEvent(3);
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);

    for (let i = 0; i < bibs.length; i++) {
      await dataService.setScores(event.id, 'final', bibs[i], [i + 1]);
    }

    // No scratches
    const results = await scoringService.calculateResults(event.id, 'final');
    expect(results).toHaveLength(3);
  });

  it('getTopCouples (advancement) excludes scratched bibs', async () => {
    const { comp, bibs, judge } = await setupEvent(4);
    // 4 couples → only final round (≤6 couples)
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);

    // Score all in final
    for (let i = 0; i < bibs.length; i++) {
      await dataService.setScores(event.id, 'final', bibs[i], [i + 1]);
    }

    // Scratch bib[0] (the top scorer)
    await dataService.updateEvent(event.id, { scratchedBibs: [bibs[0]] });

    const topBibs = await scoringService.getTopCouples(event.id, 'final', 2);
    expect(topBibs).not.toContain(bibs[0]);
    expect(topBibs).toHaveLength(2);
  });

  it('compileJudgeScores skips scratched bibs', async () => {
    const { comp, bibs, judge } = await setupEvent(3);
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);

    // Submit judge scores for all bibs
    for (const bib of bibs) {
      await dataService.setJudgeScoresBatch(event.id, 'final', judge.id, [{ bib, score: 1 }]);
    }

    // Scratch bib[0]
    await dataService.updateEvent(event.id, { scratchedBibs: [bibs[0]] });

    await scoringService.compileJudgeScores(event.id, 'final');

    // Compiled scores should not include scratched bib
    const scratchedScores = await dataService.getScores(event.id, 'final', bibs[0]);
    const activeScores = await dataService.getScores(event.id, 'final', bibs[1]);

    expect(scratchedScores).toEqual([]);
    expect(activeScores).toHaveLength(1);
  });

  it('submitJudgeScores allSubmitted ignores scratched bibs', async () => {
    const { comp, bibs, judge } = await setupEvent(3);
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);

    // Scratch bib[2]
    await dataService.updateEvent(event.id, { scratchedBibs: [bibs[2]] });

    // Submit scores only for active bibs
    const result = await scoringService.submitJudgeScores(
      event.id, 'final', judge.id,
      [{ bib: bibs[0], score: 1 }, { bib: bibs[1], score: 2 }],
    );

    expect(result.success).toBe(true);
    expect(result.allSubmitted).toBe(true);
  });

  it('full workflow: scratch after semi, advance, final excludes scratched bib', async () => {
    const { comp, bibs, judge } = await setupEvent(10);
    // 10 couples → semi-final + final
    const event = await dataService.addEvent('Waltz', bibs, [judge.id], comp.id);
    expect(event.heats).toHaveLength(2);
    expect(event.heats[0].round).toBe('semi-final');

    // Score semi-final (recall marks)
    for (const bib of bibs) {
      await dataService.setScores(event.id, 'semi-final', bib, [1]); // all get 1 recall mark
    }

    // Scratch bib[0] — they were scored in semi but should be excluded going forward
    await dataService.updateEvent(event.id, { scratchedBibs: [bibs[0]] });

    // Advance: scratched bib should be excluded from top couples
    const topBibs = await scoringService.getTopCouples(event.id, 'semi-final', 6);
    expect(topBibs).not.toContain(bibs[0]);

    // Advance remaining bibs to final
    await dataService.advanceToNextRound(event.id, 'semi-final', topBibs);

    // Verify final bibs don't include scratched
    const updatedEvent = await dataService.getEventById(event.id);
    expect(updatedEvent!.heats[1].bibs).not.toContain(bibs[0]);

    // Score final for advanced bibs
    for (let i = 0; i < topBibs.length; i++) {
      await dataService.setScores(event.id, 'final', topBibs[i], [i + 1]);
    }

    // Results should not include scratched bib
    const finalResults = await scoringService.calculateResults(event.id, 'final');
    expect(finalResults.map(r => r.bib)).not.toContain(bibs[0]);
  });
});
