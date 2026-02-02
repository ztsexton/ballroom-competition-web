import {
  Competition,
  Studio,
  Person,
  Couple,
  Judge,
  Event,
  Heat,
  User,
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
  addCouple(leaderId: number, followerId: number, competitionId: number): Promise<Couple | null>;
  deleteCouple(bib: number): Promise<boolean>;

  // Judges
  getJudges(competitionId?: number): Promise<Judge[]>;
  getJudgeById(id: number): Promise<Judge | undefined>;
  addJudge(name: string, competitionId: number): Promise<Judge>;
  deleteJudge(id: number): Promise<boolean>;

  // Events
  getEvents(competitionId?: number): Promise<Record<number, Event>>;
  getEventById(id: number): Promise<Event | undefined>;
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
    isScholarship?: boolean
  ): Promise<Event>;
  updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null>;
  deleteEvent(id: number): Promise<boolean>;

  // Scores (dance parameter is optional — used for multi-dance events)
  getScores(eventId: number, round: string, bib: number, dance?: string): Promise<number[]>;
  setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void>;
  clearScores(eventId: number, round: string, dance?: string): Promise<void>;

  // Judge Scores (dance parameter is optional — used for multi-dance events)
  getJudgeScores(eventId: number, round: string, bib: number, dance?: string): Promise<Record<number, number>>;
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
  advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): Promise<boolean>;

  // Users
  getUsers(): Promise<User[]>;
  getUserByUid(uid: string): Promise<User | undefined>;
  upsertUser(uid: string, email: string, displayName?: string, photoURL?: string): Promise<User>;
  updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null>;

  // Schedules
  getSchedule(competitionId: number): Promise<CompetitionSchedule | undefined>;
  saveSchedule(schedule: CompetitionSchedule): Promise<CompetitionSchedule>;
  deleteSchedule(competitionId: number): Promise<boolean>;

  // Testing
  resetAllData(): Promise<void>;
}
