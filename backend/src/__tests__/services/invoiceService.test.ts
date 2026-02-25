import { calculateInvoices } from '../../services/invoiceService';
import { dataService } from '../../services/dataService';

describe('InvoiceService', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetition(pricingOverrides?: Record<string, unknown>) {
    const comp = await dataService.addCompetition({
      name: 'Test Comp',
      type: 'UNAFFILIATED',
      date: '2025-06-01',
      pricing: {
        singleDance: [{ minEntries: 1, pricePerEntry: 25 }, { minEntries: 5, pricePerEntry: 20 }],
        multiDance: { mode: 'flat' as const, flatTiers: [{ minEntries: 1, pricePerEntry: 40 }] },
        scholarship: [{ minEntries: 1, pricePerEntry: 50 }],
        ...pricingOverrides,
      },
    });
    return comp;
  }

  async function setupCoupleWithEvents(competitionId: number, eventCount: number, opts?: { multiDance?: boolean; scholarship?: boolean }) {
    const leader = await dataService.addPerson({ firstName: 'L', lastName: 'A', role: 'leader', status: 'student', competitionId });
    const follower = await dataService.addPerson({ firstName: 'F', lastName: 'B', role: 'follower', status: 'student', competitionId });
    const couple = await dataService.addCouple(leader.id, follower.id, competitionId);

    const events = [];
    for (let i = 0; i < eventCount; i++) {
      const dances = opts?.multiDance ? ['waltz', 'tango'] : undefined;
      const event = await dataService.addEvent(
        `Event ${i + 1}`, [couple!.bib], [], competitionId,
        undefined, undefined, undefined, undefined, dances,
        undefined, opts?.scholarship,
      );
      events.push(event);
    }

    return { leader, follower, couple: couple!, events };
  }

  describe('single-dance pricing', () => {
    it('should apply correct tier lookup', async () => {
      const comp = await setupCompetition();
      await setupCoupleWithEvents(comp.id, 3);

      const summary = await calculateInvoices(comp.id);

      expect(summary.invoices.length).toBeGreaterThan(0);
      // 3 single-dance events at $25/each (tier: minEntries 1)
      const lineItems = summary.invoices[0].partnerships[0].lineItems;
      expect(lineItems).toHaveLength(3);
      expect(lineItems[0].pricePerEntry).toBe(25);
    });

    it('should apply volume discount tier', async () => {
      const comp = await setupCompetition();
      await setupCoupleWithEvents(comp.id, 6);

      const summary = await calculateInvoices(comp.id);

      // 6 single-dance events → tier minEntries 5 → $20/each
      const lineItems = summary.invoices[0].partnerships[0].lineItems;
      expect(lineItems[0].pricePerEntry).toBe(20);
    });
  });

  describe('multi-dance pricing (flat mode)', () => {
    it('should use flat tier pricing', async () => {
      const comp = await setupCompetition();
      await setupCoupleWithEvents(comp.id, 2, { multiDance: true });

      const summary = await calculateInvoices(comp.id);

      const lineItems = summary.invoices[0].partnerships[0].lineItems;
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].pricePerEntry).toBe(40);
      expect(lineItems[0].category).toBe('multi');
    });
  });

  describe('multi-dance pricing (per-dance-count mode)', () => {
    it('should use per-dance-count tier pricing', async () => {
      const comp = await dataService.addCompetition({
        name: 'Comp',
        type: 'UNAFFILIATED',
        date: '2025-06-01',
        pricing: {
          singleDance: [],
          multiDance: {
            mode: 'per-dance-count' as const,
            perDanceCountTiers: {
              '2': [{ minEntries: 1, pricePerEntry: 35 }],
              '3': [{ minEntries: 1, pricePerEntry: 45 }],
            },
          },
          scholarship: [],
        },
      });

      await setupCoupleWithEvents(comp.id, 1, { multiDance: true });

      const summary = await calculateInvoices(comp.id);

      const lineItems = summary.invoices[0].partnerships[0].lineItems;
      expect(lineItems[0].pricePerEntry).toBe(35); // 2 dances
    });
  });

  describe('scholarship pricing', () => {
    it('should use scholarship tier', async () => {
      const comp = await setupCompetition();
      await setupCoupleWithEvents(comp.id, 1, { scholarship: true });

      const summary = await calculateInvoices(comp.id);

      const lineItems = summary.invoices[0].partnerships[0].lineItems;
      expect(lineItems[0].pricePerEntry).toBe(50);
      expect(lineItems[0].category).toBe('scholarship');
    });
  });

  describe('revenue de-duplication', () => {
    it('should count each entry once for revenue', async () => {
      const comp = await setupCompetition();
      const { couple, events } = await setupCoupleWithEvents(comp.id, 2);

      const summary = await calculateInvoices(comp.id);

      // Both leader and follower see line items, but totalRevenue counts each entry once
      const expectedRevenue = 2 * 25;
      expect(summary.totalRevenue).toBe(expectedRevenue);
    });
  });

  describe('no pricing configured', () => {
    it('should return $0 when no pricing is set', async () => {
      const comp = await dataService.addCompetition({
        name: 'No Price Comp',
        type: 'UNAFFILIATED',
        date: '2025-06-01',
      });
      await setupCoupleWithEvents(comp.id, 2);

      const summary = await calculateInvoices(comp.id);

      expect(summary.totalRevenue).toBe(0);
    });
  });

  describe('non-existent competition', () => {
    it('should return empty summary', async () => {
      const summary = await calculateInvoices(999);

      expect(summary.totalRevenue).toBe(0);
      expect(summary.invoices).toEqual([]);
    });
  });
});
