import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { Competition, Event, DetailedResultsResponse, PersonEventResult, PersonResultsResponse, PersonHeatEntry, PersonPartnerHeats, PersonHeatListResponse } from '../types';
import logger from '../utils/logger';

const router = Router();

// Check if a scheduled date has passed and apply the setting if so
async function applyScheduledSettings(comp: Competition): Promise<Competition> {
  const now = new Date().toISOString();
  const updates: Partial<Competition> = {};

  // Check publiclyVisibleAt
  if (!comp.publiclyVisible && comp.publiclyVisibleAt && comp.publiclyVisibleAt <= now) {
    updates.publiclyVisible = true;
    updates.publiclyVisibleAt = undefined;
  }

  // Check registrationOpenAt
  if (!comp.registrationOpen && comp.registrationOpenAt && comp.registrationOpenAt <= now) {
    updates.registrationOpen = true;
    updates.registrationOpenAt = undefined;
  }

  // Check heatListsPublishedAt
  if (!comp.heatListsPublished && comp.heatListsPublishedAt && comp.heatListsPublishedAt <= now) {
    updates.heatListsPublished = true;
    updates.heatListsPublishedAt = undefined;
  }

  // If any updates, save them and return updated competition
  if (Object.keys(updates).length > 0) {
    const updated = await dataService.updateCompetition(comp.id, updates);
    return updated || comp;
  }

  return comp;
}

// Get effective value considering scheduled date
// For backwards compatibility, undefined is treated as true (not explicitly hidden)
function isEffectivelyEnabled(value: boolean | undefined, scheduledAt: string | undefined): boolean {
  // Explicitly set to true
  if (value === true) return true;
  // Explicitly set to false - check if scheduled date has passed
  if (value === false) {
    if (scheduledAt && scheduledAt <= new Date().toISOString()) return true;
    return false;
  }
  // undefined (not set) - backwards compatibility: treat as visible
  return true;
}

function sanitizeCompetition(comp: Competition) {
  return {
    id: comp.id,
    name: comp.name,
    type: comp.type,
    date: comp.date,
    location: comp.location,
    description: comp.description,
    websiteUrl: comp.websiteUrl,
    organizerEmail: comp.organizerEmail,
    registrationOpen: isEffectivelyEnabled(comp.registrationOpen, comp.registrationOpenAt),
    heatListsPublished: isEffectivelyEnabled(comp.heatListsPublished, comp.heatListsPublishedAt),
    resultsPublic: comp.resultsPublic !== false,
  };
}

function sanitizeEvent(event: Event) {
  const scratched = new Set(event.scratchedBibs || []);
  return {
    id: event.id,
    name: event.name,
    designation: event.designation,
    syllabusType: event.syllabusType,
    level: event.level,
    style: event.style,
    dances: event.dances,
    scoringType: event.scoringType,
    isScholarship: event.isScholarship,
    rounds: event.heats.map(h => h.round),
    coupleCount: (event.heats[0]?.bibs || []).filter(b => !scratched.has(b)).length,
  };
}

// GET /competitions — list all competitions (optionally filtered by scope)
router.get('/competitions', async (_req: Request, res: Response) => {
  try {
    const scope = _req.query.scope as string | undefined;
    const competitions = await dataService.getCompetitions();
    const today = new Date().toISOString().split('T')[0];

    // Apply scheduled settings and filter by visibility
    const processed: Competition[] = [];
    for (const comp of competitions) {
      const updated = await applyScheduledSettings(comp);
      // Show if publiclyVisible or scheduled visibility has passed
      if (isEffectivelyEnabled(updated.publiclyVisible, updated.publiclyVisibleAt)) {
        processed.push(updated);
      }
    }

    let filtered = processed;
    if (scope === 'upcoming') {
      filtered = filtered
        .filter(c => c.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
    } else if (scope === 'recent') {
      filtered = filtered
        .filter(c => c.date < today && c.resultsPublic !== false)
        .sort((a, b) => b.date.localeCompare(a.date));
    } else {
      filtered = filtered.sort((a, b) => b.date.localeCompare(a.date));
    }

    res.json(filtered.map(sanitizeCompetition));
  } catch (error) {
    logger.error({ err: error }, 'Public competitions error');
    res.status(500).json({ error: 'Failed to load competitions' });
  }
});

// GET /competitions/:id — single competition
router.get('/competitions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    let competition = await dataService.getCompetitionById(id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    // Apply scheduled settings
    competition = await applyScheduledSettings(competition);
    if (!isEffectivelyEnabled(competition.publiclyVisible, competition.publiclyVisibleAt)) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(sanitizeCompetition(competition));
  } catch (error) {
    logger.error({ err: error }, 'Public competition error');
    res.status(500).json({ error: 'Failed to load competition' });
  }
});

// GET /competitions/:id/events — events for a competition
router.get('/competitions/:id/events', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const eventsMap = await dataService.getEvents(competitionId);
    const events = Object.values(eventsMap).map(sanitizeEvent);
    res.json(events);
  } catch (error) {
    logger.error({ err: error }, 'Public events error');
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// GET /competitions/:id/people — public people list with their partnerships
router.get('/competitions/:id/people', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const people = await dataService.getPeople(competitionId);
    const couples = await dataService.getCouples(competitionId);

    // Build a map of personId → partnerships (bib + partner name)
    const personPartnerships = new Map<number, Array<{ bib: number; partnerName: string }>>();
    for (const c of couples) {
      // Leader side
      let leaderList = personPartnerships.get(c.leaderId);
      if (!leaderList) { leaderList = []; personPartnerships.set(c.leaderId, leaderList); }
      leaderList.push({ bib: c.bib, partnerName: c.followerName });
      // Follower side
      let followerList = personPartnerships.get(c.followerId);
      if (!followerList) { followerList = []; personPartnerships.set(c.followerId, followerList); }
      followerList.push({ bib: c.bib, partnerName: c.leaderName });
    }

    res.json(people.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      partnerships: personPartnerships.get(p.id) || [],
    })));
  } catch (error) {
    logger.error({ err: error }, 'Public people error');
    res.status(500).json({ error: 'Failed to load people' });
  }
});

// GET /competitions/:id/heats — public heat lists (requires heatListsPublished)
router.get('/competitions/:id/heats', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    let competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    // Apply scheduled settings
    competition = await applyScheduledSettings(competition);
    if (!isEffectivelyEnabled(competition.publiclyVisible, competition.publiclyVisibleAt)) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    if (!isEffectivelyEnabled(competition.heatListsPublished, competition.heatListsPublishedAt)) {
      return res.status(403).json({ error: 'Heat lists are not yet published for this competition' });
    }

    const eventsMap = await dataService.getEvents(competitionId);
    const couples = await dataService.getCouples(competitionId);
    const couplesByBib = new Map(couples.map(c => [c.bib, c]));

    const resultsPublic = competition.resultsPublic !== false;

    // Return events with heat details (bibs + couple names), excluding scratched
    const events = [];
    for (const event of Object.values(eventsMap)) {
      const eventScratched = new Set(event.scratchedBibs || []);
      const heats = [];
      for (const heat of event.heats) {
        const couples = heat.bibs
          .filter(bib => !eventScratched.has(bib))
          .map(bib => {
            const couple = couplesByBib.get(bib);
            return {
              bib,
              leaderName: couple?.leaderName || '',
              followerName: couple?.followerName || '',
            } as { bib: number; leaderName: string; followerName: string; place?: number; recalled?: boolean };
          });

        // Enrich with results if available
        if (resultsPublic) {
          try {
            const results = await scoringService.calculateResults(event.id, heat.round);
            if (results.length > 0) {
              if (heat.round === 'final') {
                await scoringService.enrichRecallStatus(results, event.id, heat.round);
                const resultsByBib = new Map(results.map(r => [r.bib, r]));
                for (const c of couples) {
                  const r = resultsByBib.get(c.bib);
                  if (r?.place) c.place = r.place;
                }
                couples.sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
              } else {
                await scoringService.enrichRecallStatus(results, event.id, heat.round);
                const resultsByBib = new Map(results.map(r => [r.bib, r]));
                for (const c of couples) {
                  const r = resultsByBib.get(c.bib);
                  if (r?.recalled !== undefined) c.recalled = r.recalled;
                }
              }
            }
          } catch {
            // Skip results enrichment if scoring fails (no scores submitted yet)
          }
        }

        heats.push({ round: heat.round, couples });
      }
      events.push({ ...sanitizeEvent(event), heats });
    }

    res.json(events);
  } catch (error) {
    logger.error({ err: error }, 'Public heat lists error');
    res.status(500).json({ error: 'Failed to load heat lists' });
  }
});

// GET /competitions/:id/events/:eventId/results/:round — event results
router.get('/competitions/:id/events/:eventId/results/:round', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const eventId = parseInt(req.params.eventId);
    const round = req.params.round;

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition || competition.publiclyVisible === false) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    if (competition.resultsPublic === false) {
      return res.status(403).json({ error: 'Results are not publicly available for this competition' });
    }

    // Validate event belongs to this competition
    const eventsMap = await dataService.getEvents(competitionId);
    const event = eventsMap[eventId];
    if (!event) {
      return res.status(404).json({ error: 'Event not found in this competition' });
    }

    const results = await scoringService.calculateResults(eventId, round);
    const detail = req.query.detail === 'true';

    if (!detail) {
      return res.json(results);
    }

    await scoringService.enrichRecallStatus(results, eventId, round);

    const eventObj = await dataService.getEventById(eventId);
    const heat = eventObj?.heats.find(h => h.round === round);
    const judgeIds = heat?.judges || [];
    const judgesMap = await dataService.getJudgesByIds(judgeIds);
    const judges = judgeIds.map(id => {
      const j = judgesMap.get(id);
      return { id, judgeNumber: j?.judgeNumber ?? 0, name: j?.name ?? '' };
    });

    const response: DetailedResultsResponse = {
      judges,
      eventName: eventObj?.name || '',
      round,
      dances: eventObj?.dances,
      style: eventObj?.style,
      level: eventObj?.level,
      results,
    };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Public results error');
    res.status(500).json({ error: 'Failed to load results' });
  }
});

// GET /competitions/:id/people/:personId/results — all results for a person across events
router.get('/competitions/:id/people/:personId/results', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const personId = parseInt(req.params.personId);

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition || competition.publiclyVisible === false) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    if (competition.resultsPublic === false) {
      return res.status(403).json({ error: 'Results are not publicly available for this competition' });
    }

    const people = await dataService.getPeople(competitionId);
    const person = people.find(p => p.id === personId);
    if (!person || person.competitionId !== competitionId) {
      return res.status(404).json({ error: 'Person not found in this competition' });
    }

    const couples = await dataService.getCouples(competitionId);
    const personCouples = couples.filter(c => c.leaderId === personId || c.followerId === personId);
    const personBibs = new Set(personCouples.map(c => c.bib));

    const eventsMap = await dataService.getEvents(competitionId);
    const events: PersonEventResult[] = [];

    for (const event of Object.values(eventsMap)) {
      // Find bib for this person in this event
      const eventBibs = new Set(event.heats.flatMap(h => h.bibs));
      const matchingBib = [...personBibs].find(b => eventBibs.has(b));
      if (!matchingBib) continue;

      const couple = personCouples.find(c => c.bib === matchingBib)!;
      const partnerName = couple.leaderId === personId ? couple.followerName : couple.leaderName;

      const rounds: PersonEventResult['rounds'] = [];
      for (const heat of event.heats) {
        if (!heat.bibs.includes(matchingBib)) continue;

        const results = await scoringService.calculateResults(event.id, heat.round);
        await scoringService.enrichRecallStatus(results, event.id, heat.round);

        const judgeIds = heat.judges || [];
        const judgesMap = await dataService.getJudgesByIds(judgeIds);
        const judges = judgeIds.map(id => {
          const j = judgesMap.get(id);
          return { id, judgeNumber: j?.judgeNumber ?? 0, name: j?.name ?? '' };
        });

        const personResult = results.find(r => r.bib === matchingBib);
        if (!personResult) continue;

        rounds.push({
          round: heat.round,
          detailed: {
            judges,
            eventName: event.name,
            round: heat.round,
            dances: event.dances,
            style: event.style,
            level: event.level,
            results,
          },
          personResult,
        });
      }

      if (rounds.length > 0) {
        events.push({
          eventId: event.id,
          eventName: event.name,
          style: event.style,
          level: event.level,
          dances: event.dances,
          bib: matchingBib,
          partnerName,
          rounds,
        });
      }
    }

    const response: PersonResultsResponse = {
      personId: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      events,
    };

    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Public person results error');
    res.status(500).json({ error: 'Failed to load person results' });
  }
});

// GET /competitions/:id/people/:personId/heatlists — per-person heatlist (NDCA-style)
router.get('/competitions/:id/people/:personId/heatlists', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const personId = parseInt(req.params.personId);

    let competition = await dataService.getCompetitionById(competitionId);
    if (!competition || competition.publiclyVisible === false) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    competition = await applyScheduledSettings(competition);
    if (!isEffectivelyEnabled(competition.heatListsPublished, competition.heatListsPublishedAt)) {
      return res.status(403).json({ error: 'Heat lists are not yet published for this competition' });
    }

    const people = await dataService.getPeople(competitionId);
    const person = people.find(p => p.id === personId);
    if (!person || person.competitionId !== competitionId) {
      return res.status(404).json({ error: 'Person not found in this competition' });
    }

    const couples = await dataService.getCouples(competitionId);
    const personCouples = couples.filter(c => c.leaderId === personId || c.followerId === personId);
    const bibToPartner = new Map<number, string>();
    for (const c of personCouples) {
      bibToPartner.set(c.bib, c.leaderId === personId ? c.followerName : c.leaderName);
    }
    const personBibs = new Set(personCouples.map(c => c.bib));

    const schedule = await dataService.getSchedule(competitionId);
    const eventsMap = await dataService.getEvents(competitionId);

    // Build per-partner heat list from schedule
    const partnershipHeatsMap = new Map<number, PersonHeatEntry[]>();

    if (schedule) {
      let heatNumber = 0;
      for (const scheduledHeat of schedule.heatOrder) {
        if (scheduledHeat.isBreak) {
          heatNumber++;
          continue;
        }
        heatNumber++;

        for (const entry of scheduledHeat.entries) {
          const event = eventsMap[entry.eventId];
          if (!event) continue;

          // Check if person's bib is in this event's heat for this round
          const heat = event.heats.find(h => h.round === entry.round);
          if (!heat) continue;

          const scratched = new Set(event.scratchedBibs || []);
          const activeBibs = heat.bibs.filter(b => !scratched.has(b));

          // If floor heat has bibSubset, use that; otherwise use all active bibs
          const relevantBibs = entry.bibSubset || activeBibs;

          for (const bib of relevantBibs) {
            if (!personBibs.has(bib)) continue;

            let heats = partnershipHeatsMap.get(bib);
            if (!heats) { heats = []; partnershipHeatsMap.set(bib, heats); }
            heats.push({
              heatNumber,
              estimatedTime: scheduledHeat.estimatedStartTime,
              eventName: event.name,
              round: entry.round,
              dance: entry.dance,
              style: event.style,
            });
          }
        }
      }
    }

    const partnerships: PersonPartnerHeats[] = [];
    for (const [bib, heats] of partnershipHeatsMap) {
      partnerships.push({
        bib,
        partnerName: bibToPartner.get(bib) || '',
        heats,
      });
    }

    const response: PersonHeatListResponse = {
      personId: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      partnerships,
    };

    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Public person heatlist error');
    res.status(500).json({ error: 'Failed to load person heatlist' });
  }
});

// GET /competitions/:id/search?dancerName=... — search events by dancer name
router.get('/competitions/:id/search', async (req: Request, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const dancerName = (req.query.dancerName as string || '').toLowerCase().trim();
    if (!dancerName) {
      return res.status(400).json({ error: 'dancerName query parameter is required' });
    }

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const eventsMap = await dataService.getEvents(competitionId);
    const couples = await dataService.getCouples(competitionId);

    // Find couples matching the search name
    const matchingCouples = couples.filter(
      c => c.leaderName.toLowerCase().includes(dancerName) ||
           c.followerName.toLowerCase().includes(dancerName)
    );
    const matchingBibs = new Set(matchingCouples.map(c => c.bib));

    // Find events that include any matching couple
    const results = [];
    for (const event of Object.values(eventsMap)) {
      const eventBibs = new Set(event.heats.flatMap(h => h.bibs));
      const eventMatchingCouples = matchingCouples.filter(c => eventBibs.has(c.bib));

      if (eventMatchingCouples.length > 0) {
        results.push({
          ...sanitizeEvent(event),
          matchingCouples: eventMatchingCouples.map(c => ({
            bib: c.bib,
            leaderName: c.leaderName,
            followerName: c.followerName,
          })),
        });
      }
    }

    res.json(results);
  } catch (error) {
    logger.error({ err: error }, 'Public search error');
    res.status(500).json({ error: 'Failed to search events' });
  }
});

export default router;
