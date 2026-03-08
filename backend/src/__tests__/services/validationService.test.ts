import { dataService } from '../../services/dataService';
import { validateEntry, getEligibleAgeCategories, getNdcaCoupleCategories, getCoupleEligibleCategories, calculateAge, getMainLevel, groupLevelsByMain } from '../../services/validationService';

describe('Validation Service', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('getNdcaCoupleCategories (pure function)', () => {
    it('should return Youth + Adult for youth couple (17, 16)', () => {
      expect(getNdcaCoupleCategories(17, 16)).toEqual(['Youth', 'Adult']);
    });

    it('should return Youth + Adult for youth couple (18, 15)', () => {
      expect(getNdcaCoupleCategories(18, 15)).toEqual(['Youth', 'Adult']);
    });

    it('should return Adult only for adult couple (25, 23)', () => {
      expect(getNdcaCoupleCategories(25, 23)).toEqual(['Adult']);
    });

    it('should return Adult only at edge (19, 18)', () => {
      expect(getNdcaCoupleCategories(19, 18)).toEqual(['Adult']);
    });

    it('should return empty for under-16 couple', () => {
      expect(getNdcaCoupleCategories(15, 14)).toEqual([]);
    });

    it('should return Adult + Senior 1 for Senior I couple (36, 31)', () => {
      expect(getNdcaCoupleCategories(36, 31)).toEqual(['Adult', 'Senior 1']);
    });

    it('should return Adult + Senior 1 at edge (35, 30)', () => {
      expect(getNdcaCoupleCategories(35, 30)).toEqual(['Adult', 'Senior 1']);
    });

    it('should return Adult only when younger partner fails Senior I threshold (35, 29)', () => {
      expect(getNdcaCoupleCategories(35, 29)).toEqual(['Adult']);
    });

    it('should return Adult + Senior 1-2 for Senior II couple (46, 41)', () => {
      expect(getNdcaCoupleCategories(46, 41)).toEqual(['Adult', 'Senior 1', 'Senior 2']);
    });

    it('should return Adult + Senior 1-3 for Senior III couple (56, 51)', () => {
      expect(getNdcaCoupleCategories(56, 51)).toEqual(['Adult', 'Senior 1', 'Senior 2', 'Senior 3']);
    });

    it('should return Adult + Senior 1-4 for Senior IV couple (66, 61)', () => {
      expect(getNdcaCoupleCategories(66, 61)).toEqual(['Adult', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4']);
    });

    it('should return Adult + Senior 1-4 at edge (65, 60)', () => {
      expect(getNdcaCoupleCategories(65, 60)).toEqual(['Adult', 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4']);
    });

    it('should stop at Senior III when younger partner fails Senior IV threshold (65, 55)', () => {
      // max=65 >= 55 (Senior III older), min=55 >= 50 (Senior III younger) => Senior III
      // Senior IV needs min >= 60, but 55 < 60
      expect(getNdcaCoupleCategories(65, 55)).toEqual(['Adult', 'Senior 1', 'Senior 2', 'Senior 3']);
    });

    it('should return Adult + Senior 1 for mixed ages (45, 38)', () => {
      // Senior I: max=45 >= 35, min=38 >= 30 => yes
      // Senior II: max=45 >= 45, min=38 >= 40 => no (38 < 40)
      expect(getNdcaCoupleCategories(45, 38)).toEqual(['Adult', 'Senior 1']);
    });
  });

  describe('getCoupleEligibleCategories (integration)', () => {
    it('should return NDCA categories for couple with DOB', async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: {
          ageCategories: [
            { name: 'Youth', minAge: 16, maxAge: 18 },
            { name: 'Adult', minAge: 19, maxAge: 34 },
            { name: 'Senior 1', minAge: 35, maxAge: 44 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      // Ages 25 and 23 as of 2026-06-01
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2001-01-15',
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '2003-03-20',
      });

      const categories = await getCoupleEligibleCategories(leader.id, follower.id, comp.id);
      expect(categories).toEqual(['Adult']);
    });

    it('should return empty when DOB is missing', async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: { ageCategories: [{ name: 'Adult', minAge: 19 }] },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id,
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id,
      });

      const categories = await getCoupleEligibleCategories(leader.id, follower.id, comp.id);
      expect(categories).toEqual([]);
    });

    it('should return empty when competition has no organization', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2001-01-15',
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '2003-03-20',
      });

      const categories = await getCoupleEligibleCategories(leader.id, follower.id, comp.id);
      expect(categories).toEqual([]);
    });

    it('should use per-person checking for non-NDCA orgs', async () => {
      const org = await dataService.addOrganization({
        name: 'Custom Org',
        rulePresetKey: 'custom',
        settings: {
          ageCategories: [
            { name: 'Open', minAge: 18 },
            { name: 'Junior', maxAge: 17 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'UNAFFILIATED', date: '2026-06-01', organizationId: org.id,
      });
      // Both age 20
      const leader = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2006-01-01',
      });
      const follower = await dataService.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '2006-06-01',
      });

      const categories = await getCoupleEligibleCategories(leader.id, follower.id, comp.id);
      expect(categories).toEqual(['Open']);
    });
  });

  describe('validateEntry with age categories', () => {
    let compId: number;
    let bib: number;

    beforeEach(async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: {
          ageCategories: [
            { name: 'Youth', minAge: 16, maxAge: 18 },
            { name: 'Adult', minAge: 19, maxAge: 34 },
            { name: 'Senior 1', minAge: 35, maxAge: 44 },
            { name: 'Senior 2', minAge: 45, maxAge: 54 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      compId = comp.id;
      // Adult couple (ages 25, 23)
      const leader = await dataService.addPerson({
        firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student',
        competitionId: compId, dateOfBirth: '2001-01-15',
      });
      const follower = await dataService.addPerson({
        firstName: 'Jane', lastName: 'Smith', role: 'follower', status: 'student',
        competitionId: compId, dateOfBirth: '2003-03-20',
      });
      const couple = await dataService.addCouple(leader.id, follower.id, compId);
      bib = couple!.bib;
    });

    it('should accept adult couple entering Adult event', async () => {
      const result = await validateEntry(compId, bib, { ageCategory: 'Adult' });
      expect(result.valid).toBe(true);
    });

    it('should reject adult couple entering Youth event', async () => {
      const result = await validateEntry(compId, bib, { ageCategory: 'Youth' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not eligible');
      expect(result.errors[0]).toContain('Youth');
    });

    it('should reject adult couple entering Senior event', async () => {
      const result = await validateEntry(compId, bib, { ageCategory: 'Senior 1' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not eligible');
    });

    it('should reject entry for unconfigured age category', async () => {
      const result = await validateEntry(compId, bib, { ageCategory: 'Senior 4' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not configured');
    });
  });

  describe('validateEntry with youth dance-up', () => {
    it('should allow youth couple to enter Adult event', async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: {
          ageCategories: [
            { name: 'Youth', minAge: 16, maxAge: 18 },
            { name: 'Adult', minAge: 19, maxAge: 34 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      // Youth couple (ages 17, 16)
      const leader = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2009-03-01',
      });
      const follower = await dataService.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '2010-01-01',
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { ageCategory: 'Adult' });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEntry with senior dance-down', () => {
    it('should allow Senior II couple to enter Senior 1 event', async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: {
          ageCategories: [
            { name: 'Adult', minAge: 19, maxAge: 34 },
            { name: 'Senior 1', minAge: 35, maxAge: 44 },
            { name: 'Senior 2', minAge: 45, maxAge: 54 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      // Senior II couple (ages 46, 41)
      const leader = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '1980-01-01',
      });
      const follower = await dataService.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '1985-01-01',
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { ageCategory: 'Senior 1' });
      expect(result.valid).toBe(true);
    });

    it('should reject Senior I couple entering Senior 2 event', async () => {
      const org = await dataService.addOrganization({
        name: 'NDCA Org',
        rulePresetKey: 'ndca',
        settings: {
          ageCategories: [
            { name: 'Adult', minAge: 19, maxAge: 34 },
            { name: 'Senior 1', minAge: 35, maxAge: 44 },
            { name: 'Senior 2', minAge: 45, maxAge: 54 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      // Senior I couple (ages 36, 31)
      const leader = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '1990-01-01',
      });
      const follower = await dataService.addPerson({
        firstName: 'C', lastName: 'D', role: 'follower', status: 'student',
        competitionId: comp.id, dateOfBirth: '1995-01-01',
      });
      const couple = await dataService.addCouple(leader.id, follower.id, comp.id);

      const result = await validateEntry(comp.id, couple!.bib, { ageCategory: 'Senior 2' });
      expect(result.valid).toBe(false);
    });
  });

  // Helper: create a couple in a competition and optionally add them to an event at a given level
  async function createCoupleWithEntry(compId: number, level?: string, judgeIds: number[] = []) {
    const leader = await dataService.addPerson({
      firstName: 'A', lastName: 'B', role: 'leader' as const, status: 'student' as const,
      competitionId: compId,
    });
    const follower = await dataService.addPerson({
      firstName: 'C', lastName: 'D', role: 'follower' as const, status: 'student' as const,
      competitionId: compId,
    });
    const couple = await dataService.addCouple(leader.id, follower.id, compId);
    if (level && couple) {
      await dataService.addEvent(`Test ${level}`, [couple.bib], judgeIds, compId, undefined, undefined, level);
    }
    return { leader, follower, couple: couple! };
  }

  describe('getAllowedLevelsForCouple', () => {
    it('should return all levels when entry validation is disabled', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze');

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.levels).toEqual(['Bronze', 'Silver', 'Gold']);
      expect(result.coupleLevel).toBeNull();
    });

    it('should return empty when competition has no levels', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const { couple } = await createCoupleWithEntry(comp.id);

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.levels).toEqual([]);
      expect(result.coupleLevel).toBeNull();
    });

    it('should return all levels when couple has no entries (first entry is unrestricted)', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      // No entries — couple has no inferred level
      const { couple } = await createCoupleWithEntry(comp.id);

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      // First entry: all levels allowed
      expect(result.levels).toEqual(['Bronze', 'Silver', 'Gold']);
      expect(result.coupleLevel).toBeNull();
    });

    it('should restrict based on lowest entry level', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold', 'Open'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze');

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      // Bronze (idx 0) + 1 above = Bronze, Silver
      expect(result.coupleLevel).toBe('Bronze');
      expect(result.levels).toEqual(['Bronze', 'Silver']);
    });

    it('should use lowest level when couple has multiple entries', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Silver');
      // Add second entry at Bronze (lower)
      await dataService.addEvent('Test Bronze', [couple.bib], [], comp.id, undefined, undefined, 'Bronze');

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      // Lowest = Bronze, +1 = Silver
      expect(result.coupleLevel).toBe('Bronze');
      expect(result.levels).toEqual(['Bronze', 'Silver']);
    });
  });

  describe('getMainLevel (pure function)', () => {
    it('should extract main level from sub-level', () => {
      expect(getMainLevel('Bronze 1')).toBe('Bronze');
      expect(getMainLevel('Bronze 4')).toBe('Bronze');
      expect(getMainLevel('Silver 2')).toBe('Silver');
    });

    it('should return the level as-is when no sub-level', () => {
      expect(getMainLevel('Gold')).toBe('Gold');
      expect(getMainLevel('Newcomer')).toBe('Newcomer');
      expect(getMainLevel('Pre-Championship')).toBe('Pre-Championship');
    });

    it('should handle "Open Bronze" as a single level (not sub-level)', () => {
      expect(getMainLevel('Open Bronze')).toBe('Open Bronze');
    });
  });

  describe('groupLevelsByMain (pure function)', () => {
    it('should group sub-levels under main levels', () => {
      const groups = groupLevelsByMain(['Bronze 1', 'Bronze 2', 'Silver 1', 'Silver 2', 'Gold']);
      expect(groups).toEqual([
        { mainLevel: 'Bronze', subLevels: ['Bronze 1', 'Bronze 2'] },
        { mainLevel: 'Silver', subLevels: ['Silver 1', 'Silver 2'] },
        { mainLevel: 'Gold', subLevels: ['Gold'] },
      ]);
    });

    it('should handle levels with no sub-levels', () => {
      const groups = groupLevelsByMain(['Bronze', 'Silver', 'Gold']);
      expect(groups).toEqual([
        { mainLevel: 'Bronze', subLevels: ['Bronze'] },
        { mainLevel: 'Silver', subLevels: ['Silver'] },
        { mainLevel: 'Gold', subLevels: ['Gold'] },
      ]);
    });

    it('should handle detailed template levels', () => {
      const groups = groupLevelsByMain([
        'Newcomer', 'Bronze 1', 'Bronze 2', 'Bronze 3', 'Bronze 4',
        'Silver 1', 'Silver 2', 'Silver 3', 'Gold',
      ]);
      expect(groups).toHaveLength(4);
      expect(groups[0]).toEqual({ mainLevel: 'Newcomer', subLevels: ['Newcomer'] });
      expect(groups[1].subLevels).toEqual(['Bronze 1', 'Bronze 2', 'Bronze 3', 'Bronze 4']);
      expect(groups[2].subLevels).toEqual(['Silver 1', 'Silver 2', 'Silver 3']);
      expect(groups[3]).toEqual({ mainLevel: 'Gold', subLevels: ['Gold'] });
    });
  });

  describe('getAllowedLevelsForCouple - mainlevel mode', () => {
    it('should allow all sub-levels within consecutive main levels', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'STUDIO', date: '2026-06-01',
        levels: ['Newcomer', 'Bronze 1', 'Bronze 2', 'Bronze 3', 'Silver 1', 'Silver 2', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1, levelRestrictionMode: 'mainlevel' },
      });
      // Create couple entered in Bronze 1 event
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze 1');

      // Base = Bronze 1, main level = Bronze, +1 main = Silver
      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.coupleLevel).toBe('Bronze 1');
      expect(result.levels).toEqual(['Bronze 1', 'Bronze 2', 'Bronze 3', 'Silver 1', 'Silver 2']);
    });

    it('should allow only own main level group when levelsAboveAllowed is 0', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'STUDIO', date: '2026-06-01',
        levels: ['Bronze 1', 'Bronze 2', 'Silver 1', 'Silver 2', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 0, levelRestrictionMode: 'mainlevel' },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze 1');

      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.levels).toEqual(['Bronze 1', 'Bronze 2']);
    });

    it('should allow 2 main levels above', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'STUDIO', date: '2026-06-01',
        levels: ['Newcomer', 'Bronze 1', 'Bronze 2', 'Silver 1', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 2, levelRestrictionMode: 'mainlevel' },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Newcomer');

      // Newcomer + 2 main levels above = Newcomer, Bronze (all), Silver (all)
      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.levels).toEqual(['Newcomer', 'Bronze 1', 'Bronze 2', 'Silver 1']);
    });

    it('should use sublevel mode as default when mode is not specified', async () => {
      const { getAllowedLevelsForCouple } = await import('../../services/validationService');
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'STUDIO', date: '2026-06-01',
        levels: ['Bronze 1', 'Bronze 2', 'Bronze 3', 'Silver 1'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze 1');

      // Default (sublevel): Bronze 1 + 1 = Bronze 1, Bronze 2 only
      const result = await getAllowedLevelsForCouple(comp.id, couple.bib);
      expect(result.levels).toEqual(['Bronze 1', 'Bronze 2']);
    });
  });

  describe('getEligibleAgeCategories', () => {
    it('should return empty when person has no DOB', async () => {
      const org = await dataService.addOrganization({
        name: 'Test Org', rulePresetKey: 'custom',
        settings: { ageCategories: [{ name: 'Adult', minAge: 18 }] },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      const person = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id,
      });

      const result = await getEligibleAgeCategories(person.id, comp.id);
      expect(result).toEqual([]);
    });

    it('should return empty when competition has no organization', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
      });
      const person = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2000-01-01',
      });

      const result = await getEligibleAgeCategories(person.id, comp.id);
      expect(result).toEqual([]);
    });

    it('should return matching age categories for person with DOB', async () => {
      const org = await dataService.addOrganization({
        name: 'Test Org', rulePresetKey: 'custom',
        settings: {
          ageCategories: [
            { name: 'Junior', maxAge: 17 },
            { name: 'Adult', minAge: 18, maxAge: 34 },
            { name: 'Senior', minAge: 35 },
          ],
        },
      });
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01', organizationId: org.id,
      });
      // Person will be 26 on 2026-06-01
      const person = await dataService.addPerson({
        firstName: 'A', lastName: 'B', role: 'leader', status: 'student',
        competitionId: comp.id, dateOfBirth: '2000-01-01',
      });

      const result = await getEligibleAgeCategories(person.id, comp.id);
      expect(result).toEqual(['Adult']);
    });
  });

  describe('validateEntry with entry validation enabled', () => {
    it('should allow any level when couple has no entries yet (first entry is unrestricted)', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      const { couple } = await createCoupleWithEntry(comp.id);

      const result = await validateEntry(comp.id, couple.bib, { level: 'Gold' });
      expect(result.valid).toBe(true);
    });

    it('should return needsApproval for level outside allowed range', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold', 'Open'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      // Create couple entered in Bronze
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze');

      // Bronze (idx 0) + levelsAboveAllowed=1 → can enter Bronze, Silver only
      const result = await validateEntry(comp.id, couple.bib, { level: 'Open' });
      expect(result.valid).toBe(false);
      expect(result.needsApproval).toBe(true);
      expect(result.approvalReason).toContain('Bronze');
    });

    it('should accept level within allowed range', async () => {
      const comp = await dataService.addCompetition({
        name: 'Test', type: 'NDCA', date: '2026-06-01',
        levels: ['Bronze', 'Silver', 'Gold'],
        entryValidation: { enabled: true, levelsAboveAllowed: 1 },
      });
      const { couple } = await createCoupleWithEntry(comp.id, 'Bronze');

      const result = await validateEntry(comp.id, couple.bib, { level: 'Silver' });
      expect(result.valid).toBe(true);
    });
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
