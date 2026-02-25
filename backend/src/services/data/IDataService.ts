import {
  Competition,
  Studio,
  Organization,
  Person,
  Couple,
  Judge,
  Event,
  Heat,
  User,
  UserProfileUpdate,
  CompetitionSchedule,
  EntryPayment,
} from '../../types';

export interface IDataService {
  // Competitions
  getCompetitions(): Promise<Competition[]>;
  getCompetitionById(id: number): Promise<Competition | undefined>;
  addCompetition(competition: Omit<Competition, 'id' | 'createdAt'>): Promise<Competition>;
  updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Promise<Competition | null>;
  deleteCompetition(id: number): Promise<boolean>;
  getEntryPayments(competitionId: number): Promise<Record<string, EntryPayment>>;
  updateEntryPayments(
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    updates: { paid: boolean; paidBy?: number; notes?: string }
  ): Promise<Record<string, EntryPayment> | null>;

  // Studios
  getStudios(): Promise<Studio[]>;
  getStudioById(id: number): Promise<Studio | undefined>;
  addStudio(studio: Omit<Studio, 'id'>): Promise<Studio>;
  updateStudio(id: number, updates: Partial<Omit<Studio, 'id'>>): Promise<Studio | null>;
  deleteStudio(id: number): Promise<boolean>;

  // Organizations
  getOrganizations(): Promise<Organization[]>;
  getOrganizationById(id: number): Promise<Organization | undefined>;
  addOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization>;
  updateOrganization(id: number, updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Organization | null>;
  deleteOrganization(id: number): Promise<boolean>;

  // People
  getPeople(competitionId?: number): Promise<Person[]>;
  getPersonById(id: number): Promise<Person | undefined>;
  getPersonByEmail(email: string, competitionId: number): Promise<Person | null>;
  getPersonsByUserId(userId: string): Promise<Person[]>;
  addPerson(person: Omit<Person, 'id'>): Promise<Person>;
  updatePerson(id: number, updates: Partial<Omit<Person, 'id'>>): Promise<Person | null>;
  deletePerson(id: number): Promise<boolean>;

  // Couples
  getCouples(competitionId?: number): Promise<Couple[]>;
  getCoupleByBib(bib: number): Promise<Couple | undefined>;
  getCouplesByBibs(bibs: number[]): Promise<Map<number, Couple>>;
  addCouple(leaderId: number, followerId: number, competitionId: number): Promise<Couple | null>;
  deleteCouple(bib: number): Promise<boolean>;

  // Judges
  getJudges(competitionId?: number): Promise<Judge[]>;
  getJudgeById(id: number): Promise<Judge | undefined>;
  getJudgesByIds(ids: number[]): Promise<Map<number, Judge>>;
  addJudge(name: string, competitionId: number): Promise<Judge>;
  updateJudge(id: number, updates: Partial<Omit<Judge, 'id'>>): Promise<Judge | null>;
  deleteJudge(id: number): Promise<boolean>;

  // Events
  getEvents(competitionId?: number): Promise<Record<number, Event>>;
  getEventById(id: number): Promise<Event | undefined>;
  getEventsByIds(ids: number[]): Promise<Map<number, Event>>;
  addEvent(
    name: string,
    bibs: number[],
    judgeIds: number[],
    competitionId: number,
    designation?: string,
    syllabusType?: string,
    level?: string,
    style?: string,
    dances?: string[],
    scoringType?: 'standard' | 'proficiency',
    isScholarship?: boolean,
    ageCategory?: string
  ): Promise<Event>;
  updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null>;
  deleteEvent(id: number): Promise<boolean>;

  // Scores (dance parameter is optional — used for multi-dance events)
  getScores(eventId: number, round: string, bib: number, dance?: string): Promise<number[]>;
  getScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, number[]>>;
  setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void>;
  setScoresBatch(eventId: number, round: string, entries: Array<{ bib: number; scores: number[] }>, dance?: string): Promise<void>;
  clearScores(eventId: number, round: string, dance?: string): Promise<void>;
  hasAnyScores(eventId: number): Promise<boolean>;

  // Judge Scores (dance parameter is optional — used for multi-dance events)
  getJudgeScores(eventId: number, round: string, bib: number, dance?: string): Promise<Record<number, number>>;
  getJudgeScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, Record<number, number>>>;
  setJudgeScoresBatch(
    eventId: number,
    round: string,
    judgeId: number,
    entries: Array<{ bib: number; score: number }>,
    dance?: string
  ): Promise<void>;
  clearJudgeScores(eventId: number, round: string, dance?: string): Promise<void>;
  clearAllEventScores(eventId: number): Promise<void>;

  // Heat management
  rebuildHeats(bibs: number[], judgeIds: number[], scoringType: 'standard' | 'proficiency'): Heat[];
  getJudgeSubmissionStatus(eventId: number, round: string, dance?: string): Promise<Record<number, boolean>>;
  getJudgeSubmissionStatusBatch(
    entries: Array<{ eventId: number; round: string; dance?: string; bibs: number[] }>,
    judgeIds: number[]
  ): Promise<Record<number, boolean>>;
  advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): Promise<boolean>;

  // Users
  getUsers(): Promise<User[]>;
  getUserByUid(uid: string): Promise<User | undefined>;
  upsertUser(uid: string, email: string, displayName?: string, photoURL?: string, signInMethod?: string): Promise<User>;
  updateUserProfile(uid: string, updates: UserProfileUpdate): Promise<User | null>;
  updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null>;

  // Schedules
  getSchedule(competitionId: number): Promise<CompetitionSchedule | undefined>;
  saveSchedule(schedule: CompetitionSchedule): Promise<CompetitionSchedule>;
  deleteSchedule(competitionId: number): Promise<boolean>;

  // Cache management (no-op for non-caching implementations)
  clearCache(): void;

  // Testing
  resetAllData(): Promise<void>;
}
