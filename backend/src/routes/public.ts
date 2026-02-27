import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { Competition, Event, DetailedResultsResponse } from '../types';
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
        .filter(c => c.date < today)
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

    // Return events with heat details (bibs + couple names), excluding scratched
    const events = Object.values(eventsMap).map(event => {
      const eventScratched = new Set(event.scratchedBibs || []);
      return {
        ...sanitizeEvent(event),
        heats: event.heats.map(heat => ({
          round: heat.round,
          couples: heat.bibs
            .filter(bib => !eventScratched.has(bib))
            .map(bib => {
              const couple = couplesByBib.get(bib);
              return {
                bib,
                leaderName: couple?.leaderName || '',
                followerName: couple?.followerName || '',
              };
            }),
        })),
      };
    });

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
