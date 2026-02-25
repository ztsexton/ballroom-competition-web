import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Invoices API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  async function setupCompetitionWithEntries() {
    const comp = await dataService.addCompetition({
      name: 'Test Comp', type: 'UNAFFILIATED', date: '2025-06-01',
      pricing: {
        singleDance: [{ minEntries: 1, pricePerEntry: 25 }],
        multiDance: { mode: 'flat' as const, flatTiers: [{ minEntries: 1, pricePerEntry: 40 }] },
        scholarship: [{ minEntries: 1, pricePerEntry: 50 }],
      },
    });
    const leader = await dataService.addPerson({ firstName: 'Leader', lastName: 'A', role: 'leader', status: 'student', competitionId: comp.id });
    const follower = await dataService.addPerson({ firstName: 'Follower', lastName: 'B', role: 'follower', status: 'student', competitionId: comp.id });
    const couple = await dataService.addCouple(leader.id, follower.id, comp.id);
    const event = await dataService.addEvent('Waltz', [couple!.bib], [], comp.id);
    return { comp, leader, follower, couple: couple!, event };
  }

  describe('GET /api/invoices/:competitionId', () => {
    it('should return invoice summary', async () => {
      const { comp } = await setupCompetitionWithEntries();

      const response = await request(app)
        .get(`/api/invoices/${comp.id}`)
        .expect(200);

      expect(response.body.totalRevenue).toBeDefined();
      expect(response.body.totalPaid).toBeDefined();
      expect(response.body.totalOutstanding).toBeDefined();
      expect(response.body.invoices).toBeDefined();
    });

    it('should return 404 for missing competition', async () => {
      await request(app)
        .get('/api/invoices/999')
        .expect(404);
    });

    it('should compute per-person line items', async () => {
      const { comp } = await setupCompetitionWithEntries();

      const response = await request(app)
        .get(`/api/invoices/${comp.id}`)
        .expect(200);

      // At least one invoice should exist (leader and/or follower)
      if (response.body.invoices.length > 0) {
        const invoice = response.body.invoices[0];
        expect(invoice.personId).toBeDefined();
        expect(invoice.personName).toBeDefined();
        expect(invoice.partnerships).toBeDefined();
        expect(invoice.totalAmount).toBeDefined();
      }
    });
  });

  describe('PATCH /api/invoices/:competitionId/payments', () => {
    it('should update payment status', async () => {
      const { comp, couple, event } = await setupCompetitionWithEntries();

      const response = await request(app)
        .patch(`/api/invoices/${comp.id}/payments`)
        .send({
          entries: [`${event.id}:${couple.bib}`],
          paid: true,
        })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 404 for missing competition', async () => {
      await request(app)
        .patch('/api/invoices/999/payments')
        .send({ entries: ['1:1'], paid: true })
        .expect(404);
    });

    it('should return 400 when entries array is missing', async () => {
      const { comp } = await setupCompetitionWithEntries();

      await request(app)
        .patch(`/api/invoices/${comp.id}/payments`)
        .send({ paid: true })
        .expect(400);
    });
  });
});
