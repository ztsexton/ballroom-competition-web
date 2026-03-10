import { dataService } from './dataService';
import logger from '../utils/logger';

export interface BackupData {
  version: 1;
  createdAt: string;
  dataStore: string;
  competitions: Awaited<ReturnType<typeof dataService.getCompetitions>>;
  users: Awaited<ReturnType<typeof dataService.getUsers>>;
  studios: Awaited<ReturnType<typeof dataService.getStudios>>;
  organizations: Awaited<ReturnType<typeof dataService.getOrganizations>>;
  judgeProfiles: Awaited<ReturnType<typeof dataService.getJudgeProfiles>>;
  siteSettings: Awaited<ReturnType<typeof dataService.getSiteSettings>>;
  competitionData: Record<number, {
    people: Awaited<ReturnType<typeof dataService.getPeople>>;
    couples: Awaited<ReturnType<typeof dataService.getCouples>>;
    judges: Awaited<ReturnType<typeof dataService.getJudges>>;
    events: Awaited<ReturnType<typeof dataService.getEvents>>;
    schedule: Awaited<ReturnType<typeof dataService.getSchedule>>;
    admins: Awaited<ReturnType<typeof dataService.getCompetitionAdmins>>;
    scores: Record<string, number[]>;
    judgeScores: Record<string, Record<number, number>>;
  }>;
}

/**
 * Export all application data as a single JSON-serializable object.
 * Works with both JSON and PostgreSQL backends via the data service interface.
 */
export async function exportAllData(): Promise<BackupData> {
  logger.info('Starting full data export');

  const [competitions, users, studios, organizations, judgeProfiles, siteSettings] = await Promise.all([
    dataService.getCompetitions(),
    dataService.getUsers(),
    dataService.getStudios(),
    dataService.getOrganizations(),
    dataService.getJudgeProfiles(),
    dataService.getSiteSettings(),
  ]);

  const competitionData: BackupData['competitionData'] = {};

  for (const comp of competitions) {
    const [people, couples, judges, eventsMap, schedule, admins] = await Promise.all([
      dataService.getPeople(comp.id),
      dataService.getCouples(comp.id),
      dataService.getJudges(comp.id),
      dataService.getEvents(comp.id),
      dataService.getSchedule(comp.id),
      dataService.getCompetitionAdmins(comp.id),
    ]);

    const scores: Record<string, number[]> = {};
    const judgeScores: Record<string, Record<number, number>> = {};
    const events = Object.values(eventsMap);

    for (const event of events) {
      for (const heat of event.heats) {
        const dances = event.dances && event.dances.length > 0 ? event.dances : [undefined];
        for (const dance of dances) {
          const danceKey = dance || '_';
          for (const bib of heat.bibs) {
            const key = `${event.id}:${heat.round}:${bib}:${danceKey}`;
            const s = await dataService.getScores(event.id, heat.round, bib, dance);
            if (s.length > 0) scores[key] = s;
            const js = await dataService.getJudgeScores(event.id, heat.round, bib, dance);
            if (Object.keys(js).length > 0) judgeScores[key] = js;
          }
        }
      }
    }

    competitionData[comp.id] = {
      people,
      couples,
      judges,
      events: eventsMap,
      schedule: schedule || null as unknown as undefined,
      admins,
      scores,
      judgeScores,
    };
  }

  logger.info({ competitionCount: competitions.length }, 'Full data export complete');

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    dataStore: process.env.DATA_STORE || 'json',
    competitions,
    users,
    studios,
    organizations,
    judgeProfiles,
    siteSettings,
    competitionData,
  };
}

/**
 * Import backup data, replacing all existing data.
 * Works by resetting then re-creating everything through the data service.
 */
export async function importAllData(backup: BackupData): Promise<{ competitionsRestored: number; usersRestored: number }> {
  logger.info({ version: backup.version, createdAt: backup.createdAt }, 'Starting full data restore');

  // Clear existing data
  await dataService.resetAllData();

  // Restore site settings
  if (backup.siteSettings) {
    await dataService.updateSiteSettings(backup.siteSettings);
  }

  // Restore studios
  for (const studio of backup.studios || []) {
    const { id: _id, ...rest } = studio;
    await dataService.addStudio(rest);
  }

  // Restore organizations
  for (const org of backup.organizations || []) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = org;
    await dataService.addOrganization(rest);
  }

  // Restore judge profiles
  for (const profile of backup.judgeProfiles || []) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = profile;
    await dataService.addJudgeProfile(rest);
  }

  // Restore users
  for (const user of backup.users || []) {
    await dataService.upsertUser(
      user.uid,
      user.email,
      user.displayName || undefined,
      user.photoURL || undefined,
      user.signInMethods?.[0],
    );
    if (user.isAdmin) {
      await dataService.updateUserAdmin(user.uid, true);
    }
    // Restore profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (user.firstName) profileUpdate.firstName = user.firstName;
    if (user.lastName) profileUpdate.lastName = user.lastName;
    if (user.phone) profileUpdate.phone = user.phone;
    if (user.city) profileUpdate.city = user.city;
    if (user.stateRegion) profileUpdate.stateRegion = user.stateRegion;
    if (user.country) profileUpdate.country = user.country;
    if (user.studioTeamName) profileUpdate.studioTeamName = user.studioTeamName;
    if (Object.keys(profileUpdate).length > 0) {
      await dataService.updateUserProfile(user.uid, profileUpdate);
    }
  }

  // Restore competitions and per-competition data
  for (const comp of backup.competitions || []) {
    const { id: _id, createdAt: _c, ...compRest } = comp;
    const newComp = await dataService.addCompetition(compRest);
    const compData = backup.competitionData?.[comp.id];
    if (!compData) continue;

    // Restore people
    const personIdMap = new Map<number, number>(); // old ID → new ID
    for (const person of compData.people || []) {
      const { id: oldId, ...rest } = person;
      rest.competitionId = newComp.id;
      const newPerson = await dataService.addPerson(rest);
      personIdMap.set(oldId, newPerson.id);
    }

    // Restore couples (remap person IDs)
    const bibMap = new Map<number, number>(); // old bib → new bib
    for (const couple of compData.couples || []) {
      const newLeaderId = personIdMap.get(couple.leaderId) ?? couple.leaderId;
      const newFollowerId = personIdMap.get(couple.followerId) ?? couple.followerId;
      const newCouple = await dataService.addCouple(newLeaderId, newFollowerId, newComp.id);
      if (newCouple) {
        bibMap.set(couple.bib, newCouple.bib);
      }
    }

    // Restore judges
    const judgeIdMap = new Map<number, number>();
    for (const judge of compData.judges || []) {
      const { id: oldId, ...rest } = judge;
      rest.competitionId = newComp.id;
      const newJudge = await dataService.addJudge(rest.name, newComp.id);
      judgeIdMap.set(oldId, newJudge.id);
      const updates: Record<string, unknown> = {};
      if (rest.judgeNumber) updates.judgeNumber = rest.judgeNumber;
      if (rest.isChairman) updates.isChairman = rest.isChairman;
      if (rest.profileId) updates.profileId = rest.profileId;
      if (Object.keys(updates).length > 0) {
        await dataService.updateJudge(newJudge.id, updates);
      }
    }

    // Restore events
    const eventIdMap = new Map<number, number>();
    const eventsArr = Object.values(compData.events || {});
    for (const event of eventsArr) {
      const remappedBibs = (event.heats[0]?.bibs || []).map(b => bibMap.get(b) ?? b);
      const remappedJudges = (event.heats[0]?.judges || []).map(j => judgeIdMap.get(j) ?? j);
      const newEvent = await dataService.addEvent(
        event.name,
        remappedBibs,
        remappedJudges,
        newComp.id,
        event.designation,
        event.syllabusType,
        event.level,
        event.style,
        event.dances,
        event.scoringType,
        event.isScholarship,
        event.ageCategory,
      );
      eventIdMap.set(event.id, newEvent.id);
      // Restore scratched bibs
      if (event.scratchedBibs?.length) {
        const remappedScratched = event.scratchedBibs.map(b => bibMap.get(b) ?? b);
        await dataService.updateEvent(newEvent.id, { scratchedBibs: remappedScratched });
      }
    }

    // Restore scores
    for (const [key, scoreValues] of Object.entries(compData.scores || {})) {
      const [eventIdStr, round, bibStr, dance] = key.split(':');
      const newEventId = eventIdMap.get(parseInt(eventIdStr)) ?? parseInt(eventIdStr);
      const newBib = bibMap.get(parseInt(bibStr)) ?? parseInt(bibStr);
      await dataService.setScores(newEventId, round, newBib, scoreValues, dance === '_' ? undefined : dance);
    }

    // Restore judge scores
    for (const [key, judgeScoreMap] of Object.entries(compData.judgeScores || {})) {
      const [eventIdStr, round, bibStr, dance] = key.split(':');
      const newEventId = eventIdMap.get(parseInt(eventIdStr)) ?? parseInt(eventIdStr);
      const newBib = bibMap.get(parseInt(bibStr)) ?? parseInt(bibStr);
      for (const [judgeIdStr, score] of Object.entries(judgeScoreMap)) {
        const newJudgeId = judgeIdMap.get(parseInt(judgeIdStr)) ?? parseInt(judgeIdStr);
        await dataService.setJudgeScoresBatch(
          newEventId, round, newJudgeId,
          [{ bib: newBib, score: score as number }],
          dance === '_' ? undefined : dance,
        );
      }
    }

    // Restore competition admins
    for (const admin of compData.admins || []) {
      await dataService.addCompetitionAdmin(newComp.id, admin.userUid, admin.role);
    }

    // Restore schedule
    if (compData.schedule) {
      const scheduleData = { ...compData.schedule, competitionId: newComp.id };
      await dataService.saveSchedule(scheduleData);
    }
  }

  dataService.clearCache();

  const result = {
    competitionsRestored: backup.competitions?.length || 0,
    usersRestored: backup.users?.length || 0,
  };
  logger.info(result, 'Full data restore complete');
  return result;
}
