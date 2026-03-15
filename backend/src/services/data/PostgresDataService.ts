import { Pool } from 'pg';
import {
  Competition, CompetitionAdmin, Studio, Organization, Person, Couple, Judge, JudgeProfile, Event, Heat, User, UserProfileUpdate,
  CompetitionSchedule, EntryPayment, PendingEntry, SiteSettings,
} from '../../types';
import { IDataService } from './IDataService';
import { determineRounds, getScoreKey } from './helpers';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'zsexton2011@gmail.com';

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
      organizationId: row.organization_id || undefined,
      description: row.description || undefined,
      bibSettings: row.bib_settings || undefined,
      judgeSettings: row.judge_settings || undefined,
      timingSettings: row.timing_settings || undefined,
      defaultScoringType: row.default_scoring_type || undefined,
      levels: row.levels || undefined,
      levelMode: row.level_mode || undefined,
      pricing: row.pricing || undefined,
      currency: row.currency || undefined,
      maxCouplesPerHeat: row.max_couples_per_heat ?? undefined,
      maxCouplesOnFloor: row.max_couples_on_floor ?? undefined,
      maxCouplesOnFloorByLevel: row.max_couples_on_floor_by_level || undefined,
      recallRules: row.recall_rules || undefined,
      entryValidation: row.entry_validation || undefined,
      ageCategories: row.age_categories || undefined,
      danceOrder: row.dance_order || undefined,
      maxJudgeHoursWithoutBreak: row.max_judge_hours_without_break ?? undefined,
      registrationOpen: row.registration_open ?? undefined,
      registrationOpenAt: row.registration_open_at || undefined,
      publiclyVisible: row.publicly_visible ?? undefined,
      publiclyVisibleAt: row.publicly_visible_at || undefined,
      resultsPublic: row.results_public ?? undefined,
      resultsVisibility: row.results_visibility || undefined,
      heatListsPublished: row.heat_lists_published ?? undefined,
      heatListsPublishedAt: row.heat_lists_published_at || undefined,
      websiteUrl: row.website_url || undefined,
      organizerEmail: row.organizer_email || undefined,
      numberOfDays: row.number_of_days ?? undefined,
      scheduleDayConfigs: row.schedule_day_configs || undefined,
      hardStopTime: row.hard_stop_time || undefined,
      eventTemplates: row.event_templates || undefined,
      scholarshipLevels: row.scholarship_levels || undefined,
      scholarshipTemplates: row.scholarship_templates || undefined,
      invoiceBranding: row.invoice_branding || undefined,
      scoringTypeDefaults: row.scoring_type_defaults || undefined,
      allowDuplicateEntries: row.allow_duplicate_entries ?? undefined,
      createdBy: row.created_by || undefined,
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

  private organizationFromRow(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      rulePresetKey: row.rule_preset_key,
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      dateOfBirth: row.date_of_birth || undefined,
      ageCategory: row.age_category || undefined,
      level: row.level || undefined,
      bib: row.bib ?? undefined,
      competitionId: row.competition_id,
      studioId: row.studio_id || undefined,
      userId: row.user_id || undefined,
    };
  }

  private coupleFromRow(row: any): Couple {
    return {
      id: row.id ?? row.bib,
      bib: row.bib,
      leaderId: row.leader_id,
      followerId: row.follower_id,
      leaderName: row.leader_name,
      followerName: row.follower_name,
      competitionId: row.competition_id,
      billTo: row.bill_to || undefined,
    };
  }

  private judgeFromRow(row: any): Judge {
    return {
      id: row.id,
      name: row.name,
      judgeNumber: row.judge_number,
      competitionId: row.competition_id,
      isChairman: row.is_chairman ?? undefined,
      profileId: row.profile_id ?? undefined,
      judgeRole: row.judge_role ?? undefined,
    };
  }

  private judgeProfileFromRow(row: any): JudgeProfile {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email || undefined,
      userUid: row.user_uid || undefined,
      certifications: row.certifications || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      ageCategory: row.age_category || undefined,
      scratchedBibs: row.scratched_bibs && row.scratched_bibs.length > 0 ? row.scratched_bibs : undefined,
      sectionGroupId: row.section_group_id || undefined,
      sectionLetter: row.section_letter || undefined,
    };
  }

  private userFromRow(row: any): User {
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name || undefined,
      firstName: row.first_name || undefined,
      lastName: row.last_name || undefined,
      photoURL: row.photo_url || undefined,
      phone: row.phone || undefined,
      city: row.city || undefined,
      stateRegion: row.state_region || undefined,
      country: row.country || undefined,
      studioTeamName: row.studio_team_name || undefined,
      signInMethods: row.sign_in_methods || [],
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
      currentDance: row.current_dance || undefined,
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
    const query = `INSERT INTO competitions (name, type, date, location, studio_id, organization_id, description,
        bib_settings, judge_settings, timing_settings, default_scoring_type, levels, level_mode, pricing, currency,
        max_couples_per_heat, max_couples_on_floor, max_couples_on_floor_by_level,
        recall_rules, entry_validation, age_categories, dance_order,
        registration_open, registration_open_at,
        publicly_visible, publicly_visible_at, results_public, results_visibility,
        heat_lists_published, heat_lists_published_at,
        website_url, organizer_email, created_by,
        number_of_days, schedule_day_configs, hard_stop_time, event_templates, scholarship_levels, scholarship_templates, invoice_branding,
        scoring_type_defaults, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42)
       RETURNING *`;
    const params = [
      competition.name, competition.type, competition.date,
      competition.location || null, competition.studioId || null,
      competition.organizationId || null,
      competition.description || null,
      competition.bibSettings ? JSON.stringify(competition.bibSettings) : null,
      competition.judgeSettings ? JSON.stringify(competition.judgeSettings) : null,
      competition.timingSettings ? JSON.stringify(competition.timingSettings) : null,
      competition.defaultScoringType || null,
      competition.levels ? JSON.stringify(competition.levels) : null,
      competition.levelMode || null,
      competition.pricing ? JSON.stringify(competition.pricing) : null,
      competition.currency || null,
      competition.maxCouplesPerHeat ?? null,
      competition.maxCouplesOnFloor ?? null,
      competition.maxCouplesOnFloorByLevel ? JSON.stringify(competition.maxCouplesOnFloorByLevel) : null,
      competition.recallRules ? JSON.stringify(competition.recallRules) : null,
      competition.entryValidation ? JSON.stringify(competition.entryValidation) : null,
      competition.ageCategories ? JSON.stringify(competition.ageCategories) : null,
      competition.danceOrder ? JSON.stringify(competition.danceOrder) : null,
      competition.registrationOpen ?? false,
      competition.registrationOpenAt || null,
      competition.publiclyVisible ?? null,
      competition.publiclyVisibleAt || null,
      competition.resultsPublic ?? null,
      competition.resultsVisibility ? JSON.stringify(competition.resultsVisibility) : null,
      competition.heatListsPublished ?? null,
      competition.heatListsPublishedAt || null,
      competition.websiteUrl || null,
      competition.organizerEmail || null,
      competition.createdBy || null,
      competition.numberOfDays ?? null,
      competition.scheduleDayConfigs ? JSON.stringify(competition.scheduleDayConfigs) : null,
      competition.hardStopTime || null,
      competition.eventTemplates ? JSON.stringify(competition.eventTemplates) : null,
      competition.scholarshipLevels ? JSON.stringify(competition.scholarshipLevels) : null,
      competition.scholarshipTemplates ? JSON.stringify(competition.scholarshipTemplates) : null,
      competition.invoiceBranding ? JSON.stringify(competition.invoiceBranding) : null,
      competition.scoringTypeDefaults ? JSON.stringify(competition.scoringTypeDefaults) : null,
      now,
    ];
    let rows;
    try {
      ({ rows } = await this.pool.query(query, params));
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'competitions_pkey') {
        await this.pool.query(`SELECT setval('competitions_id_seq', COALESCE((SELECT MAX(id) FROM competitions), 0))`);
        ({ rows } = await this.pool.query(query, params));
      } else {
        throw err;
      }
    }
    const comp = this.competitionFromRow(rows[0]);

    // Auto-add creator as competition admin
    if (competition.createdBy) {
      await this.addCompetitionAdmin(comp.id, competition.createdBy).catch(() => {});
    }

    return comp;
  }

  async updateCompetition(id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>): Promise<Competition | null> {
    const existing = await this.getCompetitionById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', type: 'type', date: 'date', location: 'location',
      studioId: 'studio_id', organizationId: 'organization_id',
      description: 'description',
      defaultScoringType: 'default_scoring_type', levelMode: 'level_mode',
      currency: 'currency',
      maxCouplesPerHeat: 'max_couples_per_heat', maxCouplesOnFloor: 'max_couples_on_floor',
      maxJudgeHoursWithoutBreak: 'max_judge_hours_without_break',
      registrationOpen: 'registration_open', registrationOpenAt: 'registration_open_at',
      publiclyVisible: 'publicly_visible', publiclyVisibleAt: 'publicly_visible_at',
      resultsPublic: 'results_public',
      heatListsPublished: 'heat_lists_published', heatListsPublishedAt: 'heat_lists_published_at',
      websiteUrl: 'website_url', organizerEmail: 'organizer_email',
      numberOfDays: 'number_of_days', hardStopTime: 'hard_stop_time',
      allowDuplicateEntries: 'allow_duplicate_entries',
    };
    const jsonFields: Record<string, string> = {
      bibSettings: 'bib_settings',
      judgeSettings: 'judge_settings', timingSettings: 'timing_settings',
      levels: 'levels', pricing: 'pricing',
      maxCouplesOnFloorByLevel: 'max_couples_on_floor_by_level',
      recallRules: 'recall_rules', entryValidation: 'entry_validation',
      ageCategories: 'age_categories', danceOrder: 'dance_order',
      resultsVisibility: 'results_visibility',
      scheduleDayConfigs: 'schedule_day_configs',
      eventTemplates: 'event_templates',
      scholarshipLevels: 'scholarship_levels',
      scholarshipTemplates: 'scholarship_templates',
      invoiceBranding: 'invoice_branding',
      scoringTypeDefaults: 'scoring_type_defaults',
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
    const { rows } = await this.pool.query(
      'SELECT event_id, bib, paid, paid_by, paid_at, notes FROM entry_payments WHERE competition_id = $1',
      [competitionId]
    );
    const result: Record<string, EntryPayment> = {};
    for (const row of rows) {
      const key = `${row.event_id}:${row.bib}`;
      result[key] = {
        paid: row.paid,
        paidBy: row.paid_by ?? undefined,
        paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
        notes: row.notes || undefined,
      };
    }
    return result;
  }

  async updateEntryPayments(
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    updates: { paid: boolean; paidBy?: number; notes?: string }
  ): Promise<Record<string, EntryPayment> | null> {
    const comp = await this.getCompetitionById(competitionId);
    if (!comp) return null;

    const result: Record<string, EntryPayment> = {};
    const now = new Date().toISOString();

    for (const { eventId, bib } of entries) {
      const key = `${eventId}:${bib}`;
      const paidAt = updates.paid ? now : null;
      const paidBy = updates.paid ? (updates.paidBy ?? null) : null;

      await this.pool.query(
        `INSERT INTO entry_payments (competition_id, event_id, bib, paid, paid_by, paid_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (competition_id, event_id, bib) DO UPDATE SET
           paid = $4, paid_by = $5, paid_at = CASE WHEN $4 THEN COALESCE(entry_payments.paid_at, $6) ELSE NULL END,
           notes = COALESCE($7, entry_payments.notes)`,
        [competitionId, eventId, bib, updates.paid, paidBy, paidAt, updates.notes ?? null]
      );

      result[key] = {
        paid: updates.paid,
        paidBy: paidBy ?? undefined,
        paidAt: updates.paid ? now : undefined,
        notes: updates.notes,
      };
    }

    return result;
  }

  async deleteCompetition(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM competitions WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Event Entries ─────────────────────────────────────────────

  async getEventEntries(eventId: number): Promise<Array<{ bib: number; scratched: boolean }>> {
    const { rows } = await this.pool.query(
      'SELECT bib, scratched FROM event_entries WHERE event_id = $1 ORDER BY bib',
      [eventId]
    );
    return rows.map(r => ({ bib: r.bib, scratched: r.scratched }));
  }

  async getEntriesForBib(competitionId: number, bib: number): Promise<Array<{ eventId: number; scratched: boolean }>> {
    const { rows } = await this.pool.query(
      'SELECT event_id, scratched FROM event_entries WHERE competition_id = $1 AND bib = $2 ORDER BY event_id',
      [competitionId, bib]
    );
    return rows.map(r => ({ eventId: r.event_id, scratched: r.scratched }));
  }

  async addEventEntry(eventId: number, bib: number, competitionId: number, coupleId?: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO event_entries (event_id, bib, competition_id, couple_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [eventId, bib, competitionId, coupleId ?? null]
    );
  }

  async removeEventEntry(eventId: number, bib: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM event_entries WHERE event_id = $1 AND bib = $2',
      [eventId, bib]
    );
  }

  async scratchEntry(eventId: number, bib: number): Promise<void> {
    await this.pool.query(
      'UPDATE event_entries SET scratched = true WHERE event_id = $1 AND bib = $2',
      [eventId, bib]
    );
  }

  async unscratchEntry(eventId: number, bib: number): Promise<void> {
    await this.pool.query(
      'UPDATE event_entries SET scratched = false WHERE event_id = $1 AND bib = $2',
      [eventId, bib]
    );
  }

  // ─── Pending Entries ──────────────────────────────────────────

  async getPendingEntries(competitionId: number): Promise<PendingEntry[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM pending_entries WHERE competition_id = $1 ORDER BY requested_at',
      [competitionId]
    );
    return rows.map(r => ({
      id: r.id,
      bib: r.bib,
      competitionId: r.competition_id,
      combination: r.combination,
      reason: r.reason,
      requestedAt: new Date(r.requested_at).toISOString(),
      requestedBy: r.requested_by || undefined,
    }));
  }

  async addPendingEntry(entry: PendingEntry): Promise<PendingEntry> {
    await this.pool.query(
      `INSERT INTO pending_entries (id, competition_id, bib, combination, reason, requested_at, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.id, entry.competitionId, entry.bib, JSON.stringify(entry.combination),
       entry.reason, entry.requestedAt, entry.requestedBy || null]
    );
    return entry;
  }

  async removePendingEntry(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM pending_entries WHERE id = $1', [id]
    );
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

  // ─── Organizations ─────────────────────────────────────────────

  async getOrganizations(): Promise<Organization[]> {
    const { rows } = await this.pool.query('SELECT * FROM organizations ORDER BY id');
    return rows.map(r => this.organizationFromRow(r));
  }

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return rows.length > 0 ? this.organizationFromRow(rows[0]) : undefined;
  }

  async addOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO organizations (name, rule_preset_key, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [org.name, org.rulePresetKey, JSON.stringify(org.settings || {}), now, now]
    );
    return this.organizationFromRow(rows[0]);
  }

  async updateOrganization(id: number, updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Organization | null> {
    const existing = await this.getOrganizationById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    const map: Record<string, string> = {
      name: 'name', rulePresetKey: 'rule_preset_key',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${paramIdx++}`);
        values.push((updates as any)[key]);
      }
    }
    if (updates.settings !== undefined) {
      fields.push(`settings = $${paramIdx++}`);
      values.push(JSON.stringify(updates.settings));
    }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = $${paramIdx++}`);
    values.push(new Date().toISOString());
    values.push(id);
    await this.pool.query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
      values
    );
    return (await this.getOrganizationById(id))!;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM organizations WHERE id = $1', [id]);
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

  async getPersonByEmail(email: string, competitionId: number): Promise<Person | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM people WHERE LOWER(email) = LOWER($1) AND competition_id = $2 LIMIT 1',
      [email, competitionId]
    );
    return rows.length > 0 ? this.personFromRow(rows[0]) : null;
  }

  async getPersonsByUserId(userId: string): Promise<Person[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM people WHERE user_id = $1 ORDER BY id', [userId]
    );
    return rows.map(r => this.personFromRow(r));
  }

  async addPerson(person: Omit<Person, 'id'>): Promise<Person> {
    // If email provided, return existing person rather than creating a duplicate
    if (person.email) {
      const { rows: existing } = await this.pool.query(
        'SELECT * FROM people WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [person.email]
      );
      if (existing.length > 0) return this.personFromRow(existing[0]);
    }

    const query = `INSERT INTO people (first_name, last_name, email, role, status, competition_id, studio_id, user_id, bib)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    const params = [
      person.firstName, person.lastName, person.email || null,
      person.role, person.status, person.competitionId, person.studioId || null,
      person.userId || null, person.bib ?? null,
    ];
    try {
      const { rows } = await this.pool.query(query, params);
      return this.personFromRow(rows[0]);
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'people_pkey') {
        // Sequence out of sync — fix it and retry
        await this.pool.query(`SELECT setval('people_id_seq', COALESCE((SELECT MAX(id) FROM people), 0))`);
        const { rows } = await this.pool.query(query, params);
        return this.personFromRow(rows[0]);
      }
      throw err;
    }
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
      userId: 'user_id', bib: 'bib',
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

  async getCouplesByBibs(bibs: number[]): Promise<Map<number, Couple>> {
    if (bibs.length === 0) return new Map();
    const { rows } = await this.pool.query(
      'SELECT * FROM couples WHERE bib = ANY($1)', [bibs]
    );
    const map = new Map<number, Couple>();
    for (const row of rows) {
      map.set(row.bib, this.coupleFromRow(row));
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
      await this.pool.query('UPDATE people SET bib = $1 WHERE id = $2', [bibNumber, leaderId]);
    }

    const query = `INSERT INTO couples (leader_id, follower_id, leader_name, follower_name, competition_id, bib)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const params = [leaderId, followerId, leaderName, followerName, competitionId, bibNumber];
    try {
      const { rows } = await this.pool.query(query, params);
      return this.coupleFromRow(rows[0]);
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'couples_pkey') {
        await this.pool.query(`SELECT setval('couples_bib_seq', COALESCE((SELECT MAX(bib) FROM couples), 0))`);
        const { rows } = await this.pool.query(query, params);
        return this.coupleFromRow(rows[0]);
      }
      throw err;
    }
  }

  async deleteCouple(bib: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM couples WHERE bib = $1', [bib]);
    return (rowCount ?? 0) > 0;
  }

  async updateCouple(bib: number, updates: Partial<Pick<Couple, 'billTo'>>): Promise<Couple | null> {
    const existing = await this.getCoupleByBib(bib);
    if (!existing) return null;
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (updates.billTo !== undefined) {
      fields.push(`bill_to = $${paramIdx++}`);
      values.push(updates.billTo || null);
    }
    if (fields.length === 0) return existing;
    values.push(bib);
    await this.pool.query(`UPDATE couples SET ${fields.join(', ')} WHERE bib = $${paramIdx}`, values);
    return (await this.getCoupleByBib(bib))!;
  }

  // ─── Couples by ID (Phase 2) ─────────────────────────────────────

  async getCoupleById(id: number): Promise<Couple | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM couples WHERE id = $1', [id]);
    return rows.length > 0 ? this.coupleFromRow(rows[0]) : undefined;
  }

  async updateCoupleById(id: number, updates: Partial<Pick<Couple, 'billTo'>>): Promise<Couple | null> {
    const existing = await this.getCoupleById(id);
    if (!existing) return null;
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (updates.billTo !== undefined) {
      fields.push(`bill_to = $${paramIdx++}`);
      values.push(updates.billTo || null);
    }
    if (fields.length === 0) return existing;
    values.push(id);
    await this.pool.query(`UPDATE couples SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    return (await this.getCoupleById(id))!;
  }

  async deleteCoupleById(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM couples WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Bib assignment ──────────────────────────────────────────────

  async assignBib(competitionId: number, personStatus: 'student' | 'professional'): Promise<number> {
    const competition = await this.getCompetitionById(competitionId);
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

    // Find next available bib in range for this competition
    const { rows } = await this.pool.query(
      'SELECT bib FROM people WHERE competition_id = $1 AND bib IS NOT NULL ORDER BY bib',
      [competitionId]
    );
    const usedBibs = new Set(rows.map((r: any) => r.bib as number));

    for (let candidate = startNumber; ; candidate++) {
      if (endNumber !== undefined && candidate > endNumber) {
        throw new Error(`No available bibs in range ${startNumber}-${endNumber} for status ${personStatus}`);
      }
      if (!usedBibs.has(candidate)) return candidate;
    }
  }

  async reassignPersonBib(personId: number, newBib: number): Promise<boolean> {
    const person = await this.getPersonById(personId);
    if (!person) return false;

    const oldBib = person.bib;
    if (oldBib === undefined || oldBib === null) return false;

    // Check new bib is available
    const { rows: conflict } = await this.pool.query(
      'SELECT id FROM people WHERE competition_id = $1 AND bib = $2 AND id != $3',
      [person.competitionId, newBib, personId]
    );
    if (conflict.length > 0) throw new Error(`Bib ${newBib} is already taken in this competition`);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update person bib
      await client.query('UPDATE people SET bib = $1 WHERE id = $2', [newBib, personId]);

      // 2. Update all couples with this leader
      await client.query('UPDATE couples SET bib = $1 WHERE leader_id = $2', [newBib, personId]);

      // 3. Get affected couple ids to find relevant events
      const { rows: coupleRows } = await client.query(
        'SELECT id FROM couples WHERE leader_id = $1', [personId]
      );

      // 4. Update event_entries
      await client.query(
        'UPDATE event_entries SET bib = $1 WHERE competition_id = $2 AND bib = $3',
        [newBib, person.competitionId, oldBib]
      );

      // 5. Update entry_payments
      await client.query(
        'UPDATE entry_payments SET bib = $1 WHERE competition_id = $2 AND bib = $3',
        [newBib, person.competitionId, oldBib]
      );

      // 6. Update events heats JSONB — replace old bib with new in bibs arrays
      const { rows: eventRows } = await client.query(
        'SELECT id, heats, scratched_bibs FROM events WHERE competition_id = $1',
        [person.competitionId]
      );
      for (const eventRow of eventRows) {
        let heatsChanged = false;
        const heats = eventRow.heats || [];
        for (const heat of heats) {
          const idx = heat.bibs?.indexOf(oldBib);
          if (idx !== undefined && idx >= 0) {
            heat.bibs[idx] = newBib;
            heatsChanged = true;
          }
        }
        let scratchedChanged = false;
        const scratched = eventRow.scratched_bibs || [];
        const scrIdx = scratched.indexOf(oldBib);
        if (scrIdx >= 0) {
          scratched[scrIdx] = newBib;
          scratchedChanged = true;
        }
        if (heatsChanged || scratchedChanged) {
          await client.query(
            'UPDATE events SET heats = $1, scratched_bibs = $2 WHERE id = $3',
            [JSON.stringify(heats), JSON.stringify(scratched), eventRow.id]
          );
        }
      }

      // 7. Update scores
      await client.query(
        `UPDATE scores SET bib = $1 WHERE bib = $2 AND event_id IN (
          SELECT id FROM events WHERE competition_id = $3
        )`,
        [newBib, oldBib, person.competitionId]
      );

      // 8. Update judge_scores
      await client.query(
        `UPDATE judge_scores SET bib = $1 WHERE bib = $2 AND event_id IN (
          SELECT id FROM events WHERE competition_id = $3
        )`,
        [newBib, oldBib, person.competitionId]
      );

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async bulkReassignBibs(competitionId: number): Promise<void> {
    const competition = await this.getCompetitionById(competitionId);
    if (!competition) throw new Error(`Competition ${competitionId} not found`);

    // Get all leaders (people who are in couples as leaders)
    const { rows: leaderRows } = await this.pool.query(
      `SELECT DISTINCT p.id, p.status, p.bib
       FROM people p
       JOIN couples c ON c.leader_id = p.id
       WHERE p.competition_id = $1
       ORDER BY p.id`,
      [competitionId]
    );

    for (const leader of leaderRows) {
      const newBib = await this.assignBib(competitionId, leader.status);
      if (leader.bib !== newBib) {
        if (leader.bib) {
          await this.reassignPersonBib(leader.id, newBib);
        } else {
          // Person has no bib yet — just set it and update couples
          await this.pool.query('UPDATE people SET bib = $1 WHERE id = $2', [newBib, leader.id]);
          await this.pool.query('UPDATE couples SET bib = $1 WHERE leader_id = $2', [newBib, leader.id]);
        }
      }
    }
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

  async getJudgesByIds(ids: number[]): Promise<Map<number, Judge>> {
    if (ids.length === 0) return new Map();
    const { rows } = await this.pool.query(
      'SELECT * FROM judges WHERE id = ANY($1)', [ids]
    );
    const map = new Map<number, Judge>();
    for (const row of rows) {
      map.set(row.id, this.judgeFromRow(row));
    }
    return map;
  }

  async addJudge(name: string, competitionId: number): Promise<Judge> {
    const { rows: existing } = await this.pool.query(
      'SELECT MAX(judge_number) as max_num FROM judges WHERE competition_id = $1',
      [competitionId]
    );
    const judgeNumber = (existing[0].max_num || 0) + 1;

    const query = `INSERT INTO judges (name, judge_number, competition_id)
       VALUES ($1, $2, $3) RETURNING *`;
    const params = [name, judgeNumber, competitionId];
    try {
      const { rows } = await this.pool.query(query, params);
      return this.judgeFromRow(rows[0]);
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'judges_pkey') {
        await this.pool.query(`SELECT setval('judges_id_seq', COALESCE((SELECT MAX(id) FROM judges), 0))`);
        const { rows } = await this.pool.query(query, params);
        return this.judgeFromRow(rows[0]);
      }
      throw err;
    }
  }

  // ─── Judge Profiles ───────────────────────────────────────────

  async getJudgeProfiles(): Promise<JudgeProfile[]> {
    const { rows } = await this.pool.query('SELECT * FROM judge_profiles ORDER BY last_name, first_name');
    return rows.map(r => this.judgeProfileFromRow(r));
  }

  async getJudgeProfileById(id: number): Promise<JudgeProfile | undefined> {
    const { rows } = await this.pool.query('SELECT * FROM judge_profiles WHERE id = $1', [id]);
    return rows.length > 0 ? this.judgeProfileFromRow(rows[0]) : undefined;
  }

  async addJudgeProfile(profile: Omit<JudgeProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<JudgeProfile> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO judge_profiles (first_name, last_name, email, user_uid, certifications, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [profile.firstName, profile.lastName, profile.email || null, profile.userUid || null, JSON.stringify(profile.certifications || {}), now, now]
    );
    return this.judgeProfileFromRow(rows[0]);
  }

  async updateJudgeProfile(id: number, updates: Partial<Omit<JudgeProfile, 'id'>>): Promise<JudgeProfile | null> {
    const existing = await this.getJudgeProfileById(id);
    if (!existing) return null;

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (updates.firstName !== undefined) { setClauses.push(`first_name = $${paramIdx++}`); values.push(updates.firstName); }
    if (updates.lastName !== undefined) { setClauses.push(`last_name = $${paramIdx++}`); values.push(updates.lastName); }
    if (updates.email !== undefined) { setClauses.push(`email = $${paramIdx++}`); values.push(updates.email || null); }
    if (updates.userUid !== undefined) { setClauses.push(`user_uid = $${paramIdx++}`); values.push(updates.userUid || null); }
    if (updates.certifications !== undefined) { setClauses.push(`certifications = $${paramIdx++}`); values.push(JSON.stringify(updates.certifications)); }

    setClauses.push(`updated_at = $${paramIdx++}`);
    values.push(new Date().toISOString());

    if (setClauses.length === 1) return existing; // only updated_at

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE judge_profiles SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );
    return this.judgeProfileFromRow(rows[0]);
  }

  async deleteJudgeProfile(id: number): Promise<boolean> {
    // Clear profile_id references from judges first
    await this.pool.query('UPDATE judges SET profile_id = NULL WHERE profile_id = $1', [id]);
    const { rowCount } = await this.pool.query('DELETE FROM judge_profiles WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async updateJudge(id: number, updates: Partial<Omit<Judge, 'id'>>): Promise<Judge | null> {
    const existing = await this.getJudgeById(id);
    if (!existing) return null;

    if (updates.isChairman === true) {
      await this.pool.query(
        'UPDATE judges SET is_chairman = FALSE WHERE competition_id = $1 AND id != $2',
        [existing.competitionId, id]
      );
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      values.push(updates.name);
    }
    if (updates.judgeNumber !== undefined) {
      setClauses.push(`judge_number = $${paramIdx++}`);
      values.push(updates.judgeNumber);
    }
    if (updates.isChairman !== undefined) {
      setClauses.push(`is_chairman = $${paramIdx++}`);
      values.push(updates.isChairman);
    }
    if (updates.profileId !== undefined) {
      setClauses.push(`profile_id = $${paramIdx++}`);
      values.push(updates.profileId || null);
    }
    if (updates.judgeRole !== undefined) {
      setClauses.push(`judge_role = $${paramIdx++}`);
      values.push(updates.judgeRole || null);
    }

    if (setClauses.length === 0) return existing;

    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE judges SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
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

  async getEventsByIds(ids: number[]): Promise<Map<number, Event>> {
    if (ids.length === 0) return new Map();
    const { rows } = await this.pool.query(
      'SELECT * FROM events WHERE id = ANY($1)', [ids]
    );
    const map = new Map<number, Event>();
    for (const row of rows) {
      map.set(row.id, this.eventFromRow(row));
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
    const heats: Heat[] = rounds.map((round, index) => ({
      round,
      bibs: index === 0 ? bibs : [],
      judges: judgeIds,
    }));

    const query = `INSERT INTO events (name, designation, syllabus_type, level, style, dances,
        heats, competition_id, scoring_type, is_scholarship, age_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;
    const params = [
      name, designation || null, syllabusType || null, level || null,
      style || null, dances ? JSON.stringify(dances) : null,
      JSON.stringify(heats), competitionId, scoringType || null,
      isScholarship || false, ageCategory || null,
    ];
    let event: Event;
    try {
      const { rows } = await this.pool.query(query, params);
      event = this.eventFromRow(rows[0]);
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'events_pkey') {
        await this.pool.query(`SELECT setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 0))`);
        const { rows } = await this.pool.query(query, params);
        event = this.eventFromRow(rows[0]);
      } else {
        throw err;
      }
    }

    // Dual-write: insert into event_entries
    if (bibs.length > 0) {
      const eeValues: any[] = [];
      const eePlaceholders: string[] = [];
      let eeIdx = 1;
      for (const bib of bibs) {
        eePlaceholders.push(`($${eeIdx++}, $${eeIdx++}, $${eeIdx++})`);
        eeValues.push(event.id, bib, competitionId);
      }
      await this.pool.query(
        `INSERT INTO event_entries (event_id, bib, competition_id) VALUES ${eePlaceholders.join(', ')} ON CONFLICT DO NOTHING`,
        eeValues
      );
    }

    return event;
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
      ageCategory: 'age_category',
      sectionGroupId: 'section_group_id', sectionLetter: 'section_letter',
    };
    const jsonMap: Record<string, string> = {
      dances: 'dances', heats: 'heats', scratchedBibs: 'scratched_bibs',
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
    // Clean up scores and event_entries first
    await this.pool.query('DELETE FROM scores WHERE event_id = $1', [id]);
    await this.pool.query('DELETE FROM judge_scores WHERE event_id = $1', [id]);
    await this.pool.query('DELETE FROM event_entries WHERE event_id = $1', [id]);
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

  async getScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, number[]>> {
    const result: Record<number, number[]> = {};
    if (bibs.length === 0) return result;
    const d = dance || '';
    const { rows } = await this.pool.query(
      'SELECT bib, scores FROM scores WHERE event_id = $1 AND round = $2 AND dance = $3 AND bib = ANY($4)',
      [eventId, round, d, bibs]
    );
    for (const row of rows) {
      result[row.bib] = row.scores;
    }
    return result;
  }

  async setScores(eventId: number, round: string, bib: number, scores: number[], dance?: string): Promise<void> {
    const d = dance || '';
    await this.pool.query(
      `INSERT INTO scores (event_id, round, bib, dance, scores) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, round, bib, dance) DO UPDATE SET scores = $5`,
      [eventId, round, bib, d, JSON.stringify(scores)]
    );
  }

  async setScoresBatch(eventId: number, round: string, entries: Array<{ bib: number; scores: number[] }>, dance?: string): Promise<void> {
    if (entries.length === 0) return;
    const d = dance || '';
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;
    for (const { bib, scores } of entries) {
      placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
      values.push(eventId, round, bib, d, JSON.stringify(scores));
    }
    await this.pool.query(
      `INSERT INTO scores (event_id, round, bib, dance, scores)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (event_id, round, bib, dance) DO UPDATE SET scores = EXCLUDED.scores`,
      values
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

  async hasAnyScores(eventId: number): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM scores WHERE event_id = $1 LIMIT 1', [eventId]
    );
    return rows.length > 0;
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

  async getJudgeScoresForRound(eventId: number, round: string, bibs: number[], dance?: string): Promise<Record<number, Record<number, number>>> {
    const result: Record<number, Record<number, number>> = {};
    if (bibs.length === 0) return result;
    const d = dance || '';
    const { rows } = await this.pool.query(
      'SELECT bib, judge_id, score FROM judge_scores WHERE event_id = $1 AND round = $2 AND dance = $3 AND bib = ANY($4)',
      [eventId, round, d, bibs]
    );
    for (const row of rows) {
      if (!result[row.bib]) result[row.bib] = {};
      result[row.bib][row.judge_id] = row.score;
    }
    return result;
  }

  async setJudgeScoresBatch(
    eventId: number, round: string, judgeId: number,
    entries: Array<{ bib: number; score: number }>,
    dance?: string
  ): Promise<void> {
    if (entries.length === 0) return;
    const d = dance || '';
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;
    for (const { bib, score } of entries) {
      placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
      values.push(eventId, round, bib, judgeId, d, score);
    }
    await this.pool.query(
      `INSERT INTO judge_scores (event_id, round, bib, judge_id, dance, score)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (event_id, round, bib, judge_id, dance) DO UPDATE SET score = EXCLUDED.score`,
      values
    );
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

      const d = entry.dance || '';
      const { rows } = await this.pool.query(
        `SELECT judge_id, COUNT(*) as cnt FROM judge_scores
         WHERE event_id = $1 AND round = $2 AND dance = $3 AND bib = ANY($4) AND judge_id = ANY($5)
         GROUP BY judge_id`,
        [entry.eventId, entry.round, d, entry.bibs, judgeIds]
      );
      const countByJudge: Record<number, number> = {};
      for (const row of rows) countByJudge[row.judge_id] = parseInt(row.cnt);

      for (const jId of judgeIds) {
        if ((countByJudge[jId] || 0) < entry.bibs.length) {
          status[jId] = false;
        }
      }
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

  async upsertUser(uid: string, email: string, displayName?: string, photoURL?: string, signInMethod?: string): Promise<User> {
    const now = new Date().toISOString();
    const isAdmin = email === ADMIN_EMAIL;
    const nameParts = displayName?.trim().split(/\s+/) || [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
    const methods = signInMethod ? JSON.stringify([signInMethod]) : '[]';

    // Remove any placeholder row created by migration seeding (different uid, same email)
    await this.pool.query(
      'DELETE FROM users WHERE email = $1 AND uid != $2 AND uid LIKE $3',
      [email, uid, 'pending-%']
    );

    const { rows } = await this.pool.query(
      `INSERT INTO users (uid, email, display_name, first_name, last_name, photo_url, sign_in_methods, is_admin, created_at, last_login_at)
       VALUES ($1, $2, $3, $7, $8, $4, $9::jsonb, $5, $6, $6)
       ON CONFLICT (uid) DO UPDATE SET
         display_name = COALESCE(NULLIF($3, ''), users.display_name),
         first_name = COALESCE(users.first_name, $7),
         last_name = COALESCE(users.last_name, $8),
         photo_url = COALESCE(NULLIF($4, ''), users.photo_url),
         sign_in_methods = CASE
           WHEN $9::jsonb = '[]'::jsonb THEN users.sign_in_methods
           WHEN users.sign_in_methods @> $9::jsonb THEN users.sign_in_methods
           ELSE users.sign_in_methods || $9::jsonb
         END,
         is_admin = users.is_admin OR $5,
         last_login_at = $6
       RETURNING *`,
      [uid, email, displayName || null, photoURL || null, isAdmin, now, firstName, lastName, methods]
    );
    return this.userFromRow(rows[0]);
  }

  async updateUserProfile(uid: string, updates: UserProfileUpdate): Promise<User | null> {
    const existing = await this.getUserByUid(uid);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      city: 'city',
      stateRegion: 'state_region',
      country: 'country',
      studioTeamName: 'studio_team_name',
    };

    for (const [key, col] of Object.entries(map)) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(uid);
    await this.pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE uid = $${idx}`,
      values
    );
    return (await this.getUserByUid(uid))!;
  }

  async updateUserAdmin(uid: string, isAdmin: boolean): Promise<User | null> {
    const user = await this.getUserByUid(uid);
    if (!user) return null;
    if (user.email === ADMIN_EMAIL) return user;

    await this.pool.query('UPDATE users SET is_admin = $1 WHERE uid = $2', [isAdmin, uid]);
    return (await this.getUserByUid(uid))!;
  }

  // ─── Schedules ──────────────────────────────────────────────────

  // ─── Site Settings ──────────────────────────────────────────

  async getSiteSettings(): Promise<SiteSettings> {
    try {
      const { rows } = await this.pool.query('SELECT * FROM site_settings WHERE id = 1');
      if (rows.length > 0) {
        return {
          maxJudgeHoursWithoutBreak: rows[0].max_judge_hours_without_break ?? undefined,
        };
      }
    } catch {
      // Table may not exist yet
    }
    return {};
  }

  async updateSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
    const maxHours = updates.maxJudgeHoursWithoutBreak ?? null;
    await this.pool.query(
      `INSERT INTO site_settings (id, max_judge_hours_without_break) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET max_judge_hours_without_break = $1`,
      [maxHours]
    );
    return this.getSiteSettings();
  }

  // ─── Schedules ─────────────────────────────────────────────

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

  // ─── Competition Admins ─────────────────────────────────────────

  async getCompetitionAdmins(competitionId: number): Promise<CompetitionAdmin[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM competition_admins WHERE competition_id = $1',
      [competitionId]
    );
    return rows.map(r => ({
      competitionId: r.competition_id,
      userUid: r.user_uid,
      role: r.role,
      createdAt: r.created_at,
    }));
  }

  async getEnrichedCompetitionAdmins(competitionId: number): Promise<(CompetitionAdmin & { email?: string; displayName?: string; firstName?: string; lastName?: string })[]> {
    const { rows } = await this.pool.query(
      `SELECT ca.competition_id, ca.user_uid, ca.role, ca.created_at,
              u.email, u.display_name, u.first_name, u.last_name
       FROM competition_admins ca
       LEFT JOIN users u ON ca.user_uid = u.uid
       WHERE ca.competition_id = $1`,
      [competitionId]
    );
    return rows.map(r => ({
      competitionId: r.competition_id,
      userUid: r.user_uid,
      role: r.role,
      createdAt: r.created_at,
      email: r.email || undefined,
      displayName: r.display_name || undefined,
      firstName: r.first_name || undefined,
      lastName: r.last_name || undefined,
    }));
  }

  async getCompetitionsByAdmin(userUid: string): Promise<number[]> {
    const { rows } = await this.pool.query(
      'SELECT competition_id FROM competition_admins WHERE user_uid = $1',
      [userUid]
    );
    return rows.map(r => r.competition_id);
  }

  async addCompetitionAdmin(competitionId: number, userUid: string, role: string = 'admin'): Promise<CompetitionAdmin> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO competition_admins (competition_id, user_uid, role, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (competition_id, user_uid) DO UPDATE SET role = $3
       RETURNING *`,
      [competitionId, userUid, role, now]
    );
    const r = rows[0];
    return { competitionId: r.competition_id, userUid: r.user_uid, role: r.role, createdAt: r.created_at };
  }

  async removeCompetitionAdmin(competitionId: number, userUid: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'DELETE FROM competition_admins WHERE competition_id = $1 AND user_uid = $2',
      [competitionId, userUid]
    );
    return (rowCount ?? 0) > 0;
  }

  async isCompetitionAdmin(competitionId: number, userUid: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM competition_admins WHERE competition_id = $1 AND user_uid = $2 LIMIT 1',
      [competitionId, userUid]
    );
    return rows.length > 0;
  }

  // ─── Testing ────────────────────────────────────────────────────

  clearCache(): void {}

  async resetAllData(): Promise<void> {
    await this.pool.query('TRUNCATE competition_admins, judge_scores, scores, schedules, events, couples, judges, people, competitions, studios, organizations, users RESTART IDENTITY CASCADE');
    try { await this.pool.query('DELETE FROM site_settings'); } catch { /* table may not exist */ }
    try { await this.pool.query('TRUNCATE judge_profiles RESTART IDENTITY CASCADE'); } catch { /* table may not exist */ }
  }
}
