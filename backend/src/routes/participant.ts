import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { dataService } from '../services/dataService';
import { registerCoupleForEvent, removeEntryFromEvent } from '../services/registrationService';
import { validateEntry, getAllowedLevelsForCouple } from '../services/validationService';
import { PersonHeatEntry, PersonPartnerHeats, PersonHeatListResponse, PendingEntry } from '../types';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

const router = Router();

// GET /participant/competitions — list competitions with registrationOpen
router.get('/competitions', async (_req: AuthRequest, res: Response) => {
  try {
    const competitions = await dataService.getCompetitions();
    const open = competitions.filter(c => c.registrationOpen);
    res.json(open);
  } catch (err) {
    logger.error(err, 'Failed to load competitions');
    res.status(500).json({ error: 'Failed to load competitions' });
  }
});

// GET /participant/competitions/:id — single competition (must be registrationOpen)
router.get('/competitions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const comp = await dataService.getCompetitionById(id);
    if (!comp || !comp.registrationOpen) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(comp);
  } catch (err) {
    logger.error(err, 'Failed to load competition');
    res.status(500).json({ error: 'Failed to load competition' });
  }
});

// GET /participant/profile — all Person records linked to the current user
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const people = await dataService.getPersonsByUserId(userId);
    res.json(people);
  } catch (err) {
    logger.error(err, 'Failed to load profile');
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /participant/competitions/:id/age-categories — get available age categories for a competition
router.get('/competitions/:id/age-categories', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const comp = await dataService.getCompetitionById(id);
    if (!comp || !comp.registrationOpen) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(comp.ageCategories || []);
  } catch (err) {
    logger.error(err, 'Failed to load age categories');
    res.status(500).json({ error: 'Failed to load age categories' });
  }
});

// POST /participant/competitions/:id/register — register self as participant
router.post('/competitions/:id/register', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const userId = req.user!.uid;
    const userEmail = req.user!.email;
    const { name, email, role, status, level } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    const comp = await dataService.getCompetitionById(competitionId);
    if (!comp || !comp.registrationOpen) {
      return res.status(404).json({ error: 'Competition not found or registration closed' });
    }

    // Check if user already has a person record in this competition
    const existing = await dataService.getPersonsByUserId(userId);
    const existingInComp = existing.find(p => p.competitionId === competitionId);
    if (existingInComp) {
      return res.status(409).json({ error: 'Already registered in this competition', person: existingInComp });
    }

    // Try to claim an existing person record by email match
    const personEmail = email || userEmail;
    if (personEmail) {
      const byEmail = await dataService.getPersonByEmail(personEmail, competitionId);
      if (byEmail && !byEmail.userId) {
        // Claim this record
        const claimed = await dataService.updatePerson(byEmail.id, { userId });
        return res.json(claimed);
      }
    }

    // Create new person record
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const person = await dataService.addPerson({
      firstName,
      lastName,
      email: personEmail || undefined,
      role,
      status: status || 'student',
      level: level || undefined,
      competitionId,
      userId,
    });

    res.status(201).json(person);
  } catch (err) {
    logger.error(err, 'Failed to register');
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /participant/competitions/:id/partner — add a partner + auto-create couple
router.post('/competitions/:id/partner', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const userId = req.user!.uid;
    const { name, role, status, level } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    const comp = await dataService.getCompetitionById(competitionId);
    if (!comp || !comp.registrationOpen) {
      return res.status(404).json({ error: 'Competition not found or registration closed' });
    }

    // Find user's person record in this competition
    const userPeople = await dataService.getPersonsByUserId(userId);
    const myPerson = userPeople.find(p => p.competitionId === competitionId);
    if (!myPerson) {
      return res.status(400).json({ error: 'You must register yourself first' });
    }

    // Create partner
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const partner = await dataService.addPerson({
      firstName,
      lastName,
      role,
      status: status || 'student',
      level: level || undefined,
      competitionId,
    });

    // Determine leader/follower based on roles
    let leaderId: number;
    let followerId: number;

    if (myPerson.role === 'leader' || (myPerson.role === 'both' && (role === 'follower' || role === 'both'))) {
      leaderId = myPerson.id;
      followerId = partner.id;
    } else {
      leaderId = partner.id;
      followerId = myPerson.id;
    }

    const couple = await dataService.addCouple(leaderId, followerId, competitionId);
    if (!couple) {
      return res.status(400).json({ error: 'Failed to create couple' });
    }

    res.status(201).json({ partner, couple });
  } catch (err) {
    logger.error(err, 'Failed to add partner');
    res.status(500).json({ error: 'Failed to add partner' });
  }
});

// GET /participant/competitions/:id/my-entries — entries + schedule for current user
router.get('/competitions/:id/my-entries', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const userId = req.user!.uid;

    // Find user's person in this competition
    const userPeople = await dataService.getPersonsByUserId(userId);
    const myPerson = userPeople.find(p => p.competitionId === competitionId);
    if (!myPerson) {
      return res.json({ person: null, couples: [], entries: [], schedule: [] });
    }

    // Find couples that include this person, enriched with partner statuses
    const allCouples = await dataService.getCouples(competitionId);
    const allPeople = await dataService.getPeople(competitionId);
    const peopleMap = new Map(allPeople.map(p => [p.id, p]));
    const myCouples = allCouples
      .filter(c => c.leaderId === myPerson.id || c.followerId === myPerson.id)
      .map(c => ({
        ...c,
        leaderStatus: peopleMap.get(c.leaderId)?.status,
        followerStatus: peopleMap.get(c.followerId)?.status,
      }));

    const myBibs = new Set(myCouples.map(c => c.bib));

    // Find events containing any of my bibs
    const allEvents = await dataService.getEvents(competitionId);
    const myEvents = Object.values(allEvents).filter(event =>
      event.heats.some(heat => heat.bibs.some(bib => myBibs.has(bib)))
    );

    // Get schedule and filter to my heats
    const schedule = await dataService.getSchedule(competitionId);
    const filteredSchedule: Array<{
      heatId: string;
      estimatedStartTime?: string;
      eventId: number;
      eventName: string;
      round: string;
    }> = [];

    if (schedule) {
      for (const heat of schedule.heatOrder) {
        if (heat.isBreak) continue;
        for (const entry of heat.entries) {
          const event = await dataService.getEventById(entry.eventId);
          if (!event) continue;
          const heatData = event.heats.find(h => h.round === entry.round);
          if (heatData && heatData.bibs.some(b => myBibs.has(b))) {
            filteredSchedule.push({
              heatId: heat.id,
              estimatedStartTime: heat.estimatedStartTime,
              eventId: entry.eventId,
              eventName: event.name,
              round: entry.round,
            });
          }
        }
      }
    }

    res.json({
      person: myPerson,
      couples: myCouples,
      entries: myEvents,
      schedule: filteredSchedule,
    });
  } catch (err) {
    logger.error(err, 'Failed to load entries');
    res.status(500).json({ error: 'Failed to load entries' });
  }
});

// POST /participant/competitions/:id/entries — register couple for event combination
router.post('/competitions/:id/entries', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const userId = req.user!.uid;
    const { bib, designation, syllabusType, level, style, dances, scoringType, ageCategory } = req.body;

    if (bib === undefined) {
      return res.status(400).json({ error: 'bib is required' });
    }

    const comp = await dataService.getCompetitionById(competitionId);
    if (!comp || !comp.registrationOpen) {
      return res.status(404).json({ error: 'Competition not found or registration closed' });
    }

    // Validate ownership — bib must belong to a couple the user is part of
    const userPeople = await dataService.getPersonsByUserId(userId);
    const myPerson = userPeople.find(p => p.competitionId === competitionId);
    if (!myPerson) {
      return res.status(403).json({ error: 'Not registered in this competition' });
    }

    const couple = await dataService.getCoupleByBib(bib);
    if (!couple || (couple.leaderId !== myPerson.id && couple.followerId !== myPerson.id)) {
      return res.status(403).json({ error: 'This couple does not belong to you' });
    }

    // Validate eligibility before registering
    const validation = await validateEntry(competitionId, bib, { level, style, designation, ageCategory: req.body.ageCategory });

    if (validation.needsApproval) {
      // Add to pending entries queue instead of rejecting
      const pendingEntry: PendingEntry = {
        id: randomUUID(),
        bib,
        competitionId,
        combination: { designation, syllabusType, level, style, dances, scoringType, ageCategory },
        reason: validation.approvalReason || 'Entry requires admin approval',
        requestedAt: new Date().toISOString(),
        requestedBy: req.user!.uid,
      };

      const existingPending = comp.pendingEntries || [];
      // Check for duplicate pending entry
      const isDuplicate = existingPending.some(p =>
        p.bib === bib &&
        p.combination.level === level &&
        p.combination.style === style &&
        p.combination.designation === designation &&
        JSON.stringify(p.combination.dances) === JSON.stringify(dances)
      );
      if (isDuplicate) {
        return res.status(409).json({ error: 'This entry is already pending approval' });
      }

      await dataService.updateCompetition(competitionId, {
        pendingEntries: [...existingPending, pendingEntry],
      });

      return res.status(202).json({
        pending: true,
        pendingEntry,
        message: validation.approvalReason || 'Entry submitted for admin approval',
      });
    }

    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    const result = await registerCoupleForEvent(competitionId, bib, {
      designation, syllabusType, level, style, dances, scoringType, ageCategory,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    if (result.created) {
      return res.status(201).json({ event: result.event, created: true });
    }
    return res.json({ event: result.event, created: false });
  } catch (err) {
    logger.error(err, 'Failed to register entry');
    res.status(500).json({ error: 'Failed to register entry' });
  }
});

// DELETE /participant/competitions/:id/entries/:eventId/:bib — remove an entry
router.delete('/competitions/:id/entries/:eventId/:bib', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const eventId = parseInt(req.params.eventId);
    const bib = parseInt(req.params.bib);
    const userId = req.user!.uid;

    // Validate ownership
    const userPeople = await dataService.getPersonsByUserId(userId);
    const myPerson = userPeople.find(p => p.competitionId === competitionId);
    if (!myPerson) {
      return res.status(403).json({ error: 'Not registered in this competition' });
    }

    const couple = await dataService.getCoupleByBib(bib);
    if (!couple || (couple.leaderId !== myPerson.id && couple.followerId !== myPerson.id)) {
      return res.status(403).json({ error: 'This couple does not belong to you' });
    }

    const result = await removeEntryFromEvent(eventId, bib);
    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    res.json(result.event);
  } catch (err) {
    logger.error(err, 'Failed to remove entry');
    res.status(500).json({ error: 'Failed to remove entry' });
  }
});

// POST /participant/competitions/:id/validate — check entry eligibility
router.post('/competitions/:id/validate', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const { bib, level, designation, ageCategory } = req.body;

    if (!bib) {
      return res.status(400).json({ error: 'bib is required' });
    }

    const { style } = req.body;
    const result = await validateEntry(competitionId, bib, { level, style, designation, ageCategory });
    res.json(result);
  } catch (err) {
    logger.error(err, 'Failed to validate entry');
    res.status(500).json({ error: 'Failed to validate entry' });
  }
});

// GET /participant/competitions/:id/allowed-levels/:bib — get allowed levels for a couple
router.get('/competitions/:id/allowed-levels/:bib', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const bib = parseInt(req.params.bib);
    const userId = req.user!.uid;

    // Validate ownership
    const userPeople = await dataService.getPersonsByUserId(userId);
    const myPerson = userPeople.find(p => p.competitionId === competitionId);
    if (!myPerson) {
      return res.status(403).json({ error: 'Not registered in this competition' });
    }

    const couple = await dataService.getCoupleByBib(bib);
    if (!couple || (couple.leaderId !== myPerson.id && couple.followerId !== myPerson.id)) {
      return res.status(403).json({ error: 'This couple does not belong to you' });
    }

    const comp = await dataService.getCompetitionById(competitionId);
    if (!comp) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // If entry validation is disabled, return all levels
    if (!comp.entryValidation?.enabled) {
      return res.json({
        validationEnabled: false,
        allowedLevels: comp.levels || [],
        coupleLevel: null,
        allLevels: comp.levels || [],
      });
    }

    // Optional style filter from query string
    const style = req.query.style as string | undefined;

    const { levels, coupleLevel } = await getAllowedLevelsForCouple(
      competitionId,
      bib,
      style,
    );

    res.json({
      validationEnabled: true,
      allowedLevels: levels,
      coupleLevel,
      allLevels: comp.levels || [],
    });
  } catch (err) {
    logger.error(err, 'Failed to get allowed levels');
    res.status(500).json({ error: 'Failed to get allowed levels' });
  }
});

// GET /participant/competitions/:id/people/:personId/heatlists — person heat list (any authenticated user)
router.get('/competitions/:id/people/:personId/heatlists', async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    const personId = parseInt(req.params.personId);

    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const people = await dataService.getPeople(competitionId);
    const person = people.find(p => p.id === personId);
    if (!person) {
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

          const heat = event.heats.find(h => h.round === entry.round);
          if (!heat) continue;

          const scratched = new Set(event.scratchedBibs || []);
          const activeBibs = heat.bibs.filter(b => !scratched.has(b));
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
    logger.error({ err: error }, 'Person heatlist error');
    res.status(500).json({ error: 'Failed to load person heatlist' });
  }
});

export default router;
