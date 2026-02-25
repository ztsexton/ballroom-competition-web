import { dataService } from '../../services/dataService';
import { findMatchingEvent, registerCoupleForEvent, removeEntryFromEvent } from '../../services/registrationService';

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
