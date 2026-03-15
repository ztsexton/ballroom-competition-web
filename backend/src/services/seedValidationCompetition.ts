import { Person, Couple, Judge, PendingEntry } from '../types';
import { IDataService } from './data/IDataService';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

const COMP_NAME = 'Level Validation Demo [ACTIVE]';

/**
 * Seeds a competition with entry validation enabled and detailed sub-levels.
 * Creates couples with entries at various levels to demonstrate the inference-based validation.
 * Includes deliberate pending entries for admin testing.
 */
export async function seedValidationCompetition(
  ds: IDataService,
): Promise<{ competitionId: number; competitionName: string }> {
  // ── Cleanup ──────────────────────────────────────────────────────
  const existing = await ds.getCompetitions();
  for (const comp of existing) {
    if (comp.name === COMP_NAME) {
      logger.info({ competitionId: comp.id }, 'Deleting previous validation seed competition');
      await ds.deleteCompetition(comp.id);
    }
  }

  // ── Competition with detailed sub-levels and entry validation ──
  const comp = await ds.addCompetition({
    name: COMP_NAME,
    type: 'STUDIO',
    date: '2026-04-20',
    location: 'Grand Ballroom, Chicago',
    description: 'Demo competition for testing entry validation. Level restrictions are inferred from existing entries — entries outside the allowed range go to an approval queue.',
    defaultScoringType: 'standard',
    levels: [
      'Newcomer', 'Bronze 1', 'Bronze 2', 'Bronze 3', 'Bronze 4',
      'Silver 1', 'Silver 2', 'Silver 3', 'Gold',
      'Novice', 'Pre-Championship', 'Championship',
    ],
    entryValidation: {
      enabled: true,
      levelsAboveAllowed: 1,
      levelRestrictionMode: 'mainlevel',
    },
    registrationOpen: true,
    judgeSettings: { defaultCount: 3, levelOverrides: {} },
    timingSettings: {
      defaultDanceDurationSeconds: 90,
      betweenDanceSeconds: 30,
      betweenHeatSeconds: 45,
    },
    publiclyVisible: true,
    resultsPublic: false,
    allowDuplicateEntries: false,
  });
  const compId = comp.id;
  logger.info({ competitionId: compId }, 'Created validation seed competition');

  // ── People ─────────────────────────────────────────────────────
  const people: Person[] = [];

  const personDefs: Array<{ first: string; last: string; role: 'leader' | 'follower'; status: 'student' | 'professional' }> = [
    // Couple 1: Will enter Bronze events
    { first: 'Alex', last: 'Rivera', role: 'leader', status: 'professional' },
    { first: 'Sofia', last: 'Chen', role: 'follower', status: 'student' },

    // Couple 2: Will enter Bronze 3-4 events
    { first: 'Marcus', last: 'Johnson', role: 'leader', status: 'professional' },
    { first: 'Elena', last: 'Petrova', role: 'follower', status: 'student' },

    // Couple 3: Will enter Silver events
    { first: 'David', last: 'Kim', role: 'leader', status: 'professional' },
    { first: 'Mia', last: 'Tanaka', role: 'follower', status: 'student' },

    // Couple 4: Will enter Gold events
    { first: 'James', last: 'Wright', role: 'leader', status: 'professional' },
    { first: 'Aria', last: 'Lopez', role: 'follower', status: 'student' },

    // Couple 5: Will enter Newcomer
    { first: 'Ethan', last: 'Nakamura', role: 'leader', status: 'student' },
    { first: 'Chloe', last: 'Dubois', role: 'follower', status: 'student' },

    // Couple 6: Has NO entries (fresh — can enter anything)
    { first: 'Noah', last: 'Fischer', role: 'leader', status: 'student' },
    { first: 'Emma', last: 'Santos', role: 'follower', status: 'student' },

    // Couple 7: Championship level
    { first: 'Oliver', last: 'Mueller', role: 'leader', status: 'professional' },
    { first: 'Zara', last: 'Hassan', role: 'follower', status: 'student' },

    // Couple 8: Novice level
    { first: 'Sebastian', last: 'Larsson', role: 'leader', status: 'professional' },
    { first: 'Charlotte', last: 'Moreau', role: 'follower', status: 'student' },
  ];

  for (const def of personDefs) {
    const p = await ds.addPerson({
      firstName: def.first,
      lastName: def.last,
      email: `${def.first.toLowerCase()}.${def.last.toLowerCase().replace(/'/g, '')}@validation-test.example.com`,
      role: def.role,
      status: def.status,
      competitionId: compId,
    });
    people.push(p);
  }

  // ── Couples ────────────────────────────────────────────────────
  const couples: Couple[] = [];
  for (let i = 0; i < personDefs.length; i += 2) {
    const c = await ds.addCouple(people[i].id, people[i + 1].id, compId);
    if (c) couples.push(c);
  }
  logger.info({ coupleCount: couples.length }, 'Created validation couples');

  // ── Judges ─────────────────────────────────────────────────────
  const judges: Judge[] = [];
  for (const name of ['Judge Adams', 'Judge Baker', 'Judge Clark']) {
    const j = await ds.addJudge(name, compId);
    judges.push(j);
  }
  const judgeIds = judges.map(j => j.id);

  // ── Events — establish each couple's level through entries ──────
  interface EventDef {
    name: string;
    style: string;
    level: string;
    coupleIndices: number[];
  }

  const eventDefs: EventDef[] = [
    // Couple 1 (idx 0): Bronze 1 entries → inferred level = Bronze 1, allowed = all Bronze + all Silver (mainlevel +1)
    { name: 'Smooth Bronze 1 Waltz', style: 'Smooth', level: 'Bronze 1', coupleIndices: [0, 4] },
    { name: 'Smooth Bronze 2 Tango', style: 'Smooth', level: 'Bronze 2', coupleIndices: [0, 1] },

    // Couple 2 (idx 1): Bronze 3 entries → inferred level = Bronze 3, allowed = all Bronze + all Silver
    { name: 'Smooth Bronze 3 Foxtrot', style: 'Smooth', level: 'Bronze 3', coupleIndices: [1] },
    { name: 'Smooth Bronze 4 V. Waltz', style: 'Smooth', level: 'Bronze 4', coupleIndices: [1, 2] },

    // Couple 3 (idx 2): Silver entries → inferred level = Silver 1, allowed = all Silver + Gold
    { name: 'Rhythm Silver 1 Cha Cha', style: 'Rhythm', level: 'Silver 1', coupleIndices: [2, 3] },
    { name: 'Rhythm Silver 2 Rumba', style: 'Rhythm', level: 'Silver 2', coupleIndices: [2] },

    // Couple 4 (idx 3): Gold entry → inferred level = Gold, allowed = Gold + Novice
    { name: 'Latin Gold Samba', style: 'Latin', level: 'Gold', coupleIndices: [3, 6] },

    // Couple 5 (idx 4): Newcomer → inferred level = Newcomer, allowed = Newcomer + all Bronze
    { name: 'Smooth Newcomer Waltz', style: 'Smooth', level: 'Newcomer', coupleIndices: [4] },

    // Couple 7 (idx 6): Pre-Championship → inferred level = Pre-Championship, allowed = Pre-Champ + Championship
    { name: 'Latin Pre-Championship Paso', style: 'Latin', level: 'Pre-Championship', coupleIndices: [6, 7] },

    // Couple 8 (idx 7): Novice → inferred level = Novice, allowed = Novice + Pre-Championship
    { name: 'Rhythm Novice Jive', style: 'Rhythm', level: 'Novice', coupleIndices: [7] },
  ];

  for (const def of eventDefs) {
    const bibs = def.coupleIndices.map(i => couples[i].bib);
    await ds.addEvent(
      def.name,
      bibs,
      judgeIds,
      compId,
      undefined,
      undefined,
      def.level,
      def.style,
    );
    logger.info({ name: def.name, level: def.level, couples: bibs.length }, 'Created validation event');
  }

  // ── Pending entries — simulate out-of-range requests ───────────
  const pendingEntries: PendingEntry[] = [
    // Couple 5 (Newcomer) wants to enter Gold — way outside range
    {
      id: randomUUID(),
      bib: couples[4].bib,
      competitionId: compId,
      combination: { level: 'Gold', style: 'Latin', designation: 'Pro-Am' },
      reason: "Couple's current entries are at Newcomer level. Gold is outside their allowed range (Newcomer, Bronze 1, Bronze 2, Bronze 3, Bronze 4).",
      requestedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    // Couple 1 (Bronze 1-2) wants to enter Gold — outside range (Bronze+Silver only with mainlevel+1)
    {
      id: randomUUID(),
      bib: couples[0].bib,
      competitionId: compId,
      combination: { level: 'Gold', style: 'Smooth', designation: 'Pro-Am', syllabusType: 'Syllabus' },
      reason: "Couple's current entries are at Bronze 1 level. Gold is outside their allowed range (Bronze 1, Bronze 2, Bronze 3, Bronze 4, Silver 1, Silver 2, Silver 3).",
      requestedAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    },
    // Couple 8 (Novice) wants to enter Championship — needs to skip Pre-Champ
    {
      id: randomUUID(),
      bib: couples[7].bib,
      competitionId: compId,
      combination: { level: 'Championship', style: 'Rhythm' },
      reason: "Couple's current entries are at Novice level. Championship is outside their allowed range (Novice, Pre-Championship).",
      requestedAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    },
  ];

  for (const pe of pendingEntries) {
    await ds.addPendingEntry(pe);
  }

  logger.info({ competitionId: compId, events: eventDefs.length, couples: couples.length, pending: pendingEntries.length }, 'Validation seed competition created');

  return { competitionId: compId, competitionName: COMP_NAME };
}
