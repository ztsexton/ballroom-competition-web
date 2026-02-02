import { Pool } from 'pg';
import {
  Competition, Studio, Person, Couple, Judge, Event, Heat, User,
  CompetitionSchedule, EntryPayment,
} from '../../types';
import { IDataService } from './IDataService';
import { determineRounds, getScoreKey } from './helpers';

const ADMIN_EMAIL = 'zsexton2011@gmail.com';

export class PostgresDataService implements IDataService {
  constructor(private pool: Pool) {}

  // ─── helpers ────────────────────────────────────────────────────

  private competitionFromRow(row: any): Competition {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      date: row.date,
      location: row.location || undefined,
      studioId: row.studio_id || undefined,
      description: row.description || undefined,
      judgeSettings: row.judge_settings || undefined,
      timingSettings: row.timing_settings || undefined,
      defaultScoringType: row.default_scoring_type || undefined,
      levels: row.levels || undefined,
      pricing: row.pricing || undefined,
      entryPayments: row.entry_payments || undefined,
      createdAt: row.created_at,
    };
  }

  private studioFromRow(row: any): Studio {
    return {
      id: row.id,
      name: row.name,
      location: row.location || undefined,
      contactInfo: row.contact_info || undefined,
      mindbodySiteId: row.mindbody_site_id || undefined,
      mindbodyToken: row.mindbody_token || undefined,
    };
  }

  private personFromRow(row: any): Person {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email || undefined,
      role: row.role,
      status: row.status,
      competitionId: row.competition_id,
      studioId: row.studio_id || undefined,
    };
  }

  private coupleFromRow(row: any): Couple {
    return {
      bib: row.bib,
      leaderId: row.leader_id,
      followerId: row.follower_id,
      leaderName: row.leader_name,
      followerName: row.follower_name,
      competitionId: row.competition_id,
    };
  }

  private judgeFromRow(row: any): Judge {
    return {
      id: row.id,
      name: row.name,
      judgeNumber: row.judge_number,
      competitionId: row.competition_id,
    };
  }

  private eventFromRow(row: any): Event {
    return {
      id: row.id,
      name: row.name,
      designation: row.designation || undefined,
      syllabusType: row.syllabus_type || undefined,
      level: row.level || undefined,
      style: row.style || undefined,
      dances: row.dances || undefined,
      heats: row.heats || [],
      competitionId: row.competition_id,
      scoringType: row.scoring_type || undefined,
      isScholarship: row.is_scholarship || undefined,
    };
  }

  private userFromRow(row: any): User {
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name || undefined,
      photoURL: row.photo_url || undefined,
      isAdmin: row.is_admin,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }

  private scheduleFromRow(row: any): CompetitionSchedule {
    return {
      competitionId: row.competition_id,
      heatOrder: row.heat_order || [],
      styleOrder: row.style_order || [],
      levelOrder: row.level_order || [],
      currentHeatIndex: row.current_heat_index,
      heatStatuses: row.heat_statuses || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ─── Competitions ───────────────────────────────────────────────

  async getCompetitions(): Promise<Competition[]> {
    const { rows } = await this.pool.query('SELECT * FROM competitions ORDER BY id');
    return rows.map(r => this.competitionFromRow(r));
  }

  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM competitions WHERE id = $1', [id]);
    return rows.length > 0 ? this.competitionFromRow(rows[0]) : undefined;
  }

  async addCompetition(competition: Omit<Competition, 'id' | 'createdAt'>): Promise<Competition> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO competitions (name, type, date, location, studio_id, description,
        judge_settings, timing_settings, default_scoring_type, levels, pricing, entry_payments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        competition.name, competition.type, competition.date,
        competition.location || null, competition.studioId || null,
        competition.description || null,
        competition.judgeSettings ? JSON.stringify(competition.judgeSettings) : null,
        competition.timingSettings ? JSON.stringify(competition.timingSettings) : null,
        competition.defaultScoringType || null,
        competition.levels ? JSON.stringify(competition.levels) : null,
        competition.pricing ? JSON.stringify(competition.pricing) : null,
        JSON.stringify(competition.entryPayments || {}),
        now,
      ]
    );
    return this.competitionFromRow(rows[0]);
  }

  async updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Promise<Competition | null> {
    const existing = await this.getCompetitionById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', type: 'type', date: 'date', location: 'location',
      studioId: 'studio_id', description: 'description',
      defaultScoringType: 'default_scoring_type',
    };
    const jsonFields: Record<string, string> = {
      judgeSettings: 'judge_settings', timingSettings: 'timing_settings',
      levels: 'levels', pricing: 'pricing', entryPayments: 'entry_payments',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push((updates as any)[key]);
      }
    }
    for (const [key, col] of Object.entries(jsonFields)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push(JSON.stringify((updates as any)[key]));
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    await this.pool.query(
      `UPDATE competitions SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
      values
    );
    return (await this.getCompetitionById(id))!;
  }

  async getEntryPayments(competitionId: number): Promise<Record<string, EntryPayment>> {
    const comp = await this.getCompetitionById(competitionId);
    return comp?.entryPayments || {};
  }

  async updateEntryPayments(
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    updates: { paid: boolean; paidBy?: number; notes?: string }
  ): Promise<Record<string, EntryPayment> | null> {
    const comp = await this.getCompetitionById(competitionId);
    if (!comp) return null;

    const payments = comp.entryPayments || {};
    const result: Record<string, EntryPayment> = {};

    for (const { eventId, bib } of entries) {
      const key = `${eventId}:${bib}`;
      const existing: EntryPayment = payments[key] || { paid: false };
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

    await this.pool.query(
      'UPDATE competitions SET entry_payments = $1 WHERE id = $2',
      [JSON.stringify(payments), competitionId]
    );
    return result;
  }

  async deleteCompetition(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM competitions WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Studios ────────────────────────────────────────────────────

  async getStudios(): Promise<Studio[]> {
    const { rows } = await this.pool.query('SELECT * FROM studios ORDER BY id');
    return rows.map(r => this.studioFromRow(r));
  }

  async getStudioById(id: number): Promise<Studio | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM studios WHERE id = $1', [id]);
    return rows.length > 0 ? this.studioFromRow(rows[0]) : undefined;
  }

  async addStudio(studio: Omit<Studio, 'id'>): Promise<Studio> {
    const { rows } = await this.pool.query(
      `INSERT INTO studios (name, location, contact_info, mindbody_site_id, mindbody_token)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        studio.name, studio.location || null, studio.contactInfo || null,
        studio.mindbodySiteId || null, studio.mindbodyToken || null,
      ]
    );
    return this.studioFromRow(rows[0]);
  }

  async updateStudio(id: number, updates: Partial<Omit<Studio, 'id'>>): Promise<Studio | null> {
    const existing = await this.getStudioById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    const map: Record<string, string> = {
      name: 'name', location: 'location', contactInfo: 'contact_info',
      mindbodySiteId: 'mindbody_site_id', mindbodyToken: 'mindbody_token',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push((updates as any)[key]);
      }
    }
    if (fields.length === 0) return existing;
    values.push(id);
    await this.pool.query(`UPDATE studios SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    return (await this.getStudioById(id))!;
  }

  async deleteStudio(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM studios WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── People ─────────────────────────────────────────────────────

  async getPeople(competitionId?: number): Promise<Person[]> {
    if (competitionId !== undefined) {
      const { rows } = await this.pool.query(
        'SELECT * FROM people WHERE competition_id = $1 ORDER BY id', [competitionId]
      );
      return rows.map(r => this.personFromRow(r));
    }
    const { rows } = await this.pool.query('SELECT * FROM people ORDER BY id');
    return rows.map(r => this.personFromRow(r));
  }

  async getPersonById(id: number): Promise<Person | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM people WHERE id = $1', [id]);
    return rows.length > 0 ? this.personFromRow(rows[0]) : undefined;
  }

  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const { rows } = await this.pool.query(
      `INSERT INTO people (first_name, last_name, email, role, status, competition_id, studio_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        person.firstName, person.lastName, person.email || null,
        person.role, person.status, person.competitionId, person.studioId || null,
      ]
    );
    return this.personFromRow(rows[0]);
  }

  async updatePerson(id: number, updates: Partial<Omit<Person, 'id'>>): Promise<Person | null> {
    const existing = await this.getPersonById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    const map: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name', email: 'email',
      role: 'role', status: 'status', competitionId: 'competition_id', studioId: 'studio_id',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push((updates as any)[key]);
      }
    }
    if (fields.length === 0) return existing;
    values.push(id);
    await this.pool.query(`UPDATE people SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    return (await this.getPersonById(id))!;
  }

  async deletePerson(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM people WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Couples ────────────────────────────────────────────────────

  async getCouples(competitionId?: number): Promise<Couple[]> {
    if (competitionId !== undefined) {
      const { rows } = await this.pool.query(
        'SELECT * FROM couples WHERE competition_id = $1 ORDER BY bib', [competitionId]
      );
      return rows.map(r => this.coupleFromRow(r));
    }
    const { rows } = await this.pool.query('SELECT * FROM couples ORDER BY bib');
    return rows.map(r => this.coupleFromRow(r));
  }

  async getCoupleByBib(bib: number): Promise<Couple | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM couples WHERE bib = $1', [bib]);
    return rows.length > 0 ? this.coupleFromRow(rows[0]) : undefined;
  }

  async addCouple(leaderId: number, followerId: number, competitionId: number): Promise<Couple | null> {
    const leader = await this.getPersonById(leaderId);
    const follower = await this.getPersonById(followerId);
    if (!leader || !follower) return null;
    if (leader.competitionId !== competitionId || follower.competitionId !== competitionId) return null;

    const leaderName = leader.firstName + (leader.lastName ? ' ' + leader.lastName : '');
    const followerName = follower.firstName + (follower.lastName ? ' ' + follower.lastName : '');

    const { rows } = await this.pool.query(
      `INSERT INTO couples (leader_id, follower_id, leader_name, follower_name, competition_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [leaderId, followerId, leaderName, followerName, competitionId]
    );
    return this.coupleFromRow(rows[0]);
  }

  async deleteCouple(bib: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM couples WHERE bib = $1', [bib]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Judges ─────────────────────────────────────────────────────

  async getJudges(competitionId?: number): Promise<Judge[]> {
    if (competitionId !== undefined) {
      const { rows } = await this.pool.query(
        'SELECT * FROM judges WHERE competition_id = $1 ORDER BY judge_number', [competitionId]
      );
      return rows.map(r => this.judgeFromRow(r));
    }
    const { rows } = await this.pool.query('SELECT * FROM judges ORDER BY judge_number');
    return rows.map(r => this.judgeFromRow(r));
  }

  async getJudgeById(id: number): Promise<Judge | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM judges WHERE id = $1', [id]);
    return rows.length > 0 ? this.judgeFromRow(rows[0]) : undefined;
  }

  async addJudge(name: string, competitionId: number): Promise<Judge> {
    const { rows: existing } = await this.pool.query(
      'SELECT MAX(judge_number) as max_num FROM judges WHERE competition_id = $1',
      [competitionId]
    );
    const judgeNumber = (existing[0].max_num || 0) + 1;

    const { rows } = await this.pool.query(
      `INSERT INTO judges (name, judge_number, competition_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, judgeNumber, competitionId]
    );
    return this.judgeFromRow(rows[0]);
  }

  async deleteJudge(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM judges WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Events ─────────────────────────────────────────────────────

  async getEvents(competitionId?: number): Promise<Record<number, Event>> {
    let rows: any[];
    if (competitionId !== undefined) {
      ({ rows } = await this.pool.query(
        'SELECT * FROM events WHERE competition_id = $1 ORDER BY id', [competitionId]
      ));
    } else {
      ({ rows } = await this.pool.query('SELECT * FROM events ORDER BY id'));
    }
    const result: Record<number, Event> = {};
    for (const row of rows) {
      const event = this.eventFromRow(row);
      result[event.id] = event;
    }
    return result;
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM events WHERE id = $1', [id]);
    return rows.length > 0 ? this.eventFromRow(rows[0]) : undefined;
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
    isScholarship?: boolean
  ): Promise<Event> {
    const rounds = scoringType === 'proficiency'
      ? ['final']
      : determineRounds(bibs.length);
    const heats: Heat[] = rounds.map((round, index) => ({
      round,
      bibs: index === 0 ? bibs : [],
      judges: judgeIds,
    }));

    const { rows } = await this.pool.query(
      `INSERT INTO events (name, designation, syllabus_type, level, style, dances,
        heats, competition_id, scoring_type, is_scholarship)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name, designation || null, syllabusType || null, level || null,
        style || null, dances ? JSON.stringify(dances) : null,
        JSON.stringify(heats), competitionId, scoringType || null,
        isScholarship || false,
      ]
    );
    return this.eventFromRow(rows[0]);
  }

  async updateEvent(id: number, updates: Partial<Omit<Event, 'id'>>): Promise<Event | null> {
    const existing = await this.getEventById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const scalarMap: Record<string, string> = {
      name: 'name', designation: 'designation', syllabusType: 'syllabus_type',
      level: 'level', style: 'style', competitionId: 'competition_id',
      scoringType: 'scoring_type', isScholarship: 'is_scholarship',
    };
    const jsonMap: Record<string, string> = {
      dances: 'dances', heats: 'heats',
    };

    for (const [key, col] of Object.entries(scalarMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push((updates as any)[key]);
      }
    }
    for (const [key, col] of Object.entries(jsonMap)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push(JSON.stringify((updates as any)[key]));
      }
    }

    if (fields.length === 0) return existing;
    values.push(id);
    await this.pool.query(`UPDATE events SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    return (await this.getEventById(id))!;
  }

  async deleteEvent(id: number): Promise<boolean> {
    // Clean up scores first
    await this.pool.query('DELETE FROM scores WHERE event_id = $1', [id]);
    await this.pool.query('DELETE FROM judge_scores WHERE event_id = $1', [id]);
    const { rowCount } = await this.pool.query('DELETE FROM events WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Scores ─────────────────────────────────────────────────────

  async getScores(eventId: number, round: string, bib: number, dance?: string): Promise<number[]> {
    const d = dance || '';
    const { rows } = await this.pool.query(
      'SELECT scores FROM scores WHERE event_id = $1 AND round = $2 AND bib = $3 AND dance = $4',
      [eventId, round, bib, d]
    );
    return rows.length > 0 ? rows[0].scores : [];
  }

  async setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void> {
    const d = dance || '';
    await this.pool.query(
      `INSERT INTO scores (event_id, round, bib, dance, scores) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, round, bib, dance) DO UPDATE SET scores = $5`,
      [eventId, round, bib, d, JSON.stringify(scores)]
    );
  }

  async clearScores(eventId: number, round: string, dance?: string): Promise<void> {
    if (dance) {
      await this.pool.query(
        'DELETE FROM scores WHERE event_id = $1 AND round = $2 AND dance = $3',
        [eventId, round, dance]
      );
    } else {
      await this.pool.query(
        'DELETE FROM scores WHERE event_id = $1 AND round = $2',
        [eventId, round]
      );
    }
  }

  // ─── Judge Scores ───────────────────────────────────────────────

  async getJudgeScores(eventId: number, round: string, bib: number, dance?: string): Promise<Record<number, number>> {
    const d = dance || '';
    const { rows } = await this.pool.query(
      'SELECT judge_id, score FROM judge_scores WHERE event_id = $1 AND round = $2 AND bib = $3 AND dance = $4',
      [eventId, round, bib, d]
    );
    const result: Record<number, number> = {};
    for (const row of rows) {
      result[row.judge_id] = row.score;
    }
    return result;
  }

  async setJudgeScoresBatch(
    eventId: number, round: string, judgeId: number,
    entries: Array<{ bib: number; score: number }>,
    dance?: string
  ): Promise<void> {
    const d = dance || '';
    for (const { bib, score } of entries) {
      await this.pool.query(
        `INSERT INTO judge_scores (event_id, round, bib, judge_id, dance, score)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (event_id, round, bib, judge_id, dance) DO UPDATE SET score = $6`,
        [eventId, round, bib, judgeId, d, score]
      );
    }
  }

  async clearJudgeScores(eventId: number, round: string, dance?: string): Promise<void> {
    if (dance) {
      await this.pool.query(
        'DELETE FROM judge_scores WHERE event_id = $1 AND round = $2 AND dance = $3',
        [eventId, round, dance]
      );
    } else {
      await this.pool.query(
        'DELETE FROM judge_scores WHERE event_id = $1 AND round = $2',
        [eventId, round]
      );
    }
  }

  async clearAllEventScores(eventId: number): Promise<void> {
    await this.pool.query('DELETE FROM scores WHERE event_id = $1', [eventId]);
    await this.pool.query('DELETE FROM judge_scores WHERE event_id = $1', [eventId]);
  }

  // ─── Heat Management ───────────────────────────────────────────

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
    const event = await this.getEventById(eventId);
    if (!event) return {};
    const heat = event.heats.find(h => h.round === round);
    if (!heat) return {};

    const d = dance || '';
    const status: Record<number, boolean> = {};
    for (const judgeId of heat.judges) {
      if (heat.bibs.length === 0) {
        status[judgeId] = false;
        continue;
      }
      const { rows } = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM judge_scores
         WHERE event_id = $1 AND round = $2 AND judge_id = $3 AND dance = $4 AND bib = ANY($5)`,
        [eventId, round, judgeId, d, heat.bibs]
      );
      status[judgeId] = parseInt(rows[0].cnt) === heat.bibs.length;
    }
    return status;
  }

  async advanceToNextRound(eventId: number, currentRound: string, topBibs: number[]): Promise<boolean> {
    const event = await this.getEventById(eventId);
    if (!event) return false;

    const rounds = event.heats.map(h => h.round);
    const currentIndex = rounds.indexOf(currentRound);
    if (currentIndex === -1 || currentIndex === rounds.length - 1) return false;

    const nextRound = rounds[currentIndex + 1];
    const nextHeat = event.heats.find(h => h.round === nextRound);
    if (!nextHeat) return false;

    nextHeat.bibs = topBibs;
    await this.pool.query(
      'UPDATE events SET heats = $1 WHERE id = $2',
      [JSON.stringify(event.heats), eventId]
    );
    return true;
  }

  // ─── Users ──────────────────────────────────────────────────────

  async getUsers(): Promise<User[]> {
    const { rows } = await this.pool.query('SELECT * FROM users ORDER BY created_at');
    return rows.map(r => this.userFromRow(r));
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
    return rows.length > 0 ? this.userFromRow(rows[0]) : undefined;
  }

  async upsertUser(uid: string, email: string, displayName?: string, photoURL?: string): Promise<User> {
    const now = new Date().toISOString();
    const isAdmin = email === ADMIN_EMAIL;

    const { rows } = await this.pool.query(
      `INSERT INTO users (uid, email, display_name, photo_url, is_admin, created_at, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (uid) DO UPDATE SET
         display_name = COALESCE(NULLIF($3, ''), users.display_name),
         photo_url = COALESCE(NULLIF($4, ''), users.photo_url),
         is_admin = $5,
         last_login_at = $6
       RETURNING *`,
      [uid, email, displayName || null, photoURL || null, isAdmin, now]
    );
    return this.userFromRow(rows[0]);
  }

  async updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null> {
    const user = await this.getUserByUid(uid);
    if (!user) return null;
    if (user.email === ADMIN_EMAIL) return user;

    await this.pool.query('UPDATE users SET is_admin = $1 WHERE uid = $2', [isAdmin, uid]);
    return (await this.getUserByUid(uid))!;
  }

  // ─── Schedules ──────────────────────────────────────────────────

  async getSchedule(competitionId: number): Promise<CompetitionSchedule | undefined> {
    const { rows } = await this.pool.query(
      'SELECT * FROM schedules WHERE competition_id = $1', [competitionId]
    );
    return rows.length > 0 ? this.scheduleFromRow(rows[0]) : undefined;
  }

  async saveSchedule(schedule: CompetitionSchedule): Promise<CompetitionSchedule> {
    await this.pool.query(
      `INSERT INTO schedules (competition_id, heat_order, style_order, level_order,
        current_heat_index, heat_statuses, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (competition_id) DO UPDATE SET
         heat_order = $2, style_order = $3, level_order = $4,
         current_heat_index = $5, heat_statuses = $6, updated_at = $8`,
      [
        schedule.competitionId,
        JSON.stringify(schedule.heatOrder),
        JSON.stringify(schedule.styleOrder),
        JSON.stringify(schedule.levelOrder),
        schedule.currentHeatIndex,
        JSON.stringify(schedule.heatStatuses),
        schedule.createdAt,
        schedule.updatedAt,
      ]
    );
    return schedule;
  }

  async deleteSchedule(competitionId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM schedules WHERE competition_id = $1', [competitionId]
    );
    return (rowCount ?? 0) > 0;
  }

  // ─── Testing ────────────────────────────────────────────────────

  async resetAllData(): Promise<void> {
    await this.pool.query('TRUNCATE judge_scores, scores, schedules, events, couples, judges, people, competitions, studios, users RESTART IDENTITY CASCADE');
  }
}
