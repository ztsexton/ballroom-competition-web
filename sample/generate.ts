/**
 * Sample data generator for Ballroom Competition Scorer.
 *
 * Produces a realistic "Galaxy Ballroom Classic 2026" with:
 *  - 2 studios
 *  - 1 competition
 *  - 10 judges
 *  - 200 people (mix of leaders, followers, and professionals)
 *  - 100 couples
 *  - Events covering every supported combination of style, level, designation,
 *    syllabus type, scoring type, single-dance, multi-dance, and scholarship
 *  - Varied couple counts per event to exercise all round-generation paths
 *    (final-only, semi+final, quarter+semi+final)
 *
 * Usage:
 *   npx ts-node sample/generate.ts          # writes JSON to sample/data/
 *   npx ts-node sample/generate.ts --sql    # also writes sample/seed.sql
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ────────────────────────────────────────────────────────────────────
// Constants (mirrors backend/src/constants and frontend/src/constants)
// ────────────────────────────────────────────────────────────────────

const STYLES = ['Smooth', 'Rhythm', 'Standard', 'Latin'] as const;

const DANCES_BY_STYLE: Record<string, string[]> = {
  Smooth: ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz'],
  Rhythm: ['Cha Cha', 'Rumba', 'East Coast Swing', 'Bolero', 'Mambo'],
  Standard: ['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep'],
  Latin: ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'],
};

const LEVELS = ['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'];
const DESIGNATIONS = ['Pro-Am', 'Amateur'] as const;
const SYLLABUS_TYPES = ['Syllabus', 'Open'] as const;
const SCORING_TYPES = ['standard', 'proficiency'] as const;

// Name pools
const FIRST_NAMES_MALE = [
  'James', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Paul', 'Andrew',
  'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward',
  'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Nicholas', 'Gary', 'Eric', 'Jonathan',
  'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Patrick',
  'Alexander', 'Frank', 'Raymond', 'Gregory', 'Jack', 'Dennis', 'Jerry', 'Tyler',
  'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas', 'Peter', 'Zachary',
  'Kyle', 'Noah', 'Ethan', 'Jeremy',
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Melissa',
  'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy',
  'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine',
  'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia',
  'Victoria', 'Kelly', 'Lauren', 'Christina',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Chen', 'Kim', 'Patel', 'Shah', 'Nakamura', 'Petrov',
  'Ivanov', 'Muller', 'Fischer', 'Weber',
];

const JUDGE_NAMES = [
  'Elena Volkov', 'Marcus Chen', 'Isabella Romano', 'Dmitri Petrov',
  'Sophia Laurent', 'Hiroshi Tanaka', 'Victoria Blake', 'Rafael Mendez',
  'Anastasia Kuznetsova', 'James Blackwood',
];

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

let _seed = 42;
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, n);
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function determineRounds(numCouples: number, scoringType: string): string[] {
  if (scoringType === 'proficiency') return ['final'];
  if (numCouples <= 6) return ['final'];
  if (numCouples <= 14) return ['semi-final', 'final'];
  return ['quarter-final', 'semi-final', 'final'];
}

// ────────────────────────────────────────────────────────────────────
// Data generation
// ────────────────────────────────────────────────────────────────────

const COMP_ID = 1;
const now = '2026-03-15T09:00:00.000Z';

// --- Studios ---
const studios = [
  { id: 1, name: 'Starlight Dance Academy', location: 'Chicago, IL', contactInfo: 'info@starlightdance.com' },
  { id: 2, name: 'Golden Ballroom Studio', location: 'New York, NY', contactInfo: 'hello@goldenballroom.com' },
];

// --- Competition ---
const competition = {
  id: COMP_ID,
  name: 'Galaxy Ballroom Classic 2026',
  type: 'STUDIO' as const,
  date: '2026-03-15',
  location: 'Grand Hyatt Chicago',
  studioId: 1,
  description: 'A comprehensive sample competition showcasing every supported event combination. Includes Pro-Am and Amateur divisions across all styles, levels, and scoring types.',
  judgeSettings: {
    defaultCount: 5,
    levelOverrides: {
      'Newcomer': 3,
      'Bronze': 3,
      'Championship': 7,
      'Pre-Championship': 5,
    } as Record<string, number>,
  },
  defaultScoringType: 'standard' as const,
  levels: LEVELS,
  maxCouplesPerHeat: 7,
  pricing: {
    singleDance: [
      { minEntries: 1, pricePerEntry: 95 },
      { minEntries: 6, pricePerEntry: 85 },
      { minEntries: 11, pricePerEntry: 75 },
    ],
    multiDance: {
      mode: 'flat' as const,
      flatTiers: [
        { minEntries: 1, pricePerEntry: 135 },
        { minEntries: 6, pricePerEntry: 120 },
      ],
      perDanceCountTiers: {} as Record<string, { minEntries: number; pricePerEntry: number }[]>,
    },
    scholarship: [
      { minEntries: 1, pricePerEntry: 175 },
    ],
  },
  allowDuplicateEntries: true,
  entryPayments: {} as Record<string, { paid: boolean; paidBy?: number; paidAt?: string; notes?: string }>,
  createdAt: now,
};

// --- People (200 total) ---
// 20 professionals (10 male, 10 female) — status: professional, role: both
// 90 male students (leaders)
// 90 female students (followers)
interface PersonData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'leader' | 'follower' | 'both';
  status: 'student' | 'professional';
  competitionId: number;
  studioId: number;
}

const people: PersonData[] = [];
let personId = 1;

// Professionals
for (let i = 0; i < 10; i++) {
  people.push({
    id: personId++,
    firstName: FIRST_NAMES_MALE[i],
    lastName: LAST_NAMES[i],
    email: `pro.${FIRST_NAMES_MALE[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@example.com`,
    role: 'both',
    status: 'professional',
    competitionId: COMP_ID,
    studioId: i < 5 ? 1 : 2,
  });
}
for (let i = 0; i < 10; i++) {
  people.push({
    id: personId++,
    firstName: FIRST_NAMES_FEMALE[i],
    lastName: LAST_NAMES[i + 10],
    email: `pro.${FIRST_NAMES_FEMALE[i].toLowerCase()}.${LAST_NAMES[i + 10].toLowerCase()}@example.com`,
    role: 'both',
    status: 'professional',
    competitionId: COMP_ID,
    studioId: i < 5 ? 1 : 2,
  });
}

// Student leaders (male)
for (let i = 0; i < 90; i++) {
  const fnIdx = (i + 10) % FIRST_NAMES_MALE.length;
  const lnIdx = (i + 20) % LAST_NAMES.length;
  people.push({
    id: personId++,
    firstName: FIRST_NAMES_MALE[fnIdx],
    lastName: LAST_NAMES[lnIdx],
    email: `student.l${i + 1}@example.com`,
    role: 'leader',
    status: 'student',
    competitionId: COMP_ID,
    studioId: i < 45 ? 1 : 2,
  });
}

// Student followers (female)
for (let i = 0; i < 90; i++) {
  const fnIdx = (i + 10) % FIRST_NAMES_FEMALE.length;
  const lnIdx = (i + 30) % LAST_NAMES.length;
  people.push({
    id: personId++,
    firstName: FIRST_NAMES_FEMALE[fnIdx],
    lastName: LAST_NAMES[lnIdx],
    email: `student.f${i + 1}@example.com`,
    role: 'follower',
    status: 'student',
    competitionId: COMP_ID,
    studioId: i < 45 ? 1 : 2,
  });
}

// --- Couples (100 total) ---
// Pro-Am couples: professional + student (50)
// Amateur couples: student + student (50)
interface CoupleData {
  bib: number;
  leaderId: number;
  followerId: number;
  leaderName: string;
  followerName: string;
  competitionId: number;
}

const couples: CoupleData[] = [];
let nextBib = 1;

const malePros = people.filter(p => p.status === 'professional' && (p.role === 'leader' || p.role === 'both')).slice(0, 10);
const femalePros = people.filter(p => p.status === 'professional' && (p.role === 'follower' || p.role === 'both')).slice(0, 10);
const studentLeaders = people.filter(p => p.status === 'student' && p.role === 'leader');
const studentFollowers = people.filter(p => p.status === 'student' && p.role === 'follower');

// Pro-Am couples: female student + male pro (25) and male student + female pro (25)
for (let i = 0; i < 25; i++) {
  const pro = malePros[i % malePros.length];
  const student = studentFollowers[i];
  couples.push({
    bib: nextBib++,
    leaderId: pro.id,
    followerId: student.id,
    leaderName: `${pro.firstName} ${pro.lastName}`,
    followerName: `${student.firstName} ${student.lastName}`,
    competitionId: COMP_ID,
  });
}
for (let i = 0; i < 25; i++) {
  const student = studentLeaders[i];
  const pro = femalePros[i % femalePros.length];
  couples.push({
    bib: nextBib++,
    leaderId: student.id,
    followerId: pro.id,
    leaderName: `${student.firstName} ${student.lastName}`,
    followerName: `${pro.firstName} ${pro.lastName}`,
    competitionId: COMP_ID,
  });
}

// Amateur couples: student leader + student follower (50)
for (let i = 0; i < 50; i++) {
  const leader = studentLeaders[25 + i];
  const follower = studentFollowers[25 + i];
  couples.push({
    bib: nextBib++,
    leaderId: leader.id,
    followerId: follower.id,
    leaderName: `${leader.firstName} ${leader.lastName}`,
    followerName: `${follower.firstName} ${follower.lastName}`,
    competitionId: COMP_ID,
  });
}

// --- Judges (10) ---
interface JudgeData {
  id: number;
  name: string;
  judgeNumber: number;
  competitionId: number;
}

const judges: JudgeData[] = JUDGE_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  judgeNumber: i + 1,
  competitionId: COMP_ID,
}));
const allJudgeIds = judges.map(j => j.id);

// --- Events ---
interface HeatData {
  round: string;
  bibs: number[];
  judges: number[];
}
interface EventData {
  id: number;
  name: string;
  designation: string;
  syllabusType: string;
  level: string;
  style: string;
  dances: string[];
  heats: HeatData[];
  competitionId: number;
  scoringType: 'standard' | 'proficiency';
  isScholarship: boolean;
  sectionGroupId?: string;
  sectionLetter?: string;
}

const events: EventData[] = [];
let nextEventId = 1;

const proAmBibs = couples.filter((_, i) => i < 50).map(c => c.bib);
const amateurBibs = couples.filter((_, i) => i >= 50).map(c => c.bib);

// Assign subsets of bibs to events based on level popularity
// Bigger pools for popular levels, smaller for niche ones
function assignBibs(pool: number[], count: number): number[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

function addEvent(opts: {
  designation: string;
  syllabusType: string;
  level: string;
  style: string;
  dances: string[];
  coupleCount: number;
  scoringType: 'standard' | 'proficiency';
  isScholarship: boolean;
  pool: number[];
}): void {
  const bibs = assignBibs(opts.pool, opts.coupleCount);
  if (bibs.length === 0) return;
  const scoringType = opts.scoringType;
  const rounds = determineRounds(bibs.length, scoringType);
  const danceLabel = opts.dances.length > 1
    ? opts.dances.join('/')
    : opts.dances[0];
  const name = `${opts.designation} ${opts.syllabusType} ${opts.level} ${opts.style} ${danceLabel}`;

  const judgeCount = (competition.judgeSettings.levelOverrides as Record<string, number>)[opts.level]
    ?? competition.judgeSettings.defaultCount;
  const eventJudgeIds = allJudgeIds.slice(0, Math.min(judgeCount, allJudgeIds.length));

  const heats: HeatData[] = rounds.map((round, idx) => ({
    round,
    bibs: idx === 0 ? bibs : [],
    judges: eventJudgeIds,
  }));

  events.push({
    id: nextEventId++,
    name,
    designation: opts.designation,
    syllabusType: opts.syllabusType,
    level: opts.level,
    style: opts.style,
    dances: opts.dances,
    heats,
    competitionId: COMP_ID,
    scoringType,
    isScholarship: opts.isScholarship,
  });
}

// ─── Generate events covering all combinations ──────────────────────

// 1. PRO-AM SYLLABUS — single-dance events for every style+level+dance
//    Varied couple counts to hit all round paths
const proAmCoupleCounts: Record<string, number> = {
  'Newcomer': 4,    // final only
  'Bronze': 8,      // semi+final
  'Silver': 6,      // final only
  'Gold': 5,        // final only
  'Novice': 10,     // semi+final
  'Pre-Championship': 12, // semi+final
  'Championship': 16,     // quarter+semi+final
};

for (const style of STYLES) {
  const dances = DANCES_BY_STYLE[style];
  for (const level of LEVELS) {
    // Single-dance events: pick 2-3 dances per level to keep total reasonable
    const dancesToUse = level === 'Championship'
      ? dances  // all dances at championship level
      : pickN(dances, Math.min(2, dances.length));

    for (const dance of dancesToUse) {
      addEvent({
        designation: 'Pro-Am',
        syllabusType: level === 'Championship' || level === 'Pre-Championship' ? 'Open' : 'Syllabus',
        level,
        style,
        dances: [dance],
        coupleCount: proAmCoupleCounts[level],
        scoringType: 'standard',
        isScholarship: false,
        pool: proAmBibs,
      });
    }

    // Multi-dance events at Bronze, Silver, Gold (2-3 dances per event)
    if (['Bronze', 'Silver', 'Gold'].includes(level)) {
      const multiDances = pickN(dances, Math.min(3, dances.length));
      if (multiDances.length >= 2) {
        addEvent({
          designation: 'Pro-Am',
          syllabusType: 'Syllabus',
          level,
          style,
          dances: multiDances,
          coupleCount: proAmCoupleCounts[level],
          scoringType: 'standard',
          isScholarship: false,
          pool: proAmBibs,
        });
      }
    }
  }

  // Scholarship events — one per style at Gold and Championship levels
  for (const schlLevel of ['Gold', 'Championship']) {
    addEvent({
      designation: 'Pro-Am',
      syllabusType: schlLevel === 'Championship' ? 'Open' : 'Syllabus',
      level: schlLevel,
      style,
      dances: DANCES_BY_STYLE[style].slice(0, 3),
      coupleCount: schlLevel === 'Championship' ? 16 : 6,
      scoringType: 'standard',
      isScholarship: true,
      pool: proAmBibs,
    });
  }
}

// 2. AMATEUR — events across levels for every style
const amateurCoupleCounts: Record<string, number> = {
  'Newcomer': 6,
  'Bronze': 10,
  'Silver': 8,
  'Gold': 7,
  'Novice': 12,
  'Pre-Championship': 14,
  'Championship': 18,
};

for (const style of STYLES) {
  const dances = DANCES_BY_STYLE[style];
  for (const level of LEVELS) {
    // Single-dance: 1-2 per level
    const dancesToUse = pickN(dances, level === 'Championship' ? dances.length : 1);
    for (const dance of dancesToUse) {
      addEvent({
        designation: 'Amateur',
        syllabusType: level === 'Championship' || level === 'Pre-Championship' ? 'Open' : 'Syllabus',
        level,
        style,
        dances: [dance],
        coupleCount: amateurCoupleCounts[level],
        scoringType: 'standard',
        isScholarship: false,
        pool: amateurBibs,
      });
    }

    // Multi-dance for Silver+ levels
    if (['Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'].includes(level)) {
      addEvent({
        designation: 'Amateur',
        syllabusType: level === 'Championship' || level === 'Pre-Championship' ? 'Open' : 'Syllabus',
        level,
        style,
        dances: pickN(dances, 3),
        coupleCount: amateurCoupleCounts[level],
        scoringType: 'standard',
        isScholarship: false,
        pool: amateurBibs,
      });
    }
  }
}

// 3. PROFICIENCY SCORING — a set of Pro-Am proficiency events
//    to exercise the proficiency scoring path
for (const style of STYLES) {
  for (const level of ['Newcomer', 'Bronze', 'Silver']) {
    const dances = pickN(DANCES_BY_STYLE[style], 1);
    addEvent({
      designation: 'Pro-Am',
      syllabusType: 'Syllabus',
      level,
      style,
      dances,
      coupleCount: level === 'Newcomer' ? 3 : level === 'Bronze' ? 5 : 4,
      scoringType: 'proficiency',
      isScholarship: false,
      pool: proAmBibs,
    });
  }
}

// 4. A few Amateur proficiency events too
for (const style of ['Smooth', 'Rhythm'] as const) {
  addEvent({
    designation: 'Amateur',
    syllabusType: 'Syllabus',
    level: 'Newcomer',
    style,
    dances: [DANCES_BY_STYLE[style][0]],
    coupleCount: 5,
    scoringType: 'proficiency',
    isScholarship: false,
    pool: amateurBibs,
  });
}

// 5. SECTION EVENTS — duplicate entries for pro-am (same pro, different students)
//    malePro[0] (id=1) appears in bibs: 1, 11, 21
//    malePro[1] (id=2) appears in bibs: 2, 12, 22
//    femalePro[0] (id=11) appears in bibs: 26, 36, 46

function addSectionEvent(opts: {
  designation: string;
  syllabusType: string;
  level: string;
  style: string;
  dances: string[];
  bibs: number[];
  scoringType: 'standard' | 'proficiency';
  sectionGroupId: string;
  sectionLetter: string;
}): void {
  const rounds = determineRounds(opts.bibs.length, opts.scoringType);
  const danceLabel = opts.dances.length > 1 ? opts.dances.join('/') : opts.dances[0];
  const name = `${opts.designation} ${opts.syllabusType} ${opts.level} ${opts.style} ${danceLabel} - ${opts.sectionLetter}`;

  const judgeCount = (competition.judgeSettings.levelOverrides as Record<string, number>)[opts.level]
    ?? competition.judgeSettings.defaultCount;
  const eventJudgeIds = allJudgeIds.slice(0, Math.min(judgeCount, allJudgeIds.length));

  const heats: HeatData[] = rounds.map((round, idx) => ({
    round,
    bibs: idx === 0 ? opts.bibs : [],
    judges: eventJudgeIds,
  }));

  events.push({
    id: nextEventId++,
    name,
    designation: opts.designation,
    syllabusType: opts.syllabusType,
    level: opts.level,
    style: opts.style,
    dances: opts.dances,
    heats,
    competitionId: COMP_ID,
    scoringType: opts.scoringType,
    isScholarship: false,
    sectionGroupId: opts.sectionGroupId,
    sectionLetter: opts.sectionLetter,
  });
}

// Group 1: Pro-Am Syllabus Bronze Smooth Waltz — 3 sections (malePro[0])
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Bronze', style: 'Smooth', dances: ['Waltz'], bibs: [1, 3, 4, 5], scoringType: 'standard', sectionGroupId: 'sg-sample-1', sectionLetter: 'A' });
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Bronze', style: 'Smooth', dances: ['Waltz'], bibs: [11, 6, 7, 8], scoringType: 'standard', sectionGroupId: 'sg-sample-1', sectionLetter: 'B' });
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Bronze', style: 'Smooth', dances: ['Waltz'], bibs: [21, 9, 10, 13], scoringType: 'standard', sectionGroupId: 'sg-sample-1', sectionLetter: 'C' });

// Group 2: Pro-Am Syllabus Silver Rhythm Cha Cha — 2 sections (malePro[1])
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Silver', style: 'Rhythm', dances: ['Cha Cha'], bibs: [2, 14, 15, 16, 17, 18], scoringType: 'standard', sectionGroupId: 'sg-sample-2', sectionLetter: 'A' });
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Silver', style: 'Rhythm', dances: ['Cha Cha'], bibs: [12, 19, 20, 23, 24, 25], scoringType: 'standard', sectionGroupId: 'sg-sample-2', sectionLetter: 'B' });

// Group 3: Pro-Am Syllabus Bronze Latin Rumba — 2 sections, proficiency (femalePro[0])
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Bronze', style: 'Latin', dances: ['Rumba'], bibs: [26, 27, 28, 29], scoringType: 'proficiency', sectionGroupId: 'sg-sample-3', sectionLetter: 'A' });
addSectionEvent({ designation: 'Pro-Am', syllabusType: 'Syllabus', level: 'Bronze', style: 'Latin', dances: ['Rumba'], bibs: [36, 37, 38, 39], scoringType: 'proficiency', sectionGroupId: 'sg-sample-3', sectionLetter: 'B' });

// ────────────────────────────────────────────────────────────────────
// Build JSON file structures
// ────────────────────────────────────────────────────────────────────

const competitionsJson = {
  competitions: [competition],
  next_id: 2,
};

const studiosJson = {
  studios,
  next_id: 3,
};

const peopleJson = {
  people,
  next_id: personId,
};

// couples.json is just an array
const couplesJson = couples;

const judgesJson = {
  judges,
  next_id: judges.length + 1,
};

const eventsMap: Record<number, EventData> = {};
for (const e of events) {
  eventsMap[e.id] = e;
}
const eventsJson = {
  events: eventsMap,
  scores: {} as Record<string, number[]>,
  judgeScores: {} as Record<string, Record<number, number>>,
  next_event_id: nextEventId,
  next_bib: nextBib,
};

// No schedule — the user should generate one via the UI or API
const schedulesJson = { schedules: {} };

const usersJson = { users: [] as any[] };

// ────────────────────────────────────────────────────────────────────
// Write JSON files
// ────────────────────────────────────────────────────────────────────

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'competitions.json'), JSON.stringify(competitionsJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'studios.json'), JSON.stringify(studiosJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'people.json'), JSON.stringify(peopleJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'couples.json'), JSON.stringify(couplesJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'judges.json'), JSON.stringify(judgesJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'events.json'), JSON.stringify(eventsJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'schedules.json'), JSON.stringify(schedulesJson, null, 2));
fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(usersJson, null, 2));

// Stats
const styleCounts: Record<string, number> = {};
const levelCounts: Record<string, number> = {};
const scoringCounts: Record<string, number> = {};
const designationCounts: Record<string, number> = {};
let scholarshipCount = 0;
let multiDanceCount = 0;
let semiCount = 0;
let quarterCount = 0;
let sectionEventCount = 0;

for (const e of events) {
  styleCounts[e.style] = (styleCounts[e.style] || 0) + 1;
  levelCounts[e.level] = (levelCounts[e.level] || 0) + 1;
  scoringCounts[e.scoringType] = (scoringCounts[e.scoringType] || 0) + 1;
  designationCounts[e.designation] = (designationCounts[e.designation] || 0) + 1;
  if (e.isScholarship) scholarshipCount++;
  if (e.dances.length > 1) multiDanceCount++;
  if (e.heats.some(h => h.round === 'semi-final')) semiCount++;
  if (e.heats.some(h => h.round === 'quarter-final')) quarterCount++;
  if (e.sectionGroupId) sectionEventCount++;
}

console.log('=== Sample Data Generated ===');
console.log(`  Studios: ${studios.length}`);
console.log(`  People: ${people.length}`);
console.log(`  Couples: ${couples.length} (${proAmBibs.length} Pro-Am, ${amateurBibs.length} Amateur)`);
console.log(`  Judges: ${judges.length}`);
console.log(`  Events: ${events.length}`);
console.log(`    By style: ${JSON.stringify(styleCounts)}`);
console.log(`    By level: ${JSON.stringify(levelCounts)}`);
console.log(`    By scoring: ${JSON.stringify(scoringCounts)}`);
console.log(`    By designation: ${JSON.stringify(designationCounts)}`);
console.log(`    Scholarship: ${scholarshipCount}`);
console.log(`    Multi-dance: ${multiDanceCount}`);
console.log(`    With semi-final: ${semiCount}`);
console.log(`    With quarter-final: ${quarterCount}`);
console.log(`    Section events: ${sectionEventCount}`);
console.log(`\nJSON files written to: ${dataDir}/`);

// ────────────────────────────────────────────────────────────────────
// Generate SQL seed file
// ────────────────────────────────────────────────────────────────────

if (process.argv.includes('--sql') || true) {
  const lines: string[] = [];
  const esc = (s: string | undefined | null): string =>
    s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
  const jsonVal = (obj: any): string =>
    `'${JSON.stringify(obj).replace(/'/g, "''")}'`;

  lines.push('-- ============================================================');
  lines.push('-- Galaxy Ballroom Classic 2026 — Sample Data Seed');
  lines.push('-- Generated by sample/generate.ts');
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // Studios
  lines.push('-- Studios');
  for (const s of studios) {
    lines.push(`INSERT INTO studios (id, name, location, contact_info) VALUES (${s.id}, ${esc(s.name)}, ${esc(s.location)}, ${esc(s.contactInfo)}) ON CONFLICT (id) DO NOTHING;`);
  }
  lines.push(`SELECT setval('studios_id_seq', ${studios.length});`);
  lines.push('');

  // Competition
  lines.push('-- Competition');
  const c = competition;
  lines.push(`INSERT INTO competitions (id, name, type, date, location, studio_id, description, judge_settings, default_scoring_type, levels, pricing, entry_payments, allow_duplicate_entries, created_at)`);
  lines.push(`  VALUES (${c.id}, ${esc(c.name)}, ${esc(c.type)}, ${esc(c.date)}, ${esc(c.location)}, ${c.studioId}, ${esc(c.description)}, ${jsonVal(c.judgeSettings)}, ${esc(c.defaultScoringType)}, ${jsonVal(c.levels)}, ${jsonVal(c.pricing)}, '{}', ${c.allowDuplicateEntries ?? false}, ${esc(c.createdAt)})`);
  lines.push(`  ON CONFLICT (id) DO NOTHING;`);
  lines.push(`SELECT setval('competitions_id_seq', ${c.id});`);
  lines.push('');

  // People
  lines.push('-- People');
  for (const p of people) {
    lines.push(`INSERT INTO people (id, first_name, last_name, email, role, status, competition_id, studio_id) VALUES (${p.id}, ${esc(p.firstName)}, ${esc(p.lastName)}, ${esc(p.email)}, ${esc(p.role)}, ${esc(p.status)}, ${p.competitionId}, ${p.studioId}) ON CONFLICT (id) DO NOTHING;`);
  }
  lines.push(`SELECT setval('people_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM people), ${personId - 1}));`);
  lines.push('');

  // Couples
  lines.push('-- Couples');
  for (const cp of couples) {
    lines.push(`INSERT INTO couples (bib, leader_id, follower_id, leader_name, follower_name, competition_id) VALUES (${cp.bib}, ${cp.leaderId}, ${cp.followerId}, ${esc(cp.leaderName)}, ${esc(cp.followerName)}, ${cp.competitionId}) ON CONFLICT (bib) DO NOTHING;`);
  }
  lines.push(`SELECT setval('couples_bib_seq', GREATEST((SELECT COALESCE(MAX(bib), 0) FROM couples), ${nextBib - 1}));`);
  lines.push('');

  // Judges
  lines.push('-- Judges');
  for (const j of judges) {
    lines.push(`INSERT INTO judges (id, name, judge_number, competition_id) VALUES (${j.id}, ${esc(j.name)}, ${j.judgeNumber}, ${j.competitionId}) ON CONFLICT (id) DO NOTHING;`);
  }
  lines.push(`SELECT setval('judges_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM judges), ${judges.length}));`);
  lines.push('');

  // Events
  lines.push('-- Events');
  for (const e of events) {
    if (e.sectionGroupId) {
      lines.push(`INSERT INTO events (id, name, designation, syllabus_type, level, style, dances, heats, competition_id, scoring_type, is_scholarship, section_group_id, section_letter)`);
      lines.push(`  VALUES (${e.id}, ${esc(e.name)}, ${esc(e.designation)}, ${esc(e.syllabusType)}, ${esc(e.level)}, ${esc(e.style)}, ${jsonVal(e.dances)}, ${jsonVal(e.heats)}, ${e.competitionId}, ${esc(e.scoringType)}, ${e.isScholarship}, ${esc(e.sectionGroupId)}, ${esc(e.sectionLetter)}) ON CONFLICT (id) DO NOTHING;`);
    } else {
      lines.push(`INSERT INTO events (id, name, designation, syllabus_type, level, style, dances, heats, competition_id, scoring_type, is_scholarship)`);
      lines.push(`  VALUES (${e.id}, ${esc(e.name)}, ${esc(e.designation)}, ${esc(e.syllabusType)}, ${esc(e.level)}, ${esc(e.style)}, ${jsonVal(e.dances)}, ${jsonVal(e.heats)}, ${e.competitionId}, ${esc(e.scoringType)}, ${e.isScholarship}) ON CONFLICT (id) DO NOTHING;`);
    }
  }
  lines.push(`SELECT setval('events_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM events), ${nextEventId - 1}));`);
  lines.push('');

  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- To load: psql $DATABASE_URL -f sample/seed.sql');
  lines.push('');

  const sqlPath = path.join(__dirname, 'seed.sql');
  fs.writeFileSync(sqlPath, lines.join('\n'));
  console.log(`\nSQL seed written to: ${sqlPath}`);
  console.log('  Usage: psql $DATABASE_URL -f sample/seed.sql');
}
