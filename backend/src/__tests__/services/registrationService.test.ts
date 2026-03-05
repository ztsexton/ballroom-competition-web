import { dataService } from '../../services/dataService';
import { findMatchingEvent, findAllMatchingEvents, checkPersonConflict, registerCoupleForEvent, removeEntryFromEvent } from '../../services/registrationService';

describe('Registration Service', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetitionWithCouple() {
    const comp = await dataService.addCompetition({ name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01' });
    const leader = await dataService.addPerson({ firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: comp.id });
    const follower = await dataService.addPerson({ firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student', competitionId: comp.id });
    const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
    return { comp, couple: couple!, leader, follower };
  }

  describe('findMatchingEvent', () => {
    it('should find an event matching all attributes', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      await dataService.addEvent(
        'Bronze Waltz', [couple.bib], [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const result = await findMatchingEvent(comp.id, {
        designation: 'Pro-Am',
        syllabusType: 'Syllabus',
        level: 'Bronze',
        style: 'Smooth',
        dances: ['Waltz'],
        scoringType: 'standard',
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Bronze Waltz');
    });

    it('should return null when no event matches', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      await dataService.addEvent('Waltz', [couple.bib], [], comp.id);

      const result = await findMatchingEvent(comp.id, {
        designation: 'Pro-Am',
        syllabusType: 'Syllabus',
        level: 'Bronze',
        style: 'Smooth',
        dances: ['Tango'],
      });

      expect(result).toBeNull();
    });

    it('should match dances regardless of order', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      await dataService.addEvent(
        'Multi Dance', [couple.bib], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz', 'Tango', 'Foxtrot'], 'standard',
      );

      const result = await findMatchingEvent(comp.id, {
        style: 'Smooth',
        dances: ['Foxtrot', 'Tango', 'Waltz'],
        scoringType: 'standard',
      });

      expect(result).not.toBeNull();
    });

    it('should default scoringType to standard', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      await dataService.addEvent(
        'Standard Event', [couple.bib], [], comp.id,
        undefined, undefined, undefined, 'Smooth', ['Waltz'], 'standard',
      );

      const result = await findMatchingEvent(comp.id, {
        style: 'Smooth',
        dances: ['Waltz'],
        // no scoringType — should default to 'standard'
      });

      expect(result).not.toBeNull();
    });

    it('should return null for empty competition', async () => {
      const comp = await dataService.addCompetition({ name: 'Empty', type: 'UNAFFILIATED', date: '2026-06-01' });
      const result = await findMatchingEvent(comp.id, { style: 'Smooth' });
      expect(result).toBeNull();
    });
  });

  describe('registerCoupleForEvent', () => {
    it('should add couple to existing matching event', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      const event = await dataService.addEvent(
        'Waltz', [], [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const result = await registerCoupleForEvent(comp.id, couple.bib, {
        designation: 'Pro-Am',
        syllabusType: 'Syllabus',
        level: 'Bronze',
        style: 'Smooth',
        dances: ['Waltz'],
        scoringType: 'standard',
      });

      expect(result.created).toBe(false);
      expect(result.event).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should return error for duplicate registration', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      await dataService.addEvent(
        'Waltz', [couple.bib], [], comp.id,
        'Pro-Am', 'Syllabus', 'Bronze', 'Smooth', ['Waltz'], 'standard',
      );

      const result = await registerCoupleForEvent(comp.id, couple.bib, {
        designation: 'Pro-Am',
        syllabusType: 'Syllabus',
        level: 'Bronze',
        style: 'Smooth',
        dances: ['Waltz'],
        scoringType: 'standard',
      });

      expect(result.event).toBeNull();
      expect(result.error).toContain('already entered');
      expect(result.status).toBe(409);
    });

    it('should auto-create event when no match exists', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();

      const result = await registerCoupleForEvent(comp.id, couple.bib, {
        designation: 'Pro-Am',
        syllabusType: 'Syllabus',
        level: 'Bronze',
        style: 'Smooth',
        dances: ['Waltz'],
        scoringType: 'standard',
      });

      expect(result.created).toBe(true);
      expect(result.event).not.toBeNull();
      expect(result.event!.name).toContain('Bronze');
      expect(result.event!.name).toContain('Smooth');
    });

    it('should generate name from combination attributes', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();

      const result = await registerCoupleForEvent(comp.id, couple.bib, {
        designation: 'Pro-Am',
        syllabusType: 'Open',
        level: 'Gold',
        style: 'Rhythm',
        dances: ['Cha Cha', 'Rumba'],
      });

      expect(result.created).toBe(true);
      expect(result.event!.name).toContain('Pro-Am');
      expect(result.event!.name).toContain('Gold');
      expect(result.event!.name).toContain('Rhythm');
    });

    it('should assign competition judges to auto-created event', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      const judge = await dataService.addJudge('Judge Smith', comp.id);

      const result = await registerCoupleForEvent(comp.id, couple.bib, {
        style: 'Smooth',
        dances: ['Waltz'],
      });

      expect(result.created).toBe(true);
      // The auto-created event should have the competition's judge
      const event = await dataService.getEventById(result.event!.id);
      expect(event!.heats[0].judges).toContain(judge.id);
    });
  });

  describe('section events (allowDuplicateEntries)', () => {
    const combination = {
      designation: 'Pro-Am',
      syllabusType: 'Syllabus',
      level: 'Bronze',
      style: 'Smooth',
      dances: ['Waltz'],
      scoringType: 'standard',
    };

    async function setupDuplicateEntryCompetition() {
      const comp = await dataService.addCompetition({
        name: 'Studio Comp', type: 'STUDIO', date: '2026-06-01',
        allowDuplicateEntries: true,
      });
      // Pro dancer (leader for both couples)
      const pro = await dataService.addPerson({
        firstName: 'Pro', lastName: 'Dancer', role: 'leader', status: 'professional', competitionId: comp.id,
      });
      // Student 1
      const student1 = await dataService.addPerson({
        firstName: 'Student', lastName: 'One', role: 'follower', status: 'student', competitionId: comp.id,
      });
      // Student 2
      const student2 = await dataService.addPerson({
        firstName: 'Student', lastName: 'Two', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple1 = await dataService.addCouple(pro.id, student1.id, comp.id);
      const couple2 = await dataService.addCouple(pro.id, student2.id, comp.id);
      return { comp, pro, student1, student2, couple1: couple1!, couple2: couple2! };
    }

    it('should create section B when person conflict detected and allowDuplicateEntries is on', async () => {
      const { comp, couple1, couple2 } = await setupDuplicateEntryCompetition();

      // Register first couple — creates the first event
      const result1 = await registerCoupleForEvent(comp.id, couple1.bib, combination);
      expect(result1.created).toBe(true);
      expect(result1.event).not.toBeNull();

      // Register second couple (same pro) — should create section B
      const result2 = await registerCoupleForEvent(comp.id, couple2.bib, combination);
      expect(result2.created).toBe(true);
      expect(result2.redirectedToSection).toBe(true);
      expect(result2.event).not.toBeNull();
      expect(result2.event!.sectionLetter).toBe('B');
      expect(result2.event!.name).toContain('- B');
    });

    it('should rename first event to add -A suffix on second section creation', async () => {
      const { comp, couple1, couple2 } = await setupDuplicateEntryCompetition();

      const result1 = await registerCoupleForEvent(comp.id, couple1.bib, combination);
      const originalEventId = result1.event!.id;

      // After second registration, original event should be renamed to include " - A"
      await registerCoupleForEvent(comp.id, couple2.bib, combination);

      const updatedOriginal = await dataService.getEventById(originalEventId);
      expect(updatedOriginal!.name).toContain('- A');
      expect(updatedOriginal!.sectionLetter).toBe('A');
      expect(updatedOriginal!.sectionGroupId).toBeDefined();
    });

    it('should reuse sectionGroupId across sections', async () => {
      const { comp, couple1, couple2 } = await setupDuplicateEntryCompetition();

      await registerCoupleForEvent(comp.id, couple1.bib, combination);
      const result2 = await registerCoupleForEvent(comp.id, couple2.bib, combination);

      const events = await findAllMatchingEvents(comp.id, combination);
      const groupIds = events.map(e => e.sectionGroupId).filter(Boolean);
      expect(groupIds.length).toBe(2);
      expect(groupIds[0]).toBe(groupIds[1]);
    });

    it('should not create sections when allowDuplicateEntries is false', async () => {
      const comp = await dataService.addCompetition({
        name: 'Normal Comp', type: 'UNAFFILIATED', date: '2026-06-01',
      });
      const pro = await dataService.addPerson({
        firstName: 'Pro', lastName: 'Dancer', role: 'leader', status: 'professional', competitionId: comp.id,
      });
      const student1 = await dataService.addPerson({
        firstName: 'S', lastName: 'One', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const student2 = await dataService.addPerson({
        firstName: 'S', lastName: 'Two', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple1 = await dataService.addCouple(pro.id, student1.id, comp.id);
      const couple2 = await dataService.addCouple(pro.id, student2.id, comp.id);

      await registerCoupleForEvent(comp.id, couple1!.bib, combination);
      // With allowDuplicateEntries OFF, second couple goes into same event (no person conflict check)
      const result2 = await registerCoupleForEvent(comp.id, couple2!.bib, combination);
      expect(result2.created).toBe(false);
      expect(result2.redirectedToSection).toBeUndefined();
    });

    it('should handle three sections (A, B, C) correctly', async () => {
      const { comp, pro, couple1, couple2 } = await setupDuplicateEntryCompetition();
      // Create a third student
      const student3 = await dataService.addPerson({
        firstName: 'Student', lastName: 'Three', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const couple3 = await dataService.addCouple(pro.id, student3.id, comp.id);

      await registerCoupleForEvent(comp.id, couple1.bib, combination);
      await registerCoupleForEvent(comp.id, couple2.bib, combination);
      const result3 = await registerCoupleForEvent(comp.id, couple3!.bib, combination);

      expect(result3.created).toBe(true);
      expect(result3.event!.sectionLetter).toBe('C');
      expect(result3.event!.name).toContain('- C');
    });

    it('should add couple to existing section without person conflict', async () => {
      const { comp, couple1, couple2 } = await setupDuplicateEntryCompetition();
      // Create an independent couple (no shared person with pro)
      const indepLeader = await dataService.addPerson({
        firstName: 'Indep', lastName: 'Leader', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const indepFollower = await dataService.addPerson({
        firstName: 'Indep', lastName: 'Follower', role: 'follower', status: 'student', competitionId: comp.id,
      });
      const indepCouple = await dataService.addCouple(indepLeader.id, indepFollower.id, comp.id);

      // Register pro couple 1 and pro couple 2 (creates sections A and B)
      await registerCoupleForEvent(comp.id, couple1.bib, combination);
      await registerCoupleForEvent(comp.id, couple2.bib, combination);

      // Register independent couple — should join section A (no person conflict)
      const result = await registerCoupleForEvent(comp.id, indepCouple!.bib, combination);
      expect(result.created).toBe(false);
      expect(result.redirectedToSection).toBeUndefined();
    });

    it('should detect person conflict through leader and follower', async () => {
      const { comp } = await setupDuplicateEntryCompetition();
      // Create a pro follower with two student leaders
      const proFollower = await dataService.addPerson({
        firstName: 'ProF', lastName: 'Dancer', role: 'follower', status: 'professional', competitionId: comp.id,
      });
      const stuLeader1 = await dataService.addPerson({
        firstName: 'StuL', lastName: 'One', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const stuLeader2 = await dataService.addPerson({
        firstName: 'StuL', lastName: 'Two', role: 'leader', status: 'student', competitionId: comp.id,
      });
      const c1 = await dataService.addCouple(stuLeader1.id, proFollower.id, comp.id);
      const c2 = await dataService.addCouple(stuLeader2.id, proFollower.id, comp.id);

      await registerCoupleForEvent(comp.id, c1!.bib, combination);
      const result2 = await registerCoupleForEvent(comp.id, c2!.bib, combination);

      expect(result2.redirectedToSection).toBe(true);
      expect(result2.event!.sectionLetter).toBe('B');
    });
  });

  describe('checkPersonConflict', () => {
    it('should detect conflict when leader is shared', async () => {
      const comp = await dataService.addCompetition({ name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01' });
      const pro = await dataService.addPerson({ firstName: 'Pro', lastName: 'D', role: 'leader', status: 'professional', competitionId: comp.id });
      const s1 = await dataService.addPerson({ firstName: 'S', lastName: '1', role: 'follower', status: 'student', competitionId: comp.id });
      const s2 = await dataService.addPerson({ firstName: 'S', lastName: '2', role: 'follower', status: 'student', competitionId: comp.id });
      const c1 = await dataService.addCouple(pro.id, s1.id, comp.id);
      const c2 = await dataService.addCouple(pro.id, s2.id, comp.id);

      const hasConflict = await checkPersonConflict(c2!.bib, [c1!.bib], comp.id);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict for independent couples', async () => {
      const comp = await dataService.addCompetition({ name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01' });
      const l1 = await dataService.addPerson({ firstName: 'L', lastName: '1', role: 'leader', status: 'student', competitionId: comp.id });
      const f1 = await dataService.addPerson({ firstName: 'F', lastName: '1', role: 'follower', status: 'student', competitionId: comp.id });
      const l2 = await dataService.addPerson({ firstName: 'L', lastName: '2', role: 'leader', status: 'student', competitionId: comp.id });
      const f2 = await dataService.addPerson({ firstName: 'F', lastName: '2', role: 'follower', status: 'student', competitionId: comp.id });
      const c1 = await dataService.addCouple(l1.id, f1.id, comp.id);
      const c2 = await dataService.addCouple(l2.id, f2.id, comp.id);

      const hasConflict = await checkPersonConflict(c2!.bib, [c1!.bib], comp.id);
      expect(hasConflict).toBe(false);
    });
  });

  describe('removeEntryFromEvent', () => {
    it('should remove a couple from an event', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      const event = await dataService.addEvent('Waltz', [couple.bib], [], comp.id);

      const result = await removeEntryFromEvent(event.id, couple.bib);
      expect(result.event).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should return error when event not found', async () => {
      const result = await removeEntryFromEvent(999, 1);
      expect(result.event).toBeNull();
      expect(result.error).toContain('Event not found');
      expect(result.status).toBe(404);
    });

    it('should return error when couple not in event', async () => {
      const { comp, couple } = await setupCompetitionWithCouple();
      const event = await dataService.addEvent('Waltz', [couple.bib], [], comp.id);

      const result = await removeEntryFromEvent(event.id, 999);
      expect(result.event).toBeNull();
      expect(result.error).toContain('not in this event');
      expect(result.status).toBe(404);
    });
  });
});
