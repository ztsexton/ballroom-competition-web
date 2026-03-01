import { Competition, Person, Couple, Judge, Event } from '../types';
import { IDataService } from './data/IDataService';
import { ScoringService, computeAdvancementBibs } from './scoringService';
import { ScheduleService } from './schedule';
import { ROUND_CAPACITY, RECALL_ROUNDS } from '../constants/rounds';
import logger from '../utils/logger';

const COMP_NAME = 'Stardust Invitational 2026 [FINISHED]';

interface EventDef {
  name: string;
  style: string;
  level: string;
  dances?: string[];
  coupleCount: number;
  scoringType: 'standard' | 'proficiency';
  isScholarship?: boolean;
  scratchBib?: number; // 1-based index into the event's couples to scratch
  /** Custom judge rankings for the final. Each inner array is one judge's ranking of couples (by event-local index). */
  customFinalRanks?: number[][];
  /** Custom recall marks per judge. Each inner array is one judge's marks (1=recall, 0=no). */
  customRecallMarks?: number[][];
}

/**
 * Generate recall marks for a recall round.
 * Top `recallCount` couples (by base skill) get mostly 1s, the rest get mostly 0s.
 * Each judge sees a slightly different picture for realism.
 */
function generateRecallMarks(coupleCount: number, recallCount: number, judgeCount: number): number[][] {
  const marks: number[][] = [];
  for (let j = 0; j < judgeCount; j++) {
    const judgeMark: number[] = [];
    for (let c = 0; c < coupleCount; c++) {
      if (c < recallCount) {
        // Top couples: recalled by most judges, but judge j might skip one near the cut
        judgeMark.push(c === recallCount - 1 && j === judgeCount - 1 ? 0 : 1);
      } else if (c === recallCount && j < 2) {
        // One couple just below cut gets recalled by first 2 judges (creates realism)
        judgeMark.push(1);
      } else {
        judgeMark.push(0);
      }
    }
    marks.push(judgeMark);
  }
  return marks;
}

/**
 * Generate final-round judge rankings for standard scoring.
 * Base order is 1..N. Each judge applies a deterministic permutation for realism.
 */
function generateFinalRanks(coupleCount: number, judgeCount: number): number[][] {
  const ranks: number[][] = [];
  for (let j = 0; j < judgeCount; j++) {
    // Start with base ranking (1, 2, 3, ..., N)
    const base = Array.from({ length: coupleCount }, (_, i) => i + 1);
    // Apply judge-specific permutation
    switch (j % 5) {
      case 0: // Exact base order
        break;
      case 1: // Swap adjacent pairs: (1,2) -> (2,1), (3,4) -> (4,3)
        for (let i = 0; i + 1 < base.length; i += 2) {
          [base[i], base[i + 1]] = [base[i + 1], base[i]];
        }
        break;
      case 2: // Middle shuffle: swap positions 1,2 and 3,4 (0-indexed)
        if (base.length >= 4) {
          [base[1], base[2]] = [base[2], base[1]];
          [base[3], base[4 < base.length ? 4 : base.length - 1]] = [base[4 < base.length ? 4 : base.length - 1], base[3]];
        }
        break;
      case 3: // Reverse middle section
        if (base.length >= 4) {
          [base[1], base[3]] = [base[3], base[1]];
        }
        break;
      case 4: // Minor: just swap first two
        if (base.length >= 2) {
          [base[0], base[1]] = [base[1], base[0]];
        }
        break;
    }
    ranks.push(base);
  }
  return ranks;
}

/**
 * Generate proficiency scores (1-10 scale).
 * Top couple gets ~9.5, bottom gets ~7.0, with per-judge variation.
 */
function generateProficiencyScores(coupleCount: number, judgeCount: number): number[][] {
  const scores: number[][] = [];
  for (let j = 0; j < judgeCount; j++) {
    const judgeScores: number[] = [];
    for (let c = 0; c < coupleCount; c++) {
      const baseScore = 9.5 - (c * 2.5 / Math.max(coupleCount - 1, 1));
      // Per-judge variation: ±0.3
      const variation = ((j * 7 + c * 3) % 7 - 3) * 0.1;
      judgeScores.push(Math.round((baseScore + variation) * 10) / 10);
    }
    scores.push(judgeScores);
  }
  return scores;
}

/** Convert per-judge rankings into the flat scores array format that scoreEvent expects. */
function toScoreEntries(
  bibs: number[],
  perJudgeRanks: number[][],
): Array<{ judgeIndex: number; bib: number; score: number }> {
  const entries: Array<{ judgeIndex: number; bib: number; score: number }> = [];
  for (let j = 0; j < perJudgeRanks.length; j++) {
    for (let c = 0; c < bibs.length; c++) {
      entries.push({ judgeIndex: j, bib: bibs[c], score: perJudgeRanks[j][c] });
    }
  }
  return entries;
}

export async function seedFinishedCompetition(
  ds: IDataService,
  scoringService: ScoringService,
  scheduleService: ScheduleService,
): Promise<{ competitionId: number; competitionName: string }> {
  // ── Cleanup ──────────────────────────────────────────────────────
  const existing = await ds.getCompetitions();
  for (const comp of existing) {
    if (comp.name === COMP_NAME) {
      logger.info({ competitionId: comp.id }, 'Deleting previous finished seed competition');
      await ds.deleteCompetition(comp.id);
    }
  }

  // ── Competition ──────────────────────────────────────────────────
  const comp = await ds.addCompetition({
    name: COMP_NAME,
    type: 'NDCA',
    date: '2026-02-15',
    location: 'Hilton Midtown, New York',
    description: 'Fully scored demo competition for validation. All events completed with results.',
    defaultScoringType: 'standard',
    levels: ['Bronze', 'Silver', 'Gold', 'Open'],
    judgeSettings: { defaultCount: 5, levelOverrides: {} },
    timingSettings: {
      defaultDanceDurationSeconds: 90,
      betweenDanceSeconds: 30,
      betweenHeatSeconds: 45,
    },
    publiclyVisible: true,
    resultsPublic: true,
  });
  const compId = comp.id;
  logger.info({ competitionId: compId }, 'Created finished seed competition');

  // ── People ───────────────────────────────────────────────────────
  const leaders: Person[] = [];
  const followers: Person[] = [];

  const leaderNames = [
    ['James', 'Richardson'], ['Michael', 'Torres'], ['David', 'Chang'], ['Robert', 'Novak'],
    ['William', 'Santos'], ['Daniel', 'Kim'], ['Thomas', 'Weber'], ['Christopher', 'Moreau'],
    ['Andrew', 'Petrov'], ['Matthew', 'Fischer'], ['Joshua', 'Lindgren'], ['Ryan', 'Okafor'],
    ['Brandon', 'Suzuki'], ['Kevin', 'Andersen'], ['Nathan', 'Rossi'], ['Tyler', 'Bergman'],
    ['Justin', 'Choi'], ['Aaron', 'Müller'], ['Ethan', 'Nakamura'], ['Steven', 'Park'],
    ['Carlos', 'Reyes'], ['Luis', 'Fernandez'], ['Marco', 'Bianchi'], ['Pavel', 'Kovalev'],
    ['Yusuf', 'Demir'], ['Hiroki', 'Yamamoto'], ['Liam', 'O\'Brien'], ['Noah', 'Schmidt'],
    ['Alexander', 'Volkov'], ['Sebastian', 'Larsson'], ['Oliver', 'Hughes'], ['Benjamin', 'Cruz'],
    ['Lucas', 'Meyer'], ['Henry', 'Tanaka'], ['Jack', 'Singh'], ['Leo', 'Johansson'],
    ['Samuel', 'Ivanov'], ['Oscar', 'Brennan'], ['Hugo', 'Almeida'], ['Felix', 'Dubois'],
  ];

  const followerNames = [
    ['Emma', 'Hartley'], ['Sophia', 'Dubois'], ['Isabella', 'Chen'], ['Olivia', 'Kowalski'],
    ['Ava', 'Nakamura'], ['Mia', 'Bergström'], ['Charlotte', 'Romano'], ['Amelia', 'Volkov'],
    ['Harper', 'Kim'], ['Evelyn', 'Santos'], ['Ella', 'Fischer'], ['Grace', 'Lindgren'],
    ['Lily', 'Okafor'], ['Zoe', 'Andersen'], ['Nora', 'Rossi'], ['Aria', 'Suzuki'],
    ['Chloe', 'Moreau'], ['Riley', 'Choi'], ['Hannah', 'Müller'], ['Scarlett', 'Park'],
    ['Luna', 'Reyes'], ['Camila', 'Fernandez'], ['Stella', 'Bianchi'], ['Natasha', 'Kovalev'],
    ['Yuki', 'Demir'], ['Sakura', 'Yamamoto'], ['Sienna', 'O\'Brien'], ['Violet', 'Schmidt'],
    ['Elena', 'Torres'], ['Maya', 'Larsson'], ['Alice', 'Hughes'], ['Clara', 'Cruz'],
    ['Freya', 'Meyer'], ['Hana', 'Tanaka'], ['Iris', 'Singh'], ['Layla', 'Johansson'],
    ['Nina', 'Ivanov'], ['Rosa', 'Brennan'], ['Thea', 'Almeida'], ['Vera', 'Chang'],
  ];

  for (const [first, last] of leaderNames) {
    const p = await ds.addPerson({
      firstName: first,
      lastName: last,
      role: 'leader',
      status: 'student',
      competitionId: compId,
    });
    leaders.push(p);
  }

  for (const [first, last] of followerNames) {
    const p = await ds.addPerson({
      firstName: first,
      lastName: last,
      role: 'follower',
      status: 'student',
      competitionId: compId,
    });
    followers.push(p);
  }

  // ── Couples ──────────────────────────────────────────────────────
  const couples: Couple[] = [];
  for (let i = 0; i < 40; i++) {
    const c = await ds.addCouple(leaders[i].id, followers[i].id, compId);
    if (c) couples.push(c);
  }
  logger.info({ coupleCount: couples.length }, 'Created couples');

  // ── Judges ───────────────────────────────────────────────────────
  const judgeNames = ['Elena Volkov', 'Marcus Chen', 'Isabella Romano', 'Dmitri Petrov', 'Sophia Laurent'];
  const judges: Judge[] = [];
  for (const name of judgeNames) {
    const j = await ds.addJudge(name, compId);
    judges.push(j);
  }
  const judgeIds = judges.map(j => j.id);

  // ── Event definitions ────────────────────────────────────────────
  const eventDefs: EventDef[] = [
    // 1. Small final-only (5 couples, basic skating)
    { name: 'Smooth Bronze Waltz', style: 'Smooth', level: 'Bronze', coupleCount: 5, scoringType: 'standard' },
    // 2. Semi + Final (10 couples, recall + final)
    { name: 'Smooth Silver Tango', style: 'Smooth', level: 'Silver', coupleCount: 10, scoringType: 'standard' },
    // 3. Quarter + Semi + Final (18 couples, 3-round progression)
    { name: 'Smooth Gold Foxtrot', style: 'Smooth', level: 'Gold', coupleCount: 18, scoringType: 'standard' },
    // 4. Multi-dance final (Rules 9-11)
    { name: 'Smooth Open Championship', style: 'Smooth', level: 'Open', dances: ['Waltz', 'Tango', 'Foxtrot'], coupleCount: 5, scoringType: 'standard' },
    // 5. Full final at max capacity (6 couples)
    { name: 'Rhythm Bronze Cha Cha', style: 'Rhythm', level: 'Bronze', coupleCount: 6, scoringType: 'standard' },
    // 6. Tight recall cut (8 → 6)
    { name: 'Rhythm Silver Rumba', style: 'Rhythm', level: 'Silver', coupleCount: 8, scoringType: 'standard' },
    // 7. Split judges (divergent opinions)
    {
      name: 'Rhythm Gold Mambo', style: 'Rhythm', level: 'Gold', coupleCount: 5, scoringType: 'standard',
      customFinalRanks: [
        [1, 2, 3, 4, 5], // Judge 0: clear order
        [3, 1, 2, 5, 4], // Judge 1: disagrees on top
        [1, 3, 2, 4, 5], // Judge 2: close to base
        [2, 1, 4, 3, 5], // Judge 3: adjacent swaps
        [1, 2, 5, 3, 4], // Judge 4: bottom shuffled
      ],
    },
    // 8. Multi-dance with recall (CC/R/J, 8 couples → semi + final)
    { name: 'Rhythm Open Championship', style: 'Rhythm', level: 'Open', dances: ['Cha Cha', 'Rumba', 'Jive'], coupleCount: 8, scoringType: 'standard' },
    // 9. Proficiency scoring
    { name: 'Latin Bronze Samba', style: 'Latin', level: 'Bronze', coupleCount: 6, scoringType: 'proficiency' },
    // 10. Scratched couple
    { name: 'Latin Silver Paso Doble', style: 'Latin', level: 'Silver', coupleCount: 5, scoringType: 'standard', scratchBib: 5 },
    // 11. Deliberate tie (identical rank distributions for couples 2 and 3)
    {
      name: 'Latin Gold Jive', style: 'Latin', level: 'Gold', coupleCount: 6, scoringType: 'standard',
      customFinalRanks: [
        [1, 2, 3, 4, 5, 6], // Judge 0
        [1, 3, 2, 4, 5, 6], // Judge 1: swaps 2nd/3rd
        [1, 2, 3, 5, 4, 6], // Judge 2
        [1, 3, 2, 4, 6, 5], // Judge 3: swaps 2nd/3rd + 5th/6th
        [1, 2, 3, 4, 5, 6], // Judge 4: same as Judge 0
      ],
    },
    // 12. Scholarship multi-dance
    { name: 'Smooth Scholarship', style: 'Smooth', level: 'Open', dances: ['Waltz', 'Tango', 'Viennese Waltz'], coupleCount: 5, scoringType: 'standard', isScholarship: true },
  ];

  // ── Create and score events ──────────────────────────────────────
  let coupleOffset = 0;
  const createdEvents: Event[] = [];

  for (const def of eventDefs) {
    const eventBibs = couples.slice(coupleOffset, coupleOffset + def.coupleCount).map(c => c.bib);
    coupleOffset = Math.min(coupleOffset + def.coupleCount, couples.length);
    // Wrap around if we run out of unique couples (some events share couples)
    while (eventBibs.length < def.coupleCount && couples.length > 0) {
      eventBibs.push(couples[eventBibs.length % couples.length].bib);
    }

    const event = await ds.addEvent(
      def.name,
      eventBibs,
      judgeIds,
      compId,
      undefined, // designation
      undefined, // syllabusType
      def.level,
      def.style,
      def.dances,
      def.scoringType,
      def.isScholarship,
    );
    createdEvents.push(event);

    // Scratch a couple if specified
    if (def.scratchBib) {
      const bibToScratch = eventBibs[def.scratchBib - 1];
      await ds.updateEvent(event.id, {
        scratchedBibs: [bibToScratch],
      });
    }

    // Score the event through all rounds
    await scoreEvent(ds, scoringService, event, def, eventBibs);
    logger.info({ eventId: event.id, name: def.name, rounds: event.heats.length }, 'Scored event');
  }

  // ── Generate schedule and mark completed ─────────────────────────
  const schedule = await scheduleService.generateSchedule(compId, ['Smooth', 'Rhythm', 'Latin'], ['Bronze', 'Silver', 'Gold', 'Open']);

  // Mark all heats as completed
  const completedStatuses: Record<string, string> = {};
  for (const heat of schedule.heatOrder) {
    completedStatuses[heat.id] = 'completed';
  }
  schedule.heatStatuses = completedStatuses as Record<string, 'pending' | 'scoring' | 'completed'>;
  schedule.currentHeatIndex = schedule.heatOrder.length;

  await ds.saveSchedule(schedule);
  logger.info({ heatCount: schedule.heatOrder.length }, 'Generated and completed schedule');

  return { competitionId: compId, competitionName: COMP_NAME };
}

async function scoreEvent(
  ds: IDataService,
  scoringService: ScoringService,
  event: Event,
  def: EventDef,
  allBibs: number[],
): Promise<void> {
  const judgeCount = event.heats[0]?.judges.length || 5;
  const isMultiDance = def.dances && def.dances.length > 1;
  const rounds = event.heats.map(h => h.round);

  // Get bibs excluding scratched
  const scratched = new Set<number>();
  if (def.scratchBib) {
    scratched.add(allBibs[def.scratchBib - 1]);
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const isRecall = RECALL_ROUNDS.includes(round);
    const isLast = ri === rounds.length - 1;

    // Re-fetch event to get updated bibs after advancement
    const freshEvent = await ds.getEventById(event.id);
    if (!freshEvent) return;
    const heat = freshEvent.heats.find(h => h.round === round);
    if (!heat || heat.bibs.length === 0) continue;

    const activeBibs = heat.bibs.filter(b => !scratched.has(b));

    if (isMultiDance) {
      await scoreMultiDanceRound(ds, scoringService, freshEvent, round, activeBibs, def, judgeCount, isRecall, isLast);
    } else if (def.scoringType === 'proficiency') {
      await scoreProficiencyRound(ds, freshEvent.id, round, activeBibs, judgeCount);
    } else if (isRecall) {
      await scoreRecallRound(scoringService, freshEvent, round, activeBibs, judgeCount, def);
    } else {
      await scoreFinalRound(scoringService, freshEvent, round, activeBibs, judgeCount, def);
    }
  }
}

async function scoreRecallRound(
  scoringService: ScoringService,
  event: Event,
  round: string,
  bibs: number[],
  judgeCount: number,
  def: EventDef,
): Promise<void> {
  const nextRound = getNextRound(event, round);
  const recallTarget = nextRound ? (ROUND_CAPACITY[nextRound] || 6) : 6;
  const recallCount = Math.min(recallTarget, bibs.length);

  const marks = def.customRecallMarks || generateRecallMarks(bibs.length, recallCount, judgeCount);
  const entries = toScoreEntries(bibs, marks);
  await scoringService.scoreEvent(event.id, round, entries);
}

async function scoreFinalRound(
  scoringService: ScoringService,
  event: Event,
  round: string,
  bibs: number[],
  judgeCount: number,
  def: EventDef,
): Promise<void> {
  const ranks = def.customFinalRanks || generateFinalRanks(bibs.length, judgeCount);
  const entries = toScoreEntries(bibs, ranks);
  await scoringService.scoreEvent(event.id, round, entries);
}

async function scoreProficiencyRound(
  ds: IDataService,
  eventId: number,
  round: string,
  bibs: number[],
  judgeCount: number,
): Promise<void> {
  const allScores = generateProficiencyScores(bibs.length, judgeCount);
  for (let c = 0; c < bibs.length; c++) {
    const bibScores = allScores.map(judgeScores => judgeScores[c]);
    await ds.setScores(eventId, round, bibs[c], bibScores);
  }
}

async function scoreMultiDanceRound(
  ds: IDataService,
  scoringService: ScoringService,
  event: Event,
  round: string,
  bibs: number[],
  def: EventDef,
  judgeCount: number,
  isRecall: boolean,
  isLastRound: boolean,
): Promise<void> {
  const dances = def.dances!;

  for (let di = 0; di < dances.length; di++) {
    const dance = dances[di];

    if (isRecall) {
      // Recall marks per dance
      const nextRound = getNextRound(event, round);
      const recallTarget = nextRound ? (ROUND_CAPACITY[nextRound] || 6) : 6;
      const recallCount = Math.min(recallTarget, bibs.length);
      const marks = generateRecallMarks(bibs.length, recallCount, judgeCount);
      for (let c = 0; c < bibs.length; c++) {
        const bibScores = marks.map(judgeMarks => judgeMarks[c]);
        await ds.setScores(event.id, round, bibs[c], bibScores, dance);
      }
    } else {
      // Final rankings per dance — vary the base order slightly per dance for realism
      const ranks = generateFinalRanks(bibs.length, judgeCount);
      // Rotate the base order by dance index so different couples win different dances
      if (di > 0) {
        for (const judgeRank of ranks) {
          // Shift all ranks by rotating which couple is "best" per dance
          const shift = di;
          const shifted = judgeRank.map((_, idx) => {
            const newIdx = (idx + shift) % bibs.length;
            return judgeRank[newIdx];
          });
          judgeRank.splice(0, judgeRank.length, ...shifted);
        }
      }
      for (let c = 0; c < bibs.length; c++) {
        const bibScores = ranks.map(judgeRanks => judgeRanks[c]);
        await ds.setScores(event.id, round, bibs[c], bibScores, dance);
      }
    }
  }

  // Manual advancement for multi-dance (scoreEvent doesn't handle per-dance scores)
  if (!isLastRound) {
    const results = await scoringService.calculateResults(event.id, round);
    const nextRound = getNextRound(event, round);
    if (nextRound) {
      const targetCount = ROUND_CAPACITY[nextRound] || 6;
      const topBibs = computeAdvancementBibs(results, targetCount);
      await ds.advanceToNextRound(event.id, round, topBibs);
    }
  }
}

function getNextRound(event: Event, currentRound: string): string | undefined {
  const rounds = event.heats.map(h => h.round);
  const idx = rounds.indexOf(currentRound);
  return idx >= 0 && idx < rounds.length - 1 ? rounds[idx + 1] : undefined;
}
