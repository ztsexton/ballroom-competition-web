import { IDataService } from '../../../services/data/IDataService';
import { PendingEntry } from '../../../types';

export function dataServiceContractTests(
  createService: () => IDataService | Promise<IDataService>,
  cleanup?: () => Promise<void>
) {
  let ds: IDataService;

  beforeEach(async () => {
    ds = await createService();
    await ds.resetAllData();
  });

  if (cleanup) {
    afterAll(async () => {
      await cleanup();
    });
  }

  // ─── Competitions ───────────────────────────────────────────────

  describe('Competitions', () => {
    it('should start empty', async () => {
      const comps = await ds.getCompetitions();
      expect(comps).toEqual([]);
    });

    it('should add and retrieve a competition', async () => {
      const comp = await ds.addCompetition({
        name: 'Spring Classic',
        type: 'STUDIO',
        date: '2026-03-01',
        location: 'NYC',
      });
      expect(comp.id).toBeDefined();
      expect(comp.name).toBe('Spring Classic');
      expect(comp.createdAt).toBeDefined();

      const fetched = await ds.getCompetitionById(comp.id);
      expect(fetched).toEqual(comp);
    });

    it('should list all competitions', async () => {
      await ds.addCompetition({ name: 'Comp A', type: 'STUDIO', date: '2026-01-01' });
      await ds.addCompetition({ name: 'Comp B', type: 'NDCA', date: '2026-02-01' });
      const comps = await ds.getCompetitions();
      expect(comps).toHaveLength(2);
    });

    it('should update a competition', async () => {
      const comp = await ds.addCompetition({ name: 'Old Name', type: 'STUDIO', date: '2026-01-01' });
      const updated = await ds.updateCompetition(comp.id, { name: 'New Name' });
      expect(updated?.name).toBe('New Name');
      expect(updated?.type).toBe('STUDIO');
    });

    it('should return null when updating non-existent competition', async () => {
      const result = await ds.updateCompetition(999, { name: 'X' });
      expect(result).toBeNull();
    });

    it('should delete a competition', async () => {
      const comp = await ds.addCompetition({ name: 'Del', type: 'STUDIO', date: '2026-01-01' });
      const deleted = await ds.deleteCompetition(comp.id);
      expect(deleted).toBe(true);
      const fetched = await ds.getCompetitionById(comp.id);
      expect(fetched).toBeUndefined();
    });

    it('should return false when deleting non-existent competition', async () => {
      const result = await ds.deleteCompetition(999);
      expect(result).toBe(false);
    });

    it('should cascade delete related entities', async () => {
      const comp = await ds.addCompetition({ name: 'Cascade', type: 'STUDIO', date: '2026-01-01' });
      const leader = await ds.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const follower = await ds.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student', competitionId: comp.id,
      });
      await ds.addCouple(leader.id, follower.id, comp.id);
      await ds.addJudge('Judge 1', comp.id);
      await ds.addEvent('Event 1', [], [], comp.id);

      await ds.deleteCompetition(comp.id);

      expect(await ds.getPeople(comp.id)).toEqual([]);
      expect(await ds.getCouples(comp.id)).toEqual([]);
      expect(await ds.getJudges(comp.id)).toEqual([]);
      const events = await ds.getEvents(comp.id);
      expect(Object.keys(events)).toHaveLength(0);
    });
  });

  // ─── Entry Payments ─────────────────────────────────────────────

  describe('Entry Payments', () => {
    it('should return empty payments for competition without any', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const payments = await ds.getEntryPayments(comp.id);
      expect(payments).toEqual({});
    });

    it('should create and update entry payments', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const result = await ds.updateEntryPayments(
        comp.id,
        [{ eventId: 1, bib: 100 }],
        { paid: true, paidBy: 5, notes: 'Cash' }
      );
      expect(result).not.toBeNull();
      expect(result!['1:100'].paid).toBe(true);
      expect(result!['1:100'].paidBy).toBe(5);
      expect(result!['1:100'].paidAt).toBeDefined();

      const fetched = await ds.getEntryPayments(comp.id);
      expect(fetched['1:100'].paid).toBe(true);
    });

    it('should clear payment fields when marking unpaid', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      await ds.updateEntryPayments(
        comp.id,
        [{ eventId: 1, bib: 100 }],
        { paid: true, paidBy: 5 }
      );
      const result = await ds.updateEntryPayments(
        comp.id,
        [{ eventId: 1, bib: 100 }],
        { paid: false }
      );
      expect(result!['1:100'].paid).toBe(false);
      expect(result!['1:100'].paidAt).toBeUndefined();
      expect(result!['1:100'].paidBy).toBeUndefined();
    });

    it('should return null for non-existent competition', async () => {
      const result = await ds.updateEntryPayments(999, [{ eventId: 1, bib: 1 }], { paid: true });
      expect(result).toBeNull();
    });
  });

  // ─── Studios ────────────────────────────────────────────────────

  describe('Studios', () => {
    it('should CRUD studios', async () => {
      const studio = await ds.addStudio({ name: 'Dance Studio', location: 'LA' });
      expect(studio.id).toBeDefined();
      expect(studio.name).toBe('Dance Studio');

      const fetched = await ds.getStudioById(studio.id);
      expect(fetched?.name).toBe('Dance Studio');

      const updated = await ds.updateStudio(studio.id, { location: 'SF' });
      expect(updated?.location).toBe('SF');

      const deleted = await ds.deleteStudio(studio.id);
      expect(deleted).toBe(true);
      expect(await ds.getStudioById(studio.id)).toBeUndefined();
    });

    it('should list all studios', async () => {
      await ds.addStudio({ name: 'A' });
      await ds.addStudio({ name: 'B' });
      const studios = await ds.getStudios();
      expect(studios).toHaveLength(2);
    });
  });

  // ─── Organizations ─────────────────────────────────────────────

  describe('Organizations', () => {
    it('should start empty', async () => {
      const orgs = await ds.getOrganizations();
      expect(orgs).toEqual([]);
    });

    it('should add and retrieve an organization', async () => {
      const org = await ds.addOrganization({
        name: 'NDCA Region 1',
        rulePresetKey: 'ndca',
        settings: { defaultLevels: ['Bronze', 'Silver'], defaultScoringType: 'standard' },
      });
      expect(org.id).toBeDefined();
      expect(org.name).toBe('NDCA Region 1');
      expect(org.rulePresetKey).toBe('ndca');
      expect(org.settings.defaultLevels).toEqual(['Bronze', 'Silver']);
      expect(org.createdAt).toBeDefined();
      expect(org.updatedAt).toBeDefined();

      const fetched = await ds.getOrganizationById(org.id);
      expect(fetched).toEqual(org);
    });

    it('should list all organizations', async () => {
      await ds.addOrganization({ name: 'Org A', rulePresetKey: 'ndca', settings: {} });
      await ds.addOrganization({ name: 'Org B', rulePresetKey: 'usadance', settings: {} });
      const orgs = await ds.getOrganizations();
      expect(orgs).toHaveLength(2);
    });

    it('should update an organization', async () => {
      const org = await ds.addOrganization({ name: 'Old Name', rulePresetKey: 'custom', settings: {} });
      const updated = await ds.updateOrganization(org.id, { name: 'New Name', settings: { defaultMaxCouplesPerHeat: 8 } });
      expect(updated?.name).toBe('New Name');
      expect(updated?.settings.defaultMaxCouplesPerHeat).toBe(8);
      expect(updated?.rulePresetKey).toBe('custom');
    });

    it('should return null when updating non-existent organization', async () => {
      const result = await ds.updateOrganization(999, { name: 'X' });
      expect(result).toBeNull();
    });

    it('should delete an organization', async () => {
      const org = await ds.addOrganization({ name: 'Del', rulePresetKey: 'custom', settings: {} });
      const deleted = await ds.deleteOrganization(org.id);
      expect(deleted).toBe(true);
      expect(await ds.getOrganizationById(org.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent organization', async () => {
      const result = await ds.deleteOrganization(999);
      expect(result).toBe(false);
    });
  });

  // ─── People ─────────────────────────────────────────────────────

  describe('People', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should add and retrieve a person', async () => {
      const person = await ds.addPerson({
        firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: compId,
      });
      expect(person.id).toBeDefined();
      expect(person.firstName).toBe('Alice');

      const fetched = await ds.getPersonById(person.id);
      expect(fetched).toEqual(person);
    });

    it('should filter people by competitionId', async () => {
      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });
      await ds.addPerson({ firstName: 'A', lastName: 'B', role: 'leader', status: 'student', competitionId: compId });
      await ds.addPerson({ firstName: 'C', lastName: 'D', role: 'follower', status: 'professional', competitionId: comp2.id });

      const comp1People = await ds.getPeople(compId);
      expect(comp1People).toHaveLength(1);
      expect(comp1People[0].firstName).toBe('A');

      const allPeople = await ds.getPeople();
      expect(allPeople).toHaveLength(2);
    });

    it('should update a person', async () => {
      const person = await ds.addPerson({
        firstName: 'Old', lastName: 'Name', role: 'leader', status: 'student', competitionId: compId,
      });
      const updated = await ds.updatePerson(person.id, { firstName: 'New' });
      expect(updated?.firstName).toBe('New');
      expect(updated?.lastName).toBe('Name');
    });

    it('should delete a person', async () => {
      const person = await ds.addPerson({
        firstName: 'Del', lastName: 'Me', role: 'leader', status: 'student', competitionId: compId,
      });
      expect(await ds.deletePerson(person.id)).toBe(true);
      expect(await ds.getPersonById(person.id)).toBeUndefined();
    });
  });

  // ─── Couples ────────────────────────────────────────────────────

  describe('Couples', () => {
    let compId: number;
    let leaderId: number;
    let followerId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const leader = await ds.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: compId,
      });
      const follower = await ds.addPerson({
        firstName: 'Jane', lastName: 'Doe', role: 'follower', status: 'student', competitionId: compId,
      });
      leaderId = leader.id;
      followerId = follower.id;
    });

    it('should create a couple with resolved names', async () => {
      const couple = await ds.addCouple(leaderId, followerId, compId);
      expect(couple).not.toBeNull();
      expect(couple!.bib).toBeDefined();
      expect(couple!.leaderName).toBe('John Doe');
      expect(couple!.followerName).toBe('Jane Doe');
      expect(couple!.competitionId).toBe(compId);
    });

    it('should return null when person does not exist', async () => {
      const couple = await ds.addCouple(999, followerId, compId);
      expect(couple).toBeNull();
    });

    it('should allow creating couple with people from a different competition', async () => {
      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });
      const couple = await ds.addCouple(leaderId, followerId, comp2.id);
      expect(couple).not.toBeNull();
      expect(couple!.competitionId).toBe(comp2.id);
    });

    it('should retrieve couple by bib', async () => {
      const couple = await ds.addCouple(leaderId, followerId, compId);
      const fetched = await ds.getCoupleByBib(couple!.bib);
      expect(fetched).toEqual(couple);
    });

    it('should filter couples by competitionId', async () => {
      await ds.addCouple(leaderId, followerId, compId);
      const couples = await ds.getCouples(compId);
      expect(couples).toHaveLength(1);

      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });
      const empty = await ds.getCouples(comp2.id);
      expect(empty).toEqual([]);
    });

    it('should delete a couple', async () => {
      const couple = await ds.addCouple(leaderId, followerId, compId);
      expect(await ds.deleteCouple(couple!.bib)).toBe(true);
      expect(await ds.getCoupleByBib(couple!.bib)).toBeUndefined();
    });

    it('should assign incrementing bib numbers', async () => {
      const follower2 = await ds.addPerson({
        firstName: 'Sarah', lastName: 'Lee', role: 'follower', status: 'student', competitionId: compId,
      });
      const c1 = await ds.addCouple(leaderId, followerId, compId);
      const c2 = await ds.addCouple(leaderId, follower2.id, compId);
      expect(c2!.bib).toBe(c1!.bib + 1);
    });
  });

  // ─── Judges ─────────────────────────────────────────────────────

  describe('Judges', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should add a judge with auto-assigned number', async () => {
      const j1 = await ds.addJudge('Judge Alpha', compId);
      expect(j1.judgeNumber).toBe(1);
      expect(j1.name).toBe('Judge Alpha');

      const j2 = await ds.addJudge('Judge Beta', compId);
      expect(j2.judgeNumber).toBe(2);
    });

    it('should filter judges by competitionId', async () => {
      await ds.addJudge('J1', compId);
      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });
      await ds.addJudge('J2', comp2.id);

      const judges1 = await ds.getJudges(compId);
      expect(judges1).toHaveLength(1);
      expect(judges1[0].name).toBe('J1');
    });

    it('should delete a judge', async () => {
      const judge = await ds.addJudge('Del', compId);
      expect(await ds.deleteJudge(judge.id)).toBe(true);
      expect(await ds.getJudgeById(judge.id)).toBeUndefined();
    });

    it('should update a judge name', async () => {
      const judge = await ds.addJudge('Old Name', compId);
      const updated = await ds.updateJudge(judge.id, { name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.judgeNumber).toBe(judge.judgeNumber);
    });

    it('should set isChairman on a judge', async () => {
      const judge = await ds.addJudge('Chair', compId);
      const updated = await ds.updateJudge(judge.id, { isChairman: true });
      expect(updated).not.toBeNull();
      expect(updated!.isChairman).toBe(true);
    });

    it('should enforce single chairman per competition', async () => {
      const j1 = await ds.addJudge('Chair 1', compId);
      const j2 = await ds.addJudge('Chair 2', compId);

      await ds.updateJudge(j1.id, { isChairman: true });
      await ds.updateJudge(j2.id, { isChairman: true });

      const refreshed1 = await ds.getJudgeById(j1.id);
      const refreshed2 = await ds.getJudgeById(j2.id);
      expect(refreshed2!.isChairman).toBe(true);
      expect(refreshed1!.isChairman).toBeFalsy();
    });

    it('should unset chairman', async () => {
      const judge = await ds.addJudge('Chair', compId);
      await ds.updateJudge(judge.id, { isChairman: true });
      const updated = await ds.updateJudge(judge.id, { isChairman: false });
      expect(updated!.isChairman).toBe(false);
    });

    it('should return null for non-existent judge update', async () => {
      const result = await ds.updateJudge(99999, { name: 'Ghost' });
      expect(result).toBeNull();
    });
  });

  // ─── Events ─────────────────────────────────────────────────────

  describe('Events', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should create event with correct rounds for small field (final only)', async () => {
      const event = await ds.addEvent('Small Event', [1, 2, 3], [], compId);
      expect(event.heats).toHaveLength(1);
      expect(event.heats[0].round).toBe('final');
      expect(event.heats[0].bibs).toEqual([1, 2, 3]);
    });

    it('should create event with semi+final for medium field', async () => {
      const bibs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const event = await ds.addEvent('Medium Event', bibs, [], compId);
      expect(event.heats).toHaveLength(2);
      expect(event.heats[0].round).toBe('semi-final');
      expect(event.heats[0].bibs).toEqual(bibs);
      expect(event.heats[1].round).toBe('final');
      expect(event.heats[1].bibs).toEqual([]);
    });

    it('should create event with quarter+semi+final for large field', async () => {
      const bibs = Array.from({ length: 20 }, (_, i) => i + 1);
      const event = await ds.addEvent('Large Event', bibs, [], compId);
      expect(event.heats).toHaveLength(3);
      expect(event.heats[0].round).toBe('quarter-final');
      expect(event.heats[1].round).toBe('semi-final');
      expect(event.heats[2].round).toBe('final');
    });

    it('should create proficiency event with final only regardless of field size', async () => {
      const bibs = Array.from({ length: 20 }, (_, i) => i + 1);
      const event = await ds.addEvent('Prof Event', bibs, [], compId, undefined, undefined, undefined, undefined, undefined, 'proficiency');
      expect(event.heats).toHaveLength(1);
      expect(event.heats[0].round).toBe('final');
      expect(event.scoringType).toBe('proficiency');
    });

    it('should store optional event fields', async () => {
      const event = await ds.addEvent(
        'Full Event', [1], [10], compId,
        'Open', 'American', 'Gold', 'Smooth',
        ['Waltz', 'Tango'], 'standard', true
      );
      expect(event.designation).toBe('Open');
      expect(event.syllabusType).toBe('American');
      expect(event.level).toBe('Gold');
      expect(event.style).toBe('Smooth');
      expect(event.dances).toEqual(['Waltz', 'Tango']);
      expect(event.scoringType).toBe('standard');
      expect(event.isScholarship).toBe(true);
      expect(event.heats[0].judges).toEqual([10]);
    });

    it('should filter events by competitionId', async () => {
      await ds.addEvent('E1', [1], [], compId);
      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });
      await ds.addEvent('E2', [2], [], comp2.id);

      const events1 = await ds.getEvents(compId);
      expect(Object.keys(events1)).toHaveLength(1);
      const names = Object.values(events1).map(e => e.name);
      expect(names).toContain('E1');
    });

    it('should update an event', async () => {
      const event = await ds.addEvent('Old', [1], [], compId);
      const updated = await ds.updateEvent(event.id, { name: 'New' });
      expect(updated?.name).toBe('New');
    });

    it('should delete an event and its scores', async () => {
      const event = await ds.addEvent('Del', [1, 2], [], compId);
      await ds.setScores(event.id, 'final', 1, [5, 4]);
      expect(await ds.deleteEvent(event.id)).toBe(true);
      expect(await ds.getEventById(event.id)).toBeUndefined();
      // Scores should be cleaned up
      expect(await ds.getScores(event.id, 'final', 1)).toEqual([]);
    });
  });

  // ─── Scores ─────────────────────────────────────────────────────

  describe('Scores', () => {
    let compId: number;
    let eventId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const event = await ds.addEvent('Scored Event', [1, 2, 3], [], compId);
      eventId = event.id;
    });

    it('should return empty array for unset scores', async () => {
      const scores = await ds.getScores(eventId, 'final', 1);
      expect(scores).toEqual([]);
    });

    it('should set and retrieve scores', async () => {
      await ds.setScores(eventId, 'final', 1, [3, 2, 1]);
      const scores = await ds.getScores(eventId, 'final', 1);
      expect(scores).toEqual([3, 2, 1]);
    });

    it('should clear scores for a round', async () => {
      await ds.setScores(eventId, 'final', 1, [3, 2, 1]);
      await ds.setScores(eventId, 'final', 2, [1, 3, 2]);
      await ds.clearScores(eventId, 'final');
      expect(await ds.getScores(eventId, 'final', 1)).toEqual([]);
      expect(await ds.getScores(eventId, 'final', 2)).toEqual([]);
    });
  });

  // ─── Judge Scores ───────────────────────────────────────────────

  describe('Judge Scores', () => {
    let compId: number;
    let eventId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const judge = await ds.addJudge('Judge', comp.id);
      const event = await ds.addEvent('JS Event', [1, 2], [judge.id], compId);
      eventId = event.id;
    });

    it('should return empty object for unset judge scores', async () => {
      const scores = await ds.getJudgeScores(eventId, 'final', 1);
      expect(scores).toEqual({});
    });

    it('should set judge scores in batch', async () => {
      const judges = await ds.getJudges(compId);
      const judgeId = judges[0].id;
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [
        { bib: 1, score: 3 },
        { bib: 2, score: 1 },
      ]);

      const scores1 = await ds.getJudgeScores(eventId, 'final', 1);
      expect(scores1[judgeId]).toBe(3);
      const scores2 = await ds.getJudgeScores(eventId, 'final', 2);
      expect(scores2[judgeId]).toBe(1);
    });

    it('should clear judge scores for a round', async () => {
      const judges = await ds.getJudges(compId);
      const judgeId = judges[0].id;
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [{ bib: 1, score: 5 }]);
      await ds.clearJudgeScores(eventId, 'final');
      expect(await ds.getJudgeScores(eventId, 'final', 1)).toEqual({});
    });

    it('should clear all event scores', async () => {
      const judges = await ds.getJudges(compId);
      const judgeId = judges[0].id;
      await ds.setScores(eventId, 'final', 1, [3]);
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [{ bib: 1, score: 3 }]);

      await ds.clearAllEventScores(eventId);

      expect(await ds.getScores(eventId, 'final', 1)).toEqual([]);
      expect(await ds.getJudgeScores(eventId, 'final', 1)).toEqual({});
    });
  });

  // ─── Heat Management ───────────────────────────────────────────

  describe('Heat Management', () => {
    it('should rebuild heats for standard scoring', () => {
      const heats = ds.rebuildHeats([1, 2, 3, 4, 5, 6, 7, 8], [10, 11], 'standard');
      expect(heats).toHaveLength(2);
      expect(heats[0].round).toBe('semi-final');
      expect(heats[0].bibs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(heats[0].judges).toEqual([10, 11]);
      expect(heats[1].round).toBe('final');
      expect(heats[1].bibs).toEqual([]);
    });

    it('should rebuild heats for proficiency scoring (final only)', () => {
      const heats = ds.rebuildHeats([1, 2, 3, 4, 5, 6, 7, 8], [10], 'proficiency');
      expect(heats).toHaveLength(1);
      expect(heats[0].round).toBe('final');
    });

    it('should track judge submission status', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const j1 = await ds.addJudge('J1', comp.id);
      const j2 = await ds.addJudge('J2', comp.id);
      const event = await ds.addEvent('E', [1, 2], [j1.id, j2.id], comp.id);

      // No scores yet — both should be false
      let status = await ds.getJudgeSubmissionStatus(event.id, 'final');
      expect(status[j1.id]).toBe(false);
      expect(status[j2.id]).toBe(false);

      // J1 scores all bibs
      await ds.setJudgeScoresBatch(event.id, 'final', j1.id, [
        { bib: 1, score: 2 },
        { bib: 2, score: 1 },
      ]);

      status = await ds.getJudgeSubmissionStatus(event.id, 'final');
      expect(status[j1.id]).toBe(true);
      expect(status[j2.id]).toBe(false);
    });

    it('should advance to next round', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const bibs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const event = await ds.addEvent('Multi Round', bibs, [], comp.id);

      const advanced = await ds.advanceToNextRound(event.id, 'semi-final', [1, 2, 3, 4, 5, 6]);
      expect(advanced).toBe(true);

      const updated = await ds.getEventById(event.id);
      const finalHeat = updated?.heats.find(h => h.round === 'final');
      expect(finalHeat?.bibs).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should return false when advancing from final (no next round)', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const event = await ds.addEvent('Small', [1, 2], [], comp.id);
      const result = await ds.advanceToNextRound(event.id, 'final', [1]);
      expect(result).toBe(false);
    });
  });

  // ─── Users ──────────────────────────────────────────────────────

  describe('Users', () => {
    it('should upsert a new user', async () => {
      const user = await ds.upsertUser('uid1', 'test@example.com', 'Test User');
      expect(user.uid).toBe('uid1');
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.createdAt).toBeDefined();
      expect(user.lastLoginAt).toBeDefined();
    });

    it('should update existing user on second upsert', async () => {
      const first = await ds.upsertUser('uid1', 'test@example.com', 'First');
      const second = await ds.upsertUser('uid1', 'test@example.com', 'Updated');
      expect(second.displayName).toBe('Updated');
      expect(second.createdAt).toBe(first.createdAt);
    });

    it('should retrieve user by uid', async () => {
      await ds.upsertUser('uid1', 'a@b.com');
      const user = await ds.getUserByUid('uid1');
      expect(user?.email).toBe('a@b.com');
    });

    it('should list all users', async () => {
      await ds.upsertUser('uid1', 'a@b.com');
      await ds.upsertUser('uid2', 'c@d.com');
      const users = await ds.getUsers();
      expect(users).toHaveLength(2);
    });

    it('should toggle admin status', async () => {
      await ds.upsertUser('uid1', 'someone@test.com');
      const promoted = await ds.updateUserAdmin('uid1', true);
      expect(promoted?.isAdmin).toBe(true);

      const demoted = await ds.updateUserAdmin('uid1', false);
      expect(demoted?.isAdmin).toBe(false);
    });

    it('should protect admin email from demotion', async () => {
      const adminUser = await ds.upsertUser('admin-uid', 'zsexton2011@gmail.com', 'Admin');
      expect(adminUser.isAdmin).toBe(true);

      const result = await ds.updateUserAdmin('admin-uid', false);
      expect(result?.isAdmin).toBe(true);
    });

    it('should return null when updating non-existent user', async () => {
      const result = await ds.updateUserAdmin('nonexistent', true);
      expect(result).toBeNull();
    });
  });

  // ─── Schedules ──────────────────────────────────────────────────

  describe('Schedules', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should return undefined for non-existent schedule', async () => {
      const schedule = await ds.getSchedule(compId);
      expect(schedule).toBeUndefined();
    });

    it('should save and retrieve a schedule', async () => {
      const now = new Date().toISOString();
      const schedule = await ds.saveSchedule({
        competitionId: compId,
        heatOrder: [{ id: 'test-heat-1', entries: [{ eventId: 1, round: 'final' }] }],
        styleOrder: ['Smooth'],
        levelOrder: ['Gold'],
        currentHeatIndex: 0,
        heatStatuses: {},
        createdAt: now,
        updatedAt: now,
      });
      expect(schedule.competitionId).toBe(compId);

      const fetched = await ds.getSchedule(compId);
      expect(fetched?.heatOrder).toHaveLength(1);
      expect(fetched?.styleOrder).toEqual(['Smooth']);
    });

    it('should delete a schedule', async () => {
      const now = new Date().toISOString();
      await ds.saveSchedule({
        competitionId: compId,
        heatOrder: [],
        styleOrder: [],
        levelOrder: [],
        currentHeatIndex: 0,
        heatStatuses: {},
        createdAt: now,
        updatedAt: now,
      });
      expect(await ds.deleteSchedule(compId)).toBe(true);
      expect(await ds.getSchedule(compId)).toBeUndefined();
    });

    it('should return false when deleting non-existent schedule', async () => {
      expect(await ds.deleteSchedule(compId)).toBe(false);
    });
  });

  // ─── Batch Score Methods ───────────────────────────────────────

  describe('getScoresForRound', () => {
    let compId: number;
    let eventId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const event = await ds.addEvent('Batch Score Event', [1, 2, 3], [], compId);
      eventId = event.id;
    });

    it('should return scores for multiple bibs in one call', async () => {
      await ds.setScores(eventId, 'final', 1, [3, 2, 1]);
      await ds.setScores(eventId, 'final', 2, [1, 3, 2]);

      const result = await ds.getScoresForRound(eventId, 'final', [1, 2, 3]);
      expect(result[1]).toEqual([3, 2, 1]);
      expect(result[2]).toEqual([1, 3, 2]);
      expect(result[3]).toBeUndefined();
    });

    it('should return empty object for empty bibs', async () => {
      const result = await ds.getScoresForRound(eventId, 'final', []);
      expect(result).toEqual({});
    });

    it('should filter by dance parameter', async () => {
      await ds.setScores(eventId, 'final', 1, [5], 'Waltz');
      await ds.setScores(eventId, 'final', 1, [3], 'Tango');

      const waltzScores = await ds.getScoresForRound(eventId, 'final', [1], 'Waltz');
      expect(waltzScores[1]).toEqual([5]);

      const tangoScores = await ds.getScoresForRound(eventId, 'final', [1], 'Tango');
      expect(tangoScores[1]).toEqual([3]);
    });
  });

  describe('getJudgeScoresForRound', () => {
    let compId: number;
    let eventId: number;
    let judgeId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const judge = await ds.addJudge('Judge', comp.id);
      judgeId = judge.id;
      const event = await ds.addEvent('Batch JS Event', [1, 2], [judge.id], compId);
      eventId = event.id;
    });

    it('should return judge scores for multiple bibs', async () => {
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [
        { bib: 1, score: 3 },
        { bib: 2, score: 1 },
      ]);

      const result = await ds.getJudgeScoresForRound(eventId, 'final', [1, 2]);
      expect(result[1][judgeId]).toBe(3);
      expect(result[2][judgeId]).toBe(1);
    });

    it('should return empty object for empty bibs', async () => {
      const result = await ds.getJudgeScoresForRound(eventId, 'final', []);
      expect(result).toEqual({});
    });

    it('should handle bibs with no scores', async () => {
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [{ bib: 1, score: 5 }]);

      const result = await ds.getJudgeScoresForRound(eventId, 'final', [1, 2]);
      expect(result[1][judgeId]).toBe(5);
      expect(result[2]).toBeUndefined();
    });

    it('should filter by dance parameter', async () => {
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [{ bib: 1, score: 5 }], 'Waltz');
      await ds.setJudgeScoresBatch(eventId, 'final', judgeId, [{ bib: 1, score: 2 }], 'Tango');

      const waltz = await ds.getJudgeScoresForRound(eventId, 'final', [1], 'Waltz');
      expect(waltz[1][judgeId]).toBe(5);

      const tango = await ds.getJudgeScoresForRound(eventId, 'final', [1], 'Tango');
      expect(tango[1][judgeId]).toBe(2);
    });
  });

  describe('getJudgeSubmissionStatusBatch', () => {
    it('should check submission across multiple entries', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const j1 = await ds.addJudge('J1', comp.id);
      const j2 = await ds.addJudge('J2', comp.id);
      const e1 = await ds.addEvent('E1', [1, 2], [j1.id, j2.id], comp.id);
      const e2 = await ds.addEvent('E2', [3, 4], [j1.id, j2.id], comp.id);

      // J1 scores all bibs in both events
      await ds.setJudgeScoresBatch(e1.id, 'final', j1.id, [{ bib: 1, score: 2 }, { bib: 2, score: 1 }]);
      await ds.setJudgeScoresBatch(e2.id, 'final', j1.id, [{ bib: 3, score: 2 }, { bib: 4, score: 1 }]);

      // J2 only scores event 1
      await ds.setJudgeScoresBatch(e1.id, 'final', j2.id, [{ bib: 1, score: 1 }, { bib: 2, score: 2 }]);

      const status = await ds.getJudgeSubmissionStatusBatch(
        [
          { eventId: e1.id, round: 'final', bibs: [1, 2] },
          { eventId: e2.id, round: 'final', bibs: [3, 4] },
        ],
        [j1.id, j2.id]
      );
      expect(status[j1.id]).toBe(true);
      expect(status[j2.id]).toBe(false);
    });

    it('should return true for all judges with empty entries', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      const j1 = await ds.addJudge('J1', comp.id);
      const status = await ds.getJudgeSubmissionStatusBatch([], [j1.id]);
      expect(status[j1.id]).toBe(true);
    });
  });

  // ─── Event Entries (junction table) ────────────────────────────

  describe('Event Entries', () => {
    let compId: number;
    let bib1: number;
    let bib2: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
      const leader1 = await ds.addPerson({ firstName: 'L1', lastName: 'A', role: 'leader', status: 'student', competitionId: compId });
      const follower1 = await ds.addPerson({ firstName: 'F1', lastName: 'B', role: 'follower', status: 'student', competitionId: compId });
      const leader2 = await ds.addPerson({ firstName: 'L2', lastName: 'C', role: 'leader', status: 'student', competitionId: compId });
      const follower2 = await ds.addPerson({ firstName: 'F2', lastName: 'D', role: 'follower', status: 'student', competitionId: compId });
      const c1 = await ds.addCouple(leader1.id, follower1.id, compId);
      const c2 = await ds.addCouple(leader2.id, follower2.id, compId);
      bib1 = c1!.bib;
      bib2 = c2!.bib;
    });

    it('should populate event_entries when creating an event via addEvent', async () => {
      const event = await ds.addEvent('Waltz', [bib1, bib2], [], compId);
      const entries = await ds.getEventEntries(event.id);
      const bibs = entries.map(e => e.bib).sort();
      expect(bibs).toEqual([bib1, bib2].sort());
      expect(entries.every(e => e.scratched === false)).toBe(true);
    });

    it('should return entries for a bib across events', async () => {
      const e1 = await ds.addEvent('Event 1', [bib1, bib2], [], compId);
      const e2 = await ds.addEvent('Event 2', [bib1], [], compId);

      const entries = await ds.getEntriesForBib(compId, bib1);
      const eventIds = entries.map(e => e.eventId).sort();
      expect(eventIds).toEqual([e1.id, e2.id].sort());
    });

    it('should return empty array for bib with no entries', async () => {
      const entries = await ds.getEntriesForBib(compId, 999);
      expect(entries).toEqual([]);
    });

    it('should add and remove individual event entries', async () => {
      const event = await ds.addEvent('Waltz', [bib1], [], compId);
      await ds.addEventEntry(event.id, bib2, compId);

      let entries = await ds.getEventEntries(event.id);
      expect(entries).toHaveLength(2);

      await ds.removeEventEntry(event.id, bib2);
      entries = await ds.getEventEntries(event.id);
      expect(entries).toHaveLength(1);
      expect(entries[0].bib).toBe(bib1);
    });

    it('should scratch and unscratch entries', async () => {
      const event = await ds.addEvent('Waltz', [bib1], [], compId);

      await ds.scratchEntry(event.id, bib1);
      let entries = await ds.getEventEntries(event.id);
      expect(entries[0].scratched).toBe(true);

      await ds.unscratchEntry(event.id, bib1);
      entries = await ds.getEventEntries(event.id);
      expect(entries[0].scratched).toBe(false);
    });

    it('should clean up event_entries when event is deleted', async () => {
      const event = await ds.addEvent('Waltz', [bib1, bib2], [], compId);
      await ds.deleteEvent(event.id);

      const entries = await ds.getEntriesForBib(compId, bib1);
      const remaining = entries.filter(e => e.eventId === event.id);
      expect(remaining).toHaveLength(0);
    });
  });

  // ─── Pending Entries ──────────────────────────────────────────

  describe('Pending Entries', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should start empty', async () => {
      const pending = await ds.getPendingEntries(compId);
      expect(pending).toEqual([]);
    });

    it('should add and retrieve pending entries', async () => {
      const entry: PendingEntry = {
        id: 'test-pending-1',
        bib: 1,
        competitionId: compId,
        combination: { level: 'Gold', style: 'Smooth' },
        reason: 'Level too high',
        requestedAt: new Date().toISOString(),
      };
      const added = await ds.addPendingEntry(entry);
      expect(added.id).toBe('test-pending-1');

      const all = await ds.getPendingEntries(compId);
      expect(all).toHaveLength(1);
      expect(all[0].bib).toBe(1);
      expect(all[0].combination.level).toBe('Gold');
      expect(all[0].reason).toBe('Level too high');
    });

    it('should remove a pending entry', async () => {
      const entry: PendingEntry = {
        id: 'test-pending-2',
        bib: 2,
        competitionId: compId,
        combination: { level: 'Silver', style: 'Rhythm' },
        reason: 'Test reason',
        requestedAt: new Date().toISOString(),
      };
      await ds.addPendingEntry(entry);
      const removed = await ds.removePendingEntry('test-pending-2');
      expect(removed).toBe(true);

      const all = await ds.getPendingEntries(compId);
      expect(all).toEqual([]);
    });

    it('should return false when removing non-existent pending entry', async () => {
      const removed = await ds.removePendingEntry('nonexistent');
      expect(removed).toBe(false);
    });

    it('should isolate pending entries by competition', async () => {
      const comp2 = await ds.addCompetition({ name: 'C2', type: 'NDCA', date: '2026-02-01' });

      await ds.addPendingEntry({
        id: 'pe-comp1', bib: 1, competitionId: compId,
        combination: { level: 'Gold' }, reason: 'R1',
        requestedAt: new Date().toISOString(),
      });
      await ds.addPendingEntry({
        id: 'pe-comp2', bib: 2, competitionId: comp2.id,
        combination: { level: 'Silver' }, reason: 'R2',
        requestedAt: new Date().toISOString(),
      });

      const c1Entries = await ds.getPendingEntries(compId);
      expect(c1Entries).toHaveLength(1);
      expect(c1Entries[0].id).toBe('pe-comp1');

      const c2Entries = await ds.getPendingEntries(comp2.id);
      expect(c2Entries).toHaveLength(1);
      expect(c2Entries[0].id).toBe('pe-comp2');
    });
  });

  // ─── getEventsByIds ───────────────────────────────────────────

  describe('getEventsByIds', () => {
    let compId: number;

    beforeEach(async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      compId = comp.id;
    });

    it('should return events by their IDs', async () => {
      const e1 = await ds.addEvent('Event A', [1], [], compId);
      const e2 = await ds.addEvent('Event B', [2], [], compId);
      await ds.addEvent('Event C', [3], [], compId);

      const map = await ds.getEventsByIds([e1.id, e2.id]);
      expect(map.size).toBe(2);
      expect(map.get(e1.id)?.name).toBe('Event A');
      expect(map.get(e2.id)?.name).toBe('Event B');
    });

    it('should return empty map for empty array', async () => {
      const map = await ds.getEventsByIds([]);
      expect(map.size).toBe(0);
    });

    it('should skip non-existent IDs', async () => {
      const e1 = await ds.addEvent('Event A', [1], [], compId);
      const map = await ds.getEventsByIds([e1.id, 99999]);
      expect(map.size).toBe(1);
      expect(map.get(e1.id)?.name).toBe('Event A');
    });
  });

  // ─── resetAllData ───────────────────────────────────────────────

  describe('resetAllData', () => {
    it('should clear all data', async () => {
      const comp = await ds.addCompetition({ name: 'C', type: 'STUDIO', date: '2026-01-01' });
      await ds.addPerson({ firstName: 'A', lastName: 'B', role: 'leader', status: 'student', competitionId: comp.id });
      await ds.addStudio({ name: 'S' });
      await ds.addOrganization({ name: 'O', rulePresetKey: 'custom', settings: {} });

      await ds.resetAllData();

      expect(await ds.getCompetitions()).toEqual([]);
      expect(await ds.getPeople()).toEqual([]);
      expect(await ds.getStudios()).toEqual([]);
      expect(await ds.getOrganizations()).toEqual([]);
      expect(await ds.getCouples()).toEqual([]);
      expect(await ds.getJudges()).toEqual([]);
      expect(Object.keys(await ds.getEvents())).toHaveLength(0);
      expect(await ds.getUsers()).toEqual([]);
    });
  });
}
