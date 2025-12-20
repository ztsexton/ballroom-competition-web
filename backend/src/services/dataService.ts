import fs from 'fs';
import path from 'path';
import { AppData, Person, Couple, Judge, Event, Competition, Studio } from '../types';

const DATA_DIR = path.join(__dirname, '../../data');
const COMPETITIONS_FILE = path.join(DATA_DIR, 'competitions.json');
const STUDIOS_FILE = path.join(DATA_DIR, 'studios.json');
const PEOPLE_FILE = path.join(DATA_DIR, 'people.json');
const COUPLES_FILE = path.join(DATA_DIR, 'couples.json');
const JUDGES_FILE = path.join(DATA_DIR, 'judges.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class DataService {
  private data: AppData;

  constructor() {
    this.data = this.loadAllData();
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
      nextCompetitionId: this.getNextId(this.loadCompetitions()),
      nextStudioId: this.getNextId(this.loadStudios()),
      nextPersonId: this.getNextId(this.loadPeople()),
      nextBib: this.getNextBib(this.loadCouples()),
      nextJudgeId: this.getNextId(this.loadJudges()),
      nextEventId: this.getNextEventId(this.loadEvents()),
    };
  }

  private loadCompetitions(): Competition[] {
    try {
      if (fs.existsSync(COMPETITIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(COMPETITIONS_FILE, 'utf-8'));
        return data.competitions || [];
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
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
      console.error('Error loading studios:', error);
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
      console.error('Error loading people:', error);
    }
    return [];
  }

  private loadCouples(): Couple[] {
    try {
      if (fs.existsSync(COUPLES_FILE)) {
        return JSON.parse(fs.readFileSync(COUPLES_FILE, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading couples:', error);
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
      console.error('Error loading judges:', error);
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
      console.error('Error loading events:', error);
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
      console.error('Error loading scores:', error);
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
      next_event_id: this.data.nextEventId,
      next_bib: this.data.nextBib,
    };
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
  }

  // Competition methods
  getCompetitions(): Competition[] {
    return this.data.competitions;
  }

  getCompetitionById(id: number): Competition | undefined {
    return this.data.competitions.find(c => c.id === id);
  }

  addCompetition(competition: Omit<Competition, 'id' | 'createdAt'>): Competition {
    const newCompetition: Competition = {
      ...competition,
      id: this.data.nextCompetitionId++,
      createdAt: new Date().toISOString(),
    };
    this.data.competitions.push(newCompetition);
    this.saveCompetitions();
    return newCompetition;
  }

  updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Competition | null {
    const competition = this.data.competitions.find(c => c.id === id);
    if (!competition) return null;
    Object.assign(competition, updates);
    this.saveCompetitions();
    return competition;
  }

  deleteCompetition(id: number): boolean {
    const initialLength = this.data.competitions.length;
    this.data.competitions = this.data.competitions.filter(c => c.id !== id);
    if (this.data.competitions.length < initialLength) {
      // Also delete all related data
      this.data.people = this.data.people.filter(p => p.competitionId !== id);
      this.data.couples = this.data.couples.filter(c => c.competitionId !== id);
      this.data.judges = this.data.judges.filter(j => j.competitionId !== id);
      Object.keys(this.data.events).forEach(key => {
        const eventId = Number(key);
        if (this.data.events[eventId].competitionId === id) {
          delete this.data.events[eventId];
        }
      });
      this.saveCompetitions();
      this.savePeople();
      this.saveCouples();
      this.saveJudges();
      this.saveEvents();
      return true;
    }
    return false;
  }

  // Studio methods
  getStudios(): Studio[] {
    return this.data.studios;
  }

  getStudioById(id: number): Studio | undefined {
    return this.data.studios.find(s => s.id === id);
  }

  addStudio(studio: Omit<Studio, 'id'>): Studio {
    const newStudio: Studio = {
      ...studio,
      id: this.data.nextStudioId++,
    };
    this.data.studios.push(newStudio);
    this.saveStudios();
    return newStudio;
  }

  updateStudio(id: number, updates: Partial<Omit<Studio, 'id'>>): Studio | null {
    const studio = this.data.studios.find(s => s.id === id);
    if (!studio) return null;
    Object.assign(studio, updates);
    this.saveStudios();
    return studio;
  }

  deleteStudio(id: number): boolean {
    const initialLength = this.data.studios.length;
    this.data.studios = this.data.studios.filter(s => s.id !== id);
    if (this.data.studios.length < initialLength) {
      this.saveStudios();
      return true;
    }
    return false;
  }

  // People methods
  getPeople(competitionId?: number): Person[] {
    if (competitionId !== undefined) {
      return this.data.people.filter(p => p.competitionId === competitionId);
    }
    return this.data.people;
  }

  getPersonById(id: number): Person | undefined {
    return this.data.people.find(p => p.id === id);
  }

  addPerson(person: Omit<Person, 'id'>): Person {
    const newPerson: Person = {
      ...person,
      id: this.data.nextPersonId++,
    };
    this.data.people.push(newPerson);
    this.savePeople();
    return newPerson;
  }

  updatePerson(id: number, updates: Partial<Omit<Person, 'id'>>): Person | null {
    const person = this.data.people.find(p => p.id === id);
    if (!person) return null;
    Object.assign(person, updates);
    this.savePeople();
    return person;
  }

  deletePerson(id: number): boolean {
    const initialLength = this.data.people.length;
    this.data.people = this.data.people.filter(p => p.id !== id);
    if (this.data.people.length < initialLength) {
      this.savePeople();
      return true;
    }
    return false;
  }

  // Couples methods
  getCouples(competitionId?: number): Couple[] {
    if (competitionId !== undefined) {
      return this.data.couples.filter(c => c.competitionId === competitionId);
    }
    return this.data.couples;
  }

  getCoupleByBib(bib: number): Couple | undefined {
    return this.data.couples.find(c => c.bib === bib);
  }

  addCouple(leaderId: number, followerId: number, competitionId: number): Couple | null {
    const leader = this.getPersonById(leaderId);
    const follower = this.getPersonById(followerId);
    
    if (!leader || !follower) return null;
    if (leader.competitionId !== competitionId || follower.competitionId !== competitionId) return null;

    const newCouple: Couple = {
      bib: this.data.nextBib++,
      leaderId,
      followerId,
      leaderName: leader.name,
      followerName: follower.name,
      competitionId,
    };
    this.data.couples.push(newCouple);
    this.saveCouples();
    this.saveEvents(); // Save nextBib
    return newCouple;
  }

  deleteCouple(bib: number): boolean {
    const initialLength = this.data.couples.length;
    this.data.couples = this.data.couples.filter(c => c.bib !== bib);
    if (this.data.couples.length < initialLength) {
      this.saveCouples();
      return true;
    }
    return false;
  }

  // Judges methods
  getJudges(competitionId?: number): Judge[] {
    if (competitionId !== undefined) {
      return this.data.judges.filter(j => j.competitionId === competitionId);
    }
    return this.data.judges;
  }

  getJudgeById(id: number): Judge | undefined {
    return this.data.judges.find(j => j.id === id);
  }

  addJudge(name: string, competitionId: number): Judge {
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

  deleteJudge(id: number): boolean {
    const initialLength = this.data.judges.length;
    this.data.judges = this.data.judges.filter(j => j.id !== id);
    if (this.data.judges.length < initialLength) {
      this.saveJudges();
      return true;
    }
    return false;
  }

  // Events methods
  getEvents(competitionId?: number): Record<number, Event> {
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

  getEventById(id: number): Event | undefined {
    return this.data.events[id];
  }

  addEvent(
    name: string, 
    bibs: number[], 
    judgeIds: number[],
    competitionId: number,
    designation?: string,
    syllabusType?: string,
    level?: string,
    style?: string,
    dances?: string[]
  ): Event {
    const rounds = this.determineRounds(bibs.length);
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
    };
    this.data.events[newEvent.id] = newEvent;
    this.saveEvents();
    return newEvent;
  }

  updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Event | null {
    const event = this.data.events[id];
    if (!event) return null;
    Object.assign(event, updates);
    this.saveEvents();
    return event;
  }

  deleteEvent(id: number): boolean {
    if (this.data.events[id]) {
      // Delete associated scores
      const event = this.data.events[id];
      event.heats.forEach(heat => {
        heat.bibs.forEach(bib => {
          const key = this.getScoreKey(id, heat.round, bib);
          delete this.data.scores[key];
        });
      });
      delete this.data.events[id];
      this.saveEvents();
      return true;
    }
    return false;
  }

  private determineRounds(numCompetitors: number): string[] {
    if (numCompetitors <= 6) return ['final'];
    if (numCompetitors <= 14) return ['semi-final', 'final'];
    return ['quarter-final', 'semi-final', 'final'];
  }

  // Scores methods
  private getScoreKey(eventId: number, round: string, bib: number): string {
    return `${eventId}:${round}:${bib}`;
  }

  getScores(eventId: number, round: string, bib: number): number[] {
    const key = this.getScoreKey(eventId, round, bib);
    return this.data.scores[key] || [];
  }

  setScores(eventId: number, round: string, bib: number, scores: number[]): void {
    const key = this.getScoreKey(eventId, round, bib);
    this.data.scores[key] = scores;
    this.saveEvents();
  }

  clearScores(eventId: number, round: string): void {
    const event = this.data.events[eventId];
    if (!event) return;

    const heat = event.heats.find(h => h.round === round);
    if (!heat) return;

    heat.bibs.forEach(bib => {
      const key = this.getScoreKey(eventId, round, bib);
      delete this.data.scores[key];
    });
    this.saveEvents();
  }

  advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): boolean {
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

  resetAllData(): void {
    this.data = {
      competitions: [],
      studios: [],
      people: [],
      couples: [],
      judges: [],
      events: {},
      scores: {},
      nextCompetitionId: 1,
      nextStudioId: 1,
      nextPersonId: 1,
      nextBib: 1,
      nextJudgeId: 1,
      nextEventId: 1,
    };
    this.saveCompetitions();
    this.saveStudios();
    this.savePeople();
    this.saveCouples();
    this.saveJudges();
    this.saveEvents();
  }
}

export const dataService = new DataService();
