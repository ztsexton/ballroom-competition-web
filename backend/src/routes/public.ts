import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { scoringService } from '../services/scoringService';
import { Competition, Event } from '../types';

const router = Router();

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
    registrationOpen: comp.registrationOpen || false,
  };
}

function sanitizeEvent(event: Event) {
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
    coupleCount: event.heats[0]?.bibs.length ?? 0,
  };
}

// GET /competitions — list all competitions (optionally filtered by scope)
router.get('/competitions', async (_req: Request, res: Response) => {
  try {
    const scope = _req.query.scope as string | undefined;
    const competitions = await dataService.getCompetitions();
    const today = new Date().toISOString().split('T')[0];

    // Only show competitions where publiclyVisible is true (or undefined for backwards compat)
    let filtered = competitions.filter(c => c.publiclyVisible !== false);
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
    console.error('Public competitions error:', error);
    res.status(500).json({ error: 'Failed to load competitions' });
  }
});

// GET /competitions/:id — single competition
router.get('/competitions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const competition = await dataService.getCompetitionById(id);
    if (!competition || competition.publiclyVisible === false) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(sanitizeCompetition(competition));
  } catch (error) {
    console.error('Public competition error:', error);
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
    console.error('Public events error:', error);
    res.status(500).json({ error: 'Failed to load events' });
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
    res.json(results);
  } catch (error) {
    console.error('Public results error:', error);
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
    console.error('Public search error:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

export default router;
