import { dataService } from './dataService';
import {
  Event, PricingTier, InvoiceLineItem, PartnershipGroup, PersonInvoice, InvoiceSummary,
} from '../types';

function findApplicableTier(tiers: PricingTier[], entryCount: number): number {
  const sorted = [...tiers].sort((a, b) => b.minEntries - a.minEntries);
  for (const tier of sorted) {
    if (entryCount >= tier.minEntries) {
      return tier.pricePerEntry;
    }
  }
  return 0;
}

function categorizeEvent(event: Event): 'scholarship' | 'single' | 'multi' {
  if (event.isScholarship) return 'scholarship';
  const danceCount = event.dances?.length || 0;
  if (danceCount <= 1) return 'single';
  return 'multi';
}

export function calculateInvoices(competitionId: number): InvoiceSummary {
  const competition = dataService.getCompetitionById(competitionId);
  if (!competition) {
    return { totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoices: [] };
  }

  const pricing = competition.pricing;
  const entryPayments = competition.entryPayments || {};
  const people = dataService.getPeople(competitionId);
  const couples = dataService.getCouples(competitionId);
  const eventsMap = dataService.getEvents(competitionId);
  const events = Object.values(eventsMap);

  // Track unique entry prices for revenue calculation (avoid double-counting)
  const entryPriceMap = new Map<string, number>(); // key "eventId:bib" → price

  const invoices: PersonInvoice[] = [];

  for (const person of people) {
    const personCouples = couples.filter(
      c => c.leaderId === person.id || c.followerId === person.id
    );

    if (personCouples.length === 0) continue;

    const partnerships: PartnershipGroup[] = [];

    for (const couple of personCouples) {
      const partnerId = couple.leaderId === person.id ? couple.followerId : couple.leaderId;
      const partnerName = couple.leaderId === person.id ? couple.followerName : couple.leaderName;

      const coupleEvents = events.filter(event =>
        event.heats[0]?.bibs.includes(couple.bib)
      );

      if (coupleEvents.length === 0) continue;

      // Categorize events for this partnership
      const singleEvents: Event[] = [];
      const multiEvents: Event[] = [];
      const scholarshipEvents: Event[] = [];

      for (const event of coupleEvents) {
        const category = categorizeEvent(event);
        if (category === 'scholarship') scholarshipEvents.push(event);
        else if (category === 'single') singleEvents.push(event);
        else multiEvents.push(event);
      }

      const lineItems: InvoiceLineItem[] = [];

      // Single dance pricing (per-partnership volume)
      if (pricing?.singleDance && singleEvents.length > 0) {
        const pricePerEntry = findApplicableTier(pricing.singleDance, singleEvents.length);
        for (const event of singleEvents) {
          const key = `${event.id}:${couple.bib}`;
          lineItems.push({
            eventId: event.id,
            eventName: event.name,
            category: 'single',
            danceCount: event.dances?.length || 1,
            pricePerEntry,
            bib: couple.bib,
            partnerName,
            paid: entryPayments[key]?.paid || false,
          });
          entryPriceMap.set(key, pricePerEntry);
        }
      }

      // Multi dance pricing (per-partnership volume)
      if (pricing?.multiDance && multiEvents.length > 0) {
        if (pricing.multiDance.mode === 'flat' && pricing.multiDance.flatTiers) {
          const pricePerEntry = findApplicableTier(pricing.multiDance.flatTiers, multiEvents.length);
          for (const event of multiEvents) {
            const key = `${event.id}:${couple.bib}`;
            lineItems.push({
              eventId: event.id,
              eventName: event.name,
              category: 'multi',
              danceCount: event.dances?.length || 2,
              pricePerEntry,
              bib: couple.bib,
              partnerName,
              paid: entryPayments[key]?.paid || false,
            });
            entryPriceMap.set(key, pricePerEntry);
          }
        } else if (pricing.multiDance.mode === 'per-dance-count' && pricing.multiDance.perDanceCountTiers) {
          const totalMultiCount = multiEvents.length;
          for (const event of multiEvents) {
            const danceCount = event.dances?.length || 2;
            const tiersForCount = pricing.multiDance.perDanceCountTiers[String(danceCount)];
            const pricePerEntry = tiersForCount
              ? findApplicableTier(tiersForCount, totalMultiCount)
              : 0;
            const key = `${event.id}:${couple.bib}`;
            lineItems.push({
              eventId: event.id,
              eventName: event.name,
              category: 'multi',
              danceCount,
              pricePerEntry,
              bib: couple.bib,
              partnerName,
              paid: entryPayments[key]?.paid || false,
            });
            entryPriceMap.set(key, pricePerEntry);
          }
        }
      }

      // Scholarship pricing (per-partnership volume)
      if (pricing?.scholarship && scholarshipEvents.length > 0) {
        const pricePerEntry = findApplicableTier(pricing.scholarship, scholarshipEvents.length);
        for (const event of scholarshipEvents) {
          const key = `${event.id}:${couple.bib}`;
          lineItems.push({
            eventId: event.id,
            eventName: event.name,
            category: 'scholarship',
            danceCount: event.dances?.length || 1,
            pricePerEntry,
            bib: couple.bib,
            partnerName,
            paid: entryPayments[key]?.paid || false,
          });
          entryPriceMap.set(key, pricePerEntry);
        }
      }

      if (lineItems.length === 0) continue;

      const subtotal = lineItems.reduce((sum, item) => sum + item.pricePerEntry, 0);
      const paidAmount = lineItems
        .filter(item => item.paid)
        .reduce((sum, item) => sum + item.pricePerEntry, 0);

      partnerships.push({
        bib: couple.bib,
        partnerId,
        partnerName,
        lineItems,
        subtotal,
        paidAmount,
      });
    }

    if (partnerships.length === 0) continue;

    const totalAmount = partnerships.reduce((sum, p) => sum + p.subtotal, 0);
    const paidAmount = partnerships.reduce((sum, p) => sum + p.paidAmount, 0);

    invoices.push({
      personId: person.id,
      personName: `${person.firstName} ${person.lastName}`,
      personStatus: person.status,
      partnerships,
      totalAmount,
      paidAmount,
      outstandingAmount: totalAmount - paidAmount,
    });
  }

  // Revenue from unique entries (each entry counted once, not per person)
  let totalRevenue = 0;
  let totalPaid = 0;
  for (const [key, price] of entryPriceMap) {
    totalRevenue += price;
    if (entryPayments[key]?.paid) {
      totalPaid += price;
    }
  }

  return {
    totalRevenue,
    totalPaid,
    totalOutstanding: totalRevenue - totalPaid,
    invoices,
  };
}
