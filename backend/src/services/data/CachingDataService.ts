import { IDataService } from './IDataService';
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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class EntityCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

const FIVE_MINUTES = 5 * 60 * 1000;
const TWO_MINUTES = 2 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
const THIRTY_SECONDS = 30 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

export class CachingDataService implements IDataService {
  private competitionsById = new EntityCache<Competition>(FIVE_MINUTES);
  private competitionsList = new EntityCache<Competition[]>(ONE_MINUTE);
  private couplesByBib = new EntityCache<Couple>(FIVE_MINUTES);
  private couplesByCompetition = new EntityCache<Couple[]>(ONE_MINUTE);
  private judgesById = new EntityCache<Judge>(FIVE_MINUTES);
  private judgesByCompetition = new EntityCache<Judge[]>(ONE_MINUTE);
  private eventsById = new EntityCache<Event>(TWO_MINUTES);
  private eventsByCompetition = new EntityCache<Record<number, Event>>(ONE_MINUTE);
  private usersCache = new EntityCache<User>(TEN_MINUTES);
  private schedulesCache = new EntityCache<CompetitionSchedule>(THIRTY_SECONDS);
  private studiosCache = new EntityCache<Studio[]>(FIVE_MINUTES);
  private studioById = new EntityCache<Studio>(FIVE_MINUTES);
  private orgsCache = new EntityCache<Organization[]>(FIVE_MINUTES);
  private orgById = new EntityCache<Organization>(FIVE_MINUTES);

  constructor(private inner: IDataService) {}

  private clearAll(): void {
    this.competitionsById.invalidateAll();
    this.competitionsList.invalidateAll();
    this.couplesByBib.invalidateAll();
    this.couplesByCompetition.invalidateAll();
    this.judgesById.invalidateAll();
    this.judgesByCompetition.invalidateAll();
    this.eventsById.invalidateAll();
    this.eventsByCompetition.invalidateAll();
    this.usersCache.invalidateAll();
    this.schedulesCache.invalidateAll();
    this.studiosCache.invalidateAll();
    this.studioById.invalidateAll();
    this.orgsCache.invalidateAll();
    this.orgById.invalidateAll();
  }

  // -- Competitions --

  async getCompetitions(): Promise<Competition[]> {
    const cached = this.competitionsList.get('all');
    if (cached) return cached;
    const result = await this.inner.getCompetitions();
    this.competitionsList.set('all', result);
    return result;
  }

  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const cached = this.competitionsById.get(`${id}`);
    if (cached) return cached;
    const result = await this.inner.getCompetitionById(id);
    if (result) this.competitionsById.set(`${id}`, result);
    return result;
  }

  async addCompetition(competition: Omit<Competition, 'id' | 'createdAt'>): Promise<Competition> {
    const result = await this.inner.addCompetition(competition);
    this.competitionsList.invalidateAll();
    return result;
  }

  async updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Promise<Competition | null> {
    const result = await this.inner.updateCompetition(id, updates);
    this.competitionsById.invalidate(`${id}`);
    this.competitionsList.invalidateAll();
    return result;
  }

  async deleteCompetition(id: number): Promise<boolean> {
    const result = await this.inner.deleteCompetition(id);
    this.competitionsById.invalidate(`${id}`);
    this.competitionsList.invalidateAll();
    return result;
  }

  async getEntryPayments(competitionId: number): Promise<Record<string, EntryPayment>> {
    return this.inner.getEntryPayments(competitionId);
  }

  async updateEntryPayments(
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    updates: { paid: boolean; paidBy?: number; notes?: string }
  ): Promise<Record<string, EntryPayment> | null> {
    const result = await this.inner.updateEntryPayments(competitionId, entries, updates);
    this.competitionsById.invalidate(`${competitionId}`);
    this.competitionsList.invalidateAll();
    return result;
  }

  // -- Studios --

  async getStudios(): Promise<Studio[]> {
    const cached = this.studiosCache.get('all');
    if (cached) return cached;
    const result = await this.inner.getStudios();
    this.studiosCache.set('all', result);
    return result;
  }

  async getStudioById(id: number): Promise<Studio | undefined> {
    const cached = this.studioById.get(`${id}`);
    if (cached) return cached;
    const result = await this.inner.getStudioById(id);
    if (result) this.studioById.set(`${id}`, result);
    return result;
  }

  async addStudio(studio: Omit<Studio, 'id'>): Promise<Studio> {
    const result = await this.inner.addStudio(studio);
    this.studiosCache.invalidateAll();
    return result;
  }

  async updateStudio(id: number, updates: Partial<Omit<Studio, 'id'>>): Promise<Studio | null> {
    const result = await this.inner.updateStudio(id, updates);
    this.studioById.invalidate(`${id}`);
    this.studiosCache.invalidateAll();
    return result;
  }

  async deleteStudio(id: number): Promise<boolean> {
    const result = await this.inner.deleteStudio(id);
    this.studioById.invalidate(`${id}`);
    this.studiosCache.invalidateAll();
    return result;
  }

  // -- Organizations --

  async getOrganizations(): Promise<Organization[]> {
    const cached = this.orgsCache.get('all');
    if (cached) return cached;
    const result = await this.inner.getOrganizations();
    this.orgsCache.set('all', result);
    return result;
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const cached = this.orgById.get(`${id}`);
    if (cached) return cached;
    const result = await this.inner.getOrganizationById(id);
    if (result) this.orgById.set(`${id}`, result);
    return result;
  }

  async addOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const result = await this.inner.addOrganization(org);
    this.orgsCache.invalidateAll();
    return result;
  }

  async updateOrganization(id: number, updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Organization | null> {
    const result = await this.inner.updateOrganization(id, updates);
    this.orgById.invalidate(`${id}`);
    this.orgsCache.invalidateAll();
    return result;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const result = await this.inner.deleteOrganization(id);
    this.orgById.invalidate(`${id}`);
    this.orgsCache.invalidateAll();
    return result;
  }

  // -- People (not cached — filtered queries make caching complex, and people lists are moderate-sized) --

  async getPeople(competitionId?: number): Promise<Person[]> {
    return this.inner.getPeople(competitionId);
  }

  async getPersonById(id: number): Promise<Person | undefined> {
    return this.inner.getPersonById(id);
  }

  async getPersonByEmail(email: string, competitionId: number): Promise<Person | null> {
    return this.inner.getPersonByEmail(email, competitionId);
  }

  async getPersonsByUserId(userId: string): Promise<Person[]> {
    return this.inner.getPersonsByUserId(userId);
  }

  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    return this.inner.addPerson(person);
  }

  async updatePerson(id: number, updates: Partial<Omit<Person, 'id'>>): Promise<Person | null> {
    return this.inner.updatePerson(id, updates);
  }

  async deletePerson(id: number): Promise<boolean> {
    return this.inner.deletePerson(id);
  }

  // -- Couples --

  async getCouples(competitionId?: number): Promise<Couple[]> {
    if (competitionId !== undefined) {
      const cached = this.couplesByCompetition.get(`${competitionId}`);
      if (cached) return cached;
      const result = await this.inner.getCouples(competitionId);
      this.couplesByCompetition.set(`${competitionId}`, result);
      return result;
    }
    return this.inner.getCouples();
  }

  async getCoupleByBib(bib: number): Promise<Couple | undefined> {
    const cached = this.couplesByBib.get(`${bib}`);
    if (cached) return cached;
    const result = await this.inner.getCoupleByBib(bib);
    if (result) this.couplesByBib.set(`${bib}`, result);
    return result;
  }

  async addCouple(leaderId: number, followerId: number, competitionId: number): Promise<Couple | null> {
    const result = await this.inner.addCouple(leaderId, followerId, competitionId);
    this.couplesByCompetition.invalidateAll();
    return result;
  }

  async deleteCouple(bib: number): Promise<boolean> {
    const result = await this.inner.deleteCouple(bib);
    this.couplesByBib.invalidate(`${bib}`);
    this.couplesByCompetition.invalidateAll();
    return result;
  }

  // -- Judges --

  async getJudges(competitionId?: number): Promise<Judge[]> {
    if (competitionId !== undefined) {
      const cached = this.judgesByCompetition.get(`${competitionId}`);
      if (cached) return cached;
      const result = await this.inner.getJudges(competitionId);
      this.judgesByCompetition.set(`${competitionId}`, result);
      return result;
    }
    return this.inner.getJudges();
  }

  async getJudgeById(id: number): Promise<Judge | undefined> {
    const cached = this.judgesById.get(`${id}`);
    if (cached) return cached;
    const result = await this.inner.getJudgeById(id);
    if (result) this.judgesById.set(`${id}`, result);
    return result;
  }

  async addJudge(name: string, competitionId: number): Promise<Judge> {
    const result = await this.inner.addJudge(name, competitionId);
    this.judgesByCompetition.invalidateAll();
    return result;
  }

  async updateJudge(id: number, updates: Partial<Omit<Judge, 'id'>>): Promise<Judge | null> {
    const result = await this.inner.updateJudge(id, updates);
    this.judgesById.invalidate(`${id}`);
    this.judgesByCompetition.invalidateAll();
    return result;
  }

  async deleteJudge(id: number): Promise<boolean> {
    const result = await this.inner.deleteJudge(id);
    this.judgesById.invalidate(`${id}`);
    this.judgesByCompetition.invalidateAll();
    return result;
  }

  // -- Events --

  async getEvents(competitionId?: number): Promise<Record<number, Event>> {
    if (competitionId !== undefined) {
      const cached = this.eventsByCompetition.get(`${competitionId}`);
      if (cached) return cached;
      const result = await this.inner.getEvents(competitionId);
      this.eventsByCompetition.set(`${competitionId}`, result);
      return result;
    }
    return this.inner.getEvents();
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const cached = this.eventsById.get(`${id}`);
    if (cached) return cached;
    const result = await this.inner.getEventById(id);
    if (result) this.eventsById.set(`${id}`, result);
    return result;
  }

  async addEvent(
    name: string, bibs: number[], judgeIds: number[], competitionId: number,
    designation?: string, syllabusType?: string, level?: string, style?: string,
    dances?: string[], scoringType?: 'standard' | 'proficiency',
    isScholarship?: boolean, ageCategory?: string,
  ): Promise<Event> {
    const result = await this.inner.addEvent(
      name, bibs, judgeIds, competitionId, designation, syllabusType,
      level, style, dances, scoringType, isScholarship, ageCategory,
    );
    this.eventsByCompetition.invalidateAll();
    return result;
  }

  async updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null> {
    const result = await this.inner.updateEvent(id, updates);
    this.eventsById.invalidate(`${id}`);
    this.eventsByCompetition.invalidateAll();
    return result;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await this.inner.deleteEvent(id);
    this.eventsById.invalidate(`${id}`);
    this.eventsByCompetition.invalidateAll();
    return result;
  }

  // -- Scores (NOT cached — change constantly during live scoring) --

  async getScores(eventId: number, round: string, bib: number, dance?: string): Promise<number[]> {
    return this.inner.getScores(eventId, round, bib, dance);
  }

  async getScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, number[]>> {
    return this.inner.getScoresForRound(eventId, round, bibs, dance);
  }

  async setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void> {
    return this.inner.setScores(eventId, round, bib, scores, dance);
  }

  async setScoresBatch(eventId: number, round: string, entries: Array<{ bib: number; scores: number[] }>, dance?: string): Promise<void> {
    return this.inner.setScoresBatch(eventId, round, entries, dance);
  }

  async clearScores(eventId: number, round: string, dance?: string): Promise<void> {
    return this.inner.clearScores(eventId, round, dance);
  }

  // -- Judge Scores (NOT cached) --

  async getJudgeScores(eventId: number, round: string, bib: number, dance?: string): Promise<Record<number, number>> {
    return this.inner.getJudgeScores(eventId, round, bib, dance);
  }

  async getJudgeScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, Record<number, number>>> {
    return this.inner.getJudgeScoresForRound(eventId, round, bibs, dance);
  }

  async setJudgeScoresBatch(
    eventId: number, round: string, judgeId: number,
    entries: Array<{ bib: number; score: number }>, dance?: string,
  ): Promise<void> {
    return this.inner.setJudgeScoresBatch(eventId, round, judgeId, entries, dance);
  }

  async clearJudgeScores(eventId: number, round: string, dance?: string): Promise<void> {
    return this.inner.clearJudgeScores(eventId, round, dance);
  }

  async clearAllEventScores(eventId: number): Promise<void> {
    return this.inner.clearAllEventScores(eventId);
  }

  // -- Heat management --

  rebuildHeats(bibs: number[], judgeIds: number[], scoringType: 'standard' | 'proficiency'): Heat[] {
    return this.inner.rebuildHeats(bibs, judgeIds, scoringType);
  }

  async getJudgeSubmissionStatus(eventId: number, round: string, dance?: string): Promise<Record<number, boolean>> {
    return this.inner.getJudgeSubmissionStatus(eventId, round, dance);
  }

  async getJudgeSubmissionStatusBatch(
    entries: Array<{ eventId: number; round: string; dance?: string; bibs: number[] }>,
    judgeIds: number[]
  ): Promise<Record<number, boolean>> {
    return this.inner.getJudgeSubmissionStatusBatch(entries, judgeIds);
  }

  async advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): Promise<boolean> {
    const result = await this.inner.advanceToNextRound(eventId, currentRound, topBibs);
    this.eventsById.invalidate(`${eventId}`);
    this.eventsByCompetition.invalidateAll();
    return result;
  }

  // -- Users --

  async getUsers(): Promise<User[]> {
    return this.inner.getUsers();
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    const cached = this.usersCache.get(uid);
    if (cached) return cached;
    const result = await this.inner.getUserByUid(uid);
    if (result) this.usersCache.set(uid, result);
    return result;
  }

  async upsertUser(uid: string, email: string, displayName?: string, photoURL?: string, signInMethod?: string): Promise<User> {
    const result = await this.inner.upsertUser(uid, email, displayName, photoURL, signInMethod);
    this.usersCache.set(uid, result);
    return result;
  }

  async updateUserProfile(uid: string, updates: UserProfileUpdate): Promise<User | null> {
    const result = await this.inner.updateUserProfile(uid, updates);
    this.usersCache.invalidate(uid);
    return result;
  }

  async updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null> {
    const result = await this.inner.updateUserAdmin(uid, isAdmin);
    this.usersCache.invalidate(uid);
    return result;
  }

  // -- Schedules --

  async getSchedule(competitionId: number): Promise<CompetitionSchedule | undefined> {
    const cached = this.schedulesCache.get(`${competitionId}`);
    if (cached) return cached;
    const result = await this.inner.getSchedule(competitionId);
    if (result) this.schedulesCache.set(`${competitionId}`, result);
    return result;
  }

  async saveSchedule(schedule: CompetitionSchedule): Promise<CompetitionSchedule> {
    const result = await this.inner.saveSchedule(schedule);
    this.schedulesCache.invalidate(`${schedule.competitionId}`);
    return result;
  }

  async deleteSchedule(competitionId: number): Promise<boolean> {
    const result = await this.inner.deleteSchedule(competitionId);
    this.schedulesCache.invalidate(`${competitionId}`);
    return result;
  }

  // -- Batch methods --

  async getCouplesByBibs(bibs: number[]): Promise<Map<number, Couple>> {
    const result = new Map<number, Couple>();
    const uncached: number[] = [];

    for (const bib of bibs) {
      const cached = this.couplesByBib.get(`${bib}`);
      if (cached) {
        result.set(bib, cached);
      } else {
        uncached.push(bib);
      }
    }

    if (uncached.length > 0) {
      const fetched = await this.inner.getCouplesByBibs(uncached);
      for (const [bib, couple] of fetched) {
        this.couplesByBib.set(`${bib}`, couple);
        result.set(bib, couple);
      }
    }

    return result;
  }

  async getJudgesByIds(ids: number[]): Promise<Map<number, Judge>> {
    const result = new Map<number, Judge>();
    const uncached: number[] = [];

    for (const id of ids) {
      const cached = this.judgesById.get(`${id}`);
      if (cached) {
        result.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length > 0) {
      const fetched = await this.inner.getJudgesByIds(uncached);
      for (const [id, judge] of fetched) {
        this.judgesById.set(`${id}`, judge);
        result.set(id, judge);
      }
    }

    return result;
  }

  async getEventsByIds(ids: number[]): Promise<Map<number, Event>> {
    const result = new Map<number, Event>();
    const uncached: number[] = [];

    for (const id of ids) {
      const cached = this.eventsById.get(`${id}`);
      if (cached) {
        result.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length > 0) {
      const fetched = await this.inner.getEventsByIds(uncached);
      for (const [id, event] of fetched) {
        this.eventsById.set(`${id}`, event);
        result.set(id, event);
      }
    }

    return result;
  }

  async hasAnyScores(eventId: number): Promise<boolean> {
    return this.inner.hasAnyScores(eventId);
  }

  // -- Cache management --

  clearCache(): void {
    this.clearAll();
  }

  // -- Testing --

  async resetAllData(): Promise<void> {
    await this.inner.resetAllData();
    this.clearAll();
  }
}
