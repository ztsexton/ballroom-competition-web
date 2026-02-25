import { CachingDataService } from '../../services/data/CachingDataService';
import { JsonDataService } from '../../services/data/JsonDataService';

describe('CachingDataService', () => {
  let inner: JsonDataService;
  let cached: CachingDataService;

  beforeEach(async () => {
    inner = new JsonDataService();
    cached = new CachingDataService(inner);
    await cached.resetAllData();
  });

  describe('competition caching', () => {
    it('should return competitions after addCompetition', async () => {
      await cached.addCompetition({ name: 'Test', type: 'NDCA', date: '2026-01-01' });

      const competitions = await cached.getCompetitions();
      expect(competitions).toHaveLength(1);
      expect(competitions[0].name).toBe('Test');
    });

    it('should return competitions after cache is cleared', async () => {
      await cached.addCompetition({ name: 'Test', type: 'NDCA', date: '2026-01-01' });

      // Populate cache
      const first = await cached.getCompetitions();
      expect(first).toHaveLength(1);

      // Clear cache
      cached.clearCache();

      // Should still return the competition (refetched from inner)
      const second = await cached.getCompetitions();
      expect(second).toHaveLength(1);
      expect(second[0].name).toBe('Test');
    });

    it('should refetch from inner after clearCache', async () => {
      // Add a competition
      await cached.addCompetition({ name: 'First', type: 'NDCA', date: '2026-01-01' });

      // Populate cache
      const first = await cached.getCompetitions();
      expect(first).toHaveLength(1);

      // Clear cache
      cached.clearCache();

      // After clearCache, getCompetitions should query inner (not use stale cache)
      // Insert directly into inner to verify cache was actually cleared
      await inner.addCompetition({ name: 'Second', type: 'STUDIO', date: '2026-03-15' });

      const afterClear = await cached.getCompetitions();
      // Should have both — the first from before and the newly-added second
      expect(afterClear).toHaveLength(2);
      expect(afterClear.map(c => c.name)).toContain('First');
      expect(afterClear.map(c => c.name)).toContain('Second');
    });

    it('should invalidate competitions list after addCompetition', async () => {
      // Populate cache with empty list
      const empty = await cached.getCompetitions();
      expect(empty).toHaveLength(0);

      // Add via cached service (not bypassing cache)
      await cached.addCompetition({ name: 'New', type: 'NDCA', date: '2026-06-01' });

      // Should return the new competition (cache was invalidated by addCompetition)
      const withNew = await cached.getCompetitions();
      expect(withNew).toHaveLength(1);
      expect(withNew[0].name).toBe('New');
    });

    it('should invalidate competitions list after deleteCompetition', async () => {
      const comp = await cached.addCompetition({ name: 'ToDelete', type: 'NDCA', date: '2026-01-01' });

      // Populate cache
      const before = await cached.getCompetitions();
      expect(before).toHaveLength(1);

      await cached.deleteCompetition(comp.id);

      // Cache invalidated — should return empty
      const after = await cached.getCompetitions();
      expect(after).toHaveLength(0);
    });

    it('should invalidate competitions list after updateCompetition', async () => {
      const comp = await cached.addCompetition({ name: 'Original', type: 'NDCA', date: '2026-01-01' });

      // Populate cache
      await cached.getCompetitions();

      await cached.updateCompetition(comp.id, { name: 'Updated' });

      // Cache invalidated — should return updated name
      const after = await cached.getCompetitions();
      expect(after).toHaveLength(1);
      expect(after[0].name).toBe('Updated');
    });

    it('should invalidate by-id cache after updateCompetition', async () => {
      const comp = await cached.addCompetition({ name: 'Original', type: 'NDCA', date: '2026-01-01' });

      // Populate by-id cache
      const before = await cached.getCompetitionById(comp.id);
      expect(before?.name).toBe('Original');

      await cached.updateCompetition(comp.id, { name: 'Updated' });

      // by-id cache invalidated
      const after = await cached.getCompetitionById(comp.id);
      expect(after?.name).toBe('Updated');
    });
  });

  describe('clearCache()', () => {
    it('should clear all caches so all entities are refetched', async () => {
      // Create some data
      const comp = await cached.addCompetition({ name: 'Comp', type: 'NDCA', date: '2026-01-01' });
      const person = await cached.addPerson({
        firstName: 'John', lastName: 'Doe', email: 'j@test.com',
        role: 'leader', status: 'student', competitionId: comp.id,
      });

      // Populate caches
      await cached.getCompetitions();
      await cached.getCompetitionById(comp.id);
      await cached.getPeople(comp.id);

      // Clear all caches
      cached.clearCache();

      // Data should still be accessible (refetched from inner)
      const comps = await cached.getCompetitions();
      expect(comps).toHaveLength(1);
      const people = await cached.getPeople(comp.id);
      expect(people).toHaveLength(1);
    });
  });
});
