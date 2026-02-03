import { dataService } from '../../services/dataService';
import { validateEntry, getEligibleAgeCategories } from '../../services/validationService';

describe('Validation Service', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('validateEntry', () => {
    it('should return valid for a basic entry with no restrictions', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { level: 'Bronze' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid level', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { level: 'Championship' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Championship');
    });

    it('should reject Pro-Am when both dancers are students', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { designation: 'Pro-Am' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Pro-Am');
    });

    it('should accept Pro-Am when one is student and one is professional', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'professional',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { designation: 'Pro-Am' });
      expect(result.valid).toBe(true);
    });

    it('should reject Amateur when one dancer is professional', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'professional',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { designation: 'Amateur' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Amateur');
    });

    it('should return error for non-existent couple', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });

      const result = await validateEntry(comp.id, 9999, {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Couple not found');
    });
  });
});
