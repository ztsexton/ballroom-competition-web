import fs from 'fs';
import path from 'path';
import { AppData, Person, Couple, Judge, JudgeProfile, Event, Heat, Competition, CompetitionAdmin, Studio, Organization, User, UserProfileUpdate, CompetitionSchedule, EntryPayment, PendingEntry, SiteSettings } from '../../types';
import { IDataService } from './IDataService';
import { determineRounds, getScoreKey } from './helpers';
import logger from '../../utils/logger';

const DATA_DIR = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '../../../data-test')
  : path.join(__dirname, '../../../data');
const COMPETITIONS_FILE = path.join(DATA_DIR, 'competitions.json');
const STUDIOS_FILE = path.join(DATA_DIR, 'studios.json');
const PEOPLE_FILE = path.join(DATA_DIR, 'people.json');
const COUPLES_FILE = path.join(DATA_DIR, 'couples.json');
const JUDGES_FILE = path.join(DATA_DIR, 'judges.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORGANIZATIONS_FILE = path.join(DATA_DIR, 'organizations.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const COMPETITION_ADMINS_FILE = path.join(DATA_DIR, 'competition_admins.json');
const SITE_SETTINGS_FILE = path.join(DATA_DIR, 'site_settings.json');
const JUDGE_PROFILES_FILE = path.join(DATA_DIR, 'judge_profiles.json');

const ADMIN_EMAIL = 'zsexton2011@gmail.com';

// Suppress error logging during tests (files may be in flux during concurrent test runs)
const logError = (message: string, error: unknown) => {
  logger.error({ err: error }, message);
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class JsonDataService implements IDataService {
  private data: AppData;
  private competitionAdmins: CompetitionAdmin[];
  private siteSettings: SiteSettings;

  constructor() {
    this.data = this.loadAllData();
    this.competitionAdmins = this.loadCompetitionAdmins();
    this.siteSettings = this.loadSiteSettings();
  }

  private loadAllData(): AppData {
    return {
      competitions: this.loadCompetitions(),
      studios: this.loadStudios(),
      people: this.loadPeople(),
      couples: this.loadCouples(),
      judges: this.loadJudges(),
      events: this.loadEvents(),
      scores: this.loadScores(),
      judgeScores: this.loadJudgeScores(),
      users: this.loadUsers(),
      schedules: this.loadSchedules(),
      nextCompetitionId: this.getNextId(this.loadCompetitions()),
      nextStudioId: this.getNextId(this.loadStudios()),
      organizations: this.loadOrganizations(),
      nextOrganizationId: this.getNextId(this.loadOrganizations()),
      nextPersonId: this.getNextId(this.loadPeople()),
      nextBib: this.getNextBib(this.loadCouples()),
      nextCoupleId: this.getNextCoupleId(this.loadCouples()),
      nextJudgeId: this.getNextId(this.loadJudges()),
      nextEventId: this.getNextEventId(this.loadEvents()),
      judgeProfiles: this.loadJudgeProfiles(),
      nextJudgeProfileId: this.getNextId(this.loadJudgeProfiles()),
    };
  }

  private loadCompetitions(): Competition[] {
    try {
      if (fs.existsSync(COMPETITIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(COMPETITIONS_FILE, 'utf-8'));
        return data.competitions || [];
      }
    } catch (error) {
      logError('Error loading competitions:', error);
    }
    return [];
  }

  private loadStudios(): Studio[] {
    try {
      if (fs.existsSync(STUDIOS_FILE)) {
        const data = JSON.parse(fs.readFileSync(STUDIOS_FILE, 'utf-8'));
        return data.studios || [];
      }
    } catch (error) {
      logError('Error loading studios:', error);
    }
    return [];
  }

  private loadOrganizations(): Organization[] {
    try {
      if (fs.existsSync(ORGANIZATIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(ORGANIZATIONS_FILE, 'utf-8'));
        return data.organizations || [];
      }
    } catch (error) {
      logError('Error loading organizations:', error);
    }
    return [];
  }

  private loadPeople(): Person[] {
    try {
      if (fs.existsSync(PEOPLE_FILE)) {
        const data = JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf-8'));
        return data.people || [];
      }
    } catch (error) {
      logError('Error loading people:', error);
    }
    return [];
  }

  private loadCouples(): Couple[] {
    try {
      if (fs.existsSync(COUPLES_FILE)) {
        return JSON.parse(fs.readFileSync(COUPLES_FILE, 'utf-8'));
      }
    } catch (error) {
      logError('Error loading couples:', error);
    }
    return [];
  }

  private loadJudges(): Judge[] {
    try {
      if (fs.existsSync(JUDGES_FILE)) {
        const data = JSON.parse(fs.readFileSync(JUDGES_FILE, 'utf-8'));
        return data.judges || [];
      }
    } catch (error) {
      logError('Error loading judges:', error);
    }
    return [];
  }

  private loadEvents(): Record<number, Event> {
    try {
      if (fs.existsSync(EVENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
        return data.events || {};
      }
    } catch (error) {
      logError('Error loading events:', error);
    }
    return {};
  }

  private loadScores(): Record<string, number[]> {
    try {
      if (fs.existsSync(EVENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
        return data.scores || {};
      }
    } catch (error) {
      logError('Error loading scores:', error);
    }
    return {};
  }

  private loadJudgeScores(): Record<string, Record<number, number>> {
    try {
      if (fs.existsSync(EVENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
        return data.judgeScores || {};
      }
    } catch (error) {
      logError('Error loading judge scores:', error);
    }
    return {};
  }

  private loadUsers(): User[] {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        return data.users || [];
      }
    } catch (error) {
      logError('Error loading users:', error);
    }
    return [];
  }

  private loadSchedules(): Record<number, CompetitionSchedule> {
    try {
      if (fs.existsSync(SCHEDULES_FILE)) {
        const data = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
        const schedules = data.schedules || {};
        for (const key of Object.keys(schedules)) {
          if (!schedules[key].heatOrder) {
            delete schedules[key];
          }
        }
        return schedules;
      }
    } catch (error) {
      logError('Error loading schedules:', error);
    }
    return {};
  }

  private getNextId(items: Array<{ id: number }>): number {
    if (items.length === 0) return 1;
    return Math.max(...items.map(item => item.id)) + 1;
  }

  private getNextBib(couples: Couple[]): number {
    if (couples.length === 0) return 1;
    return Math.max(...couples.map(c => c.bib)) + 1;
  }

  private getNextCoupleId(couples: Couple[]): number {
    if (couples.length === 0) return 1;
    return Math.max(...couples.map(c => c.id ?? c.bib)) + 1;
  }

  private getNextEventId(events: Record<number, Event>): number {
    const ids = Object.keys(events).map(Number);
    if (ids.length === 0) return 1;
    return Math.max(...ids) + 1;
  }

  private saveCompetitions(): void {
    const data = { competitions: this.data.competitions, next_id: this.data.nextCompetitionId };
    fs.writeFileSync(COMPETITIONS_FILE, JSON.stringify(data, null, 2));
  }

  private saveStudios(): void {
    const data = { studios: this.data.studios, next_id: this.data.nextStudioId };
    fs.writeFileSync(STUDIOS_FILE, JSON.stringify(data, null, 2));
  }

  private saveOrganizations(): void {
    const data = { organizations: this.data.organizations, next_id: this.data.nextOrganizationId };
    fs.writeFileSync(ORGANIZATIONS_FILE, JSON.stringify(data, null, 2));
  }

  private savePeople(): void {
    const data = { people: this.data.people, next_id: this.data.nextPersonId };
    fs.writeFileSync(PEOPLE_FILE, JSON.stringify(data, null, 2));
  }

  private saveCouples(): void {
    fs.writeFileSync(COUPLES_FILE, JSON.stringify(this.data.couples, null, 2));
  }

  private saveJudges(): void {
    const data = { judges: this.data.judges, next_id: this.data.nextJudgeId };
    fs.writeFileSync(JUDGES_FILE, JSON.stringify(data, null, 2));
  }

  private saveEvents(): void {
    const data = {
      events: this.data.events,
      scores: this.data.scores,
      judgeScores: this.data.judgeScores,
      next_event_id: this.data.nextEventId,
      next_bib: this.data.nextBib,
    };
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
  }

  private saveUsers(): void {
    const data = { users: this.data.users };
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  }

  private saveSchedules(): void {
    const data = { schedules: this.data.schedules };
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2));
  }

  private loadCompetitionAdmins(): CompetitionAdmin[] {
    try {
      if (fs.existsSync(COMPETITION_ADMINS_FILE)) {
        const data = JSON.parse(fs.readFileSync(COMPETITION_ADMINS_FILE, 'utf-8'));
        return data.competitionAdmins || [];
      }
    } catch (error) {
      logError('Error loading competition admins:', error);
    }
    return [];
  }

  private saveCompetitionAdmins(): void {
    const data = { competitionAdmins: this.competitionAdmins };
    fs.writeFileSync(COMPETITION_ADMINS_FILE, JSON.stringify(data, null, 2));
  }

  private loadJudgeProfiles(): JudgeProfile[] {
    try {
      if (fs.existsSync(JUDGE_PROFILES_FILE)) {
        const data = JSON.parse(fs.readFileSync(JUDGE_PROFILES_FILE, 'utf-8'));
        return data.judgeProfiles || [];
      }
    } catch (error) {
      logError('Error loading judge profiles:', error);
    }
    return [];
  }

  private saveJudgeProfiles(): void {
    const data = { judgeProfiles: this.data.judgeProfiles, next_id: this.data.nextJudgeProfileId };
    fs.writeFileSync(JUDGE_PROFILES_FILE, JSON.stringify(data, null, 2));
  }

  private loadSiteSettings(): SiteSettings {
    try {
      if (fs.existsSync(SITE_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SITE_SETTINGS_FILE, 'utf-8'));
      }
    } catch (error) {
      logError('Error loading site settings:', error);
    }
    return {};
  }

  private saveSiteSettings(): void {
    fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(this.siteSettings, null, 2));
  }

  // Competition methods
  async getCompetitions(): Promise<Competition[]> {
    return this.data.competitions;
  }

  async getCompetitionById(id: number): Promise<Competition | undefined> {
    return this.data.competitions.find(c => c.id === id);
  }

  async addCompetition(competition: Omit<Competition, 'id' | 'createdAt'>): Promise<Competition> {
    const newCompetition: Competition = {
      ...competition,
      id: this.data.nextCompetitionId++,
      createdAt: new Date().toISOString(),
    };
    this.data.competitions.push(newCompetition);
    this.saveCompetitions();

    // Auto-add creator as competition admin
    if (competition.createdBy) {
      await this.addCompetitionAdmin(newCompetition.id, competition.createdBy);
    }

    return newCompetition;
  }

  async updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Promise<Competition | null> {
    const competition = this.data.competitions.find(c => c.id === id);
    if (!competition) return null;
    Object.assign(competition, updates);
    this.saveCompetitions();
    return competition;
  }

  private entryPaymentsMap: Map<number, Record<string, EntryPayment>> = new Map();

  async getEntryPayments(competitionId: number): Promise<Record<string, EntryPayment>> {
    return this.entryPaymentsMap.get(competitionId) || {};
  }

  async updateEntryPayments(
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    updates: { paid: boolean; paidBy?: number; notes?: string }
  ): Promise<Record<string, EntryPayment> | null> {
    const competition = this.data.competitions.find(c => c.id === competitionId);
    if (!competition) return null;
    const payments = this.entryPaymentsMap.get(competitionId) || {};
    const result: Record<string, EntryPayment> = {};
    for (const { eventId, bib } of entries) {
      const key = `${eventId}:${bib}`;
      const existing = payments[key] || { paid: false };
      existing.paid = updates.paid;
      if (updates.paidBy !== undefined) existing.paidBy = updates.paidBy;
      if (updates.notes !== undefined) existing.notes = updates.notes;
      if (existing.paid && !existing.paidAt) {
        existing.paidAt = new Date().toISOString();
      }
      if (!existing.paid) {
        delete existing.paidAt;
        delete existing.paidBy;
      }
      payments[key] = existing;
      result[key] = existing;
    }
    this.entryPaymentsMap.set(competitionId, payments);
    return result;
  }

  async deleteCompetition(id: number): Promise<boolean> {
    const initialLength = this.data.competitions.length;
    this.data.competitions = this.data.competitions.filter(c => c.id !== id);
    if (this.data.competitions.length < initialLength) {
      this.data.people = this.data.people.filter(p => p.competitionId !== id);
      this.data.couples = this.data.couples.filter(c => c.competitionId !== id);
      this.data.judges = this.data.judges.filter(j => j.competitionId !== id);
      Object.keys(this.data.events).forEach(key => {
        const eventId = Number(key);
        if (this.data.events[eventId].competitionId === id) {
          delete this.data.events[eventId];
        }
      });
      delete this.data.schedules[id];
      this.saveCompetitions();
      this.savePeople();
      this.saveCouples();
      this.saveJudges();
      this.saveEvents();
      this.saveSchedules();
      return true;
    }
    return false;
  }

  // Event Entries methods (backed by heats JSONB in JSON backend)
  async getEventEntries(eventId: number): Promise<Array<{ bib: number; scratched: boolean }>> {
    const event = this.data.events[eventId];
    if (!event) return [];
    const bibs = event.heats[0]?.bibs || [];
    const scratchedSet = new Set(event.scratchedBibs || []);
    return bibs.map(bib => ({ bib, scratched: scratchedSet.has(bib) }));
  }

  async getEntriesForBib(competitionId: number, bib: number): Promise<Array<{ eventId: number; scratched: boolean }>> {
    const result: Array<{ eventId: number; scratched: boolean }> = [];
    for (const event of Object.values(this.data.events)) {
      if (event.competitionId !== competitionId) continue;
      if (event.heats[0]?.bibs.includes(bib)) {
        const scratched = (event.scratchedBibs || []).includes(bib);
        result.push({ eventId: event.id, scratched });
      }
    }
    return result;
  }

  async addEventEntry(eventId: number, bib: number, _competitionId: number, _coupleId?: number): Promise<void> {
    const event = this.data.events[eventId];
    if (!event || event.heats.length === 0) return;
    const firstHeat = event.heats[0];
    if (!firstHeat.bibs.includes(bib)) {
      firstHeat.bibs.push(bib);
      this.saveEvents();
    }
  }

  async removeEventEntry(eventId: number, bib: number): Promise<void> {
    const event = this.data.events[eventId];
    if (!event || event.heats.length === 0) return;
    const firstHeat = event.heats[0];
    firstHeat.bibs = firstHeat.bibs.filter(b => b !== bib);
    this.saveEvents();
  }

  async scratchEntry(eventId: number, bib: number): Promise<void> {
    const event = this.data.events[eventId];
    if (!event) return;
    if (!event.scratchedBibs) event.scratchedBibs = [];
    if (!event.scratchedBibs.includes(bib)) {
      event.scratchedBibs.push(bib);
      this.saveEvents();
    }
  }

  async unscratchEntry(eventId: number, bib: number): Promise<void> {
    const event = this.data.events[eventId];
    if (!event) return;
    if (event.scratchedBibs) {
      event.scratchedBibs = event.scratchedBibs.filter(b => b !== bib);
      this.saveEvents();
    }
  }

  // Pending Entries methods (backed by in-memory pendingEntries array per competition)
  private pendingEntries: Map<number, PendingEntry[]> = new Map();

  async getPendingEntries(competitionId: number): Promise<PendingEntry[]> {
    return this.pendingEntries.get(competitionId) || [];
  }

  async addPendingEntry(entry: PendingEntry): Promise<PendingEntry> {
    const entries = this.pendingEntries.get(entry.competitionId) || [];
    entries.push(entry);
    this.pendingEntries.set(entry.competitionId, entries);
    return entry;
  }

  async removePendingEntry(id: string): Promise<boolean> {
    for (const [compId, entries] of this.pendingEntries) {
      const idx = entries.findIndex(e => e.id === id);
      if (idx !== -1) {
        entries.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  // Studio methods
  async getStudios(): Promise<Studio[]> {
    return this.data.studios;
  }

  async getStudioById(id: number): Promise<Studio | undefined> {
    return this.data.studios.find(s => s.id === id);
  }

  async addStudio(studio: Omit<Studio, 'id'>): Promise<Studio> {
    const newStudio: Studio = {
      ...studio,
      id: this.data.nextStudioId++,
    };
    this.data.studios.push(newStudio);
    this.saveStudios();
    return newStudio;
  }

  async updateStudio(id: number, updates: Partial<Omit<Studio, 'id'>>): Promise<Studio | null> {
    const studio = this.data.studios.find(s => s.id === id);
    if (!studio) return null;
    Object.assign(studio, updates);
    this.saveStudios();
    return studio;
  }

  async deleteStudio(id: number): Promise<boolean> {
    const initialLength = this.data.studios.length;
    this.data.studios = this.data.studios.filter(s => s.id !== id);
    if (this.data.studios.length < initialLength) {
      this.saveStudios();
      return true;
    }
    return false;
  }

  // Organization methods
  async getOrganizations(): Promise<Organization[]> {
    return this.data.organizations;
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    return this.data.organizations.find(o => o.id === id);
  }

  async addOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const now = new Date().toISOString();
    const newOrg: Organization = {
      ...org,
      id: this.data.nextOrganizationId++,
      createdAt: now,
      updatedAt: now,
    };
    this.data.organizations.push(newOrg);
    this.saveOrganizations();
    return newOrg;
  }

  async updateOrganization(id: number, updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Organization | null> {
    const org = this.data.organizations.find(o => o.id === id);
    if (!org) return null;
    Object.assign(org, updates);
    org.updatedAt = new Date().toISOString();
    this.saveOrganizations();
    return org;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const initialLength = this.data.organizations.length;
    this.data.organizations = this.data.organizations.filter(o => o.id !== id);
    if (this.data.organizations.length < initialLength) {
      this.saveOrganizations();
      return true;
    }
    return false;
  }

  // People methods
  async getPeople(competitionId?: number): Promise<Person[]> {
    if (competitionId !== undefined) {
      return this.data.people.filter(p => p.competitionId === competitionId);
    }
    return this.data.people;
  }

  async getPersonById(id: number): Promise<Person | undefined> {
    return this.data.people.find(p => p.id === id);
  }

  async getPersonByEmail(email: string, competitionId: number): Promise<Person | null> {
    return this.data.people.find(p =>
      p.email?.toLowerCase() === email.toLowerCase() && p.competitionId === competitionId
    ) || null;
  }

  async getPersonsByUserId(userId: string): Promise<Person[]> {
    return this.data.people.filter(p => p.userId === userId);
  }

  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const newPerson: Person = {
      ...person,
      id: this.data.nextPersonId++,
    };
    this.data.people.push(newPerson);
    this.savePeople();
    return newPerson;
  }

  async updatePerson(id: number, updates: Partial<Omit<Person, 'id'>>): Promise<Person | null> {
    const person = this.data.people.find(p => p.id === id);
    if (!person) return null;
    Object.assign(person, updates);
    this.savePeople();
    return person;
  }

  async deletePerson(id: number): Promise<boolean> {
    const initialLength = this.data.people.length;
    this.data.people = this.data.people.filter(p => p.id !== id);
    if (this.data.people.length < initialLength) {
      this.savePeople();
      return true;
    }
    return false;
  }

  // Couples methods
  async getCouples(competitionId?: number): Promise<Couple[]> {
    if (competitionId !== undefined) {
      return this.data.couples.filter(c => c.competitionId === competitionId);
    }
    return this.data.couples;
  }

  async getCoupleByBib(bib: number): Promise<Couple | undefined> {
    return this.data.couples.find(c => c.bib === bib);
  }

  async getCouplesByBibs(bibs: number[]): Promise<Map<number, Couple>> {
    const bibSet = new Set(bibs);
    const map = new Map<number, Couple>();
    for (const couple of this.data.couples) {
      if (bibSet.has(couple.bib)) {
        map.set(couple.bib, couple);
      }
    }
    return map;
  }

  async addCouple(leaderId: number, followerId: number, competitionId: number): Promise<Couple | null> {
    const leader = await this.getPersonById(leaderId);
    const follower = await this.getPersonById(followerId);
    if (!leader || !follower) return null;

    const leaderName = leader.firstName + (leader.lastName ? ' ' + leader.lastName : '');
    const followerName = follower.firstName + (follower.lastName ? ' ' + follower.lastName : '');

    // Assign bib from leader — if leader doesn't have one yet, assign one
    let bibNumber = leader.bib;
    if (bibNumber === undefined || bibNumber === null) {
      bibNumber = await this.assignBib(competitionId, leader.status);
      leader.bib = bibNumber;
      this.savePeople();
    }
    const newCouple: Couple = {
      id: this.data.nextCoupleId++,
      bib: bibNumber,
      leaderId,
      followerId,
      leaderName,
      followerName,
      competitionId,
    };
    this.data.couples.push(newCouple);
    this.saveCouples();
    this.saveEvents(); // Save nextBib/nextCoupleId
    return newCouple;
  }

  async updateCouple(bib: number, updates: Partial<Pick<Couple, 'billTo'>>): Promise<Couple | null> {
    const couple = this.data.couples.find(c => c.bib === bib);
    if (!couple) return null;
    if (updates.billTo !== undefined) {
      couple.billTo = updates.billTo || undefined;
    }
    this.saveCouples();
    return couple;
  }

  async deleteCouple(bib: number): Promise<boolean> {
    const initialLength = this.data.couples.length;
    this.data.couples = this.data.couples.filter(c => c.bib !== bib);
    if (this.data.couples.length < initialLength) {
      this.saveCouples();
      return true;
    }
    return false;
  }

  // Couple by ID
  async getCoupleById(id: number): Promise<Couple | undefined> {
    return this.data.couples.find(c => c.id === id);
  }

  async updateCoupleById(id: number, updates: Partial<Pick<Couple, 'billTo'>>): Promise<Couple | null> {
    const couple = this.data.couples.find(c => c.id === id);
    if (!couple) return null;
    if (updates.billTo !== undefined) {
      couple.billTo = updates.billTo || undefined;
    }
    this.saveCouples();
    return couple;
  }

  async deleteCoupleById(id: number): Promise<boolean> {
    const initialLength = this.data.couples.length;
    this.data.couples = this.data.couples.filter(c => c.id !== id);
    if (this.data.couples.length < initialLength) {
      this.saveCouples();
      return true;
    }
    return false;
  }

  // Bib assignment
  async assignBib(competitionId: number, personStatus: 'student' | 'professional'): Promise<number> {
    const competition = this.data.competitions.find(c => c.id === competitionId);
    if (!competition) throw new Error(`Competition ${competitionId} not found`);

    const bibSettings = competition.bibSettings;
    let startNumber = 1;
    let endNumber: number | undefined;

    if (bibSettings && bibSettings.ranges.length > 0) {
      const range = bibSettings.ranges.find(r => r.status === personStatus);
      if (range) {
        startNumber = range.startNumber;
        endNumber = range.endNumber;
      } else if (bibSettings.defaultStartNumber) {
        startNumber = bibSettings.defaultStartNumber;
      }
    }

    const usedBibs = new Set(
      this.data.people
        .filter(p => p.competitionId === competitionId && p.bib !== undefined)
        .map(p => p.bib!)
    );

    for (let candidate = startNumber; ; candidate++) {
      if (endNumber !== undefined && candidate > endNumber) {
        throw new Error(`No available bibs in range ${startNumber}-${endNumber} for status ${personStatus}`);
      }
      if (!usedBibs.has(candidate)) return candidate;
    }
  }

  async reassignPersonBib(personId: number, newBib: number): Promise<boolean> {
    const person = this.data.people.find(p => p.id === personId);
    if (!person) return false;
    const oldBib = person.bib;
    if (oldBib === undefined || oldBib === null) return false;

    // Check availability
    const conflict = this.data.people.find(
      p => p.competitionId === person.competitionId && p.bib === newBib && p.id !== personId
    );
    if (conflict) throw new Error(`Bib ${newBib} is already taken in this competition`);

    // Update person
    person.bib = newBib;

    // Update couples
    for (const couple of this.data.couples) {
      if (couple.leaderId === personId) {
        couple.bib = newBib;
      }
    }

    // Update event heats, scores, etc.
    for (const event of Object.values(this.data.events)) {
      if (event.competitionId !== person.competitionId) continue;
      for (const heat of event.heats) {
        const idx = heat.bibs.indexOf(oldBib);
        if (idx >= 0) heat.bibs[idx] = newBib;
      }
      if (event.scratchedBibs) {
        const idx = event.scratchedBibs.indexOf(oldBib);
        if (idx >= 0) event.scratchedBibs[idx] = newBib;
      }
    }

    // Update scores
    const newScores: Record<string, number[]> = {};
    for (const [key, value] of Object.entries(this.data.scores)) {
      const newKey = key.replace(`:${oldBib}:`, `:${newBib}:`).replace(`:${oldBib}`, `:${newBib}`);
      newScores[newKey] = value;
    }
    this.data.scores = newScores;

    const newJudgeScores: Record<string, Record<number, number>> = {};
    for (const [key, value] of Object.entries(this.data.judgeScores)) {
      const newKey = key.replace(`:${oldBib}:`, `:${newBib}:`).replace(`:${oldBib}`, `:${newBib}`);
      newJudgeScores[newKey] = value;
    }
    this.data.judgeScores = newJudgeScores;

    this.savePeople();
    this.saveCouples();
    this.saveEvents();
    return true;
  }

  async bulkReassignBibs(competitionId: number): Promise<void> {
    const leaders = new Set<number>();
    for (const couple of this.data.couples) {
      if (couple.competitionId === competitionId) {
        leaders.add(couple.leaderId);
      }
    }

    for (const leaderId of leaders) {
      const person = this.data.people.find(p => p.id === leaderId);
      if (!person) continue;
      const newBib = await this.assignBib(competitionId, person.status);
      if (person.bib !== newBib) {
        if (person.bib !== undefined) {
          await this.reassignPersonBib(leaderId, newBib);
        } else {
          person.bib = newBib;
          for (const couple of this.data.couples) {
            if (couple.leaderId === leaderId) couple.bib = newBib;
          }
          this.savePeople();
          this.saveCouples();
        }
      }
    }
  }

  // Judges methods
  async getJudges(competitionId?: number): Promise<Judge[]> {
    if (competitionId !== undefined) {
      return this.data.judges.filter(j => j.competitionId === competitionId);
    }
    return this.data.judges;
  }

  async getJudgeById(id: number): Promise<Judge | undefined> {
    return this.data.judges.find(j => j.id === id);
  }

  async getJudgesByIds(ids: number[]): Promise<Map<number, Judge>> {
    const idSet = new Set(ids);
    const map = new Map<number, Judge>();
    for (const judge of this.data.judges) {
      if (idSet.has(judge.id)) {
        map.set(judge.id, judge);
      }
    }
    return map;
  }

  async addJudge(name: string, competitionId: number): Promise<Judge> {
    const competitionJudges = this.data.judges.filter(j => j.competitionId === competitionId);
    const existingNumbers = competitionJudges.map(j => j.judgeNumber);
    const judgeNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const newJudge: Judge = {
      id: this.data.nextJudgeId++,
      name,
      judgeNumber,
      competitionId,
    };
    this.data.judges.push(newJudge);
    this.data.judges.sort((a, b) => a.judgeNumber - b.judgeNumber);
    this.saveJudges();
    return newJudge;
  }

  async updateJudge(id: number, updates: Partial<Omit<Judge, 'id'>>): Promise<Judge | null> {
    const judge = this.data.judges.find(j => j.id === id);
    if (!judge) return null;

    if (updates.isChairman === true) {
      for (const j of this.data.judges) {
        if (j.competitionId === judge.competitionId && j.id !== id) {
          j.isChairman = undefined;
        }
      }
    }

    Object.assign(judge, updates);
    this.saveJudges();
    return judge;
  }

  async deleteJudge(id: number): Promise<boolean> {
    const initialLength = this.data.judges.length;
    this.data.judges = this.data.judges.filter(j => j.id !== id);
    if (this.data.judges.length < initialLength) {
      this.saveJudges();
      return true;
    }
    return false;
  }

  // Events methods
  async getEvents(competitionId?: number): Promise<Record<number, Event>> {
    if (competitionId !== undefined) {
      const filtered: Record<number, Event> = {};
      Object.entries(this.data.events).forEach(([key, event]) => {
        if (event.competitionId === competitionId) {
          filtered[Number(key)] = event;
        }
      });
      return filtered;
    }
    return this.data.events;
  }

  async getEventById(id: number): Promise<Event | undefined> {
    return this.data.events[id];
  }

  async getEventsByIds(ids: number[]): Promise<Map<number, Event>> {
    const idSet = new Set(ids);
    const map = new Map<number, Event>();
    for (const event of Object.values(this.data.events)) {
      if (idSet.has(event.id)) {
        map.set(event.id, event);
      }
    }
    return map;
  }

  async addEvent(
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
  ): Promise<Event> {
    const rounds = scoringType === 'proficiency'
      ? ['final']
      : determineRounds(bibs.length);
    const heats = rounds.map((round, index) => ({
      round,
      bibs: index === 0 ? bibs : [],
      judges: judgeIds,
    }));

    const newEvent: Event = {
      id: this.data.nextEventId++,
      name,
      designation,
      syllabusType,
      level,
      style,
      dances,
      heats,
      competitionId,
      scoringType,
      isScholarship,
      ageCategory,
    };
    this.data.events[newEvent.id] = newEvent;
    this.saveEvents();
    return newEvent;
  }

  async updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null> {
    const event = this.data.events[id];
    if (!event) return null;
    Object.assign(event, updates);
    this.saveEvents();
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    if (this.data.events[id]) {
      const event = this.data.events[id];
      const dances = event.dances && event.dances.length > 1 ? event.dances : [undefined];
      event.heats.forEach(heat => {
        heat.bibs.forEach(bib => {
          for (const dance of dances) {
            const key = getScoreKey(id, heat.round, bib, dance);
            delete this.data.scores[key];
            delete this.data.judgeScores[key];
          }
        });
      });
      delete this.data.events[id];
      this.saveEvents();
      return true;
    }
    return false;
  }

  // Scores methods
  async getScores(eventId: number, round: string, bib: number, dance?: string): Promise<number[]> {
    const key = getScoreKey(eventId, round, bib, dance);
    return this.data.scores[key] || [];
  }

  async getScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, number[]>> {
    const result: Record<number, number[]> = {};
    for (const bib of bibs) {
      const key = getScoreKey(eventId, round, bib, dance);
      const scores = this.data.scores[key];
      if (scores) result[bib] = scores;
    }
    return result;
  }

  async setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void> {
    const key = getScoreKey(eventId, round, bib, dance);
    this.data.scores[key] = scores;
    this.saveEvents();
  }

  async setScoresBatch(eventId: number, round: string, entries: Array<{ bib: number; scores: number[] }>, dance?: string): Promise<void> {
    for (const { bib, scores } of entries) {
      const key = getScoreKey(eventId, round, bib, dance);
      this.data.scores[key] = scores;
    }
    this.saveEvents();
  }

  async clearScores(eventId: number, round: string, dance?: string): Promise<void> {
    const event = this.data.events[eventId];
    if (!event) return;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return;

    heat.bibs.forEach(bib => {
      const key = getScoreKey(eventId, round, bib, dance);
      delete this.data.scores[key];
    });
    this.saveEvents();
  }

  async hasAnyScores(eventId: number): Promise<boolean> {
    for (const key of Object.keys(this.data.scores)) {
      if (key.startsWith(`${eventId}:`) && this.data.scores[key].length > 0) {
        return true;
      }
    }
    return false;
  }

  // Judge scores methods
  async getJudgeScores(eventId: number, round: string, bib: number, dance?: string): Promise<Record<number, number>> {
    const key = getScoreKey(eventId, round, bib, dance);
    return this.data.judgeScores[key] || {};
  }

  async getJudgeScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, Record<number, number>>> {
    const result: Record<number, Record<number, number>> = {};
    for (const bib of bibs) {
      const key = getScoreKey(eventId, round, bib, dance);
      const judgeScores = this.data.judgeScores[key];
      if (judgeScores && Object.keys(judgeScores).length > 0) {
        result[bib] = judgeScores;
      }
    }
    return result;
  }

  async setJudgeScoresBatch(eventId: number, round: string, judgeId: number, entries: Array<{ bib: number; score: number }>, dance?: string): Promise<void> {
    for (const { bib, score } of entries) {
      const key = getScoreKey(eventId, round, bib, dance);
      if (!this.data.judgeScores[key]) {
        this.data.judgeScores[key] = {};
      }
      this.data.judgeScores[key][judgeId] = score;
    }
    this.saveEvents();
  }

  async clearJudgeScores(eventId: number, round: string, dance?: string): Promise<void> {
    const event = this.data.events[eventId];
    if (!event) return;
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return;
    heat.bibs.forEach(bib => {
      const key = getScoreKey(eventId, round, bib, dance);
      delete this.data.judgeScores[key];
    });
    this.saveEvents();
  }

  async clearAllEventScores(eventId: number): Promise<void> {
    const event = this.data.events[eventId];
    if (!event) return;
    const dances = event.dances && event.dances.length > 1 ? event.dances : [undefined];
    for (const heat of event.heats) {
      for (const bib of heat.bibs) {
        for (const dance of dances) {
          const key = getScoreKey(eventId, heat.round, bib, dance);
          delete this.data.scores[key];
          delete this.data.judgeScores[key];
        }
      }
    }
    this.saveEvents();
  }

  rebuildHeats(bibs: number[], judgeIds: number[], scoringType: 'standard' | 'proficiency'): Heat[] {
    const rounds = scoringType === 'proficiency'
      ? ['final']
      : determineRounds(bibs.length);
    return rounds.map((round, index) => ({
      round,
      bibs: index === 0 ? bibs : [],
      judges: judgeIds,
    }));
  }

  async getJudgeSubmissionStatus(eventId: number, round: string, dance?: string): Promise<Record<number, boolean>> {
    const event = this.data.events[eventId];
    if (!event) return {};
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return {};

    const status: Record<number, boolean> = {};
    for (const judgeId of heat.judges) {
      status[judgeId] = heat.bibs.length > 0 && heat.bibs.every(bib => {
        const key = getScoreKey(eventId, round, bib, dance);
        return this.data.judgeScores[key]?.[judgeId] !== undefined;
      });
    }
    return status;
  }

  async getJudgeSubmissionStatusBatch(
    entries: Array<{ eventId: number; round: string; dance?: string; bibs: number[] }>,
    judgeIds: number[]
  ): Promise<Record<number, boolean>> {
    const status: Record<number, boolean> = {};
    for (const jId of judgeIds) status[jId] = true;

    if (entries.length === 0 || judgeIds.length === 0) return status;

    for (const entry of entries) {
      if (entry.bibs.length === 0) {
        for (const jId of judgeIds) status[jId] = false;
        continue;
      }

      for (const jId of judgeIds) {
        if (!status[jId]) continue;
        const allScored = entry.bibs.every(bib => {
          const key = getScoreKey(entry.eventId, entry.round, bib, entry.dance);
          return this.data.judgeScores[key]?.[jId] !== undefined;
        });
        if (!allScored) status[jId] = false;
      }
    }
    return status;
  }

  async advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): Promise<boolean> {
    const event = this.data.events[eventId];
    if (!event) return false;

    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(currentRound);
    if (currentIndex === -1 || currentIndex === rounds.length - 1) return false;

    const nextRound = rounds[currentIndex + 1];
    const nextHeat = event.heats.find(h => h.round === nextRound);
    if (!nextHeat) return false;

    nextHeat.bibs = topBibs;
    this.saveEvents();
    return true;
  }

  // User methods
  async getUsers(): Promise<User[]> {
    return this.data.users;
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    return this.data.users.find(u => u.uid === uid);
  }

  async upsertUser(uid: string, email: string, displayName?: string, photoURL?: string, signInMethod?: string): Promise<User> {
    const existingUser = await this.getUserByUid(uid);
    const now = new Date().toISOString();
    const isAdmin = email === ADMIN_EMAIL;

    if (existingUser) {
      existingUser.displayName = displayName || existingUser.displayName;
      existingUser.photoURL = photoURL || existingUser.photoURL;
      existingUser.lastLoginAt = now;
      existingUser.isAdmin = isAdmin;
      // Backfill firstName/lastName from displayName if still empty
      if (!existingUser.firstName && !existingUser.lastName && displayName) {
        const parts = displayName.trim().split(/\s+/);
        existingUser.firstName = parts[0] || undefined;
        existingUser.lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
      }
      // Add signInMethod if not already present
      if (!existingUser.signInMethods) existingUser.signInMethods = [];
      if (signInMethod && !existingUser.signInMethods.includes(signInMethod)) {
        existingUser.signInMethods.push(signInMethod);
      }
      this.saveUsers();
      return existingUser;
    }

    const nameParts = displayName?.trim().split(/\s+/) || [];
    const newUser: User = {
      uid,
      email,
      displayName,
      firstName: nameParts[0] || undefined,
      lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined,
      photoURL,
      signInMethods: signInMethod ? [signInMethod] : [],
      isAdmin,
      createdAt: now,
      lastLoginAt: now,
    };

    this.data.users.push(newUser);
    this.saveUsers();
    return newUser;
  }

  async updateUserProfile(uid: string, updates: UserProfileUpdate): Promise<User | null> {
    const user = await this.getUserByUid(uid);
    if (!user) return null;

    if (updates.firstName !== undefined) user.firstName = updates.firstName;
    if (updates.lastName !== undefined) user.lastName = updates.lastName;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.city !== undefined) user.city = updates.city;
    if (updates.stateRegion !== undefined) user.stateRegion = updates.stateRegion;
    if (updates.country !== undefined) user.country = updates.country;
    if (updates.studioTeamName !== undefined) user.studioTeamName = updates.studioTeamName;

    this.saveUsers();
    return user;
  }

  async updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null> {
    const user = await this.getUserByUid(uid);
    if (!user) return null;

    if (user.email === ADMIN_EMAIL) {
      return user;
    }

    user.isAdmin = isAdmin;
    this.saveUsers();
    return user;
  }

  // Site Settings methods
  async getSiteSettings(): Promise<SiteSettings> {
    return this.siteSettings;
  }

  async updateSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
    Object.assign(this.siteSettings, updates);
    this.saveSiteSettings();
    return this.siteSettings;
  }

  // Schedule methods
  async getSchedule(competitionId: number): Promise<CompetitionSchedule | undefined> {
    return this.data.schedules[competitionId];
  }

  async saveSchedule(schedule: CompetitionSchedule): Promise<CompetitionSchedule> {
    this.data.schedules[schedule.competitionId] = schedule;
    this.saveSchedules();
    return schedule;
  }

  async deleteSchedule(competitionId: number): Promise<boolean> {
    if (this.data.schedules[competitionId]) {
      delete this.data.schedules[competitionId];
      this.saveSchedules();
      return true;
    }
    return false;
  }

  // Competition Admins
  async getCompetitionAdmins(competitionId: number): Promise<CompetitionAdmin[]> {
    return this.competitionAdmins.filter(a => a.competitionId === competitionId);
  }

  async getEnrichedCompetitionAdmins(competitionId: number): Promise<(CompetitionAdmin & { email?: string; displayName?: string; firstName?: string; lastName?: string })[]> {
    const admins = this.competitionAdmins.filter(a => a.competitionId === competitionId);
    const userMap = new Map(this.data.users.map(u => [u.uid, u]));
    return admins.map(a => {
      const user = userMap.get(a.userUid);
      return {
        ...a,
        email: user?.email,
        displayName: user?.displayName,
        firstName: user?.firstName,
        lastName: user?.lastName,
      };
    });
  }

  async getCompetitionsByAdmin(userUid: string): Promise<number[]> {
    return this.competitionAdmins
      .filter(a => a.userUid === userUid)
      .map(a => a.competitionId);
  }

  async addCompetitionAdmin(competitionId: number, userUid: string, role: string = 'admin'): Promise<CompetitionAdmin> {
    const existing = this.competitionAdmins.find(
      a => a.competitionId === competitionId && a.userUid === userUid
    );
    if (existing) {
      existing.role = role;
      this.saveCompetitionAdmins();
      return existing;
    }
    const admin: CompetitionAdmin = {
      competitionId,
      userUid,
      role,
      createdAt: new Date().toISOString(),
    };
    this.competitionAdmins.push(admin);
    this.saveCompetitionAdmins();
    return admin;
  }

  async removeCompetitionAdmin(competitionId: number, userUid: string): Promise<boolean> {
    const idx = this.competitionAdmins.findIndex(
      a => a.competitionId === competitionId && a.userUid === userUid
    );
    if (idx === -1) return false;
    this.competitionAdmins.splice(idx, 1);
    this.saveCompetitionAdmins();
    return true;
  }

  async isCompetitionAdmin(competitionId: number, userUid: string): Promise<boolean> {
    return this.competitionAdmins.some(
      a => a.competitionId === competitionId && a.userUid === userUid
    );
  }

  // Judge Profile methods
  async getJudgeProfiles(): Promise<JudgeProfile[]> {
    return this.data.judgeProfiles;
  }

  async getJudgeProfileById(id: number): Promise<JudgeProfile | undefined> {
    return this.data.judgeProfiles.find(p => p.id === id);
  }

  async addJudgeProfile(profile: Omit<JudgeProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<JudgeProfile> {
    const now = new Date().toISOString();
    const newProfile: JudgeProfile = {
      ...profile,
      id: this.data.nextJudgeProfileId++,
      createdAt: now,
      updatedAt: now,
    };
    this.data.judgeProfiles.push(newProfile);
    this.saveJudgeProfiles();
    return newProfile;
  }

  async updateJudgeProfile(id: number, updates: Partial<Omit<JudgeProfile, 'id'>>): Promise<JudgeProfile | null> {
    const profile = this.data.judgeProfiles.find(p => p.id === id);
    if (!profile) return null;
    Object.assign(profile, updates);
    profile.updatedAt = new Date().toISOString();
    this.saveJudgeProfiles();
    return profile;
  }

  async deleteJudgeProfile(id: number): Promise<boolean> {
    const initialLength = this.data.judgeProfiles.length;
    this.data.judgeProfiles = this.data.judgeProfiles.filter(p => p.id !== id);
    if (this.data.judgeProfiles.length < initialLength) {
      this.saveJudgeProfiles();
      return true;
    }
    return false;
  }

  clearCache(): void {}

  async resetAllData(): Promise<void> {
    this.data = {
      competitions: [],
      studios: [],
      people: [],
      couples: [],
      judges: [],
      events: {},
      scores: {},
      judgeScores: {},
      users: [],
      schedules: {},
      nextCompetitionId: 1,
      nextStudioId: 1,
      organizations: [],
      nextOrganizationId: 1,
      nextPersonId: 1,
      nextBib: 1,
      nextCoupleId: 1,
      nextJudgeId: 1,
      nextEventId: 1,
      judgeProfiles: [],
      nextJudgeProfileId: 1,
    };
    this.competitionAdmins = [];
    this.siteSettings = {};
    this.entryPaymentsMap = new Map();
    this.pendingEntries = new Map();
    this.saveCompetitions();
    this.saveStudios();
    this.saveOrganizations();
    this.savePeople();
    this.saveCouples();
    this.saveJudges();
    this.saveEvents();
    this.saveUsers();
    this.saveSchedules();
    this.saveCompetitionAdmins();
    this.saveSiteSettings();
    this.saveJudgeProfiles();
  }
}
